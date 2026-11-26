(() => {
 'use strict';
 const $=id=>document.getElementById(id),M=SpaceModel;
 let district=null,reference=null,currentResult=null,oldUnit='sqm';
 let hotspotId='',footfall=null;
 let comparisonPending=false,hasUserEdits=false;
 const fieldKeys=Object.keys(M.DEFAULTS).filter(k=>k!=='mode');
 const money=v=>(v/10000).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})+'만원';
 const quarter=q=>`${q.slice(0,4)}년 ${q.slice(4)}분기`;
 const floorName=f=>f<0?`지하 ${-f}층`:`지상 ${f}층`;
 function read(){const s={};for(const k of fieldKeys)s[k]=$(k).value;s.mode=document.querySelector('input[name="priceMode"]:checked').value;return s;}
 function fill(s){for(const k of fieldKeys)$(k).value=s[k];document.querySelector(`input[name="priceMode"][value="${s.mode}"]`).checked=true;oldUnit=s.unit;}
 function clearComparisonQuery(){try{const url=new URL(location.href);for(const key of ['compareArea','compareFloor','comparePricing','compareDeposit','compareMonthly','compareLocation','compareRentFactor','compareTrafficFactor'])url.searchParams.delete(key);history.replaceState(null,'',url);}catch(_){}comparisonPending=false;}
 function applyComparison(base,transfer){const result={...base,...transfer.inputs};if(result.mode==='manual'&&String(base.premium).trim()!==''&&Number.isFinite(Number(base.premium))&&Number(base.premium)>=0&&Number(base.premium)<=10000000)result.premium=base.premium;return result;}
 function comparisonNotice(transfer){return `비교에서 선택한 ${transfer.label} 조건을 적용했어요. ${transfer.inputs.mode==='manual'?'직접 입력한 보증금·월세를 그대로 적용합니다.':'보증금·월세는 비교와 같은 가정으로 계산합니다.'} 확인 후 조건을 저장해 주세요.`;}
 function updateComparisonReturn(state){
  const row=M.rentalArea(reference,district.code,hotspotId),visible=Boolean(hotspotId&&row);
  $('comparison-return-box').hidden=!visible;
  const result=visible?M.comparisonReturn(state,district.code,hotspotId,reference):null;
  const base='map.html?district='+district.code+(hotspotId?'&hotspot='+encodeURIComponent(hotspotId):'');
  const href=result?.status==='ready'?result.url:base+'&openCompare=1';
  $('comparison-return').href=href;
  $('comparison-return-help').textContent=result?.status==='ready'?`돌아가면 이 번화가의 면적·층과 ${state.mode==='manual'?'직접 입력한 보증금·월세를 반영해요.':'비교 기준으로 다시 계산한 추정값을 반영해요.'} 다른 번화가 조건과 금액은 유지됩니다.`:result?.message||'';
  let connected=new URLSearchParams(location.search).has('compareArea');
  try{const ids=JSON.parse(localStorage.getItem('sim.hotspotCompare.v1'));connected=connected||Array.isArray(ids)&&ids.includes(hotspotId);}catch(_){}
  for(const id of ['change-region','header-map-link'])$(id).href=visible&&connected?href:base;
  try{if(visible&&connected&&result?.status==='ready')sessionStorage.setItem('sim.comparisonReturn.v1',result.url);else sessionStorage.removeItem('sim.comparisonReturn.v1');}catch(_){}
 }
 function errors(result){
  for(const k of fieldKeys){const el=$(k+'-error');if(!el)continue;const msg=result.errors?.[k];el.textContent=msg||'';el.hidden=!msg;$(k).setAttribute('aria-invalid',msg?'true':'false');}
 }
 function readLocationComparison(){return Object.fromEntries(['road','alley'].map(side=>[side,{rentFactor:$(side+'-rent').value,trafficFactor:$(side+'-traffic').value}]));}
 function loadLocationComparison(){
  let restored=null,message='이 지역의 지수를 바꾸면 이 브라우저에 자동 저장됩니다.';
  try{
   const raw=localStorage.getItem(M.locationComparisonKey(district.code,hotspotId));
   if(raw){restored=M.restoreLocationComparison(JSON.parse(raw),district.code,hotspotId);message=restored?'이 지역에 저장한 대로변·골목 지수를 불러왔어요.':'저장한 지수를 확인할 수 없어 예시값을 표시합니다. 값을 수정하면 새 지수를 저장해요.';}
  }catch(_){message='저장한 지수를 불러오지 못해 예시값을 표시합니다. 브라우저 저장 기능을 확인해 주세요.';}
  for(const side of ['road','alley']){const config=restored?.[side]||M.locationPreset(side);$(side+'-rent').value=config.rentFactor;$(side+'-traffic').value=config.trafficFactor;}
  $('location-compare-save-status').textContent=message;
  $('location-compare-apply-status').textContent='';
 }
 function saveLocationComparison(){
  const saved=M.locationComparisonSnapshot(district.code,hotspotId,readLocationComparison());
  if(!saved){$('location-compare-save-status').textContent='지수를 확인해 주세요. 마지막으로 저장한 값은 유지됩니다.';return false;}
  try{localStorage.setItem(M.locationComparisonKey(district.code,hotspotId),JSON.stringify(saved));$('location-compare-save-status').textContent='이 지역의 대로변·골목 지수를 이 브라우저에 저장했어요.';return true;}
  catch(_){$('location-compare-save-status').textContent='저장하지 못했어요. 입력값은 이 화면에 유지됩니다. ‘지수 다시 저장’을 눌러 재시도해 주세요.';return false;}
 }
 function updateLocationComparison(state,row){
  const scenarios=readLocationComparison();
  const pair=M.compareLocations(state,row,reference?.floorReference,scenarios);
  const v=M.validate({...M.DEFAULTS,area:state.area,unit:state.unit,floor:state.floor,floorZone:state.floorZone});
  $('location-compare-condition').textContent=`${row?.name||district.name} · 양쪽 공통: ${v.valid?`${(v.areaSqm/M.SQM_PER_PYEONG).toLocaleString('ko-KR',{maximumFractionDigits:2})}평 · ${floorName(v.floor)}`:'위에서 면적·층을 확인해 주세요.'}`;
  for(const side of ['road','alley'])for(const [field,key] of [['rent','rentFactor'],['traffic','trafficFactor']]){
   const id=side+'-'+field,msg=pair.locations[side].errors[key]||'';
   $(id).setAttribute('aria-invalid',String(!!msg));$(id+'-error').textContent=msg;$(id+'-error').hidden=!msg;
  }
  const baseFlow=FootfallModel.find(footfall,district.code,hotspotId);
  const roadFlow=FootfallModel.estimate(baseFlow,pair.locations.road.traffic),alleyFlow=FootfallModel.estimate(baseFlow,pair.locations.alley.traffic);
  for(const side of ['road','alley'])$(side+'-flow-value').textContent=FootfallModel.format(side==='road'?roadFlow:alleyFlow)+' / 일';
  $('location-flow-delta').textContent=roadFlow!==null&&alleyFlow!==null?'하루 평균: '+FootfallModel.format(Math.abs(alleyFlow-roadFlow))+' '+(alleyFlow<roadFlow?'감소':alleyFlow>roadFlow?'증가':'차이 없음'):'';
  const ready=pair.status==='ready';
  $('apply-alley-location').checked=state.locationType==='alley';
  $('location-compare-status').textContent=ready?`양쪽 모두 추정값 · 보증금은 월세 ${state.depositMonths}개월분.${state.mode==='manual'?' 직접 입력한 계약금액과 별도로 계산하며 입력 금액은 유지됩니다.':''}`:'비교값을 계산할 수 없어요. 지수와 위의 면적·층, 모의 계산 가정 및 참고자료를 확인해 주세요.';
  for(const side of ['road','alley'])for(const field of ['deposit','monthly','traffic'])$(side+'-'+field+'-value').textContent=ready?(field==='traffic'?pair.locations[side].traffic.toLocaleString('ko-KR'):money(pair[side][field])+(field==='monthly'?' / 월':'')):'—';
  for(const [field,label] of [['deposit','보증금'],['monthly','월세'],['traffic','유동 가정']]){
   const el=$('location-'+field+'-delta'),delta=pair.changes?.[field];
   el.className=delta?.amount>0?'is-increase':delta?.amount<0?'is-decrease':'';
   if(!delta){el.textContent=label+' —';continue;}
   const amount=field==='traffic'?Math.abs(delta.amount).toLocaleString('ko-KR',{maximumFractionDigits:2})+'포인트':money(Math.abs(delta.amount));
   el.textContent=label+': '+(delta.amount===0?'차이 없음':`${amount} ${delta.amount<0?'감소':'증가'}`)+(delta.percent===null?' (대로변이 0이므로 비율 계산 불가)':` (${Math.abs(delta.percent).toLocaleString('ko-KR',{maximumFractionDigits:1})}%${delta.amount===0?'':delta.amount<0?' 감소':' 증가'})`);
  }
 }
 function update(dirty=false){
  if(!district)return;
  if(dirty)hasUserEdits=true;
  const state=read(),row=M.rentalArea(reference,district.code,hotspotId);
  currentResult=M.calculate(state,row,reference?.floorReference);if(currentResult.status==='ready'&&typeof StartupBudget!=='undefined')StartupBudget.preview('space',M.snapshot(district.code,state,currentResult,reference,hotspotId));
  updateLocationComparison(state,row);
  const r=currentResult,auto=state.mode==='auto';
  const loc=M.locationScenario(state),change=n=>n===100?'기준과 같음':`${Math.abs(n-100).toLocaleString('ko-KR')}% ${n<100?'감소':'증가'} 가정`;
  $('location-impact').textContent=loc.valid?`${loc.label} · ${auto?'임대료 '+change(loc.rent):'직접 입력 금액 유지'} · 유동 ${loc.traffic} / 기준 100 (${change(loc.traffic)})`:'입지 가정 지수를 확인해 주세요.';
  const baseFlow=FootfallModel.find(footfall,district.code,hotspotId);
  $('location-flow').textContent=baseFlow?`하루 평균 추정 유동인구 · ${FootfallModel.format(FootfallModel.estimate(baseFlow,loc.traffic))} / 일 · ${baseFlow.scopeLabel} · ${loc.label}`:'유동인구 추정 자료를 불러오지 못했어요. 새로고침으로 다시 시도할 수 있어요.';
  errors(r);
  $('area-help').textContent=r.areaSqm===null?'면적을 입력해 주세요.':state.unit==='sqm'?`약 ${(r.areaSqm/M.SQM_PER_PYEONG).toFixed(2)}평`:`약 ${r.areaSqm.toFixed(2)}㎡`;
  $('cost-mode-badge').textContent=auto?'가정 기반':'직접 입력';
  $('price-explanation').textContent=auto?`보증금은 월세 ${state.depositMonths||'—'}개월분, 권리금은 ${state.premiumMonths||'—'}개월분으로 가정합니다. 실제 시세 예측이 아닙니다.`:'직접 입력한 금액은 면적·층을 바꿔도 유지됩니다. 통계나 자동 예측값이 아닙니다.';
  for(const k of ['deposit','monthly','premium']){
   $(k).readOnly=auto;
   if(auto)$(k).value=r.status==='ready'?(r[k]/10000).toFixed(1):'';
  }
  $('upfront').textContent=r.status==='ready'?money(r.upfront):'—';
  const key=r.floor>=6?'6+':String(r.floor),official=reference?.floorReference.ratios[key];
  const applied=auto?(state.floorRatioOverride!==''?Number(state.floorRatioOverride):official):null;
  const validRatio=typeof applied==='number'&&Number.isFinite(applied)&&applied>0&&applied<=300&&!r.errors?.floorRatioOverride;
  $('applied-ratio').textContent=!auto?'직접 입력':validRatio?applied.toFixed(1)+'%':'비율 입력 필요';
  $('ratio-origin').textContent=!auto?'입력한 금액을 그대로 사용해요.':state.floorRatioOverride!==''?'사용자가 지정한 비율 · 공식 비율과 아래 참고자료에서 비교하세요.':official?`${floorName(r.floor)} · 서울 중대형 상가 ${key==='6+'?'6층 이상':''} 비율을 적용한 가정`:'공식 자료에 없는 층입니다. 가정 조정에서 비율을 직접 입력해 주세요.';
  $('floorRatioOverride').placeholder=official?official.toFixed(1):'직접 지정';
  $('comparison-note').textContent=!auto?'현재 금액을 직접 입력하고 있어요. 공식 통계 비율을 비용 계산에 적용하지 않습니다.':typeof official==='number'&&validRatio?`선택 층 공식 비율 ${official.toFixed(1)}% → 이번 계산 ${applied.toFixed(1)}%${state.floorRatioOverride!==''?' (직접 지정)':' (서울 평균 적용 가정)'}`:validRatio?`해당 층 공식 비율 없음 → 이번 계산 ${applied.toFixed(1)}% (직접 지정)`:'선택한 층의 공식 비율이 없습니다. 값을 임의로 대신 넣지 않았어요.';
  document.querySelectorAll('#floor-reference-rows tr').forEach(tr=>{
   const selected=auto&&tr.dataset.floor===key;tr.classList.toggle('is-applied',selected);
   tr.querySelector('.applied-mark').textContent=selected?'선택한 층':'';
  });
  let warning='';
  if(r.status==='unavailable')warning=r.reason==='floor'?'지하 2층 이하의 공식 비율이 없어요. ‘모의 계산 가정 조정’에서 층별 비율을 입력하거나 금액 직접 입력을 선택해 주세요.':'해당 구의 참고 단가가 없어 모의 가격을 계산하지 않았어요. 자료를 다시 불러오거나 금액 직접 입력을 선택해 주세요.';
  else if(r.status==='invalid')warning='입력값을 확인하면 금액을 계산할 수 있어요.';
  $('calculation-warning').textContent=warning;$('calculation-warning').hidden=!warning;
  if(dirty)$('save-status').textContent='변경사항이 있어요. 조건을 저장해 주세요.';
  updateComparisonReturn(state);
 }
 function renderReference(){
  $('reference-error').hidden=!!reference;$('reference-content').hidden=!reference;
  if(!reference)return;
  const row=M.rentalArea(reference,district.code,hotspotId);
  if(!row)return;
  $('rent-source-meta').textContent=`${district.name}${hotspotId?' · '+row.name+' / '+row.dongName+' 전체':''} · ${quarter(reference.quarter)} · 서울신용보증재단`;
  $('source-first').textContent=row.firstFloor===null?'자료 없음':row.firstFloor.toLocaleString('ko-KR')+'원';
  $('source-other').textContent=row.otherFloors===null?'자료 없음':row.otherFloors.toLocaleString('ko-KR')+'원';
  $('floor-source-meta').textContent=`${reference.floorReference.scope} · ${quarter(reference.floorReference.quarter)} · 조회 ${reference.floorReference.retrievedAt.slice(0,10)}`;
  $('floor-reference-rows').replaceChildren();
  for(const entry of reference.floorReference.rows){
   const tr=document.createElement('tr');tr.dataset.floor=entry.key;
   const th=document.createElement('th');th.scope='row';th.textContent=entry.floor;
   const mark=document.createElement('span');mark.className='applied-mark';th.append(mark);
   const rent=document.createElement('td');rent.textContent=entry.rentThousandPerSqm.toFixed(2);
   const ratio=document.createElement('td');ratio.textContent=entry.ratio.toFixed(1)+'%';
   tr.append(th,rent,ratio);$('floor-reference-rows').append(tr);
  }
 }
 function renderAreas(){
  const select=$('rental-area');select.replaceChildren();
  const base=document.createElement('option');base.value='';base.textContent=district.name+' 평균';select.append(base);
  const districtRate=M.rentalArea(reference,district.code)?.firstFloor;
  for(const h of M.hotspotsFor(reference,district.code)){
   const option=document.createElement('option');option.value=h.id;
   const change=typeof districtRate==='number'&&districtRate>0?(h.firstFloor/districtRate-1)*100:null;
   option.textContent=`${h.name} · 구 평균 ${change===null?'비교 불가':`${change>=0?'+':''}${change.toFixed(1)}%`}`;select.append(option);
  }
  select.value=hotspotId;select.disabled=!reference;
  const h=hotspotId&&M.rentalArea(reference,district.code,hotspotId);
  $('rental-area-help').textContent=!reference?'가격자료 연결 후 번화가를 선택할 수 있어요.':h?`${h.dongName} 전체의 평균 단가를 적용해요. 번화가 중심 거리의 시세와는 다릅니다.`:M.hotspotsFor(reference,district.code).length?'번화가 주변의 행정동 평균과 구 평균을 비교할 수 있어요.':'이 구는 등록된 번화가 주변 자료가 없어 구 평균을 사용해요.';
  $('district-name').textContent='서울특별시 · '+district.name+(h?' · '+h.name:'');
  for(const id of ['change-region','header-map-link'])$(id).href='map.html?district='+district.code+(h?'&hotspot='+encodeURIComponent(h.id):'');
 }
 async function getJson(url){const r=await fetch(url);if(!r.ok)throw Error('자료 로딩 실패');return r.json();}
 async function load(){
  const outcomes=await Promise.allSettled([getJson('data/seoul-districts.geojson'),getJson('data/space-reference.json'),getJson('data/footfall-estimates.json')]);
  if(outcomes[0].status!=='fulfilled'){
   $('load-message').innerHTML='<h1>지역 정보를 불러오지 못했어요.</h1><p>연결을 확인한 뒤 다시 시도해 주세요.</p><button type="button" id="reload-space">다시 불러오기</button>';
   $('reload-space').addEventListener('click',()=>location.reload());return;
  }
  const geo=outcomes[0].value;
  if(!Array.isArray(geo.features)||geo.features.length!==25){$('load-message').textContent='지역 정보가 올바르지 않습니다. 지도로 돌아가 다시 선택해 주세요.';return;}
  const rows=geo.features.map(f=>f.properties);
  let code=new URLSearchParams(location.search).get('district');
  if(code===null){try{code=localStorage.getItem('sim.district');}catch(_){}}
  district=rows.find(d=>d.code===code);
  if(!district){$('load-message').innerHTML='<h1>먼저 지역을 골라주세요.</h1><p>지도에서 선택한 구를 이어받아 공간을 설정할 수 있어요.</p><a class="source-link" href="map.html">지도에서 구 선택하기 →</a>';return;}
  if(outcomes[1].status==='fulfilled'){try{reference=M.validateReferences(outcomes[1].value,rows);}catch(_){reference=null;}}
  if(outcomes[2]?.status==='fulfilled'){try{footfall=FootfallModel.validate(outcomes[2].value);}catch(_){footfall=null;}}
  $('space-flow-source').innerHTML=FootfallModel.source(footfall);
  $('district-name').textContent='서울특별시 · '+district.name;
  document.title=district.name+' 공간 조건 — 가게 미리 열어보기';
  for(const id of ['change-region','header-map-link'])$(id).href='map.html?district='+district.code;
  let saved=null;try{saved=JSON.parse(localStorage.getItem('sim.space.v1.'+district.code));}catch(_){}
  const requestedArea=new URLSearchParams(location.search).get('hotspot');
  const candidate=requestedArea!==null?requestedArea:(saved?.districtCode===district.code?saved.hotspotId||'':'');
  hotspotId=candidate;
  const invalidArea=reference&&candidate&&!M.rentalArea(reference,district.code,candidate);
  if(invalidArea)hotspotId='';
  const restored=M.restore(saved,district.code);
  const wasRestored=saved?.districtCode===district.code&&Object.keys(M.DEFAULTS).every(k=>restored[k]===saved.inputs?.[k]);
  const transfer=M.comparisonTransfer(new URLSearchParams(location.search),district.code,reference);
  comparisonPending=transfer.status==='pending';
  fill(transfer.status==='ready'?applyComparison(restored,transfer):restored);loadLocationComparison();renderAreas();renderReference();update();
  $('load-message').hidden=true;$('space-content').hidden=false;
  if(location.hash==='#location-compare'){$('location-compare').open=true;requestAnimationFrame(()=>$('location-compare').scrollIntoView({block:'start'}));}
  if(wasRestored)$('save-status').textContent='저장된 조건을 불러왔어요. 모의 가격은 현재 참고자료로 다시 계산합니다.';
  if(invalidArea)$('save-status').textContent='선택한 번화가 자료를 찾지 못해 구 평균을 표시합니다. 지역 조건을 확인해 주세요.';
  else if(requestedArea!==null&&requestedArea!==(saved?.hotspotId||''))$('save-status').textContent='지도에서 선택한 지역 단가를 적용했어요. 변경한 조건을 저장해 주세요.';
  if(transfer.status==='ready')$('save-status').textContent=comparisonNotice(transfer);
  else if(transfer.status==='pending')$('save-status').textContent='비교 조건을 확인하려면 가격자료를 다시 불러와 주세요. 아직 비교 조건을 적용하지 않았어요.';
  else if(transfer.status==='invalid')$('save-status').textContent='전달된 비교 조건이 올바르지 않아 적용하지 않았어요. 면적·층·번화가를 확인해 주세요.';
 }
 $('space-form').addEventListener('input',e=>{
  if(e.target.id==='apply-alley-location')return;
  if(['road-rent','road-traffic','alley-rent','alley-traffic'].includes(e.target.id)){
   if(district){const side=e.target.id.split('-')[0],selected=read().locationType==='alley'?'alley':'road';updateLocationComparison(read(),M.rentalArea(reference,district.code,hotspotId));saveLocationComparison();if(side===selected)applyComparedLocation(side);else $('location-compare-apply-status').textContent='비교 지수를 수정했어요. 골목길 체크를 바꾸면 해당 입지가 적용됩니다.';}
   return;
  }
  if(e.target.id==='locationType'){const preset=M.locationPreset(e.target.value);if(preset){$('rentFactor').value=preset.rentFactor;$('trafficFactor').value=preset.trafficFactor;}}
  if(e.target.id==='floor')$('floorRatioOverride').value='';
  update(true);
 });
 $('locationType').addEventListener('change',()=>{const preset=M.locationPreset($('locationType').value);if(preset){$('rentFactor').value=preset.rentFactor;$('trafficFactor').value=preset.trafficFactor;}update(true);});
 $('unit').addEventListener('change',()=>{
  const value=Number($('area').value);
  if($('area').value.trim()!==''&&Number.isFinite(value)&&value>0&&oldUnit!==$('unit').value){
   $('area').value=Number((oldUnit==='sqm'?value/M.SQM_PER_PYEONG:value*M.SQM_PER_PYEONG).toPrecision(12));
  }
  oldUnit=$('unit').value;update(true);
 });
 $('floorZone').addEventListener('change',()=>{$('floorRatioOverride').value='';update(true);});
 $('rental-area').addEventListener('change',()=>{
  const value=$('rental-area').value;
  if(value&&!M.rentalArea(reference,district.code,value))return;
  hotspotId=value;loadLocationComparison();renderAreas();renderReference();update(true);
  clearComparisonQuery();
  try{const url=new URL(location.href);url.searchParams.set('hotspot',hotspotId);history.replaceState(null,'',url);}catch(_){}
 });
 $('location-compare-save').addEventListener('click',()=>{if(district)saveLocationComparison();});
 function applyComparedLocation(side){
  if(!district)return;
  const next=M.applyLocationComparison(read(),side,readLocationComparison()[side]);
  if(!next){$('apply-alley-location').checked=read().locationType==='alley';$('location-compare-apply-status').textContent='선택한 입지의 지수를 확인해 주세요. 기존 공간 조건은 유지됩니다.';return;}
  fill(next);update(true);
  $('location-compare-apply-status').textContent=`${side==='road'?'대로변':'골목길'}의 임대료 ${next.rentFactor}·유동 ${next.trafficFactor} 지수를 공간 정하기에 적용했어요.${next.mode==='manual'?' 직접 입력한 금액은 유지됩니다.':''} 아래 ‘공간 조건 저장’을 누르면 적용한 공간 조건도 저장됩니다.`;
 }
 $('apply-alley-location').addEventListener('change',()=>applyComparedLocation($('apply-alley-location').checked?'alley':'road'));
 document.querySelectorAll('input[name="priceMode"]').forEach(el=>el.addEventListener('change',()=>update(true)));
 $('space-form').addEventListener('submit',e=>{
  e.preventDefault();update();
  if(currentResult?.status!=='ready'){
   $('save-status').textContent='입력값과 계산 상태를 확인해 주세요. 아직 저장하지 않았어요.';
   const key=Object.keys(currentResult?.errors||{})[0]||(currentResult?.reason==='floor'?'floorRatioOverride':null);
   if(key&&$(key)){const detail=$(key).closest('details');if(detail)detail.open=true;$(key).focus();}return;
  }
  try{
   const saved=M.snapshot(district.code,read(),currentResult,reference,hotspotId);
   localStorage.setItem('sim.space.v1.'+district.code,JSON.stringify(saved));
   clearComparisonQuery();
   $('save-status').textContent= district.name+' 공간 조건을 이 브라우저에 저장했어요.';
   if(e.submitter?.id==='kitchen-next')location.assign('kitchen.html?district='+encodeURIComponent(district.code));
  }catch(_){$('save-status').textContent='브라우저에 저장하지 못했어요. 입력한 조건은 이 화면에 유지됩니다.';}
 });
 $('retry-reference').addEventListener('click',async()=>{
  $('retry-reference').disabled=true;
  try{const geo=await getJson('data/seoul-districts.geojson');reference=M.validateReferences(await getJson('data/space-reference.json'),geo.features.map(f=>f.properties));}catch(_){reference=null;}
  if(reference&&hotspotId&&!M.rentalArea(reference,district.code,hotspotId)){hotspotId='';loadLocationComparison();$('save-status').textContent='번화가 자료를 찾지 못해 구 평균으로 변경했어요. 조건을 확인하고 다시 저장해 주세요.';}
  if(reference&&comparisonPending&&!hasUserEdits){
   const transfer=M.comparisonTransfer(new URLSearchParams(location.search),district.code,reference);
   if(transfer.status==='ready'&&transfer.hotspotId===hotspotId){fill(applyComparison(read(),transfer));$('save-status').textContent=comparisonNotice(transfer);}
   else $('save-status').textContent='전달된 비교 조건을 확인할 수 없어 적용하지 않았어요. 면적·층·번화가를 확인해 주세요.';
   comparisonPending=false;
  }
  renderAreas();renderReference();update();$('retry-reference').disabled=false;
 });
 load();
})();
