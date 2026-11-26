/* Transparent scenario arithmetic. Defaults are assumptions, never market predictions. */
(function(root){
 'use strict';
 const SQM_PER_PYEONG=400/121;
 const LOCATION_KEYS=['locationType','rentFactor','trafficFactor'];
 const LOCATION_PRESETS={baseline:{label:'기준 입지',rentFactor:'100',trafficFactor:'100'},road:{label:'대로변 · 예시 가정',rentFactor:'100',trafficFactor:'100'},side:{label:'이면도로 · 예시 가정',rentFactor:'90',trafficFactor:'80'},alley:{label:'골목 안쪽 · 예시 가정',rentFactor:'80',trafficFactor:'60'},custom:{label:'직접 설정',rentFactor:'100',trafficFactor:'100'}};
 const DEFAULTS={area:'66',unit:'sqm',floor:'1',floorZone:'above',depositMonths:'12',premiumMonths:'6',adjustmentPercent:'100',floorRatioOverride:'',mode:'auto',deposit:'',monthly:'',premium:'',locationType:'baseline',rentFactor:'100',trafficFactor:'100'};
 const numeric=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
 const bounded=(value,min,max,integer=false)=>{const n=numeric(value);return n!==null&&n>=min&&n<=max&&(!integer||Number.isInteger(n))?n:null;};
 const round=v=>Math.round(v/1000)*1000;
 function locationPreset(type){const preset=typeof type==='string'&&Object.hasOwn(LOCATION_PRESETS,type)?LOCATION_PRESETS[type]:null;return preset?{locationType:type,rentFactor:preset.rentFactor,trafficFactor:preset.trafficFactor}:null;}
 function locationInputs(state={}){return Object.fromEntries(LOCATION_KEYS.map(key=>[key,state[key]===undefined?DEFAULTS[key]:state[key]]));}
 function locationScenario(state={}){
  const inputs=locationInputs(state),rent=bounded(inputs.rentFactor,1,300),traffic=bounded(inputs.trafficFactor,0,300),preset=typeof inputs.locationType==='string'&&Object.hasOwn(LOCATION_PRESETS,inputs.locationType)?LOCATION_PRESETS[inputs.locationType]:null;
  const errors={};if(!preset)errors.locationType='입지를 선택해 주세요.';if(rent===null)errors.rentFactor='임대료 지수를 1~300 사이로 입력해 주세요.';if(traffic===null)errors.trafficFactor='유동 가정 지수를 0~300 사이로 입력해 주세요.';
  return {...inputs,valid:!Object.keys(errors).length,errors,label:preset?.label||'입지 확인 필요',rent,traffic};
 }
 function locationComparisonKey(code,hotspotId=''){
  return /^11\d{3}$/.test(code)&&(!hotspotId||/^11\d{6}$/.test(hotspotId)&&hotspotId.slice(0,5)===code)?`sim.locationCompare.v1.${code}.${hotspotId||'district'}`:null;
 }
 function locationComparisonSnapshot(code,hotspotId,scenarios){
  if(!locationComparisonKey(code,hotspotId))return null;
  const entries={};
  for(const side of ['road','alley']){
   const config=scenarios?.[side];
   if(!config||['rentFactor','trafficFactor'].some(k=>typeof config[k]!=='string'||config[k].length>40))return null;
   entries[side]={locationType:side,rentFactor:config.rentFactor,trafficFactor:config.trafficFactor};
   if(!locationScenario(entries[side]).valid)return null;
  }
  return {schemaVersion:1,districtCode:code,hotspotId,scenarios:entries};
 }
 function restoreLocationComparison(saved,code,hotspotId=''){
  return saved?.schemaVersion===1&&saved.districtCode===code&&saved.hotspotId===hotspotId?locationComparisonSnapshot(code,hotspotId,saved.scenarios)?.scenarios||null:null;
 }
 function applyLocationComparison(state,side,config){
  if(!['road','alley'].includes(side)||!config||['rentFactor','trafficFactor'].some(k=>typeof config[k]!=='string'||config[k].length>40))return null;
  const inputs={locationType:side,rentFactor:config.rentFactor,trafficFactor:config.trafficFactor};
  return locationScenario(inputs).valid?{...state,...inputs}:null;
 }
 function compareLocations(state,reference,floorReference,scenarios={}){
  const configs={road:{...locationPreset('baseline'),...scenarios.road},alley:{...locationPreset('alley'),...scenarios.alley}};
  const shared={...DEFAULTS,...state,mode:'auto'};
  const road=calculate({...shared,...configs.road},reference,floorReference),alley=calculate({...shared,...configs.alley},reference,floorReference);
  const locations={road:locationScenario(configs.road),alley:locationScenario(configs.alley)};
  const delta=(from,to)=>({amount:to-from,percent:from===0?null:(to-from)/from*100});
  const ready=road.status==='ready'&&alley.status==='ready';
  return {status:ready?'ready':'unavailable',road,alley,locations,changes:ready?{deposit:delta(road.deposit,alley.deposit),monthly:delta(road.monthly,alley.monthly),traffic:delta(locations.road.traffic,locations.alley.traffic)}:null};
 }
 function rentalArea(reference,code,hotspotId=''){
  if(hotspotId)return reference?.hotspots?.find(h=>h.id===hotspotId&&h.districtCode===code)||null;
  return reference?.districts.find(d=>d.code===code)||null;
 }
 function hotspotsFor(reference,code){return (reference?.hotspots||[]).filter(h=>h.districtCode===code);}
 function validate(state){
  const errors={};
  const area=bounded(state.area,0.1,10000);
  if(area===null)errors.area='면적을 0.1~10,000 사이 숫자로 입력해 주세요.';
  if(!['sqm','pyeong'].includes(state.unit))errors.area='면적 단위를 선택해 주세요.';
  const floor=bounded(state.floor,1,100,true);
  if(floor===null)errors.floor='층을 1~100 사이 정수로 입력해 주세요.';
  if(!['above','below'].includes(state.floorZone))errors.floor='지상 또는 지하를 선택해 주세요.';
  if(!['auto','manual'].includes(state.mode))errors.mode='가격 입력 방식을 선택해 주세요.';
  if(state.mode==='auto'){
   if(bounded(state.depositMonths,0,120)===null)errors.depositMonths='보증금 개월수를 0~120 사이로 입력해 주세요.';
   if(bounded(state.premiumMonths,0,120)===null)errors.premiumMonths='권리금 개월수를 0~120 사이로 입력해 주세요.';
   if(bounded(state.adjustmentPercent,1,500)===null)errors.adjustmentPercent='참고 단가 조정을 1~500% 사이로 입력해 주세요.';
   if(state.floorRatioOverride!==''&&bounded(state.floorRatioOverride,1,300)===null)errors.floorRatioOverride='층별 비율은 비워두거나 1~300% 사이로 입력해 주세요.';
  }else{
   for(const k of ['deposit','monthly','premium'])if(bounded(state[k],0,10000000)===null)errors[k]='금액을 0 이상 숫자로 입력해 주세요. 없으면 0을 입력하세요.';
  }
  Object.assign(errors,locationScenario(state).errors);
  return {valid:Object.keys(errors).length===0,errors,areaSqm:area===null?null:area*(state.unit==='pyeong'?SQM_PER_PYEONG:1),floor:floor===null?null:floor*(state.floorZone==='below'?-1:1)};
 }
 function calculate(state,reference,floorReference){
  const v=validate(state);
  if(!v.valid)return {status:'invalid',...v};
  if(state.mode==='manual'){
   const costs=Object.fromEntries(['deposit','monthly','premium'].map(k=>[k,round(Number(state[k])*10000)]));
   return {status:'ready',...v,mode:'manual',...costs,upfront:costs.deposit+costs.premium};
  }
  const rate=reference?.firstFloor;
  const floorKey=v.floor>=6?'6+':String(v.floor);
  const floorRatio=state.floorRatioOverride!==''?Number(state.floorRatioOverride):floorReference?.ratios[floorKey];
  if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0)return {status:'unavailable',reason:'reference',...v};
  if(typeof floorRatio!=='number'||!Number.isFinite(floorRatio)||floorRatio<=0)return {status:'unavailable',reason:'floor',...v};
  const equivalent=rate*(v.areaSqm/3.3)*(Number(state.adjustmentPercent)/100)*(floorRatio/100)*(locationScenario(state).rent/100);
  const cash=equivalent/(1+.12/12*Number(state.depositMonths));
  const deposit=round(cash*Number(state.depositMonths)),monthly=round(cash),premium=round(cash*Number(state.premiumMonths));
  return {status:'ready',...v,mode:'auto',rate,equivalent,floorRatio,floorKey,floorRatioSource:state.floorRatioOverride!==''?'custom':'reference',deposit,monthly,premium,upfront:deposit+premium};
 }
 function validateReferences(data,rows){
  if(data?.schemaVersion!==1||data.annualConversionRate!==.12||!/^\d{4}[1-4]$/.test(data.quarter)||!Array.isArray(data.districts)||data.districts.length!==25)throw Error('공간 참고자료 형식 오류');
  const expected=new Map(rows.map(r=>[r.code,r.name])),seen=new Set();
  for(const r of data.districts){
   if(seen.has(r.code)||expected.get(r.code)!==r.name)throw Error('공간 참고자료 지역 오류');
   seen.add(r.code);
   for(const k of ['firstFloor','otherFloors'])if(r[k]!==null&&!(Number.isSafeInteger(r[k])&&r[k]>0))throw Error('공간 참고자료 단가 오류');
  }
  if(data.source?.url!=='https://golmok.seoul.go.kr/stateArea.do'||data.source?.definitionUrl!=='https://golmok.seoul.go.kr/source.do')throw Error('공간 참고자료 출처 오류');
  if(data.hotspots!==undefined){
   if(!Array.isArray(data.hotspots))throw Error('번화가 자료 형식 오류');
   const ids=new Set();
   for(const h of data.hotspots){
    if(typeof h.id!=='string'||!/^11\d{6}$/.test(h.id)||ids.has(h.id)||h.id.slice(0,5)!==h.districtCode||!expected.has(h.districtCode)||h.scope!=='administrative-dong')throw Error('번화가 지역 연결 오류');
    if(typeof h.name!=='string'||!h.name.trim()||typeof h.dongName!=='string'||!h.dongName.trim())throw Error('번화가 이름 오류');
    if(!Number.isSafeInteger(h.firstFloor)||h.firstFloor<=0||h.otherFloors!==null&&(!Number.isSafeInteger(h.otherFloors)||h.otherFloors<=0))throw Error('번화가 단가 오류');
    if(h.location&&(!Number.isFinite(h.location.lat)||!Number.isFinite(h.location.lng)||h.location.lat<37.4||h.location.lat>37.7||h.location.lng<126.7||h.location.lng>127.3))throw Error('번화가 위치 오류');
    ids.add(h.id);
   }
  }
  if(data.floorReference?.sourceUrl!=='https://www.reb.or.kr/r-one/portal/stat/easyStatPage/T261943143757415.do'||!/^\d{4}[1-4]$/.test(data.floorReference.quarter))throw Error('층별 출처 오류');
  for(const k of ['-1','1','2','3','4','5','6+'])if(typeof data.floorReference.ratios[k]!=='number'||!Number.isFinite(data.floorReference.ratios[k])||data.floorReference.ratios[k]<=0||data.floorReference.ratios[k]>300)throw Error('층별 비율 오류');
  if(data.floorReference.ratios['1']!==100)throw Error('1층 기준 오류');
  const floorRows=data.floorReference.rows;
  if(!Array.isArray(floorRows)||floorRows.length!==7||new Set(floorRows.map(r=>r.key)).size!==7||floorRows.some(r=>!['-1','1','2','3','4','5','6+'].includes(r.key)))throw Error('층별 원자료 행 오류');
  const base=floorRows.find(r=>r.key==='1')?.rentThousandPerSqm;
  for(const r of floorRows)if(typeof r.floor!=='string'||!Number.isFinite(r.rentThousandPerSqm)||r.rentThousandPerSqm<=0||!Number.isFinite(r.ratio)||r.ratio!==data.floorReference.ratios[r.key]||Math.abs(r.rentThousandPerSqm/base*100-r.ratio)>1e-8)throw Error('층별 원자료 대조 오류');
  if(!/^\d{4}-\d{2}-\d{2}T/.test(data.floorReference.retrievedAt))throw Error('층별 자료 조회일 오류');
  return data;
 }
 function restore(saved,code){
  if(saved?.schemaVersion!==1||saved.districtCode!==code||!saved.inputs)return {...DEFAULTS};
  const result={...DEFAULTS};
  for(const k of Object.keys(DEFAULTS))if(typeof saved.inputs[k]==='string'&&saved.inputs[k].length<=40)result[k]=saved.inputs[k];
  return validate(result).valid?result:{...DEFAULTS};
 }
 function comparisonTransfer(params,code,reference){
  const keys=['compareArea','compareFloor'];
  const priceKeys=['comparePricing','compareDeposit','compareMonthly'];
  const locationKeys=['compareLocation','compareRentFactor','compareTrafficFactor'];
  if(![...keys,...priceKeys,...locationKeys].some(k=>params.has(k)))return {status:'none'};
  if(keys.some(k=>params.getAll(k).length!==1)||params.getAll('hotspot').length!==1)return {status:'invalid'};
  const area=params.get('compareArea'),floorKey=params.get('compareFloor'),hotspotId=params.get('hotspot');
  if(!['-1','1','2','3','4','5','6+'].includes(floorKey)||!area||area.length>40||!/^11\d{6}$/.test(hotspotId)||hotspotId.slice(0,5)!==code)return {status:'invalid'};
  const inputs={area,unit:'pyeong',floor:floorKey==='-1'?'1':floorKey==='6+'?'6':floorKey,floorZone:floorKey==='-1'?'below':'above',mode:'auto',depositMonths:'12',adjustmentPercent:'100',floorRatioOverride:'',deposit:'',monthly:'',premium:''};
  Object.assign(inputs,locationPreset('baseline'));
  if(locationKeys.some(k=>params.has(k))){if(locationKeys.some(k=>params.getAll(k).length!==1||params.get(k).length>40))return {status:'invalid'};LOCATION_KEYS.forEach((key,i)=>inputs[key]=params.get(locationKeys[i]));}
  if(priceKeys.some(k=>params.has(k))){
   if(priceKeys.some(k=>params.getAll(k).length!==1)||params.get('comparePricing')!=='manual'||priceKeys.some(k=>params.get(k).length>40))return {status:'invalid'};
   Object.assign(inputs,{mode:'manual',deposit:params.get('compareDeposit'),monthly:params.get('compareMonthly'),premium:'0'});
  }
  if(!validate({...DEFAULTS,...inputs}).valid)return {status:'invalid'};
  if(!reference)return {status:'pending'};
  const row=rentalArea(reference,code,hotspotId);
  if(!row||calculate({...DEFAULTS,...inputs},row,reference.floorReference).status!=='ready')return {status:'invalid'};
  return {status:'ready',hotspotId,inputs,label:`${Number(area).toLocaleString('ko-KR',{maximumFractionDigits:10})}평 · ${floorKey==='-1'?'지하 1층':floorKey==='6+'?'6층 이상':floorKey+'층'}`};
 }
 function comparisonUrl(code,hotspotId,area,floor,reference,pricing,location){
  const params=new URLSearchParams({district:code,hotspot:hotspotId,compareArea:String(area),compareFloor:String(floor)});
  if(pricing?.pricingMode==='manual'){params.set('comparePricing','manual');params.set('compareDeposit',pricing.deposit);params.set('compareMonthly',pricing.monthly);}
  if(location){const values=locationInputs(location);['compareLocation','compareRentFactor','compareTrafficFactor'].forEach((key,i)=>params.set(key,values[LOCATION_KEYS[i]]));}
  return comparisonTransfer(params,code,reference).status==='ready'?'space.html?'+params.toString():'';
 }
 function comparisonReturn(state,code,hotspotId,reference){
  const v=validate({...DEFAULTS,area:state.area,unit:state.unit,floor:state.floor,floorZone:state.floorZone});
  if(!v.valid)return {status:'invalid',message:'면적·층을 확인해 주세요. 돌아가도 기존 비교 조건은 유지됩니다.'};
  const pricing=state.mode==='manual'?{pricingMode:'manual',deposit:state.deposit,monthly:state.monthly}:null;
  if(pricing&&!validate({...DEFAULTS,mode:'manual',deposit:state.deposit,monthly:state.monthly,premium:'0'}).valid)return {status:'invalid',message:'보증금·월세를 0~10,000,000만원 사이 숫자로 입력해 주세요. 기존 비교 조건은 유지됩니다.'};
  if(v.floor<-1)return {status:'invalid',message:'비교는 지하 1층까지만 지원해요. 기존 비교 조건은 유지됩니다.'};
  const pyeong=state.unit==='pyeong'?String(state.area):String(Number((v.areaSqm/SQM_PER_PYEONG).toPrecision(12)));
  if(!validate({...DEFAULTS,area:pyeong,unit:'pyeong'}).valid)return {status:'invalid',message:'비교에서는 0.1~10,000평을 지원해요. 기존 비교 조건은 유지됩니다.'};
  if(!locationScenario(state).valid)return {status:'invalid',message:'입지 가정 값을 확인해 주세요. 기존 비교 조건은 유지됩니다.'};
  const floor=v.floor>=6?'6+':String(v.floor),url=comparisonUrl(code,hotspotId,pyeong,floor,reference,pricing,locationInputs(state));
  return url?{status:'ready',url:url.replace('space.html?','map.html?')+'&compareReturn=1',pyeong,floor}:{status:'invalid',message:'번화가 참고자료를 확인할 수 없어 기존 비교 조건을 유지합니다.'};
 }
 function snapshot(code,state,result,reference,hotspotId=''){
  if(result.status!=='ready')throw Error('유효하지 않은 공간 조건');
  const area=rentalArea(reference,code,hotspotId);
  if(hotspotId&&!area&&state.mode==='auto')throw Error('번화가 참고자료 불일치');
  return {schemaVersion:1,districtCode:code,hotspotId,rentalAreaName:area?.name||null,rentalDongName:area?.dongName||null,inputs:{...state},areaSqm:result.areaSqm,floor:result.floor,costs:{deposit:result.deposit,monthly:result.monthly,premium:result.premium},pricingMode:state.mode,referenceQuarter:state.mode==='auto'?reference.quarter:null,floorReferenceQuarter:state.mode==='auto'?reference.floorReference.quarter:null,floorRatio:result.floorRatio??null,modelVersion:'scenario-v1',savedAt:new Date().toISOString()};
 }
 const api={DEFAULTS,SQM_PER_PYEONG,LOCATION_KEYS,LOCATION_PRESETS,locationPreset,locationInputs,locationScenario,locationComparisonKey,locationComparisonSnapshot,restoreLocationComparison,applyLocationComparison,compareLocations,validate,calculate,validateReferences,restore,snapshot,rentalArea,hotspotsFor,comparisonTransfer,comparisonUrl,comparisonReturn};
 if(typeof module!=='undefined')module.exports=api;else root.SpaceModel=api;
})(typeof window!=='undefined'?window:globalThis);
