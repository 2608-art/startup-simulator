(() => {
 'use strict';
 const M=InteriorModel,$=id=>document.getElementById(id),C=M.CATALOG;
 let state,code,sourceArea,sourceKitchen,sourceWidth=null,kitchenStamp='',kitchenLinked=false,selected=null,history=[],drag=null,districtName='';
 const money=n=>(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원';
 const say=t=>$('action-status').textContent=t;
 const readStore=key=>{try{return JSON.parse(localStorage.getItem(key));}catch(_){return null;}};
 function icon(type){
  const art={
   table2:'<rect x="9" y="9" width="82" height="82" rx="10" fill="#c49b71" stroke="#805b3d" stroke-width="3"/><path d="M16 31H84M16 65H84" stroke="#b3875d" stroke-width="2"/>',
   table4:'<rect x="4" y="5" width="92" height="90" rx="8" fill="#c49b71" stroke="#805b3d" stroke-width="3"/><path d="M12 34H88M12 67H88" stroke="#b3875d" stroke-width="2"/>',
   chair:'<rect x="16" y="17" width="68" height="68" rx="20" fill="#697963" stroke="#46533f" stroke-width="4"/><path d="M16 73Q50 93 84 73" fill="none" stroke="#394834" stroke-width="10"/>',
   window:'<rect x="3" y="5" width="35" height="90" rx="4" fill="#d2ac81" stroke="#805b3d" stroke-width="3"/><circle cx="70" cy="50" r="23" fill="#697963" stroke="#46533f" stroke-width="4"/><circle cx="20" cy="23" r="7" fill="#fff7e7"/>',
   pendant:'<circle cx="50" cy="50" r="38" fill="#f7da88" stroke="#9b742b" stroke-width="4"/><circle cx="50" cy="50" r="18" fill="#fff7cf"/><path d="M50 5V25" stroke="#9b742b" stroke-width="4"/>',
   plant:'<circle cx="50" cy="53" r="30" fill="#ac7950"/><ellipse cx="35" cy="39" rx="18" ry="29" transform="rotate(-40 35 39)" fill="#63845a"/><ellipse cx="65" cy="39" rx="18" ry="29" transform="rotate(40 65 39)" fill="#829b6b"/><ellipse cx="49" cy="66" rx="17" ry="25" fill="#476e4d"/>',
   sofa:'<rect x="3" y="6" width="94" height="85" rx="12" fill="#6d826d" stroke="#455b46" stroke-width="3"/><rect x="15" y="12" width="33" height="55" rx="8" fill="#a6b39b"/><rect x="52" y="12" width="33" height="55" rx="8" fill="#a6b39b"/><path d="M12 76H88" stroke="#455b46" stroke-width="6"/>',
   shelf:'<rect x="3" y="6" width="94" height="88" rx="4" fill="#d1ae88" stroke="#805b3d" stroke-width="4"/><path d="M6 45H94M32 6V45M67 6V45" stroke="#805b3d" stroke-width="3"/><path d="M14 15V36M23 15V36M42 15V36M54 15V36" stroke="#76866d" stroke-width="6"/>',
   return:'<rect x="3" y="6" width="94" height="88" rx="4" fill="#bba58e" stroke="#74614e" stroke-width="4"/><rect x="12" y="18" width="39" height="64" rx="4" fill="#eee5d4"/><circle cx="73" cy="36" r="15" fill="#d4e6e8" stroke="#7e9fa3" stroke-width="3"/><rect x="61" y="62" width="24" height="18" fill="#fbf7ef"/>'
  };
  return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+art[type]+'</svg>';
 }
 function checkpoint(){history.push(M.clone(state));if(history.length>40)history.shift();}
 function dirty(){ $('save-status').textContent='변경사항이 있어요. 배치와 예산을 저장해 주세요.'; }
 function priceValid(){
  let valid=true;for(const el of document.querySelectorAll('.price-settings input')){const ok=M.validNumber(el.value,Number(el.min),Number(el.max));el.setAttribute('aria-invalid',String(!ok));if(!ok)valid=false;}
  $('price-error').textContent=valid?'':'빈칸을 채우고 허용 범위 안의 단가를 입력해 주세요. 비용이 없으면 0을 입력하세요.';
  return valid;
 }
 function fillControls(){
  $('room-width-input').value=state.width;$('kitchen-area-input').value=state.kitchenArea;
  $('room-width-input').readOnly=sourceWidth!==null;
  $('kitchen-area-input').readOnly=kitchenLinked;
  $('construction-rate').value=state.rate;$('contingency').value=state.contingency;
  $('experiment-area').value=Number(((state.areaSqm-state.kitchenArea)/M.PYEONG).toFixed(2));
  for(const key of Object.keys(C))$('price-'+key).value=state.prices[key];
 }
 function renderCosts(){
  StartupBudget.preview('interior',{schemaVersion:1,districtCode:code,sourceAreaSqm:sourceArea,sourceKitchenAreaSqm:sourceKitchen,isAreaExperiment:state.areaSqm!==sourceArea,layout:state});
  const valid=priceValid(),cost=M.costs(state),bad=M.invalidItems(state);
  $('total').textContent=valid?(cost.total/10000).toLocaleString('ko-KR',{maximumFractionDigits:1}):'—';
  $('construction-cost').textContent=valid?money(cost.construction):'—';$('furniture-cost').textContent=valid?money(cost.furniture):'—';$('reserve-cost').textContent=valid?money(cost.reserve):'—';$('reserve-percent').textContent=state.contingency;
  $('save-layout').disabled=$('next-operations').disabled=!valid||bad.length>0;
  $('service-choice').hidden=cost.seats>0;
  if(cost.seats>0)$('takeout-only').checked=false;
  $('seat-count').textContent=cost.seats+'석';$('guest-area').textContent=((state.areaSqm-state.kitchenArea)/M.PYEONG).toFixed(1)+'평';$('item-count').textContent=state.items.length+'개';
  $('item-breakdown').replaceChildren();
  for(const [type,n] of Object.entries(cost.counts)){if(!n)continue;const row=document.createElement('div');row.className='budget-item';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=C[type].name+' × '+n;value.textContent=valid?money(n*state.prices[type]*10000):'—';row.append(label,value);$('item-breakdown').append(row);}
  if(!state.items.length)$('item-breakdown').textContent='아직 고른 물건이 없어요.';
  for(const key of Object.keys(C))$('catalog-price-'+key).textContent=state.prices[key]+'만원 · '+cost.counts[key]+'개 배치';
 }
 function select(id,focus=false){
  selected=state.items.some(i=>i.id===id)?id:null;$('selected-item').value=selected??'';
  document.querySelectorAll('.object').forEach(el=>{el.classList.toggle('selected',Number(el.dataset.id)===selected);el.setAttribute('aria-pressed',String(Number(el.dataset.id)===selected));});
  document.querySelectorAll('.move-tools button').forEach(el=>el.disabled=!selected);
  $('rotate').disabled=!selected||state.items.find(i=>i.id===selected)?.type==='window';
  if(focus&&selected)document.querySelector('.object[data-id="'+selected+'"]')?.focus({preventScroll:true});
 }
 function position(el,item){const d=M.dimensions(state),s=M.size(item),c=C[item.type];Object.assign(el.style,{left:item.x/d.w*100+'%',top:item.y/d.h*100+'%',width:s.w/d.w*100+'%',height:s.h/d.h*100+'%'});Object.assign(el.querySelector('svg').style,{position:'absolute',left:'50%',top:'50%',width:c.w/s.w*100+'%',height:c.h/s.h*100+'%',transform:'translate(-50%,-50%) rotate('+item.rot+'deg)'});}
 function render(){
  const d=M.dimensions(state),bad=M.invalidItems(state);$('room').style.width=(d.w*56)+'px';$('room').style.height=(d.h*56)+'px';$('room').dataset.level=state.level;
  $('room-width').textContent=d.w.toFixed(1)+'m × '+d.h.toFixed(1)+'m · 전체 '+(state.areaSqm/M.PYEONG).toFixed(1)+'평';
  $('kitchen-zone').style.height=(d.k/d.h*100)+'%';$('kitchen-zone').hidden=state.kitchenArea===0;$('kitchen-label').textContent=(state.kitchenArea/M.PYEONG).toFixed(1)+'평 · 배치 불가';
  $('window-line').style.top=(d.k/d.h*100)+'%';$('entrance').style.width=Math.min(d.w,1.2)/d.w*100+'%';$('entrance').style.height=Math.min(d.h-d.k,1.2)/d.h*100+'%';
  $('grid-count').textContent='한 칸 0.5m × 0.5m · '+Math.ceil(d.w/.5)*Math.ceil(d.h/.5)+'칸 (가장자리 부분칸·주방 포함). 큰 공간은 스크롤해 둘러보세요.';
  $('objects').replaceChildren();$('selected-item').replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='물건을 선택하세요';$('selected-item').append(empty);
  for(const item of state.items){
   const b=document.createElement('button');b.type='button';b.className='object'+(C[item.type].kind==='light'?' light':'')+(bad.includes(item.id)?' invalid':'');b.dataset.id=item.id;b.innerHTML=icon(item.type);b.title=C[item.type].name+' #'+item.id;b.setAttribute('aria-label',b.title+(bad.includes(item.id)?' · 위치 조정 필요':''));position(b,item);$('objects').append(b);
   const o=document.createElement('option');o.value=item.id;o.textContent=b.title+(bad.includes(item.id)?' (위치 조정 필요)':'');$('selected-item').append(o);
  }
  select(selected);$('undo').disabled=!history.length;
  document.querySelectorAll('[data-level]').forEach(el=>{if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(el.dataset.level===state.level));});
  const suggestion=M.suggestion(state);$('suggestion').textContent=`객석 ${((state.areaSqm-state.kitchenArea)/M.PYEONG).toFixed(1)}평 기준 시작 목표 ${suggestion.seats}석: 창가 ${suggestion.window}석, 2인 테이블 최대 ${suggestion.table2}개. 수납장 ${suggestion.shelf}개·셀프대 ${suggestion.return}개·화분 ${suggestion.plant}개. 실제 배치 수는 공간 모양에 따라 줄어듭니다.`;
  $('area-note').textContent=`앞 단계: 전체 ${(sourceArea/M.PYEONG).toFixed(1)}평 − 주방 ${(sourceKitchen/M.PYEONG).toFixed(1)}평 = 객석 ${((sourceArea-sourceKitchen)/M.PYEONG).toFixed(1)}평.${Math.abs(state.areaSqm-sourceArea)>.01?' 현재는 다른 크기를 비교 중이며 앞 단계의 면적은 바꾸지 않습니다.':' 이 남은 면적으로 배치와 비용을 계산합니다.'}`;
  renderCosts();
  if(bad.length)say('공간 조건이 달라져 '+bad.length+'개 물건의 위치를 조정해야 해요. 점선 표시를 옮기거나 삭제한 뒤 저장하세요.');
 }
 function add(type){
  const item=M.place(state,type);if(!item){say('놓을 자리가 부족해요. 물건을 옮기거나 공간 크기를 확인해 주세요. 한 배치는 최대 150개입니다.');return;}
  checkpoint();state.items.push(item);state.nextId++;selected=item.id;render();dirty();say(C[type].name+'을 추가했어요. 평면도에서 원하는 곳으로 옮겨보세요.');
 }
 function move(dx,dy,rotate=false){
  const i=state.items.find(i=>i.id===selected);if(!i)return;
  const next={...i,x:Math.round((i.x+dx)*10)/10,y:Math.round((i.y+dy)*10)/10,rot:rotate?(i.rot+90)%360:i.rot};
  if(!M.fits(state,next)){say(i.type==='window'?'창가 1인석은 왼쪽 창가에서 위아래로 옮길 수 있어요.':'다른 가구·주방·출입 공간과 겹치거나 공간 밖입니다.');return;}
  checkpoint();Object.assign(i,next);render();dirty();select(i.id,true);say('위치를 바꿨어요.');
 }
 function remove(){if(!selected)return;checkpoint();state.items=state.items.filter(i=>i.id!==selected);selected=null;render();dirty();say('물건을 삭제했어요. 되돌리기로 복원할 수 있습니다.');}
 function save(go=false){
  if(!priceValid()||M.invalidItems(state).length||!M.validate(state))return;
  if(M.costs(state).seats===0&&!$('takeout-only').checked){
   $('save-status').textContent='좌석을 배치하거나 포장 전용을 선택해 주세요.';
   $('takeout-only').focus();return;
  }
  const saved={serviceMode:M.costs(state).seats===0?'takeout':'seated',schemaVersion:1,districtCode:code,sourceAreaSqm:sourceArea,sourceKitchenAreaSqm:sourceKitchen,kitchenStamp,kitchenLinked,layout:M.clone(state),costs:M.costs(state),isAreaExperiment:Math.abs(state.areaSqm-sourceArea)>.01,modelVersion:'interior-scenario-v1',savedAt:new Date().toISOString()};
  try{localStorage.setItem('sim.interior.v1.'+code,JSON.stringify(saved));$('save-status').textContent=(kitchenLinked?'배치와 예산을 저장했어요.':'주방 미연결 임시 배치를 저장했어요.')+(saved.isAreaExperiment?' 앞 단계와 다른 면적의 비교안입니다.':'');if(go)location.href='operations.html?district='+encodeURIComponent(code);}catch(_){$('save-status').textContent='브라우저에 저장하지 못했어요. 현재 화면의 배치는 유지됩니다.';}
 }
 function resize(restore=false){
  const val=$('experiment-area').value;if(!restore&&!M.validNumber(val,2,100)){$('area-error').textContent='객석 실험 면적을 2~100평 사이로 입력하세요.';return;}
  const area=restore?sourceArea:Number(val)*M.PYEONG+state.kitchenArea,next=M.clone(state);next.areaSqm=area;next.width=sourceWidth??Math.round(Math.sqrt(area/1.3)*10)/10;if(restore)next.kitchenArea=sourceKitchen;
  if(!M.validate(next)){$('area-error').textContent='배치 가능한 공간 크기를 확인해 주세요.';return;}
  checkpoint();state=next;fillControls();render();dirty();$('area-error').textContent='';if(!M.invalidItems(state).length)say('칸 크기는 그대로, 공간의 칸 수가 바뀌었어요.');
 }
 function setup(){
  for(const [key,v] of Object.entries(M.LEVELS)){const b=document.createElement('button');b.className='level';b.dataset.level=key;b.innerHTML='<span class="swatch" aria-hidden="true"></span><span><strong>'+v.name+'</strong><small>'+v.rate+'만원/평 · 모의</small></span>';b.addEventListener('click',()=>{checkpoint();state.level=key;state.rate=v.rate;$('construction-rate').value=v.rate;render();dirty();say(v.name+' 마감으로 바꿨어요.');});$('levels').append(b);}
  for(const [key,c] of Object.entries(C)){
   const row=document.createElement('div');row.className='catalog-item';row.innerHTML='<div class="catalog-icon">'+icon(key)+'</div><div><strong>'+c.name+'</strong><small id="catalog-price-'+key+'"></small></div>';const b=document.createElement('button');b.textContent='+';b.title=c.note;b.setAttribute('aria-label',c.name+' 추가');b.dataset.add=key;b.addEventListener('click',()=>add(key));row.append(b);$('catalog').append(row);
   const label=document.createElement('label');label.textContent=c.name+' (만원/개)';const input=document.createElement('input');input.id='price-'+key;input.type='number';input.min='0';input.max='100000';input.step='any';label.append(input);$('price-inputs').append(label);
  }
  document.querySelector('.price-settings').addEventListener('input',()=>{dirty();if(priceValid()){checkpoint();state.rate=Number($('construction-rate').value);state.contingency=Number($('contingency').value);for(const k of Object.keys(C))state.prices[k]=Number($('price-'+k).value);}renderCosts();});
  $('selected-item').addEventListener('change',()=>select(Number($('selected-item').value)));
  const deltas={left:[-.1,0],right:[.1,0],up:[0,-.1],down:[0,.1]};document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>move(...deltas[b.dataset.move])));
  $('rotate').addEventListener('click',()=>move(0,0,true));$('remove').addEventListener('click',remove);
  $('undo').addEventListener('click',()=>{if(!history.length)return;state=history.pop();fillControls();render();dirty();say('이전 상태로 되돌렸어요.');});
  $('starter').addEventListener('click',()=>{checkpoint();state=M.starter(state);selected=null;render();dirty();say('시작 배치를 만들었어요. 실제 놓인 좌석은 '+M.costs(state).seats+'석입니다. 물건을 자유롭게 바꿔보세요.');});
  $('apply-room').addEventListener('click',()=>{const next=M.clone(state);next.width=Number($('room-width-input').value);if(!kitchenLinked)next.kitchenArea=Number($('kitchen-area-input').value);if($('room-width-input').value===''||$('kitchen-area-input').value===''||!M.validate(next)){$('room-error').textContent='가로 1~100m, 주방 면적은 전체보다 작게 입력하세요. 세로도 1~100m여야 합니다.';return;}checkpoint();state=next;fillControls();render();dirty();$('room-error').textContent='';});
  $('resize-area').addEventListener('click',()=>resize());$('restore-area').addEventListener('click',()=>resize(true));$('save-layout').addEventListener('click',()=>save());$('next-operations').addEventListener('click',()=>save(true));
  $('objects').addEventListener('keydown',e=>{select(Number(e.target.closest('.object')?.dataset.id));const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(keys[e.key]){e.preventDefault();move(...deltas[keys[e.key]]);}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}else if(e.key.toLowerCase()==='r'){e.preventDefault();move(0,0,true);}});
  $('objects').addEventListener('click',e=>{const b=e.target.closest('.object');if(b)select(Number(b.dataset.id));});
  $('objects').addEventListener('pointerdown',e=>{const b=e.target.closest('.object');if(!b||e.button!==0)return;select(Number(b.dataset.id));const i=state.items.find(i=>i.id===selected);drag={item:M.clone(i),before:M.clone(state),el:b,x:e.clientX,y:e.clientY,moved:false};b.setPointerCapture(e.pointerId);b.classList.add('dragging');});
  $('objects').addEventListener('pointermove',e=>{if(!drag)return;const d=M.dimensions(state),rect=$('room').getBoundingClientRect(),i=state.items.find(i=>i.id===drag.item.id);if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<3&&!drag.moved)return;drag.moved=true;i.x=Math.round((drag.item.x+(e.clientX-drag.x)/(rect.width-13)*d.w)*10)/10;i.y=Math.round((drag.item.y+(e.clientY-drag.y)/(rect.height-10)*d.h)*10)/10;if(i.type==='window')i.x=.1;position(drag.el,i);drag.el.classList.toggle('invalid',!M.fits(state,i));});
  function endDrag(cancel){if(!drag)return;const i=state.items.find(i=>i.id===drag.item.id),ok=!cancel&&M.fits(state,i);if(!ok)Object.assign(i,drag.item);else if(drag.moved){history.push(drag.before);if(history.length>40)history.shift();dirty();}const moved=drag.moved;drag=null;render();if(moved)say(ok?'물건을 옮겼어요.':'놓을 수 없는 위치여서 원래 자리로 돌렸어요.');}
  $('objects').addEventListener('pointerup',()=>endDrag(false));$('objects').addEventListener('pointercancel',()=>endDrag(true));
 }
 function kitchenRecord(){const v=readStore('sim.kitchen.v1.'+code);return v?.schemaVersion===1&&v.districtCode===code&&v.spaceAreaSqm===sourceArea&&M.validNumber(v.kitchenAreaSqm,0,sourceArea-.1)?v:null;}
 function start(kitchen,linked,roomWidth=null){
  sourceKitchen=kitchen;kitchenLinked=linked;const saved=readStore('sim.interior.v1.'+code);state=M.restore(saved,code,sourceArea)||M.fresh(sourceArea);
  const restored=!!M.restore(saved,code,sourceArea);if(!restored||saved.sourceKitchenAreaSqm!==kitchen){state.kitchenArea=kitchen;if(restored){$('restored-note').textContent='주방 면적이 바뀌었어요. 남은 공간과 가구 위치를 다시 확인하세요.';$('restored-note').hidden=false;}}
  sourceWidth=linked&&typeof roomWidth==='number'&&M.validNumber(roomWidth,1,100)&&M.validNumber(sourceArea/roomWidth,1,100)?roomWidth:null;
  if(sourceWidth!==null){if(restored&&state.width!==sourceWidth){$('restored-note').textContent='3페이지의 매장 가로 길이가 바뀌었어요. 가구 위치를 다시 확인하세요.';$('restored-note').hidden=false;}state.width=sourceWidth;}
  if(!M.validate(state)){$('loading').textContent='이 면적은 현재 평면도로 표현하기 어렵습니다. 공간 조건의 면적을 확인해 주세요.';return;}
  $('takeout-only').checked=saved?.serviceMode==='takeout';
  $('choose-seats').onclick=()=>{$('starter').focus();$('starter').scrollIntoView({block:'center'});say('시작 배치를 적용하거나 가구 목록에서 좌석을 추가하세요.');};
  setup();fillControls();render();$('loading').hidden=true;$('studio-content').hidden=false;
  $('region').textContent=districtName;$('space-size').textContent='전체 '+(sourceArea/M.PYEONG).toFixed(1)+'평 · 주방 '+(sourceKitchen/M.PYEONG).toFixed(1)+'평';$('space-link').href='space.html?district='+code;
  $('kitchen-origin').textContent=linked?'3페이지에서 저장한 주방 면적을 적용했습니다. 주방 면적'+(sourceWidth!==null?'과 매장 가로 길이':'')+'는 3페이지에서 바꿔 주세요.':'주방 미연결: 직접 입력한 임시 면적으로 미리 보고 있습니다. 실제 주방 저장값이 생기면 그 값을 우선 적용합니다.';
  if(!linked){$('restored-note').textContent='주방 미연결 미리보기입니다. 3페이지의 실제 주방 면적이 연결되면 남은 공간을 다시 계산합니다.';$('restored-note').hidden=false;}
  if(restored)$('save-status').textContent='저장한 배치를 불러왔어요.';
 }
 async function load(){
  try{const r=await fetch('data/seoul-districts.geojson');if(!r.ok)throw Error();const geo=await r.json();code=new URLSearchParams(location.search).get('district');if(code===null){try{code=localStorage.getItem('sim.district');}catch(_){}}const region=geo.features.find(f=>f.properties.code===code)?.properties;if(!region){$('loading').innerHTML='<h1>먼저 지역을 골라주세요.</h1><a href="map.html">지역 지도 열기 →</a>';return;}districtName=region.name;
   const saved=readStore('sim.space.v1.'+code);sourceArea=M.spaceArea(saved,code);if(sourceArea===null){$('loading').innerHTML='<h1>저장된 공간 면적이 필요해요.</h1><p>공간 조건에서 면적을 정하고 저장한 뒤 돌아와 주세요.</p><a href="space.html?district='+code+'">공간 조건 설정 →</a>';return;}
   const kitchen=kitchenRecord();if(kitchen){kitchenStamp=kitchen.savedAt||'';start(Number(kitchen.kitchenAreaSqm),true,kitchen.roomWidthM);return;}
   $('loading').innerHTML='<div class="panel"><h1>주방 면적을 기다리고 있어요.</h1><p>전체 '+(sourceArea/M.PYEONG).toFixed(1)+'평에서 3페이지가 저장한 주방 면적을 뺀 공간을 꾸밉니다.</p><p>연결 전에는 주방 면적을 직접 입력해 임시로 미리 볼 수 있어요.</p><label for="preview-kitchen">임시 주방 면적 (평)</label><input id="preview-kitchen" type="number" min="0" step=".1" style="max-width:220px;display:block;margin:12px 0"><button id="preview-start">이 면적으로 미리보기</button><p id="preview-error" class="error" role="status"></p><p><a href="space.html?district='+code+'">공간 조건 확인 →</a></p></div>';
   $('preview-start').addEventListener('click',()=>{const value=$('preview-kitchen').value;if(!M.validNumber(value,0,(sourceArea-.1)/M.PYEONG)){$('preview-error').textContent='전체 면적보다 작은 주방 평수를 입력하세요.';return;}start(Number(value)*M.PYEONG,false);});
  }catch(_){$('loading').innerHTML='<h1>공간 정보를 불러오지 못했어요.</h1><p>연결을 확인한 뒤 다시 시도해 주세요.</p><button id="reload">다시 불러오기</button>';$('reload').onclick=()=>location.reload();}
 }
 window.addEventListener('storage',e=>{if(e.key==='sim.kitchen.v1.'+code||e.key==='sim.space.v1.'+code){$('restored-note').hidden=false;$('restored-note').textContent='앞 단계의 조건이 변경됐어요. 현재 배치를 저장한 뒤 새로고침해 최신 면적을 적용하세요.';}});
 load();
})();
