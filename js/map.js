/* Local GeoJSON is the selection layer; external map tiles are optional. */
(() => {
 'use strict';
 let footfall=null;
 const $=id=>document.getElementById(id);
 const locationFields=s=>Object.fromEntries(SpaceModel.LOCATION_KEYS.filter(k=>typeof s?.[k]==='string'&&s[k].length<=40).map(k=>[k,s[k]]));
 let rows=[],selected=null,map=null,geoLayer=null,allBounds=null,listOpen=false;
 let statistics=null,statisticsStatus='loading';
 let rentalReference=null,rentalStatus='loading';
 let selectedHotspot='';
 let selectionHandoff=null;
 try{const p=new URLSearchParams(location.search);if(p.has('compareArea')&&p.has('compareFloor'))selectionHandoff={id:p.get('hotspot'),area:p.get('compareArea'),floor:p.get('compareFloor'),pricingMode:p.get('comparePricing'),deposit:p.get('compareDeposit'),monthly:p.get('compareMonthly'),...(p.has('compareLocation')?{locationType:p.get('compareLocation'),rentFactor:p.get('compareRentFactor'),trafficFactor:p.get('compareTrafficFactor')}:{})};}catch(_){}
 let hotspotLayer=null;
 let hotspotPopupOpen=false;
 const hotspotMarkers=new Map();
 let resultButtons=[];
 let comparisonIds=[];
 let comparisonSort='selected';
 let comparisonBudget=DistrictModel.restoreComparisonBudget(null);
 try{comparisonBudget=DistrictModel.restoreComparisonBudget(JSON.parse(localStorage.getItem('sim.hotspotCompareBudget.v1')));}catch(_){}
 try{const saved=localStorage.getItem('sim.hotspotCompareSort.v1');if(DistrictModel.comparisonSortInfo(saved).key===saved)comparisonSort=saved;}catch(_){}
 let comparisonSettings={mode:'range',pyeong:'20',floor:'1'};
 let individualComparison={individual:false,entries:{}};
 try{individualComparison=DistrictModel.restoreComparisonIndividuals(JSON.parse(localStorage.getItem('sim.hotspotCompareIndividual.v1')));}catch(_){}
 try{const saved=JSON.parse(localStorage.getItem('sim.hotspotCompareArea.v1'));if(saved&&['range','custom'].includes(saved.mode)&&typeof saved.pyeong==='string'&&saved.pyeong.length<=40)comparisonSettings={mode:saved.mode,pyeong:String(saved.pyeong),floor:DistrictModel.comparisonFloor(saved.floor).valid?(saved.floor??'1'):'1',...locationFields(saved)};}catch(_){}
 let comparisonOpener=null;
 const plansKey='sim.hotspotComparePlans.v1';
 let planLibrary={schemaVersion:1,plans:[]},planUndo=null;
 const editingCopyKey='sim.hotspotCompareEditingCopy.v1';
 let editingCopyId='',planUndoCopyId='';
 let pairEditingId='';
 try{editingCopyId=localStorage.getItem(editingCopyKey)||'';}catch(_){}
 try{const saved=JSON.parse(localStorage.getItem('sim.hotspotCompare.v1'));if(Array.isArray(saved))comparisonIds=[...new Set(saved.filter(id=>typeof id==='string'&&/^11\d{6}$/.test(id)))].slice(0,17);}catch(_){}
 try{selectedHotspot=new URLSearchParams(location.search).get('hotspot')||'';}catch(_){}
 const layers=new Map();
 const baseStyle={color:'#8E7663',weight:1.4,fillColor:'#E7D4BC',fillOpacity:.47};
 const activeStyle={color:'#A64324',weight:3,fillColor:'#C66A44',fillOpacity:.48};
 function remember(code){
  try{if(code)localStorage.setItem('sim.district',code);else localStorage.removeItem('sim.district');}catch(_){}
  try{const url=new URL(location.href);if(code)url.searchParams.set('district',code);else url.searchParams.delete('district');if(code&&selectedHotspot)url.searchParams.set('hotspot',selectedHotspot);else url.searchParams.delete('hotspot');if(code&&selectionHandoff?.id===selectedHotspot){url.searchParams.set('compareArea',selectionHandoff.area);url.searchParams.set('compareFloor',selectionHandoff.floor);}else{url.searchParams.delete('compareArea');url.searchParams.delete('compareFloor');}for(const [key,field] of [['comparePricing','pricingMode'],['compareDeposit','deposit'],['compareMonthly','monthly']]){if(code&&selectionHandoff?.id===selectedHotspot&&selectionHandoff.pricingMode==='manual')url.searchParams.set(key,selectionHandoff[field]);else url.searchParams.delete(key);}history.replaceState(null,'',url);}catch(_){}
  rememberLocation(code);
 }
 function rememberLocation(code){try{const url=new URL(location.href);for(const [key,field] of [['compareLocation','locationType'],['compareRentFactor','rentFactor'],['compareTrafficFactor','trafficFactor']]){if(code&&selectionHandoff?.id===selectedHotspot&&selectionHandoff[field]!==undefined)url.searchParams.set(key,selectionHandoff[field]);else url.searchParams.delete(key);}history.replaceState(null,'',url);}catch(_){}}
 function initialCode(){try{const code=new URLSearchParams(location.search).get('district');if(code!==null)return code;return localStorage.getItem('sim.district');}catch(_){return null;}}
 function renderDetail(){ if(typeof StartupBudget!=='undefined')StartupBudget.render();$('detail').innerHTML=DistrictModel.detail(rows.find(d=>d.code===selected)||null,statistics,statisticsStatus,rentalReference,rentalStatus,selectedHotspot,selectionHandoff,footfall);updateCompareAdd(); }
 function updateCompareAdd(){const b=$('compare-add');if(b)b.textContent=comparisonIds.includes(selectedHotspot)?'비교에 담김 · 비교 보기':'이 번화가 비교에 담기';}
 function saveComparison(){try{localStorage.setItem('sim.hotspotCompare.v1',JSON.stringify(comparisonIds));}catch(_){} }
 function saveIndividuals(){try{localStorage.setItem('sim.hotspotCompareIndividual.v1',JSON.stringify(individualComparison));}catch(_){} }
 function comparisonConfig(){return {...comparisonSettings,...individualComparison,sort:comparisonSort,budget:comparisonBudget};}
 function currentComparisonSnapshot(){return DistrictModel.comparisonSnapshot({ids:comparisonIds,shared:comparisonSettings,individual:individualComparison,budget:comparisonBudget,sort:comparisonSort});}
 function readPlans(){try{return DistrictModel.comparisonPlanLibrary(localStorage.getItem(plansKey));}catch(_){throw Error('비교안을 읽을 수 없어요. 브라우저 저장 설정을 확인해 주세요. 기존 저장자료는 유지됩니다.');}}
 function showPlanSummary(){
  const plan=planLibrary.plans.find(p=>p.id===$('compare-plan-list').value);
  $('compare-plan-summary').textContent=plan?`${plan.sourcePlanId?'복사본 · ':''}${plan.state.ids.length}곳 · ${plan.state.individual.individual?'번화가별 조건':'같은 조건'} · ${DistrictModel.comparisonSortInfo(plan.state.sort).label} · 저장 ${new Date(plan.updatedAt||plan.createdAt).toLocaleString('ko-KR')}`:'저장된 비교안을 선택하면 조건을 불러올 수 있어요.';
  $('compare-plan-load').disabled=!plan||rentalStatus!=='ready';
  $('compare-plan-rename').disabled=!plan;$('compare-plan-delete').disabled=!plan;
  $('compare-plan-copy').disabled=!plan||rentalStatus!=='ready';showCopyContext();
 }
 function setEditingCopy(id){editingCopyId=id||'';try{if(editingCopyId)localStorage.setItem(editingCopyKey,editingCopyId);else localStorage.removeItem(editingCopyKey);}catch(_){}showCopyContext();}
 function showCopyContext(){
  const plan=planLibrary.plans.find(p=>p.id===editingCopyId&&p.sourcePlanId),snapshot=currentComparisonSnapshot();
  const changed=plan&&JSON.stringify(snapshot)!==JSON.stringify(plan.state);
  $('compare-copy-current').hidden=!plan;$('compare-copy-current-label').textContent=plan?`수정 중인 복사본: ${plan.name} · ${changed?'저장하지 않은 변경 있음':'저장된 조건과 같음'}`:'';
  $('compare-copy-update').disabled=!plan||!changed||!snapshot?.ids.length||rentalStatus!=='ready';
  refreshPlanPair();
 }
 function refreshPlanPair(){
  const select=$('compare-ab-copy');if(!select)return;
  const copies=planLibrary.plans.filter(p=>p.sourcePlanId),previous=select.value;
  const signature=JSON.stringify(copies.map(p=>[p.id,p.name]));
  if(select.dataset.options!==signature){
   select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=copies.length?'비교할 복사본 선택':'저장된 복사본이 없어요';select.append(empty);
   for(const plan of [...copies].reverse()){const option=document.createElement('option');option.value=plan.id;option.textContent=plan.name;select.append(option);}
   select.value=copies.some(p=>p.id===previous)?previous:copies.some(p=>p.id===editingCopyId)?editingCopyId:copies.at(-1)?.id||'';select.dataset.options=signature;
  }
  const copy=copies.find(p=>p.id===select.value),draft=$('compare-ab-draft'),status=$('compare-ab-status'),result=$('compare-ab-results');
  const editing=Boolean(copy&&pairEditingId===copy.id&&editingCopyId===copy.id);
  if(!editing)pairEditingId='';
  const focused=document.activeElement,focusId=result.contains(focused)?focused.id:'',caret=focusId&&focused.type==='text'?[focused.selectionStart,focused.selectionEnd]:null,scroll=$('compare-dialog').scrollTop;
  draft.disabled=editing||!copy||copy.id!==editingCopyId;if(editing)draft.checked=true;else if(draft.disabled)draft.checked=false;
  $('compare-ab-edit').disabled=!copy||rentalStatus!=='ready';$('compare-ab-edit').textContent=editing?'수정 마치기':'복사본 수정';
  $('compare-ab-save').hidden=!editing;$('compare-ab-changed').disabled=editing;
  $('compare-ab-edit-help').hidden=!editing;
  result.replaceChildren();
  if(!copy){status.textContent='저장한 비교안을 복사하면 원본과 나란히 비교할 수 있어요.';return;}
  const active=planLibrary.plans.find(p=>p.id===copy.sourcePlanId),source=active||planLibrary.deleted?.find(e=>e.plan.id===copy.sourcePlanId)?.plan;
  if(!source){status.textContent='이 복사본의 원본을 찾을 수 없어 비교할 수 없어요.';return;}
  if(rentalStatus!=='ready'){status.textContent='가격자료를 불러오면 원본과 복사본을 비교합니다.';return;}
  const state=draft.checked?currentComparisonSnapshot():copy.state;
  if(!state){status.textContent='수정 중인 비교 조건을 확인해 주세요.';return;}
  if(editing){const issue=DistrictModel.comparisonCopyIssue(state,rows,rentalReference);$('compare-ab-edit-status').textContent=issue|| (JSON.stringify(state)===JSON.stringify(copy.state)?'저장된 조건과 같아요.':'저장하지 않은 변경이 있어요.');$('compare-ab-save').disabled=Boolean(issue)||JSON.stringify(state)===JSON.stringify(copy.state);}
  status.textContent=`${active?'원본의 저장된 조건':'삭제 보관 중인 원본의 저장된 조건'} · ${draft.checked?'복사본의 현재 수정 중인 조건 (저장 전 변경 포함)':'복사본의 저장된 조건'}. ${draft.disabled&&!editing?'저장 전 수정사항은 이 복사본을 불러온 뒤 비교할 수 있어요.':''}`;
  result.innerHTML=DistrictModel.comparisonPlanPairHtml(rows,rentalReference,source,{...copy,state},{changedOnly:$('compare-ab-changed').checked,editable:editing});
  if(focusId&&$(focusId)){let control=$(focusId);if(focused.matches('[data-copy-field]')){if(control.hasAttribute('aria-invalid'))focused.setAttribute('aria-invalid',control.getAttribute('aria-invalid'));control.replaceWith(focused);control=focused;}control.focus({preventScroll:true});if(caret&&control.type==='text')control.setSelectionRange(...caret);$('compare-dialog').scrollTop=scroll;}
 }
 function togglePairEditing(){
  if(pairEditingId){pairEditingId='';refreshPlanPair();$('compare-ab-edit').focus();return;}
  try{
   const library=readPlans(),copy=library.plans.find(p=>p.id===$('compare-ab-copy').value&&p.sourcePlanId);if(!copy)throw Error('수정할 복사본을 선택해 주세요.');
   if(editingCopyId!==copy.id){const previous=currentComparisonSnapshot(),previousCopy=editingCopyId;applyComparisonSnapshot(copy.state);planUndo=previous;planUndoCopyId=previousCopy;$('compare-plan-undo').hidden=!planUndo;setEditingCopy(copy.id);}
   planLibrary=library;pairEditingId=copy.id;$('compare-ab-draft').checked=true;refreshPlanPair();
  }catch(error){$('compare-ab-edit-status').textContent=error.message;}
 }
 function editPairField(field,id,value){
  if(!pairEditingId||pairEditingId!==editingCopyId||pairEditingId!==$('compare-ab-copy').value)return;
  try{const state=DistrictModel.editComparisonCopy(currentComparisonSnapshot(),{field,id,value},rows,rentalReference);applyComparisonSnapshot(state);}
  catch(error){$('compare-ab-edit-status').textContent=error.message;}
 }
 function savePairEditing(){
  try{
   if(!pairEditingId||pairEditingId!==editingCopyId||pairEditingId!==$('compare-ab-copy').value)throw Error('수정할 복사본을 선택해 주세요.');
   const state=currentComparisonSnapshot(),issue=DistrictModel.comparisonCopyIssue(state,rows,rentalReference);if(issue)throw Error(issue);
   const next=DistrictModel.updateCopiedComparisonPlan(readPlans(),pairEditingId,state,new Date().toISOString());writePlans(next);refreshPlans(pairEditingId);$('compare-ab-edit-status').textContent='복사본에 변경사항을 저장했어요. 원본은 그대로입니다.';
  }catch(error){$('compare-ab-edit-status').textContent=error.message;}
 }
 function cancelPlanCopy(){$('compare-plan-copy-box').hidden=true;$('compare-plan-copy-name').value='';delete $('compare-plan-copy-box').dataset.planId;}
 function startPlanCopy(){
  try{const library=readPlans(),plan=library.plans.find(p=>p.id===$('compare-plan-list').value);if(!plan)throw Error('복사할 비교안을 선택해 주세요.');
   cancelPlanRename();let n=1,name;do{const suffix=n===1?' (복사)':` (복사 ${n})`;name=plan.name.slice(0,60-suffix.length)+suffix;n++;}while(library.plans.some(p=>p.name===name));
   $('compare-plan-copy-box').dataset.planId=plan.id;$('compare-plan-copy-box').hidden=false;$('compare-plan-copy-name').value=name;$('compare-plan-copy-name').focus();$('compare-plan-copy-name').select();
  }catch(error){$('compare-plan-status').textContent=error.message;}
 }
 function copyNamedComparison(){
  let created=null;
  try{const library=readPlans(),id=crypto.randomUUID(),next=DistrictModel.copyComparisonPlan(library,$('compare-plan-copy-box').dataset.planId,$('compare-plan-copy-name').value,id,new Date().toISOString());
   const previous=currentComparisonSnapshot(),previousCopy=editingCopyId;writePlans(next);created=next.plans.find(p=>p.id===id);refreshPlans(id);
   applyComparisonSnapshot(created.state);planUndo=previous;planUndoCopyId=previousCopy;$('compare-plan-undo').hidden=!planUndo;setEditingCopy(id);
   $('compare-plan-status').textContent=`‘${created.name}’ 복사본을 저장하고 불러왔어요. 조건을 바꾼 뒤 ‘복사본에 변경사항 저장’을 눌러 주세요. 원본은 그대로 유지됩니다.`;
  }catch(error){$('compare-plan-status').textContent=created?`복사본은 저장됐지만 불러오지 못했어요. ${error.message}`:error.message;if(!created)$('compare-plan-copy-name').focus();}
 }
 function updateWorkingCopy(){
  try{const next=DistrictModel.updateCopiedComparisonPlan(readPlans(),editingCopyId,currentComparisonSnapshot(),new Date().toISOString());writePlans(next);const name=next.plans.find(p=>p.id===editingCopyId).name;refreshPlans(editingCopyId);$('compare-plan-status').textContent=`‘${name}’ 복사본에 변경사항을 저장했어요. 원본은 그대로입니다.`;}
  catch(error){$('compare-plan-status').textContent=error.message;}
 }
 function cancelPlanRename(){$('compare-plan-rename-box').hidden=true;$('compare-plan-rename-name').value='';delete $('compare-plan-rename-box').dataset.planId;}
 function showDeletedPlans(){
  const entries=planLibrary.deleted||[],select=$('compare-plan-deleted-list'),previous=select.value;select.replaceChildren();
  for(const entry of [...entries].reverse()){const option=document.createElement('option');option.value=entry.plan.id;option.textContent=entry.plan.name;select.append(option);}
  if(entries.some(e=>e.plan.id===previous))select.value=previous;
  $('compare-plan-deleted-box').hidden=!entries.length;$('compare-plan-delete-undo').disabled=!entries.length;
 }
 function writePlans(library){try{localStorage.setItem(plansKey,JSON.stringify(library));}catch(_){throw Error('변경을 저장하지 못했어요. 브라우저 저장 공간·설정을 확인해 주세요. 기존 비교안은 유지됩니다.');}}
 function startPlanRename(){
  cancelPlanCopy();
  try{const plan=readPlans().plans.find(p=>p.id===$('compare-plan-list').value);if(!plan)throw Error('이름을 바꿀 비교안을 선택해 주세요.');
   $('compare-plan-rename-box').dataset.planId=plan.id;$('compare-plan-rename-box').hidden=false;$('compare-plan-rename-name').value=plan.name;$('compare-plan-rename-name').focus();$('compare-plan-rename-name').select();
  }catch(error){$('compare-plan-status').textContent=error.message;}
 }
 function renameNamedComparison(){
  try{const id=$('compare-plan-rename-box').dataset.planId,next=DistrictModel.renameComparisonPlan(readPlans(),id,$('compare-plan-rename-name').value);writePlans(next);const name=next.plans.find(p=>p.id===id).name;cancelPlanRename();refreshPlans(id);$('compare-plan-status').textContent=`‘${name}’ 이름으로 변경했어요. 저장된 조건은 그대로입니다.`;$('compare-plan-rename').focus();}
  catch(error){$('compare-plan-status').textContent=error.message;$('compare-plan-rename-name').focus();}
 }
 function deleteNamedComparison(){
  try{const id=$('compare-plan-list').value,library=readPlans(),next=DistrictModel.deleteComparisonPlan(library,id),name=library.plans.find(p=>p.id===id).name;writePlans(next);cancelPlanRename();if(id===editingCopyId)setEditingCopy('');refreshPlans('');$('compare-plan-deleted-list').value=id;$('compare-plan-status').textContent=`‘${name}’ 비교안을 삭제했어요. 아래에서 삭제를 되돌릴 수 있습니다. 현재 비교 조건은 유지됩니다.`;$('compare-plan-delete-undo').focus();}
  catch(error){$('compare-plan-status').textContent=error.message;}
 }
 function undoDeletedComparison(){
  try{const id=$('compare-plan-deleted-list').value,library=readPlans(),oldName=library.deleted?.find(e=>e.plan.id===id)?.plan.name,next=DistrictModel.undoDeleteComparisonPlan(library,id);writePlans(next);cancelPlanRename();refreshPlans(id);const name=next.plans.find(p=>p.id===id).name;$('compare-plan-status').textContent=name===oldName?`‘${name}’ 비교안의 삭제를 되돌렸어요.`:`같은 이름의 안을 유지하고 ‘${name}’으로 복구했어요.`;$('compare-plan-list').focus();}
  catch(error){$('compare-plan-status').textContent=error.message;}
 }
 function refreshPlans(selectedId=$('compare-plan-list').value){
  cancelPlanRename();cancelPlanCopy();
  try{
   planLibrary=readPlans();const select=$('compare-plan-list');select.replaceChildren();
   const empty=document.createElement('option');empty.value='';empty.textContent=planLibrary.plans.length?'저장된 비교안 선택':'아직 저장된 비교안이 없어요';select.append(empty);
   for(const plan of [...planLibrary.plans].reverse()){const option=document.createElement('option');option.value=plan.id;option.textContent=plan.name;select.append(option);}
   select.value=planLibrary.plans.some(p=>p.id===selectedId)?selectedId:'';showPlanSummary();showDeletedPlans();
  }catch(error){$('compare-plan-status').textContent=error.message;for(const id of ['compare-plan-load','compare-plan-rename','compare-plan-delete','compare-plan-delete-undo','compare-plan-copy','compare-copy-update'])$(id).disabled=true;}
 }
 function saveNamedComparison(){
  if(rentalStatus!=='ready'){$('compare-plan-status').textContent='가격자료를 불러온 뒤 저장해 주세요.';return;}
  try{
   const library=readPlans(),name=$('compare-plan-name').value,state=currentComparisonSnapshot();
   const next=DistrictModel.addComparisonPlan(library,name,state,crypto.randomUUID(),new Date().toISOString());
   try{localStorage.setItem(plansKey,JSON.stringify(next));}catch(_){throw Error('비교안을 저장하지 못했어요. 브라우저 저장 공간·설정을 확인해 주세요.');}
   const plan=next.plans[next.plans.length-1];refreshPlans(plan.id);setEditingCopy('');$('compare-plan-name').value='';$('compare-plan-status').textContent=`‘${plan.name}’ 비교안을 저장했어요. 이후 변경은 저장된 안에 자동 반영되지 않습니다.`;
  }catch(error){$('compare-plan-status').textContent=error.message;$('compare-plan-name').focus();}
 }
 function applyComparisonSnapshot(snapshot){
  const s=DistrictModel.comparisonSnapshot(snapshot);
  if(!s||!rentalReference||s.ids.some(id=>!rentalReference.hotspots.some(h=>h.id===id)))throw Error('일부 번화가 자료를 찾을 수 없어 비교안을 적용하지 않았어요.');
  try{DistrictModel.writeComparisonState(localStorage,s);}catch(_){throw Error('비교 조건을 저장하지 못해 불러오기를 중단했어요. 브라우저 저장 공간·설정을 확인해 주세요.');}
  comparisonIds=s.ids;comparisonSettings=s.shared;individualComparison=s.individual;comparisonBudget=s.budget;comparisonSort=s.sort;
  try{sessionStorage.removeItem('sim.comparisonReturn.v1');}catch(_){}
  selectionHandoff=null;
  if(s.ids.length){const item=DistrictModel.comparisonRows(rows,rentalReference,[s.ids[0]],comparisonConfig())[0];selectHotspot(item.hotspot,item.handoffUrl?{...item.pricing,...locationFields(item.location),id:item.hotspot.id,area:String(item.area.pyeong),floor:item.floor.key}:null);}
  else{remember(selected);renderDetail();}
  $('compare-pyeong').value=comparisonSettings.pyeong;syncBudgetInputs();renderComparison();
 }
 function loadNamedComparison(){
  try{
   const plan=readPlans().plans.find(p=>p.id===$('compare-plan-list').value);if(!plan)throw Error('불러올 비교안을 선택해 주세요.');
   const previous=currentComparisonSnapshot(),previousCopy=editingCopyId;applyComparisonSnapshot(plan.state);planUndo=previous;planUndoCopyId=previousCopy;$('compare-plan-undo').hidden=!planUndo;setEditingCopy(plan.sourcePlanId?plan.id:'');
   $('compare-plan-status').textContent=`‘${plan.name}’ 비교안을 불러왔어요. 추정금액은 현재 참고자료로 계산합니다.`;
  }catch(error){$('compare-plan-status').textContent=error.message;}
 }
 function saveBudget(){try{localStorage.setItem('sim.hotspotCompareBudget.v1',JSON.stringify(comparisonBudget));}catch(_){} }
 function syncBudgetInputs(){for(const key of ['deposit','monthly'])$('compare-budget-'+key).value=comparisonBudget[key];$('compare-budget-only').checked=comparisonBudget.enabled;}
 function renderBudget(){
  const result=DistrictModel.filterComparisons(DistrictModel.comparisonRows(rows,rentalReference,comparisonIds,comparisonConfig()),comparisonBudget);
  for(const key of ['deposit','monthly']){$('compare-budget-'+key).setAttribute('aria-invalid',String(Boolean(result.errors[key])));$('compare-budget-'+key+'-error').textContent=result.errors[key]||'';}
  $('compare-budget-status').textContent=rentalStatus!=='ready'?'가격자료를 불러오면 예산 결과를 표시해요.':!result.active?`전체 ${result.total}곳 표시 · 예산 필터 꺼짐`:!result.valid?'예산 입력을 확인해 주세요.':`선택 ${result.total}곳 중 ${result.items.length}곳 표시 · 숨겨진 번화가의 조건도 보관됩니다.`;
 }
 function comparisonSortMessage(){const sort=DistrictModel.comparisonSortInfo(comparisonSort,comparisonBudget);return !sort.ready?`${sort.field==='monthly'?'월세':'보증금'} 최대 예산을 올바르게 입력하면 정렬해요. 현재는 담은 순서로 표시합니다.`:sort.kind==='selected'?'비교에 담은 순서로 표시해요.':`${sort.label}으로 정렬했어요.`;}
 function reorderComparison(){
  if(comparisonBudget.enabled){
   const focus=document.activeElement,inside=$('compare-table').contains(focus),id=focus?.id;
   renderComparison();
   if(inside||focus===document.body)($(id)||$('compare-budget-only')).focus({preventScroll:true});
   return;
  }
  const body=$('compare-table')?.querySelector('tbody');if(!body)return;
  const focus=document.activeElement;
  const nodes=new Map([...body.querySelectorAll('[data-compare-row]')].map(node=>[node.dataset.compareRow,node]));
  for(const item of DistrictModel.sortComparisons(DistrictModel.comparisonRows(rows,rentalReference,comparisonIds,comparisonConfig()),comparisonSort,comparisonBudget)){
   const node=nodes.get(item.hotspot.id);if(node)body.append(node);
  }
  if(focus&&body.contains(focus)&&document.activeElement!==focus)focus.focus({preventScroll:true});
  if(comparisonSort!=='selected')$('compare-status').textContent=comparisonSortMessage();
 }
 function syncSelectionEntry(id){
  if(selectionHandoff?.id!==id)return;
  const item=DistrictModel.comparisonRows(rows,rentalReference,[id],comparisonConfig())[0];
  selectionHandoff=item?.handoffUrl?{...item.pricing,...locationFields(item.location),id,area:String(item.area.pyeong),floor:item.floor.key}:null;remember(selected);renderDetail();
 }
 function ensureIndividuals(){
  if(!individualComparison.individual)return;
  const area=DistrictModel.comparisonArea(comparisonSettings);let added=false;
  for(const id of comparisonIds)if(!individualComparison.entries[id]&&rentalReference?.hotspots.some(h=>h.id===id)){
   individualComparison.entries[id]={pyeong:area.valid&&area.mode==='custom'?String(area.pyeong):'20',floor:comparisonSettings.floor,...locationFields(comparisonSettings)};added=true;
  }
  if(added)saveIndividuals();
 }
 function updateIndividual(e){
  const isArea=Boolean(e.target.dataset.itemArea),id=e.target.dataset.itemArea||e.target.dataset.itemFloor;
  if(!individualComparison.individual||!comparisonIds.includes(id)||!individualComparison.entries[id])return;
  if(!isArea&&!DistrictModel.comparisonFloor(e.target.value).valid)return;
  individualComparison.entries[id]={...individualComparison.entries[id],[isArea?'pyeong':'floor']:e.target.value};saveIndividuals();
  syncSelectionEntry(id);
  const item=DistrictModel.comparisonRows(rows,rentalReference,[id],comparisonConfig())[0];if(!item)return;
  const tr=e.target.closest('[data-compare-row]');
  for(const key of ['deposit','monthly'])tr.querySelector(`[data-price="${key}"]`).innerHTML=DistrictModel.comparisonPriceCell(item,key,comparisonBudget);
  tr.querySelector('[data-item-summary]').textContent=DistrictModel.comparisonCondition(item);
  tr.querySelector('[data-item-error]').textContent=DistrictModel.comparisonIssue(item);
  tr.querySelector('[data-item-handoff]').innerHTML=DistrictModel.comparisonAction(item);
  tr.querySelector('[data-item-area]').setAttribute('aria-invalid',String(!item.area.valid));
  showCopyContext();
  $('compare-status').textContent=`${item.hotspot.name} · ${DistrictModel.comparisonIssue(item)||`${item.area.pyeong}평 · ${item.floor.label} 적용`}`;
 }
 function updateComparisonLocation(input){
  const id=input.dataset.itemAlley,h=rentalReference?.hotspots.find(h=>h.id===id);
  if(!h||!comparisonIds.includes(id))return;
  const side=input.checked?'alley':'road';let config=SpaceModel.locationPreset(side),note='';
  try{
   const raw=localStorage.getItem(SpaceModel.locationComparisonKey(h.districtCode,id));
   if(raw){const saved=SpaceModel.restoreLocationComparison(JSON.parse(raw),h.districtCode,id);if(saved)config=saved[side];else note=' 저장 지수를 확인할 수 없어 예시값을 적용했어요.';}
  }catch(_){note=' 저장 지수를 읽지 못해 예시값을 적용했어요.';}
  try{individualComparison=DistrictModel.setComparisonLocation(individualComparison,comparisonSettings,id,side,config);}
  catch(error){input.checked=!input.checked;$('compare-status').textContent=error.message;return;}
  let saved=true;try{localStorage.setItem('sim.hotspotCompareIndividual.v1',JSON.stringify(individualComparison));}catch(_){saved=false;}
  syncSelectionEntry(id);renderComparison();showCopyContext();
  ($('alley-'+id)||$('compare-budget-only')).focus({preventScroll:true});
  const item=DistrictModel.comparisonRows(rows,rentalReference,[id],comparisonConfig())[0];
  $('compare-status').textContent=`${h.name} · ${side==='alley'?'골목길':'대로변'} 적용 · 임대료 지수 ${config.rentFactor} · 유동 가정 ${config.trafficFactor}${item?.pricing?' · 직접 입력 금액 유지':''}.${note}${saved?'':' 브라우저에 저장하지 못했어요. 현재 화면에만 반영됩니다.'}`;
 }
 function saveComparisonSettings(){if(DistrictModel.comparisonArea({mode:'custom',pyeong:comparisonSettings.pyeong}).valid&&DistrictModel.comparisonFloor(comparisonSettings.floor).valid){try{localStorage.setItem('sim.hotspotCompareArea.v1',JSON.stringify(comparisonSettings));}catch(_){} }}
 function setComparisonArea(mode,pyeong=comparisonSettings.pyeong){
  if(mode==='range'&&!DistrictModel.comparisonArea({mode:'custom',pyeong}).valid){pyeong='20';$('compare-pyeong').value=pyeong;}
  comparisonSettings={...comparisonSettings,mode,pyeong};
  saveComparisonSettings();
  renderComparison();
 }
 function renderComparison(rebuildOptions=false){
  if(!$('compare-dialog'))return;
  ensureIndividuals();
  const individual=individualComparison.individual;
  $('compare-plan-save').disabled=rentalStatus!=='ready';showPlanSummary();
  renderBudget();
  $('compare-sort').value=comparisonSort;
  const sort=DistrictModel.comparisonSortInfo(comparisonSort,comparisonBudget);
  $('compare-sort-help').textContent=!sort.ready?comparisonSortMessage():`${sort.kind==='room'?'예산 여유가 큰 곳부터 표시하며, 초과한 곳은 초과액이 적은 순으로 뒤에 표시해요. 범위는 상한 기준.':sort.kind==='over'?'예산 이내인 곳의 초과액은 0으로 보고 먼저 표시해요. 초과한 곳은 초과액이 적은 순 · 범위는 상한 기준.':'현재 표의 금액 기준 · 범위는 하한 기준.'} 직접 입력 금액 우선 · 같은 금액은 담은 순서 · 입력 오류·자료 없음은 마지막. 평수 입력을 마치면 다시 정렬해요.`;
  $('compare-shared').setAttribute('aria-pressed',String(!individual));$('compare-individual').setAttribute('aria-pressed',String(individual));
  $('compare-shared-controls').hidden=individual;$('compare-individual-help').hidden=!individual;
  const area=DistrictModel.comparisonArea(comparisonSettings);
  const floor=DistrictModel.comparisonFloor(comparisonSettings.floor,rentalReference);
  $('compare-floor').value=comparisonSettings.floor;
  $('compare-floor-ratio').textContent=floor.available?`1층 대비 ${floor.ratio.toFixed(1)}% 적용`:rentalStatus==='loading'?'층별 자료 불러오는 중':'층별 참고 비율 없음';
  $('compare-range').setAttribute('aria-pressed',String(comparisonSettings.mode==='range'));
  $('compare-custom').setAttribute('aria-pressed',String(comparisonSettings.mode==='custom'));
  $('compare-pyeong').setAttribute('aria-invalid',String(!area.valid));
  $('compare-area-error').textContent=area.valid?'':area.error;
  $('compare-sqm').textContent=area.valid&&area.mode==='custom'?`= ${area.areaSqm.toLocaleString('ko-KR',{maximumFractionDigits:2})}㎡`:'';
  $('compare-presets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(area.valid&&area.mode==='custom'&&Number(b.dataset.pyeong)===area.pyeong)));
  $('compare-basis').textContent=individual?'번화가별 조건·금액 적용 · 추정값의 보증금은 월세 12개월분 가정':`모두 ${floor.label} · ${area.valid?area.label:'면적 입력 필요'} · 보증금은 월세 12개월분 가정`;
  $('compare-estimate-note').textContent=individual?'추정값은 행정동 평균과 층별 비율로 계산합니다. 직접 입력은 공간에서 입력한 금액으로, 면적·층을 바꿔도 유지됩니다. 공통 조건 모드에서는 모두 추정값으로 비교하며 개별 입력 금액은 보관됩니다.':!individual&&area.mode==='range'?'하한 33㎡, 상한 66㎡의 모의 비용이며 실제 매물의 최저·최고가가 아닙니다.':'입력 면적·층에 행정동 평균 단가를 적용한 추정액이며 실제 매물·계약 가격이 아닙니다. 면적별 할인·할증은 반영하지 않았습니다.';
  const items=DistrictModel.comparisonRows(rows,rentalReference,comparisonIds);
  $('compare-open').textContent=`번화가 비교 (${items.length})`;
  $('compare-clear').disabled=!comparisonIds.length;
  if(rebuildOptions){
   const container=$('compare-options');container.replaceChildren();
   for(const h of rentalReference?.hotspots||[]){
    const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');
    input.type='checkbox';input.value=h.id;input.dataset.compareId=h.id;input.checked=comparisonIds.includes(h.id);name.textContent=h.name;label.append(input,name);container.append(label);
   }
  }
  $('compare-options').querySelectorAll('input').forEach(input=>{input.checked=comparisonIds.includes(input.value);});
  $('compare-status').textContent=rentalStatus==='loading'?'가격자료 불러오는 중':rentalStatus==='error'?'가격자료를 불러오지 못했어요.':`${items.length}곳 선택 · ${individual?'개별 조건 적용':floor.label}${!individual&&area.valid&&area.mode==='custom'?` · ${area.pyeong}평 적용`:''}${items.length<2?' · 두 곳 이상 선택해 비교해 보세요.':''}`;
  $('compare-table').innerHTML=rentalStatus==='ready'?DistrictModel.comparisonTable(rows,rentalReference,comparisonIds,comparisonConfig()):rentalStatus==='error'?'<button type="button" id="compare-retry">가격자료 다시 불러오기</button>':'';
  const q=rentalReference?.quarter;
  $('compare-source').textContent=q?`서울시 지역별 임대료 · ${q.slice(0,4)}년 ${q.slice(4)}분기 · 조회 ${rentalReference.retrievedAt.slice(0,10)}`:'';
  const f=rentalReference?.floorReference;
  $('compare-floor-source').textContent=f?`한국부동산원 · ${f.scope} · ${f.quarter.slice(0,4)}년 ${f.quarter.slice(4)}분기 · 조회 ${f.retrievedAt.slice(0,10)}. 층별 비율 = 해당 층 환산임대료 ÷ 1층 환산임대료 × 100.`:'층별 자료 연결 대기';
  updateCompareAdd();
 }
 function openComparison(opener){comparisonOpener=opener;refreshPlans();syncBudgetInputs();$('compare-pyeong').value=comparisonSettings.pyeong;$('compare-picker-panel').open=comparisonIds.length<2;renderComparison();if(!$('compare-dialog')?.open)$('compare-dialog')?.showModal();}
 function receiveComparisonReturn(){
  if(!rentalReference||!$('compare-dialog'))return;
  const current=new URL(location.href);let params=current.searchParams;
  if(params.get('compareReturn')!=='1'){try{const pending=sessionStorage.getItem('sim.comparisonReturn.v1');if(pending)params=new URL(pending,current).searchParams;}catch(_){} }
  if(params.get('compareReturn')==='1'){
   const code=params.get('district'),transfer=SpaceModel.comparisonTransfer(params,code,rentalReference);
   if(transfer.status==='ready'){
    try{const latest=JSON.parse(localStorage.getItem('sim.hotspotCompareIndividual.v1'));if(latest)individualComparison=DistrictModel.restoreComparisonIndividuals(latest);const ids=JSON.parse(localStorage.getItem('sim.hotspotCompare.v1'));if(Array.isArray(ids))comparisonIds=DistrictModel.comparisonRows(rows,rentalReference,ids).map(r=>r.hotspot.id);}catch(_){}
    individualComparison=DistrictModel.mergeComparisonReturn(individualComparison,transfer);
    if(!comparisonIds.includes(transfer.hotspotId))comparisonIds.push(transfer.hotspotId);
    saveIndividuals();saveComparison();ensureIndividuals();
    const h=SpaceModel.rentalArea(rentalReference,code,transfer.hotspotId),entry=individualComparison.entries[h.id];
    selectHotspot(h,{...entry,id:h.id,area:entry.pyeong});
    openComparison($('compare-open'));
    $('compare-status').textContent=`${h.name} · 공간에서 바꾼 ${transfer.label} 반영 · ${transfer.inputs.mode==='manual'?'보증금·월세 직접 입력':'추정값'} · 다른 번화가 조건 유지`;
   }else{openComparison($('compare-open'));$('compare-status').textContent='돌아온 조건을 확인할 수 없어 기존 비교 조건을 유지했어요.';}
   try{sessionStorage.removeItem('sim.comparisonReturn.v1');}catch(_){}
  }else if(current.searchParams.get('openCompare')==='1')openComparison($('compare-open'));
  if(current.searchParams.has('compareReturn')||current.searchParams.has('openCompare')){const clean=new URL(location.href);clean.searchParams.delete('compareReturn');clean.searchParams.delete('openCompare');history.replaceState(null,'',clean);}
 }
 function closeComparison(){
  $('compare-dialog').close();
  (comparisonOpener?.isConnected?comparisonOpener:$('compare-open'))?.focus();
 }
 function setOpen(open){listOpen=open;$('district-search').classList.toggle('is-open',open);$('list-toggle').setAttribute('aria-expanded',String(open));}
 function paint(){
  for(const [code,l] of layers){const active=code===selected;l.setStyle(active?activeStyle:baseStyle);const el=l.getElement();if(el){el.setAttribute('aria-pressed',String(active));el.setAttribute('aria-label',l.feature.properties.name+' 선택'+(active?' · 선택됨':''));}l.getTooltip()?.getElement()?.classList.toggle('selected',active);if(active)l.bringToFront();}
  document.querySelectorAll('.district-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hotspot?b.dataset.hotspot===selectedHotspot:b.dataset.code===selected&&!selectedHotspot)));
  paintHotspots();
 }
 function paintHotspots(){
  for(const {marker,items} of hotspotMarkers.values()){
   const active=items.some(h=>h.id===selectedHotspot),el=marker.getElement();
   if(el){el.classList.toggle('is-selected',active);el.setAttribute('aria-pressed',String(active));}
   marker.setZIndexOffset(active?1000:0);
  }
 }
 function selectHotspot(h,handoff){
  const district=rows.find(d=>d.code===h.districtCode);if(!district)return;
  selectionHandoff=handoff===undefined?(selectedHotspot===h.id?selectionHandoff:null):handoff;
  selected=district.code;selectedHotspot=h.id;remember(selected);renderDetail();paint();setOpen(false);
  if(map&&h.location){map.closePopup();map.stop();map.setView([h.location.lat,h.location.lng],Math.max(map.getZoom(),15),{animate:false});
   for(const {marker,items} of hotspotMarkers.values())if(items.some(item=>item.id===h.id))marker.getElement()?.focus({preventScroll:true});
  }
 }
 function renderHotspots(){
  if(!map)return;
  const L=window.L;
  if(!hotspotLayer)hotspotLayer=L.layerGroup().addTo(map);
  hotspotLayer.clearLayers();hotspotMarkers.clear();
  const hotspots=rentalReference?.hotspots||[];
  const groups=DistrictModel.hotspotGroups(hotspots,p=>map.latLngToContainerPoint([p.lat,p.lng]));
  for(const group of groups){
   const items=group.items,single=items.length===1,h=items[0];
   const values=items.map(h=>DistrictModel.hotspotPremium(h,rentalReference)).filter(v=>v!==null);
   const label=single?h.name:`번화가 ${items.length}곳`;
   const premium=single?DistrictModel.premiumLabel(DistrictModel.hotspotPremium(h,rentalReference)):values.length?`${DistrictModel.premiumLabel(Math.min(...values))}~${DistrictModel.premiumLabel(Math.max(...values))}`:'비교 불가';
   const content=document.createElement('span');content.className='hotspot-label';
   const name=document.createElement('span');name.className='hotspot-name';name.textContent=label;
   const price=document.createElement('strong');price.textContent=premium;content.append(name,price);
   const position=single?[h.location.lat,h.location.lng]:map.containerPointToLatLng([group.x,group.y]);
   const marker=L.marker(position,{pane:'hotspotPane',icon:L.divIcon({className:'hotspot-marker'+(single?'':' is-cluster'),html:content,iconSize:[116,48],iconAnchor:[58,24]}),keyboard:true,bubblingMouseEvents:false,title:`${label} · 구 평균 대비 ${premium}`,riseOnHover:true}).addTo(hotspotLayer);
   if(single)marker.on('click',()=>selectHotspot(h));
   else{
    const popup=document.createElement('div');popup.className='hotspot-choices';
    const heading=document.createElement('strong');heading.textContent='가까운 번화가를 선택하세요';popup.append(heading);
    for(const item of items){
     const b=document.createElement('button');b.type='button';b.textContent=`${item.name} · ${DistrictModel.premiumLabel(DistrictModel.hotspotPremium(item,rentalReference))}`;
     b.addEventListener('click',()=>selectHotspot(item));popup.append(b);
    }
    const expand=document.createElement('button');expand.type='button';expand.textContent='지도 확대해서 펼쳐 보기';
    expand.addEventListener('click',()=>{map.closePopup();map.fitBounds(L.latLngBounds(items.map(h=>[h.location.lat,h.location.lng])),{padding:[90,110],maxZoom:16,animate:false});});popup.append(expand);
    marker.bindPopup(popup,{maxWidth:280,minWidth:220,autoPanPaddingTopLeft:[20,110],autoPanPaddingBottomRight:[20,65]});
   }
   hotspotMarkers.set(items.map(h=>h.id).join(','),{marker,items});
   const el=marker.getElement();
   el.setAttribute('aria-label',`${label}, 구 평균 대비 ${premium}${single?' 선택':' 목록 열기'}`);
   el.setAttribute('role','button');el.setAttribute('aria-describedby','hotspot-map-help');
   el.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();if(single)selectHotspot(h);else marker.openPopup();}});
  }
  paintHotspots();
 }
 function selectDistrict(d,preserveHotspot=false){
  if(!preserveHotspot){selectedHotspot='';selectionHandoff=null;}
  selected=d.code;remember(selected);renderDetail();paint();setOpen(false);
  if(map){map.stop();const layer=layers.get(d.code);if(layer)map.fitBounds(layer.getBounds(),{padding:[54,65],maxZoom:12,animate:false});}
 }
 function list(){
  const found=DistrictModel.searchPlaces(rows,$('search').value,rentalReference);$('district-list').replaceChildren();resultButtons=[];
  const add=(row,hotspot)=>{
   const b=document.createElement('button');b.type='button';b.className='district-button'+(hotspot?' hotspot-result':'');b.dataset.code=hotspot?row.districtCode:row.code;
   if(hotspot)b.dataset.hotspot=row.id;
   b.textContent=hotspot?`${row.name}\n번화가 · ${rows.find(d=>d.code===row.districtCode).name} · 구 평균 ${DistrictModel.premiumLabel(DistrictModel.hotspotPremium(row,rentalReference))}`:row.name;
   b.setAttribute('aria-pressed',String(hotspot?row.id===selectedHotspot:row.code===selected&&!selectedHotspot));
   b.addEventListener('click',()=>{if(hotspot)selectHotspot(row);else selectDistrict(row);if(!hotspot||!map)$('search').focus?.();setOpen(false);});
   b.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();$('search').focus();setOpen(false);}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=resultButtons.indexOf(b)+(e.key==='ArrowDown'?1:-1);if(next<0)$('search').focus();else resultButtons[Math.min(next,resultButtons.length-1)]?.focus();}
   });
   resultButtons.push(b);$('district-list').append(b);
  };
  found.hotspots.forEach(h=>add(h,true));found.districts.forEach(d=>add(d,false));
  const pending=rentalStatus==='loading'?' · 번화가 불러오는 중':rentalStatus==='error'?' · 번화가 자료 연결 실패':'';
  $('result-status').textContent=resultButtons.length?`번화가 ${found.hotspots.length}곳 · 자치구 ${found.districts.length}개${pending}`:`검색 결과가 없어요. 구·번화가 이름을 바꿔보세요.${pending}`;
 }
 function overview(){selected=null;selectedHotspot='';remember(null);renderDetail();paint();if(map){map.stop();map.fitBounds(allBounds,{padding:[24,32],animate:false});}}
 function initMap(geo){
  if(!window.L){$('map-status').textContent='지도를 불러오지 못했어요. 구 목록으로 선택할 수 있어요.';setOpen(true);return;}
  const L=window.L;map=L.map('map',{zoomControl:false,scrollWheelZoom:false,zoomSnap:.25}).setView([37.565,126.98],11);L.control.zoom({position:'topright'}).addTo(map);
  map.createPane('hotspotPane').style.zIndex='660';
  let tileFailed=false;
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
  tiles.on('tileerror',()=>{tileFailed=true;$('map-status').textContent='배경지도 연결 안 됨 · 구 경계와 선택은 이용 가능';});
  tiles.on('load',()=>{if(!tileFailed)$('map-status').textContent='구 경계에서 선택 · 검색과 목록도 이용 가능';});tiles.addTo(map);
  geoLayer=L.geoJSON(geo,{style:baseStyle,onEachFeature:(feature,l)=>{
   const d=feature.properties;layers.set(d.code,l);l.bindTooltip(d.name,{permanent:true,direction:'center',className:'district-label',interactive:false});
   l.on('click',()=>selectDistrict(d));l.on('mouseover',()=>{if(d.code!==selected)l.setStyle({fillOpacity:.72,weight:2.4,color:'#A64324'});});l.on('mouseout',()=>l.setStyle(d.code===selected?activeStyle:baseStyle));
  }}).addTo(map);
  for(const l of layers.values()){const el=l.getElement();el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',l.feature.properties.name+' 선택');el.setAttribute('aria-pressed','false');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDistrict(l.feature.properties);}});}
  allBounds=geoLayer.getBounds();map.fitBounds(allBounds,{padding:[24,32],animate:false});$('map-status').textContent='구 경계에서 선택 · 검색과 목록도 이용 가능';
  map.on('popupopen',()=>{hotspotPopupOpen=true;});map.on('popupclose',()=>{hotspotPopupOpen=false;});
  map.on('moveend',()=>{if(!hotspotPopupOpen)renderHotspots();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>map.invalidateSize({animate:false})).observe($('map'));
 }
 async function loadFootfall(){
  try{const response=await fetch('data/footfall-estimates.json');if(!response.ok)throw Error();footfall=FootfallModel.validate(await response.json());}catch(_){footfall=null;}
  if(rentalReference)rentalReference.footfall=footfall;
  const source=$('compare-flow-source');if(source)source.innerHTML=FootfallModel.source(footfall);
  renderDetail();renderComparison();
 }
 async function loadStatistics(){
  statisticsStatus='loading';renderDetail();
  try{
   const response=await fetch('data/district-data.json');
   if(!response.ok)throw Error('통계 로딩 실패');
   statistics=DistrictModel.validateStats(await response.json(),rows);statisticsStatus='ready';
  }catch(_){statistics=null;statisticsStatus='error';}
  renderDetail();
 }
 async function loadRentals(){
  rentalStatus='loading';renderDetail();renderComparison();
  try{
   const response=await fetch('data/space-reference.json');
   if(!response.ok)throw Error('가격자료 로딩 실패');
   const data=SpaceModel.validateReferences(await response.json(),rows);
   if(!/^\d{4}-\d{2}-\d{2}T/.test(data.retrievedAt))throw Error('가격자료 조회일 오류');
   rentalReference=data;rentalReference.footfall=footfall;rentalStatus='ready';
   comparisonIds=DistrictModel.comparisonRows(rows,data,comparisonIds).map(item=>item.hotspot.id);saveComparison();
   if(selectedHotspot&&!SpaceModel.rentalArea(data,selected,selectedHotspot)){selectedHotspot='';remember(selected);}
  }catch(_){rentalReference=null;rentalStatus='error';}
  renderDetail();renderHotspots();list();renderComparison(true);
  if(map&&selectedHotspot){const h=SpaceModel.rentalArea(rentalReference,selected,selectedHotspot);if(h)selectHotspot(h);}
  receiveComparisonReturn();
 }
 async function load(){
  $('district-list').setAttribute('aria-busy','true');$('retry').hidden=true;
  try{const response=await fetch('data/seoul-districts.geojson');if(!response.ok)throw Error('경계 로딩 실패');const geo=await response.json();rows=DistrictModel.validate(geo);list();if(!map)initMap(geo);const initial=rows.find(d=>d.code===initialCode());if(initial)selectDistrict(initial,true);await Promise.all([loadStatistics(),loadRentals(),loadFootfall()]);}
  catch(_){statisticsStatus='idle';renderDetail();$('result-status').textContent='구 경계를 불러오지 못했어요. 다시 시도해 주세요.';$('map-status').textContent='경계 자료 없음 · 재시도가 필요해요.';$('retry').hidden=false;setOpen(true);}
  finally{$('district-list').setAttribute('aria-busy','false');}
 }
 renderDetail();
 $('detail').addEventListener('click',e=>{if(e.target.id==='stats-retry')loadStatistics();if(e.target.id==='rent-retry')loadRentals();if(e.target.id==='compare-add'&&SpaceModel.rentalArea(rentalReference,selected,selectedHotspot)){if(!comparisonIds.includes(selectedHotspot))comparisonIds.push(selectedHotspot);saveComparison();renderComparison();openComparison(e.target);}});
 $('compare-open')?.addEventListener('click',e=>openComparison(e.currentTarget));
 $('compare-shared')?.addEventListener('click',()=>{individualComparison.individual=false;saveIndividuals();renderComparison();});
 $('compare-individual')?.addEventListener('click',()=>{individualComparison.individual=true;ensureIndividuals();saveIndividuals();renderComparison();});
 $('compare-table')?.addEventListener('input',e=>{if(e.target.dataset.itemArea)updateIndividual(e);});
 $('compare-table')?.addEventListener('change',e=>{if(e.target.dataset.itemAlley){updateComparisonLocation(e.target);return;}if(e.target.dataset.itemFloor)updateIndividual(e);if(e.target.dataset.itemFloor||e.target.dataset.itemArea)reorderComparison();});
 $('compare-plan-save')?.addEventListener('click',saveNamedComparison);
 $('compare-plan-name')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();saveNamedComparison();}});
 $('compare-plan-list')?.addEventListener('change',()=>{cancelPlanRename();cancelPlanCopy();showPlanSummary();});
 $('compare-plan-copy')?.addEventListener('click',startPlanCopy);
 $('compare-ab-copy')?.addEventListener('change',()=>{pairEditingId='';$('compare-ab-draft').checked=false;$('compare-ab-edit-status').textContent='';refreshPlanPair();});
 $('compare-ab-edit')?.addEventListener('click',togglePairEditing);
 $('compare-ab-save')?.addEventListener('click',savePairEditing);
 $('compare-ab-results')?.addEventListener('input',e=>{if(e.target.matches('input[data-copy-field]')&&!e.isComposing)editPairField(e.target.dataset.copyField,e.target.dataset.copyId,e.target.value);});
 $('compare-ab-results')?.addEventListener('compositionend',e=>{if(e.target.matches('input[data-copy-field]'))editPairField(e.target.dataset.copyField,e.target.dataset.copyId,e.target.value);});
 $('compare-ab-results')?.addEventListener('change',e=>{if(e.target.matches('select[data-copy-field]'))editPairField(e.target.dataset.copyField,e.target.dataset.copyId,e.target.value);});
 $('compare-ab-results')?.addEventListener('click',e=>{const button=e.target.closest('[data-copy-auto]');if(button){editPairField('auto',button.dataset.copyAuto,'');$('copy-deposit-'+button.dataset.copyAuto)?.focus({preventScroll:true});}});
 $('compare-ab-draft')?.addEventListener('change',refreshPlanPair);
 $('compare-ab-changed')?.addEventListener('change',refreshPlanPair);
 $('compare-ab')?.addEventListener('toggle',()=>{if($('compare-ab').open){try{planLibrary=readPlans();refreshPlanPair();}catch(error){$('compare-ab-results').replaceChildren();$('compare-ab-status').textContent=error.message;}}});
 $('compare-plan-copy-save')?.addEventListener('click',copyNamedComparison);
 $('compare-copy-update')?.addEventListener('click',updateWorkingCopy);
 $('compare-plan-copy-cancel')?.addEventListener('click',()=>{cancelPlanCopy();$('compare-plan-copy').focus();});
 $('compare-plan-copy-name')?.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();copyNamedComparison();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelPlanCopy();$('compare-plan-copy').focus();}});
 $('compare-plan-rename')?.addEventListener('click',startPlanRename);
 $('compare-plan-rename-save')?.addEventListener('click',renameNamedComparison);
 $('compare-plan-rename-cancel')?.addEventListener('click',()=>{cancelPlanRename();$('compare-plan-rename').focus();});
 $('compare-plan-rename-name')?.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();renameNamedComparison();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelPlanRename();$('compare-plan-rename').focus();}});
 $('compare-plan-delete')?.addEventListener('click',deleteNamedComparison);
 $('compare-plan-delete-undo')?.addEventListener('click',undoDeletedComparison);
 $('compare-plan-load')?.addEventListener('click',loadNamedComparison);
 $('compare-plan-undo')?.addEventListener('click',()=>{if(!planUndo)return;try{applyComparisonSnapshot(planUndo);setEditingCopy(planUndoCopyId);planUndo=null;planUndoCopyId='';$('compare-plan-undo').hidden=true;$('compare-plan-status').textContent='불러오기 전 비교 조건으로 되돌렸어요. 저장된 비교안은 그대로 유지됩니다.';$('compare-plan-load').focus();}catch(error){$('compare-plan-status').textContent=error.message;}});
 for(const key of ['deposit','monthly'])$('compare-budget-'+key)?.addEventListener('input',e=>{comparisonBudget[key]=e.target.validity?.badInput?'invalid':e.target.value;saveBudget();renderComparison();});
 $('compare-budget-only')?.addEventListener('change',e=>{comparisonBudget.enabled=e.target.checked;saveBudget();renderComparison();});
 $('compare-budget-reset')?.addEventListener('click',()=>{comparisonBudget=DistrictModel.restoreComparisonBudget(null);saveBudget();syncBudgetInputs();renderComparison();$('compare-budget-deposit').focus();});
 $('compare-sort')?.addEventListener('change',e=>{
  if(DistrictModel.comparisonSortInfo(e.target.value).key!==e.target.value)return;
  comparisonSort=e.target.value;try{localStorage.setItem('sim.hotspotCompareSort.v1',comparisonSort);}catch(_){}
  renderComparison();$('compare-status').textContent=comparisonSortMessage();
 });
 $('compare-floor')?.addEventListener('change',e=>{const floor=e.target.value;if(!DistrictModel.comparisonFloor(floor).valid)return;comparisonSettings={...comparisonSettings,floor};saveComparisonSettings();renderComparison();});
 $('compare-pyeong')?.addEventListener('input',e=>setComparisonArea('custom',e.target.value));
 $('compare-range')?.addEventListener('click',()=>setComparisonArea('range'));
 $('compare-custom')?.addEventListener('click',()=>{setComparisonArea('custom');$('compare-pyeong').focus();});
 $('compare-presets')?.addEventListener('click',e=>{const pyeong=e.target.closest('[data-pyeong]')?.dataset.pyeong;if(pyeong){$('compare-pyeong').value=pyeong;setComparisonArea('custom',pyeong);}});
 $('compare-close')?.addEventListener('click',closeComparison);
 $('compare-dialog')?.addEventListener('cancel',e=>{e.preventDefault();closeComparison();});
 $('compare-options')?.addEventListener('change',e=>{
  const id=e.target.dataset.compareId;if(!rentalReference?.hotspots.some(h=>h.id===id))return;
  comparisonIds=comparisonIds.filter(item=>item!==id);if(e.target.checked)comparisonIds.push(id);
  saveComparison();renderComparison();
 });
 $('compare-clear')?.addEventListener('click',()=>{comparisonIds=[];saveComparison();renderComparison();$('compare-options').querySelector('input')?.focus();});
 $('compare-table')?.addEventListener('click',e=>{
  if(e.target.id==='compare-retry'){loadRentals();return;}
  const resetId=e.target.closest('[data-estimate-reset]')?.dataset.estimateReset;
  if(resetId&&individualComparison.individual&&individualComparison.entries[resetId]){const entry=individualComparison.entries[resetId];individualComparison.entries[resetId]={pyeong:entry.pyeong,floor:entry.floor,...locationFields(entry),...(entry.locationIndependent?{locationIndependent:true}:{})};saveIndividuals();syncSelectionEntry(resetId);renderComparison();($('area-'+resetId)||$('compare-budget-only')).focus();$('compare-status').textContent='선택한 번화가만 추정값으로 전환했어요.';return;}
  const h=rentalReference?.hotspots.find(h=>h.id===e.target.closest('[data-compare-map]')?.dataset.compareMap);
  if(h){
   const item=DistrictModel.comparisonRows(rows,rentalReference,[h.id],comparisonConfig())[0];
   if(!item||DistrictModel.comparisonIssue(item)){$('compare-status').textContent='면적과 층을 확인한 뒤 선택해 주세요.';$('area-'+h.id)?.focus();return;}
   closeComparison();selectHotspot(h,item.handoffUrl?{...item.pricing,...locationFields(item.location),id:h.id,area:String(item.area.pyeong),floor:item.floor.key}:null);
  }
 });
 $('detail').addEventListener('change',e=>{
  if(e.target.id!=='rent-area')return;
  const value=e.target.value;
  if(value&&!SpaceModel.rentalArea(rentalReference,selected,value))return;
  if(value)selectHotspot(SpaceModel.rentalArea(rentalReference,selected,value));
  else{selectedHotspot='';remember(selected);renderDetail();paint();}
  $('rent-area')?.focus();
 });
 $('search').addEventListener('input',()=>{if(rows.length)list();setOpen(true);});$('search').addEventListener('focus',()=>setOpen(true));$('search').addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(e.key==='Escape')setOpen(false);
  if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);resultButtons[0]?.focus();}
  if(e.key==='Enter'&&$('search').value.trim()&&resultButtons.length){e.preventDefault();if(resultButtons.length===1)resultButtons[0].click();else{setOpen(true);resultButtons[0].focus();}}
 });
 $('list-toggle').addEventListener('click',()=>setOpen(!listOpen));$('overview').addEventListener('click',overview);$('retry').addEventListener('click',load);
 window.addEventListener?.('pageshow',e=>{if(e.persisted)receiveComparisonReturn();});
 load();
})();
