(function(root){
 'use strict';
 const PYEONG=400/121;
 const CATALOG={
  table2:{name:'2인 테이블',w:.75,h:.75,price:18,seat:0,kind:'table',note:'테이블만 · 의자는 따로 추가'},
  table4:{name:'4인 테이블',w:1.3,h:.8,price:28,seat:0,kind:'table',note:'테이블만 · 의자는 따로 추가'},
  chair:{name:'의자',w:.5,h:.5,price:7,seat:1,kind:'chair',note:'의자 1개 · 계획 좌석 1석'},
  window:{name:'창가 1인석',w:.85,h:1,price:28,seat:1,kind:'window',note:'선반 + 의자 1개 · 왼쪽 창가'},
  pendant:{name:'펜던트 조명',w:.45,h:.45,price:9,seat:0,kind:'light',note:'천장 설치 · 가구 위 배치 가능'},
  plant:{name:'화분',w:.55,h:.55,price:6,seat:0,kind:'plant',note:'실내 식물 + 화분 1개'},
  sofa:{name:'2인 소파',w:1.5,h:.8,price:60,seat:2,kind:'sofa',note:'휴식형 좌석 2석 · 테이블 별도'},
  shelf:{name:'수납장',w:1,h:.4,price:25,seat:0,kind:'shelf',note:'객석 비품·책·소품 수납'},
  return:{name:'반납·셀프대',w:1,h:.55,price:35,seat:0,kind:'shelf',note:'쟁반·물·냅킨을 두는 가구'}
 };
 const LEVELS={basic:{name:'간결하게',rate:45},standard:{name:'따뜻하게',rate:80},premium:{name:'공들여서',rate:130}};
 const clone=v=>JSON.parse(JSON.stringify(v));
 const validNumber=(v,min,max)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;
 function fresh(area){return {schemaVersion:1,areaSqm:area,width:Math.round(Math.sqrt(area/1.3)*10)/10,kitchenArea:Math.round(area*.25*10)/10,level:'standard',rate:80,contingency:10,prices:Object.fromEntries(Object.entries(CATALOG).map(([k,v])=>[k,v.price])),items:[],nextId:1};}
 function dimensions(s){return {w:s.width,h:s.areaSqm/s.width,k:s.kitchenArea/s.width};}
 function size(item){const c=CATALOG[item.type];return item.rot%180?{w:c.h,h:c.w}:{w:c.w,h:c.h};}
 function overlaps(a,b){return a.x<b.x+b.w-1e-6&&a.x+a.w>b.x+1e-6&&a.y<b.y+b.h-1e-6&&a.y+a.h>b.y+1e-6;}
 function fits(s,item){
  if(!Object.hasOwn(CATALOG,item.type)||!Number.isFinite(item.x)||!Number.isFinite(item.y))return false;
  const d=dimensions(s),box={...size(item),x:item.x,y:item.y};
  if(box.x<0||box.y<d.k||box.x+box.w>d.w+1e-6||box.y+box.h>d.h+1e-6)return false;
  if(item.type==='window'&&(item.rot!==0||Math.abs(item.x-.1)>.01))return false;
  const entry={x:Math.max(0,d.w-1.2),y:Math.max(d.k,d.h-1.2),w:Math.min(d.w,1.2),h:Math.min(d.h-d.k,1.2)};
  if(overlaps(box,entry))return false;
  if(CATALOG[item.type].kind==='light')return true;
  return !s.items.some(other=>other.id!==item.id&&CATALOG[other.type].kind!=='light'&&overlaps(box,{...size(other),x:other.x,y:other.y}));
 }
 function place(s,type){
  if(!Object.hasOwn(CATALOG,type)||s.items.length>=150)return null;
  const d=dimensions(s),item={id:s.nextId,type,x:.1,y:0,rot:0};
  for(let y=Math.ceil((d.k+.1)*10)/10;y<d.h;y+=.2){
   for(let x=.1;x<d.w;x+=.2){item.x=Number(x.toFixed(2));item.y=Number(y.toFixed(2));if(fits(s,item)&&!s.items.some(o=>o.type===type&&Math.abs(o.x-item.x)<.05&&Math.abs(o.y-item.y)<.05))return {...item};if(type==='window')break;}
  }
  return null;
 }
 function invalidItems(s){return s.items.filter(i=>!fits(s,i)).map(i=>i.id);}
 function suggestion(s){const guest=s.areaSqm-s.kitchenArea,seats=Math.max(0,Math.min(60,Math.floor(guest/2.5))),window=Math.min(6,Math.floor(seats/5));return {seats,window,table2:Math.max(0,Math.floor((seats-window)/2)),shelf:guest>=12?1:0,return:guest>=12?1:0,plant:Math.floor(guest/20)};}
 function starter(s){
  const n=clone(s);n.items=[];n.nextId=1;const target=suggestion(n),d=dimensions(n);
  function put(type,x,y,rot=0){const item={id:n.nextId,type,x:Math.round(x*100)/100,y:Math.round(y*100)/100,rot};if(n.items.length>=150||!fits(n,item))return false;n.items.push(item);n.nextId++;return true;}
  for(let i=0;i<target.window;i++)put('window',.1,d.k+.2+i*1.25);
  if(target.return)put('return',d.w-1.1,d.k+.15);
  if(target.shelf)put('shelf',1.2,d.k+.15);
  for(let y=d.k+1.1;y<d.h-1;y+=2.1){for(let x=1.6;x<d.w-1.1;x+=2.2){
   if(costs(n).seats+2>target.seats)break;
   const group=[['table2',x,y],['chair',x-.6,y+.125],['chair',x+.85,y+.125]];
   const saved=clone(n);let ok=true;for(const [t,xx,yy] of group)if(!put(t,xx,yy)){ok=false;break;}
   if(!ok){n.items=saved.items;n.nextId=saved.nextId;}else put('pendant',x+.15,y+.15);
  }}
  for(let i=0;i<target.plant;i++){const item=place(n,'plant');if(item){n.items.push(item);n.nextId++;}}
  return n;
 }
 function costs(s){
  const counts=Object.fromEntries(Object.keys(CATALOG).map(k=>[k,s.items.filter(i=>i.type===k).length]));
  const construction=Math.round((s.areaSqm-s.kitchenArea)/PYEONG*s.rate*10000);
  const furniture=Math.round(Object.entries(counts).reduce((v,[k,n])=>v+n*s.prices[k]*10000,0));
  const reserve=Math.round((construction+furniture)*s.contingency/100);
  return {counts,construction,furniture,reserve,total:construction+furniture+reserve,seats:s.items.reduce((v,i)=>v+CATALOG[i.type].seat,0)};
 }
 function validate(s){
  if(s?.schemaVersion!==1||['areaSqm','width','kitchenArea','rate','contingency'].some(k=>typeof s[k]!=='number')||!validNumber(s.areaSqm,.1,40000)||!validNumber(s.width,1,100)||!validNumber(s.kitchenArea,0,s.areaSqm-.1)||s.areaSqm/s.width<1||s.areaSqm/s.width>100||!Object.hasOwn(LEVELS,s.level)||!validNumber(s.rate,0,10000)||!validNumber(s.contingency,0,100))return false;
  if(!s.prices||Object.keys(CATALOG).some(k=>typeof s.prices[k]!=='number'||!validNumber(s.prices[k],0,100000)))return false;
  if(!Array.isArray(s.items)||s.items.length>150||!Number.isSafeInteger(s.nextId)||s.nextId<1)return false;
  const ids=new Set();for(const i of s.items){if(!i||!Object.hasOwn(CATALOG,i.type)||!Number.isSafeInteger(i.id)||i.id<1||i.id>=s.nextId||ids.has(i.id)||![0,90,180,270].includes(i.rot)||!Number.isFinite(i.x)||!Number.isFinite(i.y))return false;ids.add(i.id);}
  return true;
 }
 function restore(saved,code,area){return saved?.districtCode===code&&saved?.sourceAreaSqm===area&&validate(saved.layout)?clone(saved.layout):null;}
 function spaceArea(saved,code){
  if(saved?.schemaVersion!==1||saved.districtCode!==code||!validNumber(saved.areaSqm,.1,40000))return null;
  return Number(saved.areaSqm);
 }
 const api={PYEONG,CATALOG,LEVELS,clone,fresh,dimensions,size,overlaps,fits,place,invalidItems,suggestion,starter,costs,validate,restore,spaceArea,validNumber};
 if(typeof module!=='undefined')module.exports=api;else root.InteriorModel=api;
})(typeof window!=='undefined'?window:globalThis);
