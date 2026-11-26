(() => {
 'use strict';
 const M=KitchenModel,C=M.CATALOG,$=id=>document.getElementById(id),SCALE=72;
 let state,code,selected=null,history=[],drag=null,changed=false,areaPending=false,kitchenAreaEdited=false,itemPending=false,sourceChanged=false;
 const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch(_){return null;}};
 const say=t=>$('action-status').textContent=t;
 const num=(id)=>$(id).value.trim()===''?NaN:Number($(id).value);
 const money=n=>(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원';
 const kindNames={rows:'일자·여러 줄',l:'ㄱ자',facing:'대면형'};
 let previewKind=null,previewResult=null;
 function previewReady(){const reject=message=>{say(message);if($('layout-preview').open)$('preview-error').textContent=message;return false;};if(sourceChanged)return reject('앞 단계 면적이 바뀌었어요. 새로고침 후 비교해 주세요.');if(areaPending||itemPending||num('workers')!==state.workers||num('aisle-width')!==state.aisle)return reject('입력 중인 인원·크기·장비·통로를 먼저 적용해 주세요.');return true;}
 function previewLayout(kind){
  if(!previewReady())return;
  previewKind=kind;previewResult=M.planLayout({...state,areaMode:'recommended'},false,kind);
  const r=previewResult,s=r.state;
  $('preview-context').textContent='전체 '+(state.areaSqm/M.PYEONG).toFixed(1)+'평 · '+state.workers+'명 · '+[state.menus.milk?'우유 음료':'',state.menus.iced?'얼음':'',state.menus.smoothie?'스무디':'',state.menus.dessert?'디저트':'',state.menus.bake?'굽기':'',state.menus.drip?'드립':''].filter(Boolean).join(' · ');
  document.querySelectorAll('[data-preview-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.previewKind===kind)));
  $('preview-error').textContent=r.ok?'':r.reason;$('preview-apply').disabled=!r.ok;
  $('preview-plan').toggleAttribute('hidden',!r.ok);$('preview-legend').hidden=!r.ok;$('preview-equipment').replaceChildren();
  const inset=r.ok&&s.layoutPlan.variant==='inset-prep',family=r.ok?r.comparison.families.find(f=>f.kind===kind):null;
  $('preview-summary').textContent=kindNames[kind]+(inset?' + 안쪽 준비대':'')+(r.ok?' · 주방 '+s.kitchenArea.toFixed(1)+'㎡ ('+(s.kitchenArea/M.PYEONG).toFixed(1)+'평) · 객석 '+((s.areaSqm-s.kitchenArea)/M.PYEONG).toFixed(1)+'평':' · 현재 조건에서 적용할 수 없어요.');
  $('preview-layout-detail').hidden=!inset;$('preview-layout-detail').textContent=inset?'빈 준비대 '+s.layoutPlan.innerPrep+'개를 안쪽으로 옮겨 기존 통로를 공유합니다. '+(family.perimeterArea!==null?'벽면만 쓰는 ㄱ자 '+family.perimeterArea.toFixed(1)+'㎡ → '+s.kitchenArea.toFixed(1)+'㎡ · '+(family.perimeterArea-s.kitchenArea).toFixed(1)+'㎡ 절약. ':'')+'장비·작업면·통로 폭은 그대로입니다.':'';
  if(r.ok)drawPreview(s);
  if(!$('layout-preview').open)$('layout-preview').showModal();
 }
 function applyLayoutKind(kind){
  if(!previewReady())return;
  const reject=message=>{say(message);$('layout-review').textContent=message;if($('layout-preview').open){$('preview-error').textContent=message;$('preview-apply').disabled=true;}};
  if(read('sim.space.v1.'+code)?.areaSqm!==state.areaSqm){sourceChanged=true;reject('앞 단계 면적이 바뀌었어요. 새로고침해 주세요.');return;}
  const r=M.planLayout({...state,areaMode:'recommended'},false,kind);
  if(!r.ok){reject(r.reason+' 기존 배치는 유지했어요.');return;}
  checkpoint();state=r.state;state.layoutMode='manual';selected=null;
  if($('layout-preview').open)$('layout-preview').close();
  fillArea();render();dirty();say(kindNames[kind]+' 배치와 주방 면적을 적용했어요. 되돌리기로 이전 배치를 복원할 수 있어요.');
 }
 function drawPreview(s){
  const svg=$('preview-plan'),d=M.dims(s),ns='http://www.w3.org/2000/svg';svg.replaceChildren();svg.setAttribute('viewBox','-.08 -.08 '+(d.w+.16)+' '+(d.d+.16));svg.setAttribute('aria-label',kindNames[previewKind]+' 평면도, 장비 '+s.items.length+'개, 작업 통로 '+s.aisle.toFixed(1)+'m');
  const node=(tag,attrs,parent=svg)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;};
  const rect=(b,fill,extra={})=>node('rect',{x:b.x,y:b.y,width:b.w,height:b.d,fill,...extra});
  const text=(x,y,label,extra={})=>{const el=node('text',{x,y,'font-size':.23,'text-anchor':'middle',fill:'#385a4d',...extra});el.textContent=label;};
  rect({x:0,y:0,w:d.w,d:d.d},'#f4ecdf',{stroke:'#716958','stroke-width':.04});rect({x:0,y:0,w:d.w,d:d.k},'#e5e7dd');
  for(const l of M.lanes(s))rect(l,'#cbded0',{stroke:'#648771','stroke-width':.02,'stroke-dasharray':'.08 .06'});
  for(const i of s.items){const f=M.front(i);if(f)rect(f,'#edd5a4',{stroke:'#8b631f','stroke-width':.015,'stroke-dasharray':'.06 .04'});}
  for(const layer of ['floor','counter','wall'])for(const i of s.items.filter(i=>C[i.type].layer===layer)){const b=M.box(i),g=node('g',{transform:'translate('+(b.x+b.w/2)+' '+(b.y+b.d/2)+') rotate('+i.rot+') translate('+(-i.w/2)+' '+(-i.d/2)+')'});g.innerHTML=art(i.type);const icon=g.firstElementChild;icon.setAttribute('width',i.w);icon.setAttribute('height',i.d);const title=node('title',{},g);title.textContent=C[i.type].name+' · '+i.zone;}
  for(const i of s.items){const b=M.box(i);node('circle',{cx:b.x+.1,cy:b.y+.1,r:.105,fill:'#fff9ef',stroke:'#5e534b','stroke-width':.012});text(b.x+.1,b.y+.14,String(i.id),{'font-size':.12,fill:'#2c1e17'});const li=document.createElement('li');li.textContent=C[i.type].name+' · '+i.zone;$('preview-equipment').append(li);}
  const guide=s.layoutPlan.guides[0];text(guide.x+guide.w/2,guide.y+guide.d/2+.08,'작업 통로 '+s.aisle.toFixed(1)+'m');
  node('line',{x1:0,y1:d.k,x2:d.w,y2:d.k,stroke:'#647d6b','stroke-width':.04});text(d.w/2,d.k+(d.d-d.k)/2,'객석 '+((s.areaSqm-s.kitchenArea)/M.PYEONG).toFixed(1)+'평');
 }
 function manualLayout(){state.layoutMode='manual';if(!['facing','l'].includes(state.layoutPlan?.kind))delete state.layoutPlan;}
 function syncLayout(){if(state.layoutMode!=='recommended')return '직접 조절한 배치는 유지됩니다. 추천 배치 버튼으로 다시 배치할 수 있어요.';const r=M.planLayout(state);if(!r.ok){manualLayout();return r.reason+' 기존 배치는 유지했어요.';}state=r.state;if(!areaPending)fillArea();return '메뉴·인원에 맞춰 장비와 준비 작업대를 다시 배치했어요.';}
 function dirty(){changed=true;$('save-status').textContent='변경사항이 있어요. 주방 계획을 저장해 주세요.';}
 function checkpoint(){history.push(M.clone(state));if(history.length>35)history.shift();}
 function art(type){
  const base='<rect x="3" y="3" width="94" height="94" rx="6" fill="#bccbc7" stroke="#5f7c74" stroke-width="3"/>';
  const drawings={
   bench:base+'<rect x="8" y="8" width="84" height="84" rx="3" fill="#e3e8e2"/><path d="M12 14H88M12 86H88" stroke="#a7b9af" stroke-width="2"/>',
   sink:base+'<rect x="9" y="15" width="48" height="72" rx="15" fill="#91aaa7" stroke="#607e7c" stroke-width="3"/><circle cx="33" cy="54" r="5" fill="#5b7874"/><path d="M37 17V9H58V32" fill="none" stroke="#e5ebe9" stroke-width="6"/><path d="M66 20V83M75 20V83M84 20V83" stroke="#94aaa2" stroke-width="3"/>',
   fridge:base+'<path d="M50 6V94" stroke="#718c84" stroke-width="2"/><path d="M35 83H43M57 83H65" stroke="#3b5952" stroke-width="4"/><path d="M10 10H90" stroke="#e9f2ed" stroke-width="4"/>',
   ice:base+'<rect x="11" y="12" width="78" height="62" rx="5" fill="#e6eff0"/><path d="M25 25H43V43H25ZM53 38H72V57H53ZM30 51H45V67H30Z" fill="#b6d5dd" stroke="#7fabb8" stroke-width="2"/><path d="M16 84H84" stroke="#526e68" stroke-width="6"/>',
   freezer:base+'<path d="M14 18H86V82H14Z" fill="#dce6e5" stroke="#8aa4a1" stroke-width="3"/><path d="M30 79H70" stroke="#496a66" stroke-width="5"/><path d="M50 29V62M36 37L65 54M36 54L65 37" stroke="#78a9b0" stroke-width="3"/>',
   machine:'<rect x="3" y="5" width="94" height="90" rx="10" fill="#345f58" stroke="#233f3a" stroke-width="3"/><rect x="10" y="11" width="80" height="39" rx="4" fill="#c5d6cf"/><circle cx="27" cy="28" r="9" fill="#f4eddf"/><circle cx="50" cy="28" r="9" fill="#f4eddf"/><circle cx="73" cy="28" r="9" fill="#f4eddf"/><path d="M12 65H88M12 74H88M12 83H88" stroke="#8caea1" stroke-width="3"/><path d="M30 53V66M68 53V66" stroke="#263c34" stroke-width="9"/>',
   grinder:'<rect x="15" y="25" width="70" height="70" rx="10" fill="#3b4945"/><ellipse cx="50" cy="29" rx="34" ry="25" fill="#a7b7af" stroke="#3b4945" stroke-width="3"/><ellipse cx="50" cy="29" rx="23" ry="16" fill="#76523b"/><path d="M38 68H62L57 84H43Z" fill="#dce4dd"/>',
   rack:base+'<path d="M8 32H92M8 66H92M33 4V96M66 4V96" stroke="#6c8a7c" stroke-width="3"/><circle cx="18" cy="17" r="7" fill="#f5e7cc"/><circle cx="49" cy="46" r="8" fill="#f5e7cc"/><path d="M73 73H88V88H73Z" fill="#cfb990"/>',
   dishwasher:base+'<rect x="12" y="12" width="76" height="65" rx="6" fill="#d4e1df" stroke="#78958c" stroke-width="3"/><circle cx="50" cy="45" r="22" fill="#f7f2e5" stroke="#a8b6a4" stroke-width="3"/><path d="M28 86H72" stroke="#3c5d53" stroke-width="5"/>',
   showcase:'<rect x="3" y="3" width="94" height="94" rx="8" fill="#7b8a83"/><rect x="8" y="8" width="84" height="84" rx="8" fill="#d4e5df"/><path d="M12 48H88" stroke="#8fa99f" stroke-width="4"/><path d="M20 19H38V36H20ZM59 19H78V36H59ZM20 60H38V79H20ZM59 60H78V79H59Z" fill="#c59b74"/><path d="M14 9L88 83" stroke="#fff" stroke-opacity=".4" stroke-width="8"/>',
   blender:'<rect x="15" y="50" width="70" height="46" rx="12" fill="#566858"/><circle cx="50" cy="37" r="32" fill="#ccd7bd" stroke="#456457" stroke-width="5"/><circle cx="50" cy="37" r="19" fill="#d8b9c7"/><path d="M83 22H94V51H81" fill="none" stroke="#456457" stroke-width="5"/><circle cx="50" cy="81" r="6" fill="#f7edd9"/>',
   boiler:base+'<circle cx="50" cy="42" r="29" fill="#d9e1d7" stroke="#6d897c" stroke-width="4"/><circle cx="50" cy="42" r="7" fill="#5c7e6c"/><path d="M45 72V89H59" fill="none" stroke="#365747" stroke-width="7"/>',
   oven:'<rect x="3" y="3" width="94" height="94" rx="5" fill="#6d7973"/><rect x="10" y="10" width="80" height="70" fill="#a8bbb2"/><rect x="16" y="16" width="68" height="56" fill="#d7d4c4"/><path d="M14 87H74" stroke="#34443b" stroke-width="5"/><circle cx="86" cy="88" r="5" fill="#e9e3d6"/>',
   rinser:base+'<circle cx="50" cy="50" r="35" fill="#829e93"/><path d="M50 23V77M23 50H77" stroke="#e0e9df" stroke-width="6"/><circle cx="50" cy="50" r="10" fill="#607c70"/>',
   tools:'<rect x="3" y="3" width="94" height="94" rx="7" fill="#d3ba95" stroke="#927657" stroke-width="3"/><rect x="10" y="12" width="35" height="37" rx="5" fill="#485e50"/><circle cx="70" cy="30" r="16" fill="#dbe4d9" stroke="#657e6f" stroke-width="3"/><circle cx="30" cy="73" r="14" fill="#526c5d"/><path d="M61 58H88V87H61Z" fill="#99b1a3"/>',
   drip:'<rect x="3" y="3" width="94" height="94" rx="7" fill="#cbb591"/><circle cx="29" cy="49" r="24" fill="#f7f1df" stroke="#987c58" stroke-width="3"/><circle cx="29" cy="49" r="11" fill="#9e7650"/><ellipse cx="75" cy="52" rx="18" ry="25" fill="#668d85"/><path d="M75 25V10M87 40L98 22" stroke="#668d85" stroke-width="7"/>',
   filter:'<rect x="5" y="5" width="90" height="20" rx="5" fill="#4d6b5e"/><rect x="12" y="22" width="29" height="73" rx="12" fill="#ecebdd" stroke="#6c8978" stroke-width="3"/><rect x="59" y="22" width="29" height="73" rx="12" fill="#ecebdd" stroke="#6c8978" stroke-width="3"/>',
   bin:'<rect x="12" y="7" width="76" height="86" rx="15" fill="#8c9586" stroke="#55644f" stroke-width="4"/><rect x="22" y="17" width="56" height="64" rx="12" fill="#56624d"/>'
  };return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+drawings[type]+'</svg>';
 }
 function catalog(){
  $('catalog').replaceChildren();for(const [key,c] of Object.entries(C)){
   if($('category').value!=='all'&&c.group!==$('category').value)continue;
   const row=document.createElement('div');row.className='catalog-item';row.innerHTML='<div class="catalog-icon">'+art(key)+'</div><div><strong>'+c.name+'</strong><small>'+({floor:'바닥',counter:'작업대 위',wall:'벽·하부장'}[c.layer])+' · '+Number((c.w*100).toFixed(1))+'×'+Number((c.d*100).toFixed(1))+'cm</small><small>'+(c.real?'모델 규격 예시':'모의 치수')+'</small></div><button type="button" aria-label="'+c.name+' 추가">+</button>';
   row.querySelector('button').onclick=()=>{const n=M.clone(state);if(!M.add(n,key)){say(c.layer==='counter'?'올릴 작업대 공간이 부족해요. 작업대를 추가하거나 위 장비를 옮겨보세요.':'주방·작업 통로를 침범하지 않는 자리가 없어요. 주방을 넓히거나 장비를 옮겨보세요.');return;}checkpoint();state=n;manualLayout();selected=state.items[state.items.length-1].id;render();dirty();say(c.name+'을 들여놓았어요. 원하는 자리로 옮겨보세요.');};$('catalog').append(row);
  }
 }
 function fillArea(){$('kitchen-pyeong').value=Number((state.kitchenArea/M.PYEONG).toFixed(2));$('room-width').value=state.width;$('workers').value=state.workers;$('kitchen-ratio').value=state.kitchenArea/state.areaSqm*100;$('ratio-label').textContent=(state.kitchenArea/state.areaSqm*100).toFixed(1)+'%';$('aisle-width').value=state.aisle;areaPending=false;kitchenAreaEdited=false;}
 function renderRecommendation(){
  const r=M.recommend(state),manual=state.areaMode==='manual';
  if(!manual&&r.feasible){const different=state.kitchenArea!==r.area||state.aisle!==r.aisle;state.kitchenArea=r.area;state.aisle=r.aisle;if(different&&!areaPending)fillArea();}
  $('recommended-area').textContent=(r.area/M.PYEONG).toFixed(1)+'평';$('recommended-sqm').textContent=r.area.toFixed(1)+'㎡ · 전체의 '+r.percent.toFixed(0)+'%';
  $('area-mode').textContent=manual?'직접 조절 중':r.feasible?'추천값 적용 중':'새 조건의 공간 부족';
  $('recommend-summary').textContent='동시 작업 '+r.workers+'명 · 준비 장비 '+r.equipmentCount+'개 · 통로 '+r.aisle.toFixed(1)+'m 가정';
  const diff=state.kitchenArea-r.area;
  $('recommend-comparison').textContent=manual?'현재 '+(state.kitchenArea/M.PYEONG).toFixed(1)+'평'+(Math.abs(diff)<.01?'으로 추천과 같아요.':(diff>0?' · 추천보다 ':' · 추천보다 ')+(Math.abs(diff)/M.PYEONG).toFixed(1)+'평 '+(diff>0?'넓어요.':'작아요.')):'조건을 바꾸면 추천 면적이 함께 갱신됩니다. 직접 면적을 바꾸면 그 값을 유지해요.';
  $('recommend-warning').textContent=r.feasible?'':r.tooWide.length?'현재 매장 가로에 들어가기 어려운 장비: '+r.tooWide.join(', ')+'. 장비 방향·규격이나 공간 모양을 확인하세요.':'계산한 주방이 매장에 들어가지 않아요. 메뉴·장비·인원을 줄이거나 매장 면적을 다시 확인하세요. 추천값을 임의로 잘라 적용하지 않았어요.';
  $('apply-recommendation').disabled=!r.feasible;
  $('recommend-breakdown').textContent='바닥 장비 면적 '+r.floorArea.toFixed(1)+'㎡, 작업대 위 기기 '+r.counterSurface.toFixed(1)+'㎡, '+r.workers+'명 준비 작업면 '+r.prepSurface.toFixed(1)+'㎡를 고려했습니다. '+(r.missing.length?'아직 놓지 않은 메뉴 기본 장비 '+r.missing.map(t=>C[t].name).join('·')+'도 포함합니다. ':'')+(r.extraBenches?'상판·준비 공간을 위해 작업대 '+r.extraBenches+'개를 추가로 고려합니다. ':'')+(r.complete?'필요한 장비가 갖춰져 실제 장비 위치와 통로 경계로 면적을 계산합니다.':'매장 가로 '+state.width.toFixed(1)+'m에 장비 '+r.rowCount+'줄과 통로를 잡은 추정입니다.')+(r.layoutDriven?' 현재 장비 위치를 유지할 공간이 더 커서 그 면적을 사용합니다.':'');
  return r;
 }
 function position(el,i){const b=M.box(i);Object.assign(el.style,{left:b.x*SCALE+'px',top:b.y*SCALE+'px',width:b.w*SCALE+'px',height:b.d*SCALE+'px'});const svg=el.querySelector('svg');Object.assign(svg.style,{position:'absolute',left:'50%',top:'50%',width:i.w/b.w*100+'%',height:i.d/b.d*100+'%',transform:'translate(-50%,-50%) rotate('+i.rot+'deg)'});}
 function select(id,focus=false){
  selected=state.items.some(i=>i.id===id)?id:null;$('selected').value=selected??'';
  for(const b of document.querySelectorAll('.k-object')){b.classList.toggle('selected',Number(b.dataset.id)===selected);b.setAttribute('aria-pressed',String(Number(b.dataset.id)===selected));}
  document.querySelectorAll('.move-tools button').forEach(b=>b.disabled=!selected);$('inspector').hidden=!selected;itemPending=false;$('item-error').textContent='';
  if(!selected)return;const i=state.items.find(i=>i.id===selected),c=C[i.type];$('item-name').textContent=c.name+' #'+i.id;$('item-note').textContent=c.note+' · '+(c.real&&i.w===c.w&&i.d===c.d?'확인한 모델 외곽 규격':'배치 연습용 / 직접 지정 치수')+(c.power?' · 전원 확인':'')+(c.water?' · 급배수 확인':'');$('item-width').value=Number((i.w*100).toFixed(2));$('item-depth').value=Number((i.d*100).toFixed(2));const quote=M.Pricing.quote(state,i);$('item-price').value=quote.price/10000;$('item-price').dataset.edited='false';$('item-note').textContent+=' · '+quote.label+(quote.note?' · '+quote.note:'');$('item-source').hidden=!c.source;if(c.source)$('item-source').href=c.source;
  if(focus)document.querySelector('.k-object[data-id="'+id+'"]')?.focus({preventScroll:true});
 }
 function render(){
  document.querySelectorAll('[data-apply-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.applyKind===state.layoutPlan?.kind)));
  const recommendation=renderRecommendation();
  const layout=M.planLayout(state),combined=M.planLayout({...state,areaMode:'recommended'});
  $('layout-mode').textContent=state.layoutMode==='recommended'?'추천 배치 적용 중':'직접 배치 중';
  $('layout-summary').textContent='동시 '+state.workers+'명 · '+(combined.ok?combined.state.items.length+'개 장비 · '+kindNames[combined.comparison.kind]+' 추천 · 주방 '+(combined.requiredArea/M.PYEONG).toFixed(1)+'평':combined.reason);
  const comparison=combined.ok?combined.comparison:layout.ok?layout.comparison:null;
  const rowArea=comparison?.families.find(f=>f.kind==='rows').area;
  $('layout-comparison').textContent=comparison?'일자·여러 줄, ㄱ자, 대면형 '+comparison.candidates+'개 후보 비교'+(rowArea>comparison.requiredArea+.01?' · 기존 줄 배치보다 '+(rowArea-comparison.requiredArea).toFixed(1)+'㎡ ('+((rowArea-comparison.requiredArea)/M.PYEONG).toFixed(1)+'평) 절약':'')+' · 장비 수량·규격, 준비 작업면과 통로 폭을 동일하게 비교합니다.':'';
  $('layout-options').replaceChildren();for(const f of comparison?.families||[]){const tr=document.createElement('tr');tr.className=f.kind===comparison.kind?'chosen-layout':'';const name=document.createElement('th');name.scope='row';const button=document.createElement('button');button.type='button';button.textContent=kindNames[f.kind]+' 보기';button.setAttribute('aria-label',kindNames[f.kind]+' 평면도 보기');button.onclick=()=>previewLayout(f.kind);name.append(button);if(f.variant==='inset-prep'){const note=document.createElement('small');note.textContent='+ 안쪽 준비대';note.className='layout-variant';name.append(note);}const area=document.createElement('td');area.textContent=f.area===null?'배치 불가':f.area.toFixed(1)+'㎡ · '+(f.area/M.PYEONG).toFixed(1)+'평';const status=document.createElement('td');status.textContent=f.kind===comparison.kind?'추천':!f.fits?'공간 부족':'비교안';tr.append(name,area,status);$('layout-options').append(tr);}
  $('layout-review').textContent=comparison?.requiresReview?'작업 인원 1명 증가로 필요한 면적이 '+Math.round(comparison.growth*100)+'% 커졌어요. 현재 비교 범위에서는 '+(layout.ok?layout.rows:combined.rows)+'줄 배치가 필요합니다. 공간 모양·메뉴·장비 구성을 다시 검토해 주세요.':'';
  $('starter').disabled=!layout.ok||sourceChanged;$('layout-with-area').disabled=!combined.ok||sourceChanged;
  $('layout-guides').replaceChildren();if(state.layoutPlan){for(const b of M.lanes(state)){const el=document.createElement('div');el.className='layout-lane';Object.assign(el.style,{left:b.x*SCALE+'px',top:b.y*SCALE+'px',width:b.w*SCALE+'px',height:b.d*SCALE+'px'});$('layout-guides').append(el);}}
  $('aisle').hidden=['facing','l'].includes(state.layoutPlan?.kind);

  const d=M.dims(state),bad=M.invalid(state);$('room').style.width=d.w*SCALE+'px';$('room').style.height=d.d*SCALE+'px';$('kitchen-floor').style.height=d.k*SCALE+'px';Object.assign($('aisle').style,{top:Math.max(0,d.k-state.aisle)*SCALE+'px',height:Math.min(state.aisle,d.k)*SCALE+'px'});Object.assign($('guest-zone').style,{top:d.k*SCALE+'px',height:(d.d-d.k)*SCALE+'px'});
  $('kitchen-size').textContent=(state.kitchenArea/M.PYEONG).toFixed(1)+'평';$('equipment-count').textContent=state.items.length+'개';$('room-dimensions').textContent=d.w.toFixed(1)+'m × '+d.d.toFixed(1)+'m';$('guest-area').textContent='남은 객석 '+((state.areaSqm-state.kitchenArea)/M.PYEONG).toFixed(1)+'평';
  $('objects').replaceChildren();$('clearances').replaceChildren();$('selected').innerHTML='<option value="">장비를 선택하세요</option>';
  for(const i of state.items){const c=C[i.type],b=document.createElement('button');b.type='button';b.className='k-object'+(bad.some(j=>j.id===i.id)?' invalid':'');b.dataset.id=i.id;b.dataset.layer=c.layer;b.innerHTML=art(i.type);b.title=c.name+' #'+i.id+(i.zone?' · '+i.zone:'');b.setAttribute('aria-label',b.title+(M.issues(state,i).length?' · 위치 조정 필요':''));position(b,i);$('objects').append(b);const o=document.createElement('option');o.value=i.id;o.textContent=b.title+(M.issues(state,i).length?' (위치 조정)':'');$('selected').append(o);
   const f=M.front(i);if(f){const e=document.createElement('div');e.className='clearance';Object.assign(e.style,{left:f.x*SCALE+'px',top:f.y*SCALE+'px',width:f.w*SCALE+'px',height:f.d*SCALE+'px'});$('clearances').append(e);}}
  $('readiness').replaceChildren();for(const row of M.readiness(state)){const li=document.createElement('li');li.className=row.missing.length?'':'ready';li.textContent=row.missing.length?row.name+' · '+row.missing.map(t=>C[t].name).join(', ')+' 필요':row.name+' · 구성됨';$('readiness').append(li);}
  const cost=M.costs(state);$('budget').textContent=cost.known||state.items.length&&!cost.missing?money(cost.known):'—';$('price-status').textContent='장비 '+cost.estimated+'개 추정값 · 식기·소도구 '+money(cost.ancillary)+' 포함. 직접 입력액 우선. '+(cost.manualBundle?'입력한 도구 묶음에 소도구가 포함된 것으로 보아 중복 합산하지 않습니다.':'')+' 배송·설치·부가세 별도 확인.';
  $('budget-breakdown').innerHTML='<div><dt>장비</dt><dd>'+money(cost.equipment)+'</dd></div><div><dt>식기·소도구</dt><dd>'+money(cost.ancillary)+'</dd></div>';
  for(const [key,value] of Object.entries(state.small))if($('small-count-'+key))$('small-count-'+key).textContent=value+'개';
  priceDetails();StartupBudget.preview('kitchen',{schemaVersion:1,districtCode:code,layout:state,spaceAreaSqm:state.areaSqm,kitchenAreaSqm:state.kitchenArea});
  const corridor=d.k<=state.aisle?'주방 깊이보다 통로가 넓거나 같아요. 주방 크기를 조절하세요.':'';
  $('problems').textContent=[corridor,...bad.map(i=>C[i.type].name+' #'+i.id+': '+M.issues(state,i).join(', '))].filter(Boolean).join(' / ');$('save').disabled=$('next').disabled=!!bad.length||!!corridor||sourceChanged||(state.areaMode==='recommended'&&!recommendation.feasible);$('undo').disabled=!history.length;select(selected);
  document.querySelectorAll('[data-menu]').forEach(el=>el.checked=state.menus[el.dataset.menu]);
 }
 function move(dx,dy,rot=false){const i=state.items.find(i=>i.id===selected);if(!i)return;const result=M.transform(state,i.id,{x:Math.round((i.x+dx)*1000)/1000,y:Math.round((i.y+dy)*1000)/1000,rot:rot?(i.rot+90)%360:i.rot});if(!result.ok){say(result.reason);return;}checkpoint();state=result.state;manualLayout();render();dirty();select(i.id,true);say('배치를 바꿨어요.');}
 function remove(){if(!selected)return;checkpoint();M.remove(state,selected);manualLayout();selected=null;render();dirty();say('장비를 삭제했어요. 작업대 위 장비도 함께 제거되며 되돌리기로 복원할 수 있어요.');}
 function areaApply(){const n=M.clone(state),py=num('kitchen-pyeong'),width=num('room-width');if(kitchenAreaEdited){n.kitchenArea=py*M.PYEONG;n.areaMode='manual';}n.width=width;if(!M.validate(n)){$('area-error').textContent='주방은 전체보다 작게, 매장 가로·세로는 1~100m로 입력하세요.';return;}checkpoint();state=n;manualLayout();fillArea();render();dirty();$('area-error').textContent='';say(M.invalid(state).length?'주방 크기가 바뀌었어요. 점선 표시 장비를 옮기거나 삭제하세요.':'주방 크기와 남은 객석 공간이 바뀌었어요.');}
 function fillStock(){for(const k of ['seats','peak','dineIn','washMinutes','reserve'])$('stock-'+k).value=state.stock[k];renderStock();for(const [k,v] of Object.entries(state.small))$('small-'+k).value=v;}
 function priceDetails(){
  let box=$('price-details');if(!box){box=document.createElement('details');box.id='price-details';box.className='price-details';$('price-status').after(box);}
  const cost=M.costs(state),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  box.innerHTML='<summary>장비별 금액·추정 근거·출처</summary><p>2026-11-17 조사 상품가 참고. 현재 도면의 모델·규격과 다를 수 있습니다. 배치와 실제 기종은 변경하지 않습니다. 식기·소도구 가격은 위 품목을 펼쳐 수정할 수 있어요.</p>'+cost.rows.map(r=>'<p>'+esc(C[r.type].name)+' #'+r.id+' · '+money(r.price)+' · '+r.label+(r.source?' · <a href="'+esc(r.source)+'" target="_blank" rel="noopener">출처</a>':'')+'<small>'+esc(r.note||'직접 입력한 금액을 유지합니다.')+'</small></p>').join('');
  for(const holder of document.querySelectorAll('[data-supply-price]')){
   if(holder.contains(document.activeElement))continue;
   const key=holder.dataset.supplyPrice,ref=M.Pricing.reusable[key]||M.Pricing.small[key],group=M.Pricing.reusable[key]?'supplyPrices':'smallPrices',manual=M.Pricing.hasPrice(state[group]?.[key]),price=manual?Number(state[group][key]):ref.unitPrice;
   const bundled=group==='smallPrices'&&cost.manualBundle;
   holder.innerHTML='<label>개당 가격 (원)<input aria-label="'+esc(ref.name)+' 개당 가격 (원)" type="number" min="0" max="100000000" step="any" data-price-group="'+group+'" data-price-key="'+key+'" value="'+price+'"'+(bundled?' disabled':'')+'></label><p class="help">'+(bundled?'직접 입력한 도구 묶음 가격에 포함 · 중복 합산 안 함':manual?'직접 입력한 가격':'조사 상품가를 참고한 추정값')+'</p><details><summary>가격 출처·입력 안내</summary><a href="'+esc(ref.source)+'" target="_blank" rel="noopener">참고 상품 ↗</a><p>빈칸으로 적용하면 추정 단가를 다시 사용합니다. 현재 입력한 가격은 수량을 바꿔도 유지됩니다.</p></details>';
  }
 }
 function changeSupplyPrice(e){const el=e.target;if(!el.dataset.priceKey)return;el.setCustomValidity('');if(el.validity.badInput||el.value!==''&&(!Number.isFinite(Number(el.value))||Number(el.value)<0||Number(el.value)>1e8)){el.setCustomValidity('0~100,000,000원 사이 가격을 입력하세요.');el.reportValidity();return;}checkpoint();state[el.dataset.priceGroup]??={};if(el.value==='')delete state[el.dataset.priceGroup][el.dataset.priceKey];else state[el.dataset.priceGroup][el.dataset.priceKey]=Number(el.value);const holder=el.closest('[data-supply-price]');holder.querySelector('.help').textContent=el.value===''?'추정 단가 적용':'직접 입력한 가격';render();dirty();}
 function renderStock(){
  const opened=new Set([...$('stock-rows').querySelectorAll('details[open][data-stock]')].map(el=>el.dataset.stock));
  $('stock-rows').replaceChildren();for(const row of M.stockRows(state.stock)){
   const r=state.stock.rows[row.key],e=document.createElement('details');e.className='stock-card';e.dataset.stock=row.key;e.open=opened.has(row.key);
   e.innerHTML='<summary><h3>'+row.name+'</h3><div class="stock-total">'+row.buy+'개 <small style="font-size:12px">구매'+(r.buy===null?' 예시':' 계획')+'</small></div></summary><div class="stock-card-detail"><p class="math">사용 '+row.inUse+' + 세척 '+row.washing+' + 여분 '+row.reserve+'<br>목표 보유 '+row.target+'개 · 현재 '+row.owned+'개</p><div class="stock-row-fields"><label>품목 이용률 (%)<input data-field="share" type="number" min="0" max="100" value="'+r.share+'"></label><label>묶음 단위 (개)<input data-field="pack" type="number" min="1" max="1000" step="1" value="'+r.pack+'"></label><label>이미 보유 (개)<input data-field="owned" type="number" min="0" max="10000" step="1" value="'+r.owned+'"></label><label>직접 구매 (개)<input data-field="buy" type="number" min="0" max="10000" step="1" placeholder="자동 '+row.suggested+'" value="'+(r.buy===null?'':r.buy)+'"></label></div><p class="help">'+(row.shortfall?'계산 목표보다 '+row.shortfall+'개 적어요.':'구매 후 '+row.after+'개를 갖추게 돼요.')+'</p><button data-reset="'+row.key+'">구매 수량 자동으로</button><button type="button" data-stock-apply>수량 적용</button><div data-supply-price="'+row.key+'"></div></div>';$('stock-rows').append(e);
  }
 }
 function readStock(){const st=M.clone(state.stock);for(const k of ['seats','peak','dineIn','washMinutes','reserve'])st[k]=num('stock-'+k);for(const el of document.querySelectorAll('[data-stock]')){const r=st.rows[el.dataset.stock];for(const input of el.querySelectorAll('[data-field]'))r[input.dataset.field]=input.value.trim()===''?(input.dataset.field==='buy'?null:NaN):Number(input.value);}return st;}
 function applyStock(){const st=readStock();if(!M.validateStock(st)){$('stock-error').textContent='수량은 0 이상의 정수, 묶음은 1 이상, 이용률은 0~100%, 여분은 0~200%로 입력하세요.';return false;}const changedStock=JSON.stringify(st)!==JSON.stringify(state.stock);if(changedStock){checkpoint();state.stock=st;dirty();}renderStock();render();$('stock-error').textContent='';return true;}
 function collectSmall(){const n={};for(const k of Object.keys(state.small)){n[k]=num('small-'+k);if(!Number.isInteger(n[k])||!M.finite(n[k],0,1000)){$('stock-error').textContent='작은 도구의 수량은 0~1,000 사이 정수로 입력하세요.';return false;}}state.small=n;return true;}
 function save(go=false){
  const invalidPrice=document.querySelector('[data-price-key]:invalid');if(invalidPrice){invalidPrice.closest('details').open=true;invalidPrice.focus();invalidPrice.reportValidity();return;}
  if(num('workers')!==state.workers||!Number.isInteger(num('workers'))){$('worker-error').textContent='동시 작업 인원을 1~6명으로 입력해 주세요.';$('workers').focus();return;}
  if(num('aisle-width')!==state.aisle){say('입력한 통로 폭을 먼저 적용해 주세요.');$('apply-aisle').focus();return;}
  if(areaPending){$('area-error').textContent='입력한 주방 크기를 먼저 적용해 주세요.';$('apply-area').focus();return;}
  if(itemPending){$('item-error').textContent='장비 정보 적용을 먼저 눌러주세요.';$('apply-item').focus();return;}
  const current=read('sim.space.v1.'+code);if(sourceChanged||current?.areaSqm!==state.areaSqm){sourceChanged=true;render();$('save-status').textContent='앞 단계의 면적이 바뀌었어요. 새로고침해 다시 불러오세요.';return;}
  if(!applyStock()||!collectSmall()||M.dims(state).k<=state.aisle)return;
  try{const value=M.snapshot(state,code);localStorage.setItem('sim.kitchen.v1.'+code,JSON.stringify(value));changed=false;$('save-status').textContent='주방 배치와 용품 계획을 저장했어요. 4페이지에서 같은 주방 영역을 적용합니다.';if(go)location.href='interior.html?district='+encodeURIComponent(code);}catch(_){$('save-status').textContent='저장하지 못했어요. 배치·입력값 또는 브라우저 저장 공간을 확인하세요. 현재 작업은 유지됩니다.';}
 }
 function setup(){
  document.querySelectorAll('[data-apply-kind]').forEach(b=>b.onclick=()=>applyLayoutKind(b.dataset.applyKind));
  document.querySelectorAll('[data-preview-kind]').forEach(b=>b.onclick=()=>previewLayout(b.dataset.previewKind));
  $('layout-explain').onclick=()=>previewLayout(state.layoutPlan?.kind||'rows');
  document.querySelector('.stock-panel').addEventListener('input',changeSupplyPrice);
  $('preview-close').onclick=$('preview-cancel').onclick=()=>$('layout-preview').close();
  $('layout-preview').addEventListener('close',()=>{previewKind=null;previewResult=null;});
  $('preview-apply').onclick=()=>{
   if(!previewReady()||!previewResult?.ok)return;
   applyLayoutKind(previewKind);
  };
  catalog();const smallNames={pitcher:'밀크피처',tamper:'탬퍼',scale:'저울',brush:'청소 브러시',scoop:'얼음스쿱',cloth:'행주'};for(const [k,name] of Object.entries(smallNames)){const card=document.createElement('details');card.className='small-card stock-card';card.innerHTML='<summary><h4>'+name+'</h4><div class="stock-total"><span id="small-count-'+k+'">'+state.small[k]+'개</span> <small>준비 계획</small></div></summary><div class="stock-card-detail"><label>'+name+' 수량 (개)<input id="small-'+k+'" type="number" min="0" max="1000" step="1"></label><div data-supply-price="'+k+'"></div></div>';const input=card.querySelector('input');input.addEventListener('input',()=>{dirty();if(collectSmall())render();});$('small-inputs').append(card);}

  $('category').onchange=catalog;$('selected').onchange=()=>select(Number($('selected').value),true);
  function applyWorkers(){const workers=num('workers');if(!Number.isInteger(workers)||!M.finite(workers,1,6)){$('worker-error').textContent='동시에 주방에서 일하는 사람을 1~6명으로 입력하세요.';return;}$('worker-error').textContent='';if(workers===state.workers)return;checkpoint();state.workers=workers;const message=syncLayout();render();dirty();say(message);}
  $('workers').onchange=applyWorkers;$('workers').oninput=()=>{dirty();if(Number.isInteger(num('workers'))&&M.finite(num('workers'),1,6))applyWorkers();};
  $('apply-recommendation').onclick=()=>{if(num('workers')!==state.workers){$('worker-error').textContent='작업 인원을 올바르게 입력한 뒤 추천을 적용하세요.';return;}const result=M.applyRecommendation(state);if(!result.ok)return;checkpoint();state=result.state;fillArea();render();dirty();$('area-error').textContent='';say('현재 메뉴·장비·인원의 추천 면적과 통로를 적용했어요. 장비와 용품 수량은 그대로 유지됩니다.');};
  const delta={left:[-.05,0],right:[.05,0],up:[0,-.05],down:[0,.05]};document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(...delta[b.dataset.move]));$('rotate').onclick=()=>move(0,0,true);$('remove').onclick=remove;
  $('undo').onclick=()=>{if(!history.length)return;state=history.pop();fillArea();fillStock();render();dirty();say('이전 상태로 되돌렸어요.');};
  function applyLayout(withArea=false){
   if(num('workers')!==state.workers||areaPending||itemPending){say('입력 중인 인원·공간 크기·장비 정보를 먼저 적용해 주세요.');return;}
   const r=M.planLayout(withArea?{...state,areaMode:'recommended'}:state);if(!r.ok){say(r.reason);return;}
   checkpoint();state=r.state;selected=null;fillArea();render();dirty();say('메뉴·'+state.workers+'명 기준 추천 배치를 적용했어요. 장비를 직접 옮길 수 있고, 되돌리기로 이전 배치를 복원할 수 있어요.');
  }
  $('starter').onclick=()=>applyLayout();$('layout-with-area').onclick=()=>applyLayout(true);
  document.querySelectorAll('[data-menu]').forEach(el=>el.onchange=()=>{checkpoint();state.menus[el.dataset.menu]=el.checked;const message=syncLayout();render();dirty();say(message);});
  for(const id of ['kitchen-pyeong','room-width'])$(id).oninput=()=>{areaPending=true;if(id==='kitchen-pyeong')kitchenAreaEdited=true;dirty();};
  $('kitchen-ratio').oninput=()=>{$('kitchen-pyeong').value=state.areaSqm*num('kitchen-ratio')/100/M.PYEONG;$('ratio-label').textContent=$('kitchen-ratio').value+'%';areaPending=true;kitchenAreaEdited=true;};$('kitchen-ratio').onchange=areaApply;$('apply-area').onclick=areaApply;
  $('apply-aisle').onclick=()=>{const n=M.clone(state);n.aisle=num('aisle-width');n.areaMode='manual';if(!M.validate(n)){say('통로 가정을 0.3~2m로 입력하세요.');return;}checkpoint();state=n;manualLayout();render();dirty();say('작업 통로를 직접 바꿨어요. 위치 조정 표시가 있는지 확인하세요.');};
  for(const id of ['item-width','item-depth','item-price'])$(id).oninput=()=>{itemPending=true;dirty();};
  $('item-price').addEventListener('input',()=>{$('item-price').dataset.edited='true';});
  $('apply-item').onclick=()=>{const i=state.items.find(i=>i.id===selected);if(!i)return;const w=num('item-width')/100,d=num('item-depth')/100,p=$('item-price').value.trim()===''?null:num('item-price')*10000;if(!M.finite(w,.05,5)||!M.finite(d,.05,5)||(p!==null&&!M.finite(p,0,1e10))){$('item-error').textContent='폭·깊이 5~500cm, 가격은 0 이상으로 입력하세요.';return;}const r=M.transform(state,i.id,{w,d});if(!r.ok){$('item-error').textContent=r.reason;return;}checkpoint();state=r.state;if(w!==i.w||d!==i.d)manualLayout();if($('item-price').dataset.edited==='true'){if(p===null)delete state.prices[i.type];else state.prices[i.type]=p;}render();dirty();say('장비 정보가 적용됐어요.');};
  $('apply-stock').onclick=applyStock;document.querySelectorAll('.stock-inputs input').forEach(el=>el.oninput=dirty);$('stock-rows').addEventListener('input',dirty);$('stock-rows').addEventListener('click',e=>{if(e.target.hasAttribute('data-stock-apply')){applyStock();return;}const k=e.target.dataset.reset;if(!k)return;document.querySelector('[data-stock="'+k+'"] [data-field="buy"]').value='';applyStock();});
  $('use-seats').onclick=()=>{const saved=read('sim.interior.v1.'+code);const seats=saved?.costs?.seats;if(saved?.schemaVersion!==1||saved.districtCode!==code||saved.sourceAreaSqm!==state.areaSqm||saved.sourceKitchenAreaSqm!==state.kitchenArea||!saved.kitchenLinked||saved.isAreaExperiment||!Number.isInteger(seats)||!M.finite(seats,0,500)){$('stock-error').textContent='현재 매장·주방 면적과 일치하는 4페이지 저장 배치가 필요해요. 그 전에는 계획 좌석을 직접 입력하세요.';return;}$('stock-seats').value=seats;if(applyStock())$('seat-origin').textContent='4페이지의 저장된 계획 좌석 '+seats+'석을 가져왔어요.';};
  $('save').onclick=()=>save();$('next').onclick=()=>save(true);
  $('objects').addEventListener('click',e=>{const el=e.target.closest('.k-object');if(el)select(Number(el.dataset.id));});
  $('objects').addEventListener('keydown',e=>{const el=e.target.closest('.k-object');if(!el)return;select(Number(el.dataset.id));const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(keys[e.key]){e.preventDefault();move(...delta[keys[e.key]]);}else if(e.key.toLowerCase()==='r'){e.preventDefault();move(0,0,true);}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}});
  $('objects').addEventListener('pointerdown',e=>{const el=e.target.closest('.k-object');if(!el||e.button!==0)return;select(Number(el.dataset.id));drag={id:selected,before:M.clone(state),start:M.clone(state.items.find(i=>i.id===selected)),x:e.clientX,y:e.clientY,moved:false,el};el.setPointerCapture(e.pointerId);el.classList.add('dragging');});
  $('objects').addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)/SCALE,dy=(e.clientY-drag.y)/SCALE;if(!drag.moved&&Math.hypot(dx,dy)<.04)return;drag.moved=true;const x=Math.round((drag.start.x+dx)*20)/20,y=Math.round((drag.start.y+dy)*20)/20;drag.result=M.transform(drag.before,drag.id,{x,y});if(drag.result.state){for(const i of drag.result.state.items.filter(i=>i.id===drag.id||i.supportId===drag.id)){const el=document.querySelector('.k-object[data-id="'+i.id+'"]');if(el)position(el,i);}}drag.el.classList.toggle('invalid',!drag.result.ok);});
  function end(cancel){if(!drag)return;const d=drag;drag=null;if(!cancel&&d.moved&&d.result?.ok){history.push(d.before);if(history.length>35)history.shift();state=d.result.state;manualLayout();dirty();render();say('장비를 옮겼어요.');}else{render();if(d.moved)say(cancel?'이동을 취소했어요.':(d.result?.reason||'놓을 수 없는 위치')+' · 원래 자리로 돌아왔어요.');}}
  $('objects').addEventListener('pointerup',()=>end(false));$('objects').addEventListener('pointercancel',()=>end(true));$('objects').addEventListener('lostpointercapture',()=>{if(drag)end(true);});
 }
 async function load(){try{
  const res=await fetch('data/seoul-districts.geojson');if(!res.ok)throw Error();const geo=await res.json();code=new URLSearchParams(location.search).get('district');if(code===null){try{code=localStorage.getItem('sim.district');}catch(_){}}
  const region=geo.features.find(f=>f.properties.code===code)?.properties;if(!region){$('loading').innerHTML='<h1>먼저 지역을 골라주세요.</h1><a href="map.html">지역 고르기 →</a>';return;}
  const space=read('sim.space.v1.'+code);if(space?.schemaVersion!==1||space.districtCode!==code||!M.finite(space.areaSqm,1,10000)){$('loading').innerHTML='<h1>저장한 매장 면적이 필요해요.</h1><p>공간 조건에서 면적을 저장해 주세요. 이 평면도는 1㎡ 이상을 지원합니다.</p><a href="space.html?district='+code+'">공간 조건 설정 →</a>';return;}
  const saved=read('sim.kitchen.v1.'+code);state=M.restore(saved,code,space.areaSqm)||M.initialLayout(space.areaSqm);if(saved&&!M.restore(saved,code,space.areaSqm)){$('notice').hidden=false;$('notice').textContent='저장한 주방의 면적이나 형식이 현재 조건과 달라 새 배치를 열었어요. 이전 기록은 새로 저장할 때까지 유지됩니다.';}
  $('region').textContent=region.name;$('total-area').textContent='전체 '+(space.areaSqm/M.PYEONG).toFixed(1)+'평 · '+space.areaSqm.toFixed(1)+'㎡';$('back-space').href='space.html?district='+code;setup();fillArea();fillStock();render();$('loading').hidden=true;$('app').hidden=false;if(M.restore(saved,code,space.areaSqm))$('save-status').textContent='저장한 주방 배치와 용품 계획을 불러왔어요.';else say(state.layoutMode==='recommended'?'메뉴·1명 기준 추천 배치로 시작했어요. 인원을 바꾸거나 장비를 직접 옮겨보세요.':M.planLayout(state).reason);
 }catch(e){$('loading').innerHTML='<h1>주방 정보를 불러오지 못했어요.</h1><p>연결을 확인한 뒤 다시 시도해 주세요.</p><button id="reload">다시 불러오기</button>';$('reload').onclick=()=>location.reload();}}
 window.addEventListener('storage',e=>{if(e.key==='sim.space.v1.'+code){sourceChanged=true;$('notice').hidden=false;$('notice').textContent='앞 단계의 공간 조건이 변경됐어요. 새로고침해 최신 면적을 적용하세요.';if(state)render();}});
 window.addEventListener('beforeunload',e=>{if(changed){e.preventDefault();e.returnValue='';}});
 load();
})();
