(function(root){
 'use strict';
 const Pricing=typeof module!=='undefined'?require('./price-model.js'):root.PriceModel;
 const PYEONG=400/121,clone=x=>JSON.parse(JSON.stringify(x));
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const CATALOG={
  bench:{name:'작업대',group:'work',layer:'floor',w:1.5,d:.7,support:true,note:'장비를 올리는 스테인리스 상판',source:'https://mrkc.kr/category/스텐기구/27'},
  sink:{name:'싱크대',group:'work',layer:'floor',w:1.2,d:.6,note:'세척 구역 · 급수·배수 확인',water:true,source:'https://mrkc.kr/category/스텐기구/27'},
  fridge:{name:'테이블 냉장고',group:'cold',layer:'floor',w:1.2,d:.7,front:.5,note:'우유·재료 보관 · 문 열림 여유',power:true,source:'http://woosunginc.co.kr/shop/list-202030'},
  ice:{name:'제빙기',group:'cold',layer:'floor',w:.55,d:.6,front:.4,note:'급수·배수·통풍 확인',water:true,power:true,source:'https://www.woosunginc.co.kr/shop/list-4060'},
  freezer:{name:'냉동고',group:'cold',layer:'floor',w:.7,d:.7,front:.5,note:'냉동 과일·생지 보관',power:true,source:'http://woosunginc.co.kr/shop/list-202030'},
  rack:{name:'수납 선반',group:'work',layer:'floor',w:.9,d:.45,note:'컵·도구를 보관하는 바닥형 선반',source:'https://mrkc.kr/category/스텐기구/27'},
  dishwasher:{name:'식기세척기',group:'work',layer:'floor',w:.6,d:.65,front:.55,note:'세척 방식에 따라 선택 · 급배수 확인',water:true,power:true,source:'http://woosunginc.co.kr/shop/list-5010'},
  showcase:{name:'디저트 쇼케이스',group:'menu',layer:'floor',w:.9,d:.55,front:.4,note:'디저트 진열 · 냉장 여부는 모델별 확인',power:true,source:'https://www.woosunginc.co.kr/shop/list-301010'},
  bin:{name:'수거함',group:'work',layer:'floor',w:.35,d:.35,note:'커피 찌꺼기·일반 쓰레기 수거 위치'},
  machine:{name:'에스프레소 머신',group:'coffee',layer:'counter',w:.71,d:.59,real:true,note:'Linea PB 2그룹 예시 · 710×590mm · 4,600W',water:true,power:true,source:'https://lamarzoccokorea.co.kr/another/product/179.html'},
  grinder:{name:'그라인더',group:'coffee',layer:'counter',w:.195,d:.283,real:true,note:'E65S 예시 · 195×283mm · 호퍼 상부 여유',power:true,source:'https://www.mahlkoenig.com/products/e65s'},
  filter:{name:'정수필터',group:'coffee',layer:'wall',w:.3,d:.2,note:'벽·하부장 부속 · 필터 교체 공간 확인',water:true,source:'https://everpure.kr/goods/goods_list.php?cateCd=001'},
  blender:{name:'블렌더',group:'menu',layer:'counter',w:.25,d:.3,note:'스무디·프라페 · 용기 탈착 여유',power:true,source:'https://www.woosunginc.co.kr/shop/list-4060'},
  boiler:{name:'온수기',group:'coffee',layer:'counter',w:.3,d:.4,note:'별도 온수 공급이 필요할 때',power:true,source:'https://www.woosunginc.co.kr/shop/list-4060'},
  oven:{name:'소형 오븐',group:'menu',layer:'counter',w:.6,d:.55,note:'직접 굽는 메뉴 · 열·환기·전력 확인',power:true,source:'https://www.woosunginc.co.kr/shop/list-4060'},
  rinser:{name:'피처린서',group:'work',layer:'counter',w:.2,d:.3,note:'매립·거치 방식과 급배수 확인',water:true,source:'https://www.pocoffee.co.kr/shot_glass'},
  tools:{name:'바리스타 도구',group:'coffee',layer:'counter',w:.4,d:.25,note:'저울·탬퍼·넉박스·밀크피처 묶음',source:'https://www.dhcoffeemall.com/shop/list.php?ca_id=i0'},
  drip:{name:'드립 도구',group:'menu',layer:'counter',w:.4,d:.3,note:'드리퍼·서버·포트·필터 묶음',source:'https://www.caffemuseo.co.kr/goods/goods_list.php?cateCd=020'}
 };
 const SUPPLIES={hotCup:{name:'뜨거운 음료 컵',share:50,pack:6},coldGlass:{name:'차가운 음료 잔',share:50,pack:6},plate:{name:'디저트 접시',share:30,pack:6},spoon:{name:'티스푼',share:50,pack:6}};
 function fresh(area,width){const s={schemaVersion:1,areaSqm:area,width:width||Math.round(Math.sqrt(area/1.3)*10)/10,kitchenArea:area*.25,aisle:.9,workers:1,areaMode:'recommended',layoutMode:'manual',items:[],nextId:1,menus:{milk:true,iced:true,smoothie:false,bake:false,drip:false,dessert:false},stock:{seats:20,peak:40,dineIn:60,washMinutes:20,reserve:20,rows:Object.fromEntries(Object.entries(SUPPLIES).map(([k,v])=>[k,{share:v.share,pack:v.pack,owned:0,buy:null}]))},small:{pitcher:3,tamper:1,scale:1,brush:2,scoop:1,cloth:8},prices:{}};const r=recommend(s);if(r.feasible){s.kitchenArea=r.area;s.aisle=r.aisle;}else s.areaMode='manual';return s;}
 // Transparent planning scenario, not a measured optimum or installation certification.
 function recommend(s){
  const workers=s.workers??1,aisle=Math.min(1.6,.9+(workers-1)*.2),margin=.1;
  const planned=s.items.map(i=>({...size(i),type:i.type,existing:true})),missing=[];
  const required=['bench','sink','machine','grinder','tools','filter',...(s.menus.milk?['fridge']:[]),...(s.menus.iced?['ice']:[]),...(s.menus.smoothie?['blender','freezer']:[]),...(s.menus.bake?['oven']:[]),...(s.menus.drip?['drip']:[]),...(s.menus.dessert?['showcase']:[])];
  for(const type of required)if(!planned.some(i=>i.type===type)){const c=CATALOG[type];planned.push({type,w:c.w,d:c.d,existing:false});missing.push(type);}
  const counter=planned.filter(i=>CATALOG[i.type].layer==='counter');
  const surface=counter.reduce((sum,i)=>sum+i.w*i.d,0),prep=workers*.6*.7;
  const supports=planned.filter(i=>CATALOG[i.type].support),existingSurface=supports.reduce((sum,i)=>sum+i.w*i.d,0);
  const benchW=Math.max(1.5,...counter.map(i=>i.w)),benchD=Math.max(.7,...counter.map(i=>i.d));
  let extraBenches=Math.max(0,Math.ceil((surface+prep-existingSurface-1e-7)/(benchW*benchD)));
  if(counter.some(i=>!supports.some(b=>b.w>=i.w&&b.d>=i.d)))extraBenches=Math.max(1,extraBenches);
  for(let k=0;k<extraBenches;k++)planned.push({type:'bench',w:benchW,d:benchD,existing:false});
  const floor=planned.filter(i=>CATALOG[i.type].layer==='floor').map(i=>({...i,depth:i.d+(CATALOG[i.type].front||0)})).sort((a,b)=>b.depth-a.depth||b.w-a.w);
  const tooWide=floor.filter(i=>i.w>s.width-2*margin+1e-7).map(i=>CATALOG[i.type].name);
  const rows=[];for(const i of floor){let row=rows.find(r=>r.used+i.w+margin<=s.width-margin+1e-7);if(!row){row={used:margin,depth:0};rows.push(row);}row.used+=i.w+margin;row.depth=Math.max(row.depth,i.depth);}
  const packedDepth=margin+rows.reduce((sum,r)=>sum+r.depth+aisle,0);
  const shaped=['facing','l'].includes(s.layoutPlan?.kind);
  const placedDepth=s.items.reduce((max,i)=>{const b=box(i),f=front(i),a=shaped&&CATALOG[i.type].layer==='floor'?workArea(i,aisle):null;return Math.max(max,b.y+b.d+(shaped?0:CATALOG[i.type].layer==='floor'?aisle:0),a?a.y+a.d:0,f?f.y+f.d+(shaped?0:aisle):0);},0)+(shaped?.1:0);
  const packedArea=s.width*packedDepth,placedArea=s.width*placedDepth;
  // Complete, supported equipment already has a concrete footprint. A rough packing
  // estimate must not inflate a layout that has been checked at its actual positions.
  const complete=!missing.length&&!extraBenches&&s.items.length>0;
  const area=Math.ceil(((complete?placedArea:Math.max(packedArea,placedArea))-1e-7)*10)/10;
  const feasible=!tooWide.length&&area<=s.areaSqm-.1&&s.areaSqm/s.width>=1&&s.areaSqm/s.width<=100;
  return {version:'equipment-staff-v2',area,aisle,workers,feasible,tooWide,shortfall:Math.max(0,area-(s.areaSqm-.1)),percent:area/s.areaSqm*100,guestArea:s.areaSqm-area,missing,extraBenches,benchW,benchD,equipmentCount:planned.length,placedCount:s.items.length,floorArea:floor.reduce((sum,i)=>sum+i.w*i.d,0),counterSurface:surface,prepSurface:prep,rowCount:rows.length,packedArea,placedArea,complete,layoutDriven:placedArea>packedArea+.01};
 }
 function applyRecommendation(s){const result=recommend(s);if(!result.feasible)return {ok:false,state:s,result};const n=clone(s);n.workers=s.workers??1;n.areaMode='recommended';n.kitchenArea=result.area;n.aisle=result.aisle;return {ok:true,state:n,result};}
 function dims(s){return {w:s.width,d:s.areaSqm/s.width,k:s.kitchenArea/s.width};}
 function size(i){return i.rot%180?{w:i.d,d:i.w}:{w:i.w,d:i.d};}
 function box(i){return {...size(i),x:i.x,y:i.y};}
 function overlap(a,b){return a.x<b.x+b.w-1e-7&&a.x+a.w>b.x+1e-7&&a.y<b.y+b.d-1e-7&&a.y+a.d>b.y+1e-7;}
 function contains(a,b){return b.x>=a.x-1e-7&&b.y>=a.y-1e-7&&b.x+b.w<=a.x+a.w+1e-7&&b.y+b.d<=a.y+a.d+1e-7;}
 function front(i){const b=box(i),v=CATALOG[i.type].front||0;if(!v)return null;if(i.rot===0)return {x:b.x,y:b.y+b.d,w:b.w,d:v};if(i.rot===90)return {x:b.x-v,y:b.y,w:v,d:b.d};if(i.rot===180)return {x:b.x,y:b.y-v,w:b.w,d:v};return {x:b.x+b.w,y:b.y,w:v,d:b.d};}
 function workArea(i,aisle){const b=box(i),v=CATALOG[i.type].front||0;if(i.rot===0)return {x:b.x,y:b.y+b.d+v,w:b.w,d:aisle};if(i.rot===90)return {x:b.x-v-aisle,y:b.y,w:aisle,d:b.d};if(i.rot===180)return {x:b.x,y:b.y-v-aisle,w:b.w,d:aisle};return {x:b.x+b.w+v,y:b.y,w:aisle,d:b.d};}
 function lanes(s){const p=s.layoutPlan;if(!p)return [];return [...p.guides,{...p.side,d:Math.max(0,dims(s).k-p.side.y)}];}
 function circulationIssues(s){
  if(!['facing','l'].includes(s.layoutPlan?.kind))return [];
  const ls=lanes(s),room={x:0,y:0,w:s.width,d:dims(s).k},floor=s.items.filter(i=>CATALOG[i.type].layer==='floor'),errors=[];
  if(ls.some(l=>!contains(room,l)||Math.min(l.w,l.d)<s.aisle-1e-7))errors.push('연결 통로 폭·경계 확인');
  if(ls.some(l=>floor.some(i=>overlap(l,box(i))||(front(i)&&overlap(l,front(i))))))errors.push('연결 통로에 장비·문 여유 침범');
  // Lane rectangles must share an opening at least as wide as the specified aisle.
  const connected=(a,b)=>{const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.d,b.y+b.d)-Math.max(a.y,b.y);return x>=-1e-7&&y>=-1e-7&&Math.max(x,y)>=s.aisle-1e-7;};
  const seen=new Set([ls.length-1]);for(let pass=0;pass<ls.length;pass++)ls.forEach((l,k)=>{if([...seen].some(j=>connected(l,ls[j])))seen.add(k);});
  if(seen.size!==ls.length)errors.push('객석까지 통로 연결 확인');
  return errors;
 }
 function issues(s,i){
  const c=CATALOG[i.type],d=dims(s),b=box(i),errors=[];
  if(!contains({x:0,y:0,w:d.w,d:d.k},b))errors.push('주방 경계 밖');
  const shaped=['facing','l'].includes(s.layoutPlan?.kind);
  if(c.layer==='floor'&&!shaped&&b.y+b.d>d.k-s.aisle+1e-7)errors.push('작업 통로 침범');
  if(c.layer==='counter'){
   const host=s.items.find(j=>j.id===i.supportId&&CATALOG[j.type].support);
   if(!host||!contains(box(host),b))errors.push('작업대 위에 놓아주세요');
  }
  for(const j of s.items){if(i.id===j.id||CATALOG[j.type].layer!==c.layer)continue;if(overlap(b,box(j))){errors.push('같은 높이의 장비와 겹침');break;}}
  if(c.layer==='floor'){
   const f=front(i);
   if(f&&!contains({x:0,y:0,w:d.w,d:d.k},f))errors.push('문·작업 여유가 주방 밖');
   if(s.items.some(j=>j.id!==i.id&&CATALOG[j.type].layer==='floor'&&((f&&overlap(f,box(j)))||(front(j)&&overlap(b,front(j))))))errors.push('문·작업 여유에 다른 장비');
   if(shaped){const a=workArea(i,s.aisle),ls=lanes(s);
    if(!contains({x:0,y:0,w:d.w,d:d.k},a)||!ls.some(l=>overlap(l,a)))errors.push('장비 정면 작업 통로 부족');
    if(s.items.some(j=>j.id!==i.id&&CATALOG[j.type].layer==='floor'&&(overlap(a,box(j))||(front(j)&&overlap(a,front(j)))||overlap(b,workArea(j,s.aisle))||(f&&overlap(f,workArea(j,s.aisle))))))errors.push('장비 정면 작업 공간 침범');
   }
  }
  if(shaped)errors.push(...circulationIssues(s));
  return [...new Set(errors)];
 }
 function invalid(s){return s.items.filter(i=>issues(s,i).length);}
 function attach(s,item){if(CATALOG[item.type].layer!=='counter')return item;const host=s.items.find(j=>CATALOG[j.type].support&&contains(box(j),box(item)));return {...item,supportId:host?.id??null};}
 function candidate(s,type){
  if(!CATALOG[type]||s.items.length>=80)return null;
  const c=CATALOG[type],d=dims(s),i={id:s.nextId,type,x:0,y:0,w:c.w,d:c.d,rot:0,supportId:null};
  const zones=c.layer==='counter'?s.items.filter(j=>CATALOG[j.type].support).map(box):[{x:.05,y:.05,w:d.w-.1,d:d.k-.1}];
  for(const z of zones){for(let y=z.y;y<=z.y+z.d-i.d+1e-7;y+=.05){for(let x=z.x;x<=z.x+z.w-i.w+1e-7;x+=.05){const next=attach(s,{...i,x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000});if(!issues(s,next).length)return next;}}}
  return null;
 }
 function add(s,type){
  if(!CATALOG[type]||s.items.length>=80)return false;
  const n=clone(s),c=CATALOG[type];
  if(n.areaMode==='recommended'){const trial=clone(n);trial.items.push({id:n.nextId,type,w:c.w,d:c.d,x:0,y:0,rot:0,supportId:null});const r=recommend(trial);if(!r.feasible)return false;n.kitchenArea=r.area;n.aisle=r.aisle;}
  const i=candidate(n,type);if(!i)return false;n.items.push(i);n.nextId++;Object.assign(s,n);return true;
 }
 function transform(s,id,changes){
  const n=clone(s),i=n.items.find(i=>i.id===id);if(!i)return {ok:false,reason:'장비를 선택하세요'};
  const children=n.items.filter(j=>j.supportId===id);
  if(children.length&&['rot','w','d'].some(k=>changes[k]!==undefined&&changes[k]!==i[k]))return {ok:false,reason:'작업대 위 장비를 다른 곳으로 옮긴 뒤 크기·방향을 바꿔주세요.'};
  const old={...i};Object.assign(i,changes);Object.assign(i,attach(n,i));
  for(const j of children){j.x+=i.x-old.x;j.y+=i.y-old.y;}
  if(n.areaMode==='recommended'){const r=recommend(n);if(!r.feasible)return {ok:false,reason:'변경한 장비에 필요한 주방 면적이 매장에 들어가지 않아요.',state:n};n.kitchenArea=r.area;n.aisle=r.aisle;}
  const changed=[i,...children],errs=changed.flatMap(j=>issues(n,j));
  // Moving a support also changes which floor objects meet its clearance.
  if(errs.length)return {ok:false,reason:[...new Set(errs)].join(' · '),state:n};
  return {ok:true,state:n};
 }
 function remove(s,id){s.items=s.items.filter(i=>i.id!==id&&i.supportId!==id);}
 function starter(s){const n=clone(s);n.items=[];n.nextId=1;const missed=[];
  const types=['bench','sink',...(s.menus.milk?['fridge']:[]),...(s.menus.iced?['ice']:[]),'machine','grinder','tools','filter',...(s.menus.smoothie?['bench','blender','freezer']:[]),...(s.menus.bake?['bench','oven']:[]),...(s.menus.drip?['drip']:[]),...(s.menus.dessert?['showcase']:[])];
  for(const type of types)if(!add(n,type))missed.push(CATALOG[type].name);
  return {state:n,missed};
 }
 // Bounded deterministic search over orientations, row assignments and three orders.
 // A rotated preparation bench seals its row: its long working edge stays reachable
 // from the right-hand aisle. Appliances with doors and loaded stations keep facing
 // the horizontal service aisle; rotation is never a shortcut around clearance.
 function layoutAlternatives(blocks,width,aisle){
  const right=width-aisle-.1,depth=p=>.1+p.rows.reduce((sum,r)=>sum+r.depth+aisle,0);
  const score=(a,b)=>depth(a)-depth(b)||a.rotations-b.rotations||a.rows.length-b.rows.length;
  const orders=[blocks,[...blocks].sort((a,b)=>(b.d+(CATALOG[b.type].front||0))-(a.d+(CATALOG[a.type].front||0))),[...blocks].sort((a,b)=>b.w-a.w)];
  const alternatives=[];
  for(let order=0;order<orders.length;order++){
   let beam=[{rows:[],rotations:0}];
   for(const b of orders[order]){
    const next=[],rotations=b.type==='bench'&&!b.children.length&&b.w!==b.d?[0,90]:[0];
    for(const p of beam)for(const rot of rotations){const w=rot?b.d:b.w,d=(rot?b.w:b.d)+(CATALOG[b.type].front||0);if(w>right-.1+1e-7)continue;
     for(let k=0;k<=p.rows.length;k++){const old=p.rows[k]||{x:.1,depth:0,blocks:[],sealed:false};if(old.sealed||old.x+w>right+1e-7)continue;
      const row={x:old.x+w+.1,depth:Math.max(old.depth,d),blocks:[...old.blocks,{...b,x:old.x,rot}],sealed:rot===90};
      const rows=p.rows.slice();rows[k]=row;next.push({rows,rotations:p.rotations+(rot?1:0)});
     }
    }
    next.sort(score);beam=next.slice(0,64);if(!beam.length)break;
   }
   alternatives.push(...beam.map(p=>({...p,strategy:order,depth:depth(p)})));
  }
  // Always retain the old, non-rotating layout as a quality baseline.
  const baseline={rows:[],rotations:0,strategy:3};
  for(const b of blocks){if(b.w>right-.1+1e-7){baseline.invalid=true;break;}let row=baseline.rows.at(-1);if(!row||row.x+b.w>right+1e-7){row={x:.1,depth:0,blocks:[]};baseline.rows.push(row);}row.blocks.push({...b,x:row.x,rot:0});row.x+=b.w+.1;row.depth=Math.max(row.depth,b.d+(CATALOG[b.type].front||0));}
  if(!baseline.invalid){baseline.depth=depth(baseline);alternatives.push(baseline);}
  alternatives.sort((a,b)=>score(a,b)||a.strategy-b.strategy);
  const seen=new Set(),unique=alternatives.filter(p=>{const key=JSON.stringify(p.rows.map(r=>r.blocks.map(b=>[b.zone,b.type,b.rot,b.x])));if(seen.has(key))return false;seen.add(key);return true;});
  return {alternatives:unique,baselineArea:baseline.invalid?null:Math.ceil((width*baseline.depth-1e-7)*10)/10};
 }
 // Compare two opposed banks and two perpendicular banks. A whole station may
 // turn 180/270 degrees: its appliances, working face and door envelope turn too.
 // Partitions preserve menu order within each bank; this is bounded, not exhaustive.
 function shapedAlternatives(blocks,width,aisle){
  const result=[],length=bs=>bs.reduce((sum,b)=>sum+b.w+.1,0)-.1,envelope=bs=>Math.max(...bs.map(b=>b.d+(CATALOG[b.type].front||0)));
  for(let mask=1;mask<(1<<blocks.length)-1;mask++){
   const top=blocks.filter((_,k)=>mask&(1<<k)),other=blocks.filter((_,k)=>!(mask&(1<<k))),td=envelope(top),od=envelope(other),tl=length(top),ol=length(other);
   if(Math.max(tl,ol)<=width-aisle-.2+1e-7){
    const placements=[];let x=.1;for(const b of top){placements.push({...b,x,y:.1+td-b.d-(CATALOG[b.type].front||0),rot:0});x+=b.w+.1;}
    x=.1;for(const b of other){placements.push({...b,x,y:.1+td+aisle+(CATALOG[b.type].front||0),rot:180});x+=b.w+.1;}
    result.push({kind:'facing',placements,rows:2,depth:.2+td+aisle+od,rotations:other.length,guides:[{x:.1,y:.1+td,w:width-.1,d:aisle}],side:{x:width-aisle,y:0,w:aisle}});
   }
   if(tl<=width-od-.3+1e-7&&width-od-.1>=aisle-1e-7){
    const placements=[];let x=od+.2;for(const b of top){placements.push({...b,x,y:.1+td-b.d-(CATALOG[b.type].front||0),rot:0});x+=b.w+.1;}
    let y=td+.2;for(const b of other){placements.push({...b,x:.1+od-b.d-(CATALOG[b.type].front||0),y,rot:270});y+=b.w+.1;}
    const depth=Math.max(.1+td+aisle,td+.2+ol)+.1;
    result.push({kind:'l',placements,rows:2,depth,rotations:other.length,guides:[{x:.1+od,y:.1+td,w:width-.1-od,d:aisle}],side:{x:.1+od,y:.1+td,w:aisle}});
   }
  }
  return result.sort((a,b)=>a.depth-b.depth||a.rotations-b.rotations);
 }
 // Keep the two outer L banks, but compare moving empty preparation benches
 // into the unused inner space. A bench faces the top aisle (180) or left aisle
 // (90); both retain the full shared aisle, not just a sliver of access.
 function insetLAlternatives(blocks,width,aisle){
  const prep=blocks.filter(b=>b.type==='bench'&&!b.children.length),result=[];
  const length=bs=>bs.reduce((sum,b)=>sum+b.w+.1,0)-.1;
  const envelope=bs=>Math.max(...bs.map(b=>b.d+(CATALOG[b.type].front||0)));
  for(let choice=1;choice<(1<<prep.length);choice++){
   const inner=prep.filter((_,k)=>choice&(1<<k)),outer=blocks.filter(b=>!inner.includes(b));
   for(let mask=1;mask<(1<<outer.length)-1;mask++){
    const top=outer.filter((_,k)=>mask&(1<<k)),left=outer.filter((_,k)=>!(mask&(1<<k)));
    const td=envelope(top),ld=envelope(left),tl=length(top),ll=length(left);
    if(tl>width-ld-.3+1e-7||width-ld-.1<aisle-1e-7)continue;
    const placements=[];let x=ld+.2,y=td+.2;
    for(const b of top){placements.push({...b,x,y:.1+td-b.d-(CATALOG[b.type].front||0),rot:0});x+=b.w+.1;}
    for(const b of left){placements.push({...b,x:.1+ld-b.d-(CATALOG[b.type].front||0),y,rot:270});y+=b.w+.1;}
    const sx=.1+ld,sy=.1+td;
    // Compare all top/left-facing assignments, in both preparation bench orders.
    for(const order of inner.length>1?[inner,[...inner].reverse()]:[inner])for(let turns=0;turns<(1<<inner.length);turns++){
     const placed=placements.slice();let horizontalX=sx+aisle+.1,verticalY=sy+aisle+.1;
     let depth=Math.max(sy+aisle,td+.2+ll);
     for(let k=0;k<order.length;k++){
      const b=order[k],rot=turns&(1<<k)?90:180;
      const p=rot===180?{...b,x:horizontalX,y:sy+aisle,rot}:{...b,x:sx+aisle,y:verticalY,rot};
      placed.push(p);if(rot===180)horizontalX+=b.w+.1;else verticalY+=b.w+.1;
      depth=Math.max(depth,p.y+(rot===90?b.w:b.d));
     }
     if(placed.some(b=>b.x+(b.rot%180?b.d:b.w)>width-.1+1e-7))continue;
     // A mixed assignment can collide at the inner corner; reject it before
     // materialization. Full front/support/circulation checks still run later.
     if(placed.some((a,k)=>placed.slice(k+1).some(b=>overlap(box(a),box(b)))))continue;
     result.push({kind:'l',variant:'inset-prep',innerPrep:inner.length,placements:placed,rows:2,depth:depth+.1,rotations:left.length+inner.length,guides:[{x:sx,y:sy,w:width-sx,d:aisle}],side:{x:sx,y:sy,w:aisle}});
    }
   }
  }
  return result;
 }
 function materialize(s,p,aisle,workers){
  const n=clone(s);n.items=[];n.nextId=1;n.aisle=aisle;n.kitchenArea=Math.ceil((s.width*p.depth-1e-7)*10)/10;
  n.layoutMode='recommended';n.layoutPlan={kind:p.kind,variant:p.variant||'perimeter',innerPrep:p.innerPrep||0,workers,rows:p.rows,guides:p.guides,side:{...p.side,d:n.kitchenArea/s.width-p.side.y},menus:clone(s.menus)};
  const put=(b,x,y,rot,supportId=null)=>{const i={id:n.nextId++,type:b.type,x,y,w:b.w,d:b.d,rot,supportId,zone:b.zone};n.items.push(i);return i;};
  for(const b of p.placements){const host=put(b,b.x,b.y,b.rot);for(const c of b.children){
   const pos=b.rot===180?{x:b.w-c.x-c.w,y:b.d-c.y-c.d}:b.rot===270?{x:c.y,y:b.w-c.x-c.w}:b.rot===90?{x:b.d-c.y-c.d,y:c.x}:c;
   put({...c,zone:b.zone},b.x+pos.x,b.y+pos.y,b.rot,host.id);
  }}
  const coffee=n.items.find(i=>i.type==='machine');put({type:'filter',w:.3,d:.2,zone:'커피 급수'},coffee.x,coffee.y,coffee.rot);
  return n;
 }
 // A deterministic starting layout, with menu stations and a connected side aisle.
 // No purchase quantities or installation compliance are inferred from sales capacity.
 function planLayout(s,audit=true,kind=null){
  if(kind!==null&&!['rows','l','facing'].includes(kind))return {ok:false,state:s,reason:'비교할 배치 형태를 선택해 주세요.'};
  const n=clone(s),workers=s.workers??1,aisle=s.areaMode==='manual'?s.aisle:Math.min(1.6,.9+(workers-1)*.2),gap=.1;
  n.items=[];n.nextId=1;n.aisle=aisle;
  const blocks=[];
  const floor=(type,zone,w=CATALOG[type].w,d=CATALOG[type].d)=>{const b={type,zone,w,d,children:[]};blocks.push(b);return b;};
  const station=(zone,types)=>{const b=floor('bench',zone);let x=.025;for(const type of types){const c=CATALOG[type];b.children.push({type,x,y:.025,w:c.w,d:c.d});x+=c.w+.025;}return b;};
  floor('sink','세척');
  if(s.menus.milk)floor('fridge','우유·재료');
  station('커피 추출',['machine','grinder','tools']);
  if(s.menus.iced)floor('ice','얼음');
  if(s.menus.smoothie)floor('freezer','스무디 재료');
  if(s.menus.smoothie||s.menus.drip)station('음료 준비',[...(s.menus.smoothie?['blender']:[]),...(s.menus.drip?['drip']:[])]);
  if(s.menus.bake)station('굽기',['oven']);
  for(let first=1;first<=workers;first+=2){const count=Math.min(2,workers-first+1);floor('bench','준비 '+first+(count===2?'·'+(first+1):'')+'번',count*.6,.7);}
  if(s.menus.dessert)floor('showcase','디저트 진열');
  const search=layoutAlternatives(blocks,s.width,aisle),proposals=search.alternatives.map(p=>{
   let y=gap;const guides=[],placements=[];
   for(const row of p.rows){placements.push(...row.blocks.map(b=>({...b,y})));guides.push({x:gap,y:y+row.depth,w:s.width-gap,d:aisle});y+=row.depth+aisle;}
   return {kind:'rows',placements,guides,rows:p.rows.length,depth:y,rotations:p.rotations,side:{x:s.width-aisle,y:0,w:aisle}};
  });
  proposals.push(...shapedAlternatives(blocks,s.width,aisle));
  proposals.push(...insetLAlternatives(blocks,s.width,aisle));
  const families=['rows','l','facing'].map(kind=>{
   const options=proposals.filter(p=>p.kind===kind).sort((a,b)=>a.depth-b.depth||a.rotations-b.rotations);
   const valid=p=>{const state=materialize(s,p,aisle,workers);
    const blocked=lanes(state).some(l=>state.items.some(i=>CATALOG[i.type].layer==='floor'&&(overlap(l,box(i))||(front(i)&&overlap(l,front(i))))));
    return !blocked&&!invalid(state).length?state:null;
   };
   for(const p of options){const state=valid(p);if(!state)continue;
    let perimeterArea=state.kitchenArea;
    if(p.variant==='inset-prep'){perimeterArea=null;for(const old of options.filter(o=>!o.variant)){const oldState=valid(old);if(oldState){perimeterArea=oldState.kitchenArea;break;}}}
    return {kind,p,state,area:state.kitchenArea,perimeterArea,candidates:options.length};
   }
   return {kind,area:null,candidates:options.length};
  });
  const best=families.filter(f=>f.area!==null&&(kind===null||f.kind===kind)).sort((a,b)=>a.area-b.area)[0];
  if(!best)return {ok:false,state:s,reason:'장비 정면·문 여유·연결 통로를 함께 확보하지 못했어요. 매장 가로나 메뉴를 조절해 주세요.'};
  Object.assign(n,best.state);const requiredArea=best.area;
  if(requiredArea>s.areaSqm-.1)return {ok:false,state:s,requiredArea,reason:'이 메뉴와 '+workers+'명 배치에는 약 '+(requiredArea/PYEONG).toFixed(1)+'평의 주방이 필요해 매장에 들어가지 않아요. 메뉴·인원·공간 모양을 조절해 주세요.'};
  if(s.areaMode==='manual'&&requiredArea>s.kitchenArea+1e-7)return {ok:false,state:s,requiredArea,reason:'현재 주방보다 넓은 약 '+(requiredArea/PYEONG).toFixed(1)+'평이 필요해요. 주방을 넓히거나 ‘추천 면적과 배치 함께 적용’을 눌러 주세요.'};
  n.kitchenArea=s.areaMode==='manual'?s.kitchenArea:requiredArea;
  n.layoutPlan.side.d=dims(n).k-n.layoutPlan.side.y;
  const comparison={version:'layout-options-v4',kind:best.kind,candidates:proposals.length,baselineArea:search.baselineArea,requiredArea,rotations:best.p.rotations,families:families.map(f=>({kind:f.kind,area:f.area,variant:f.p?.variant||'perimeter',perimeterArea:f.perimeterArea??null,candidates:f.candidates,fits:f.area!==null&&f.area<=s.areaSqm-.1}))};
  if(audit&&workers>1){const previous=planLayout({...s,workers:workers-1},false,kind);if(previous.ok){comparison.previousArea=previous.comparison.requiredArea;comparison.growth=requiredArea/comparison.previousArea-1;comparison.requiresReview=comparison.growth>.35;}}
  n.layoutPlan.comparison=comparison;
  return {ok:true,state:n,requiredArea:n.kitchenArea,rows:best.p.rows,workers,stations:blocks.filter(b=>b.type==='bench').length,comparison};
 }
 function initialLayout(area,width){const s=fresh(area,width),r=planLayout(s);return r.ok?r.state:{...s,layoutMode:'manual'};}
 function readiness(s){const has=t=>s.items.some(i=>i.type===t);return [
  {name:'커피 추출',missing:['machine','grinder'].filter(t=>!has(t))},
  {name:'세척·준비',missing:['sink','bench'].filter(t=>!has(t))},
  ...(s.menus.milk?[{name:'우유 음료',missing:['fridge'].filter(t=>!has(t))}]:[]),
  ...(s.menus.iced?[{name:'얼음 자체 생산',missing:['ice'].filter(t=>!has(t))}]:[]),
  ...(s.menus.smoothie?[{name:'냉동과일 스무디',missing:['blender','freezer'].filter(t=>!has(t))}]:[]),
  ...(s.menus.bake?[{name:'매장에서 굽기',missing:['oven'].filter(t=>!has(t))}]:[]),
  ...(s.menus.drip?[{name:'핸드드립',missing:['drip'].filter(t=>!has(t))}]:[]),
  ...(s.menus.dessert?[{name:'디저트 진열',missing:['showcase'].filter(t=>!has(t))}]:[])];}
 function stockRows(stock){return Object.entries(stock.rows).map(([key,r])=>{
  const inUse=Math.ceil(stock.seats*r.share/100),washing=Math.ceil(stock.peak*stock.dineIn/100*r.share/100*stock.washMinutes/60),reserve=Math.ceil((inUse+washing)*stock.reserve/100);
  const target=inUse+washing+reserve,need=Math.max(0,target-r.owned),suggested=Math.ceil(need/r.pack)*r.pack,buy=r.buy===null?suggested:r.buy;
  return {key,name:SUPPLIES[key].name,inUse,washing,reserve,target,suggested,buy,owned:r.owned,after:r.owned+buy,shortfall:Math.max(0,target-r.owned-buy)};
 });}
 function costs(s){const rows=s.items.map(i=>({...Pricing.quote(s,i),id:i.id,type:i.type})),ancillary=Pricing.ancillary(s,stockRows(s.stock));const equipment=rows.reduce((sum,r)=>sum+r.price,0);return {known:equipment+ancillary.total,equipment,ancillary:ancillary.total,rows,ancillaryRows:ancillary.rows,manualBundle:ancillary.manualBundle,estimated:rows.filter(r=>r.kind==='estimate').length,missing:0};}
 function validateStock(st){return st&&Number.isInteger(st.seats)&&finite(st.seats,0,500)&&Number.isInteger(st.peak)&&finite(st.peak,0,2000)&&finite(st.dineIn,0,100)&&finite(st.washMinutes,0,240)&&finite(st.reserve,0,200)&&Object.keys(SUPPLIES).every(k=>{const r=st.rows?.[k];return r&&finite(r.share,0,100)&&Number.isInteger(r.pack)&&finite(r.pack,1,1000)&&Number.isInteger(r.owned)&&finite(r.owned,0,10000)&&(r.buy===null||Number.isInteger(r.buy)&&finite(r.buy,0,10000));});}
 function validate(s){
  if(s?.layoutMode!==undefined&&!['recommended','manual'].includes(s.layoutMode))return false;
  if(s?.layoutPlan?.kind!==undefined&&!['rows','l','facing'].includes(s.layoutPlan.kind))return false;
  if(s?.layoutPlan){const p=s.layoutPlan;if(!Number.isInteger(p.workers)||!finite(p.workers,1,6)||!Number.isInteger(p.rows)||!finite(p.rows,1,20)||!Array.isArray(p.guides)||p.guides.length>20||[...p.guides,p.side].some(b=>!b||!finite(b.x,0,100)||!finite(b.y,0,100)||!finite(b.w,0,100)||!finite(b.d,0,100)))return false;}
  if(!s||(s.workers!==undefined&&(!Number.isInteger(s.workers)||!finite(s.workers,1,6)))||(s.areaMode!==undefined&&!['recommended','manual'].includes(s.areaMode)))return false;
  if(s?.schemaVersion!==1||!finite(s.areaSqm,1,10000)||!finite(s.width,1,100)||!finite(s.kitchenArea,.1,s.areaSqm-.1)||!finite(s.aisle,.3,2)||dims(s).d>100||dims(s).d<1||!Array.isArray(s.items)||s.items.length>80||!Number.isSafeInteger(s.nextId)||s.nextId<1||!validateStock(s.stock))return false;
  for(const [field,keys] of [['supplyPrices',Object.keys(Pricing.reusable)],['smallPrices',Object.keys(Pricing.small)]])if(s[field]!==undefined&&(!s[field]||Object.entries(s[field]).some(([k,v])=>!keys.includes(k)||!finite(v,0,1e8))))return false;
  if(!s.menus||['milk','iced','smoothie','bake','drip','dessert'].some(k=>typeof s.menus[k]!=='boolean')||!s.small||['pitcher','tamper','scale','brush','scoop','cloth'].some(k=>!Number.isInteger(s.small[k])||!finite(s.small[k],0,1000))||!s.prices||Object.entries(s.prices).some(([k,v])=>!CATALOG[k]||!finite(v,0,1e10)))return false;
  const ids=new Set();for(const i of s.items){if(!CATALOG[i.type]||!Number.isSafeInteger(i.id)||i.id<1||i.id>=s.nextId||ids.has(i.id)||!finite(i.w,.05,5)||!finite(i.d,.05,5)||!finite(i.x,-100,100)||!finite(i.y,-100,100)||![0,90,180,270].includes(i.rot)||(i.supportId!==null&&!Number.isSafeInteger(i.supportId)))return false;ids.add(i.id);}
  return true;
 }
 function snapshot(s,code){if(!validate(s)||invalid(s).length||dims(s).k<=s.aisle||typeof code!=='string')throw Error('배치와 입력값을 확인하세요');return {schemaVersion:1,districtCode:code,spaceAreaSqm:s.areaSqm,kitchenAreaSqm:s.kitchenArea,roomWidthM:s.width,layout:clone(s),stockPlan:stockRows(s.stock),equipmentCosts:costs(s),savedAt:new Date().toISOString()};}
 function restore(saved,code,area){if(!(saved?.schemaVersion===1&&saved.districtCode===code&&saved.spaceAreaSqm===area&&saved.layout?.areaSqm===area&&saved.kitchenAreaSqm===saved.layout.kitchenArea&&validate(saved.layout)))return null;const n=clone(saved.layout);n.workers??=1;n.areaMode??='manual';n.layoutMode??='manual';return n;}
 const api={PYEONG,CATALOG,SUPPLIES,Pricing,clone,finite,fresh,recommend,applyRecommendation,dims,size,box,front,workArea,lanes,circulationIssues,overlap,issues,invalid,attach,candidate,add,transform,remove,starter,planLayout,initialLayout,readiness,stockRows,costs,validateStock,validate,snapshot,restore};
 if(typeof module!=='undefined')module.exports=api;else root.KitchenModel=api;
})(typeof window!=='undefined'?window:globalThis);
