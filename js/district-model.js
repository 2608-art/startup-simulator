/* Official district statistics and separately labelled rental scenarios. */
(function(root){
 'use strict';
 const flowModel=typeof module!=='undefined'?require('./footfall-model.js'):root.FootfallModel;
 const space=typeof module!=='undefined'?require('./space-model.js'):root.SpaceModel;
 const locationFields=s=>Object.fromEntries(space.LOCATION_KEYS.filter(k=>typeof s?.[k]==='string'&&s[k].length<=40).map(k=>[k,s[k]]));
 const locationShape=s=>space.LOCATION_KEYS.every(k=>s?.[k]===undefined||typeof s[k]==='string'&&s[k].length<=40);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function search(rows,q){return rows.filter(d=>(d.name+' '+d.code).includes(q.trim())).sort((a,b)=>a.name.localeCompare(b.name,'ko'));}
 function searchPlaces(rows,q,reference){
  const normalize=s=>String(s).normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s·.,()\-]/g,'');
  const terms=q.trim().split(/\s+/).map(normalize).filter(Boolean);
  const matches=s=>terms.every(t=>normalize(s).includes(t));
  const districts=rows.filter(d=>matches(d.name+' '+d.code)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  const hotspots=terms.length?(reference?.hotspots||[]).filter(h=>{
   const district=rows.find(d=>d.code===h.districtCode);
   return district&&matches(h.name+' '+h.dongName+' '+h.id+' '+district.name);
  }).sort((a,b)=>a.name.localeCompare(b.name,'ko')):[];
  return {districts,hotspots};
 }
 function validate(geo){
  if(geo?.type!=='FeatureCollection'||geo.features?.length!==25)throw Error('서울 25개 구 경계가 필요합니다.');
  const rows=geo.features.map(f=>f.properties);
  if(new Set(rows.map(d=>d.code)).size!==25||new Set(rows.map(d=>d.name)).size!==25)throw Error('구 이름 또는 코드 중복');
  if(rows.some(d=>!/^11\d{3}$/.test(d.code)||!d.name.endsWith('구')))throw Error('구 코드 또는 이름 오류');
  return rows;
 }
 const count=v=>Number.isSafeInteger(v)&&v>=0;
 const fmt=v=>count(v)?v.toLocaleString('ko-KR'):'자료 없음';
 const pct=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v.toFixed(1)+'%':'자료 없음';
 function hotspotPremium(h,reference){
  const base=reference?.districts.find(d=>d.code===h.districtCode)?.firstFloor;
  return typeof base==='number'&&base>0?(h.firstFloor/base-1)*100:null;
 }
 function premiumLabel(value){return value===null?'비교 불가':`${value>=0?'+':''}${value.toFixed(1)}%`;}
 function hotspotGroups(hotspots,project){
  const groups=[];
  for(const h of hotspots.filter(h=>h.location).sort((a,b)=>a.id.localeCompare(b.id))){
   const p=project(h.location),group=groups.find(g=>Math.abs(g.x-p.x)<120&&Math.abs(g.y-p.y)<56);
   if(group){group.items.push(h);const n=group.items.length;group.x+=(p.x-group.x)/n;group.y+=(p.y-group.y)/n;}
   else groups.push({x:p.x,y:p.y,items:[h]});
  }
  return groups;
 }
 function validateStats(data,rows){
  if(data?.schemaVersion!==1||!/^\d{4}[1-4]$/.test(data.quarter)||data.districts?.length!==25)throw Error('구 통계 형식 오류');
  const expected=new Map(rows.map(d=>[d.code,d.name])),seen=new Set();
  for(const d of data.districts){
   if(seen.has(d.code)||expected.get(d.code)!==d.name||d.quarter!==data.quarter)throw Error('구 통계 코드·이름·분기 불일치');
   seen.add(d.code);
   if(!count(d.population?.resident)||!count(d.population?.workplace))throw Error('인구수 오류');
   const c=d.cafe,f=d.flow;
   if(c?.industryCode!=='CS100010'||![c.total,c.general,c.franchise].every(count)||c.total!==c.general+c.franchise)throw Error('카페 집계 오류');
   if(c.total===0?c.franchisePercent!==null:typeof c.franchisePercent!=='number'||!Number.isFinite(c.franchisePercent)||Math.abs(c.franchisePercent-c.franchise/c.total*100)>1e-8)throw Error('카페 비율 오류');
   if(!count(f?.total))throw Error('구성비 분모 오류');
   for(const [raw,shares,n,delta] of [[f.timeValues,f.timePercent,6,f.timeSumMinusTotal],[f.dayValues,f.dayPercent,7,f.daySumMinusTotal]]){
    if(!Array.isArray(raw)||raw.length!==n||!raw.every(v=>count(v)&&v<=f.total))throw Error('구성비 원값 오류');
    const sum=raw.reduce((a,b)=>a+b,0)-f.total;
    if(sum!==delta||Math.abs(sum)>Math.max(10,f.total*0.000001))throw Error('구성비 합계 오류');
    if(f.total===0){if(shares!==null)throw Error('0 분모의 구성비 오류');}
    else if(!Array.isArray(shares)||shares.length!==n||shares.some((v,i)=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>100||Math.abs(v-raw[i]/f.total*100)>1e-8))throw Error('구성비 계산 오류');
   }
  }
  for(const k of ['resident','workplace','flow','cafe']){
   if(!/^https:\/\/data\.seoul\.go\.kr\/dataList\/OA-\d+\/S\/1\/datasetView\.do$/.test(data.sources?.[k]?.url))throw Error('출처 주소 오류');
  }
  if(!/^\d{4}-\d{2}-\d{2}T/.test(data.retrievedAt))throw Error('조회일 오류');
  return data;
 }
 function source(data,key,label){return `<a href="${esc(data.sources[key].url)}" target="_blank" rel="noopener">${label} ↗</a>`;}
 function distributions(flow){
  if(!flow.timePercent||!flow.dayPercent)return '<p class="short-note">구성비 자료 없음 · 원자료의 총값이 0이어서 비율을 계산하지 않았어요.</p>';
  const times=['00–06시','06–11시','11–14시','14–17시','17–21시','21–24시'],days=['월','화','수','목','금','토','일'];
  return `<div class="distribution"><h3>시간대 구성비</h3><dl class="share-list">${times.map((label,i)=>`<div><dt>${label}</dt><dd><span class="share-track" aria-hidden="true"><i style="width:${flow.timePercent[i]}%"></i></span><span>${pct(flow.timePercent[i])}</span></dd></div>`).join('')}</dl><h3>요일 구성비</h3><dl class="day-shares">${days.map((label,i)=>`<div><dt>${label}<span class="sr-only">요일</span></dt><dd>${pct(flow.dayPercent[i])}</dd></div>`).join('')}</dl></div>`;
 }
 function people(d,data,hotspot,flowData,handoff){
  const districtFlow=flowModel.find(flowData,d.code),areaFlow=hotspot?flowModel.find(flowData,d.code,hotspot.id):districtFlow;
  const factor=hotspot&&handoff?.id===hotspot.id?space.locationScenario(handoff).traffic:100;
  const summary=areaFlow?`<div class="flow-summary"><h3>${esc(hotspot?.name||d.name)} · 하루 평균 유동인구</h3>${flowModel.cell(areaFlow,factor)}</div>${hotspot&&districtFlow?`<p class="flow-district-context">${esc(d.name)} 전체: ${flowModel.format(districtFlow.daily)} / 일</p>`:""}`:'<p class="short-note">유동인구 추정 자료 연결 대기</p>';
  return `<dl class="data-pairs population-pairs"><div><dt>상주인구수</dt><dd>${fmt(d.population.resident)}<small>명</small></dd></div><div><dt>직장인구수</dt><dd>${fmt(d.population.workplace)}<small>명</small></dd></div></dl>
  <p class="flow-basis">${esc(d.name)} 전체 · 주거·직장 배경지표</p>
  ${summary}${areaFlow?flowModel.distributions(areaFlow,factor):distributions(d.flow)}
  ${flowModel.source(flowData)}
  <details><summary>상주·직장인구 기준 · 출처</summary><p>${source(data,'resident','상주인구')} · ${source(data,'workplace','직장인구')} · ${source(data,'flow','시간대·요일')}</p><p>구 전체의 배경지표이며 상주인구와 직장인구는 합산하지 않습니다. 매년 4분기 갱신 후 다음 해 1~3분기에 이월됩니다. 시간 구간 길이는 서로 다르므로 시간당 혼잡도로 비교하지 않습니다. 실제 방문객이나 카페 이용률로 환산하지 않습니다.</p><p>조회 ${esc(data.retrievedAt.slice(0,10))} · 공공누리 제1유형</p></details>`;
 }
 function cafes(d,data){
  const c=d.cafe;
  return `<dl class="data-pairs cafe-pairs"><div><dt>카페 수 <small>커피·음료</small></dt><dd>${fmt(c.total)}<small>곳</small></dd></div><div><dt>프랜차이즈 비율</dt><dd>${pct(c.franchisePercent)}</dd></div></dl><p class="short-note">일반 ${fmt(c.general)}곳 + 프랜차이즈 ${fmt(c.franchise)}곳<br>선택 구 전체 기준 · 매출이나 경쟁 강도를 뜻하지 않아요.</p><details><summary>카페 정의 · 분모 · 출처</summary><p>${source(data,'cafe','서울시 점포-자치구')}</p><p>서비스 업종 ‘커피-음료’(CS100010) 기준입니다. 카페라는 상호나 인허가 업태로 세지 않았으며 음료 전문점도 포함됩니다.</p><p>전체 점포(SIMILR_INDUTY_STOR_CO) = 일반 점포(STOR_CO) + 프랜차이즈 점포(FRC_STOR_CO). 비율은 프랜차이즈 ${fmt(c.franchise)}곳 ÷ 전체 ${fmt(c.total)}곳 × 100입니다. 서울시 자료의 프랜차이즈 분류를 사용하며, 공정위 가맹사업 등록 기준과 같다고 단정하지 않습니다.</p><p>서울특별시·서울신용보증재단 · 조회 ${esc(data.retrievedAt.slice(0,10))} · 공공누리 제1유형 · 비율 가공</p></details>`;
 }
 function rentRange(d,reference,hotspotId=''){
  if(!reference?.districts.some(r=>r.code===d?.code&&r.name===d?.name))return null;
  const row=space.rentalArea(reference,d.code,hotspotId);
  if(!row)return null;
  // A size scenario, not observed market minima/maxima or a confidence interval.
  const costs=[33,66].map(area=>space.calculate({...space.DEFAULTS,area:String(area)},row,{ratios:{'1':100}}));
  return costs.every(c=>c.status==='ready')?{row,deposit:costs.map(c=>c.deposit),monthly:costs.map(c=>c.monthly)}:null;
 }
 function comparisonArea(settings={mode:'range',pyeong:'20'}){
  if(settings?.mode==='range')return {valid:true,mode:'range',label:'33~66㎡ (약 10~20평)'};
  const check=space.validate({...space.DEFAULTS,area:settings?.pyeong,unit:'pyeong'});
  if(settings?.mode!=='custom'||!['string','number'].includes(typeof settings?.pyeong)||!check.valid)return {valid:false,mode:'custom',error:'평수를 0.1~10,000 사이 숫자로 입력해 주세요.'};
  const pyeong=Number(settings.pyeong);
  return {valid:true,mode:'custom',pyeong,areaSqm:check.areaSqm,label:`${pyeong.toLocaleString('ko-KR',{maximumFractionDigits:10})}평 (${check.areaSqm.toLocaleString('ko-KR',{maximumFractionDigits:2})}㎡)`};
 }
 function comparisonFloor(key='1',reference){
  const labels={'-1':'지하 1층','1':'1층','2':'2층','3':'3층','4':'4층','5':'5층','6+':'6층 이상'};
  if(typeof key!=='string'||!Object.hasOwn(labels,key))return {valid:false,available:false,label:'층 선택 필요'};
  const ratio=reference?.floorReference?.ratios?.[key];
  return {valid:true,available:typeof ratio==='number'&&Number.isFinite(ratio)&&ratio>0&&ratio<=300,key,label:labels[key],ratio,floor:key==='-1'?'1':key==='6+'?'6':key,floorZone:key==='-1'?'below':'above'};
 }
 function comparisonRows(rows,reference,ids,settings){
  return [...new Set(Array.isArray(ids)?ids:[])].map(id=>{
   const config=settings?.individual?{...settings.entries?.[id],mode:'custom'}:settings?.entries?.[id]?.locationIndependent?{...settings,...locationFields(settings.entries[id])}:settings;
   const area=comparisonArea(config),floor=comparisonFloor(config?.floor,reference),location=space.locationScenario(config);
   const pricing=config?.pricingMode==='manual'?{pricingMode:'manual',deposit:config.deposit,monthly:config.monthly}:null;
   const pricingValid=!pricing||space.validate({...space.DEFAULTS,mode:'manual',deposit:pricing.deposit,monthly:pricing.monthly,premium:'0'}).valid;
   const h=reference?.hotspots?.find(h=>h.id===id),d=h&&rows.find(d=>d.code===h.districtCode);
   if(!d)return null;
   let range=null,estimate=null;
   if(area.valid&&floor.valid&&floor.available&&reference.districts.some(r=>r.code===d.code&&r.name===d.name)){
    const sizes=area.mode==='custom'?[area.pyeong]:[33,66];
    const costs=sizes.map(size=>space.calculate({...space.DEFAULTS,...locationFields(config),...(pricing?{mode:'manual',deposit:pricing.deposit,monthly:pricing.monthly,premium:'0'}:{}),area:String(size),unit:area.mode==='custom'?'pyeong':'sqm',floor:floor.floor,floorZone:floor.floorZone},h,reference.floorReference));
    if(costs.every(cost=>cost.status==='ready'))range={row:h,deposit:costs.map(c=>c.deposit),monthly:costs.map(c=>c.monthly)};
    if(pricing&&area.mode==='custom'){
     const baseline=space.calculate({...space.DEFAULTS,...locationFields(config),area:String(area.pyeong),unit:'pyeong',floor:floor.floor,floorZone:floor.floorZone},h,reference.floorReference);
     if(baseline.status==='ready')estimate={deposit:baseline.deposit,monthly:baseline.monthly};
    }
   }
   const handoffUrl=range&&area.mode==='custom'?space.comparisonUrl(d.code,id,area.pyeong,floor.key,reference,pricing,Object.keys(locationFields(config)).length?locationFields(config):undefined):'';
   return {hotspot:h,district:d,range,premium:hotspotPremium(h,reference),area,floor,handoffUrl,pricing,pricingValid,estimate,location,footfall:flowModel.find(reference?.footfall,d.code,h.id)};
  }).filter(Boolean);
 }
 function comparisonIssue(item){return !item.area.valid?item.area.error:!item.floor.valid?'지원하는 층을 선택해 주세요.':item.location&&!item.location.valid?'입지 가정 지수를 확인해 주세요.':!item.pricingValid?'직접 입력한 보증금·월세를 확인해 주세요.':!item.floor.available?'층별 참고 비율이 없습니다.':!item.range?'지역 가격자료가 없습니다.':'';}
 function comparisonSortInfo(key,budget){
  const choices={selected:['담은 순서',null,'selected'],monthly:['월세 저렴한 순','monthly','price'],deposit:['보증금 저렴한 순','deposit','price'],'monthly-room':['월세 예산 여유 큰 순','monthly','room'],'deposit-room':['보증금 예산 여유 큰 순','deposit','room'],'monthly-over':['월세 초과액 적은 순','monthly','over'],'deposit-over':['보증금 초과액 적은 순','deposit','over']};
  if(!Object.hasOwn(choices,key))key='selected';
  const [label,field,kind]=choices[key],needsBudget=['room','over'].includes(kind);
  const {limits,errors}=filterComparisons([],budget);
  const ready=!needsBudget||!errors[field]&&limits[field]!==null&&limits[field]!==undefined;
  return {key,label,field,kind,ready,aria:!ready||kind==='selected'?'none':needsBudget?'other':'ascending'};
 }
 function sortComparisons(items,key,budget){
  const sort=comparisonSortInfo(key,budget);
  if(sort.kind==='selected'||!sort.ready)return [...items];
  const value=item=>{
   if(sort.kind==='price'){const n=item.range?.[sort.field]?.[0];return Number.isFinite(n)&&n>=0?n:Infinity;}
   const gap=comparisonBudgetGap(item,sort.field,budget);
   return !Number.isFinite(gap.remaining)?Infinity:sort.kind==='room'?-gap.remaining:Math.max(0,-gap.remaining);
  };
  return items.map((item,index)=>({item,index})).sort((a,b)=>{
   const av=value(a.item),bv=value(b.item);return av===bv?a.index-b.index:av<bv?-1:1;
  }).map(entry=>entry.item);
 }
 function restoreComparisonBudget(saved){
  const result={enabled:saved?.enabled===true,deposit:'',monthly:''};
  for(const key of ['deposit','monthly'])if(typeof saved?.[key]==='string'&&saved[key].length<=40)result[key]=saved[key];
  return result;
 }
 function filterComparisons(items,budget){
  const limits={},errors={};
  for(const key of ['deposit','monthly']){
   const raw=budget?.[key]??'';
   if(typeof raw==='string'&&raw.trim()===''){limits[key]=null;continue;}
   const n=Number(raw);
   if(!['string','number'].includes(typeof raw)||!Number.isFinite(n)||n<0||n>10000000)errors[key]='0~10,000,000만원을 입력하거나 비워 주세요.';
   else limits[key]=Math.round(n*10000);
  }
  const valid=!Object.keys(errors).length,active=budget?.enabled===true;
  const matches=item=>['deposit','monthly'].every(key=>{
   if(limits[key]===null)return true;
   const amounts=item.range?.[key];
   return Array.isArray(amounts)&&amounts.length>0&&amounts.every(n=>Number.isFinite(n)&&n>=0&&n<=limits[key]);
  });
  return {valid,active,errors,limits,total:items.length,items:!active?items:!valid?[]:items.filter(matches)};
 }
 function comparisonBudgetGap(item,key,budget){
  const {limits,errors}=filterComparisons([],budget);
  if(errors[key])return {status:'invalid'};
  const limit=limits[key];
  if(limit===null||limit===undefined)return {status:'none'};
  const amounts=item.range?.[key];
  if(!Array.isArray(amounts)||!amounts.length||amounts.some(n=>!Number.isFinite(n)||n<0))return {status:'unavailable'};
  const cost=Math.max(...amounts),remaining=limit-cost;
  return {status:remaining<0?'over':remaining>0?'under':'equal',limit,cost,remaining,isRange:amounts.length>1};
 }
 function comparisonBudgetCell(item,key,budget){
  const gap=comparisonBudgetGap(item,key,budget);
  if(gap.status==='none')return '';
  if(['invalid','unavailable'].includes(gap.status))return `<small class="compare-budget-gap">${gap.status==='invalid'?'예산 확인 필요':'예산 비교 불가'}</small>`;
  const label=gap.status==='over'?'예산 초과':gap.status==='under'?'예산 여유':'예산과 같음';
  const money=(Math.abs(gap.remaining)/10000).toLocaleString('ko-KR',{maximumFractionDigits:4});
  return `<small class="compare-budget-gap is-${gap.status}"><strong>${label}</strong><span>${money}만원</span>${gap.isRange?'<span>상한 기준</span>':''}</small>`;
 }
 function comparisonPrice(item,key){return item.range?item.range[key].map(v=>item.pricing?(v/10000).toLocaleString('ko-KR',{maximumFractionDigits:1}):Math.round(v/10000).toLocaleString('ko-KR')).join('~'):!item.area.valid||!item.floor.valid||!item.pricingValid?'입력 확인':'자료 없음';}
 function comparisonDifference(item,key){
  const actual=item.range?.[key]?.[0],estimate=item.estimate?.[key];
  if(!item.pricing||!Number.isFinite(actual)||!Number.isFinite(estimate)||estimate<0)return null;
  const amount=actual-estimate;
  return {estimate,amount,percent:estimate>0?amount/estimate*100:null};
 }
 function comparisonPriceCell(item,key,budget){
  const price=esc(comparisonPrice(item,key))+comparisonBudgetCell(item,key,budget);
  if(!item.pricing)return price;
  const diff=comparisonDifference(item,key);
  if(!diff)return `${price}<small class="compare-difference">추정값 비교 불가</small>`;
  const money=v=>(v/10000).toLocaleString('ko-KR',{maximumFractionDigits:1});
  const sign=diff.amount>0?'+':diff.amount<0?'−':'';
  const percent=diff.percent===null?'비율 계산 불가 (추정 0)':diff.percent===0?'0%':`${sign}${Math.abs(diff.percent)<.1?'0.1% 미만':Math.abs(diff.percent).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'}`;
  const direction=diff.amount>0?'비쌈':diff.amount<0?'저렴':'차이 없음';
  return `${price}<small class="compare-estimate">같은 조건 추정<span>${money(diff.estimate)}만원</span></small><small class="compare-difference"><span>${sign}${money(Math.abs(diff.amount))}만원</span><span>(${percent})</span><strong>${direction}</strong></small>`;
 }
 function comparisonCondition(item){return item.area.valid&&item.floor.available?`${item.area.label} · ${item.floor.label} · ${item.pricing?'직접 입력 금액은 면적·층을 바꿔도 유지':`1층 대비 ${item.floor.ratio.toFixed(1)}%`}`:'';}
 function comparisonPricing(item){return `<span class="compare-pricing-label">${item.pricing?'직접 입력':'추정값'}</span><small>${esc(item.location?.label||'기준 입지')} · 임대료 지수 ${esc(item.location?.rent??'확인 필요')} · 유동 가정 ${esc(item.location?.traffic??'확인 필요')} (기준 100, 실측 아님)</small>${item.pricing?`<button type="button" class="compare-estimate-reset" data-estimate-reset="${esc(item.hotspot.id)}" aria-label="${esc(item.hotspot.name)} 금액을 추정값으로 전환">추정값으로 전환</button>`:''}`;}
 function comparisonAction(item){return item.handoffUrl?`<a class="compare-space-link" href="${esc(item.handoffUrl)}" aria-label="${esc(item.hotspot.name)} ${esc(item.area.label)} ${esc(item.floor.label)} 조건으로 공간 정하기">이 조건으로 공간 정하기 →</a><a class="compare-space-link" href="${esc(item.handoffUrl)}#location-compare" aria-label="${esc(item.hotspot.name)} 같은 평수와 층으로 대로변·골목 비교">대로변·골목 비교 →</a>`:`<small>${item.area.valid&&item.area.mode==='range'?'평수를 직접 입력하면 조건을 이어갈 수 있어요.':'조건을 확인하면 공간 정하기로 이어갈 수 있어요.'}</small>`;}
 function restoreComparisonIndividuals(saved){
  const entries={};
  if(saved?.entries&&typeof saved.entries==='object'&&!Array.isArray(saved.entries))for(const [id,value] of Object.entries(saved.entries)){
   if(/^11\d{6}$/.test(id)&&typeof value?.pyeong==='string'&&value.pyeong.length<=40&&comparisonFloor(value.floor).valid){
    entries[id]={pyeong:value.pyeong,floor:value.floor??'1',...locationFields(value)};
    if(value.locationIndependent===true)entries[id].locationIndependent=true;
    if(value.pricingMode==='manual')Object.assign(entries[id],{pricingMode:'manual',deposit:typeof value.deposit==='string'&&value.deposit.length<=40?value.deposit:'',monthly:typeof value.monthly==='string'&&value.monthly.length<=40?value.monthly:''});
   }
  }
  return {individual:saved?.individual===true,entries};
 }
 function setComparisonLocation(previous,shared,id,side,config){
  if(!/^11\d{6}$/.test(id)||!space.applyLocationComparison({},side,config))throw Error('입지 지수를 확인해 주세요.');
  const next=restoreComparisonIndividuals(previous);
  const area=comparisonArea(shared);
  const entry=next.entries[id]||{pyeong:area.valid&&area.mode==='custom'?String(shared.pyeong):'20',floor:comparisonFloor(shared?.floor).valid?shared.floor:'1'};
  next.entries[id]={...entry,locationType:side,rentFactor:config.rentFactor,trafficFactor:config.trafficFactor,locationIndependent:true};
  return next;
 }
 function comparisonLocationControl(item){
  const id=esc(item.hotspot.id);
  return `<label class="compare-location-toggle" for="alley-${id}"><input id="alley-${id}" type="checkbox" data-item-alley="${id}"${item.location?.locationType==='alley'?' checked':''} aria-label="${esc(item.hotspot.name)} 골목길 적용"> 골목길</label>`;
 }
 function mergeComparisonReturn(previous,transfer){
  const result=restoreComparisonIndividuals(previous);
  if(transfer?.status!=='ready')return result;
  const s=transfer.inputs;
  result.entries[transfer.hotspotId]={pyeong:String(s.area),floor:s.floorZone==='below'?'-1':Number(s.floor)>=6?'6+':String(s.floor)};
  if(previous?.entries?.[transfer.hotspotId]?.locationIndependent)result.entries[transfer.hotspotId].locationIndependent=true;
  if(space.LOCATION_KEYS.some(k=>s[k]!==undefined&&s[k]!==space.DEFAULTS[k]))Object.assign(result.entries[transfer.hotspotId],locationFields(s));
  if(s.mode==='manual')Object.assign(result.entries[transfer.hotspotId],{pricingMode:'manual',deposit:s.deposit,monthly:s.monthly});
  result.individual=true;return result;
 }
 function comparisonControls(item,settings){
  const id=esc(item.hotspot.id),name=esc(item.hotspot.name),entry=settings.entries?.[item.hotspot.id]||{};
  const floors=[['-1','지하 1층'],['1','1층'],['2','2층'],['3','3층'],['4','4층'],['5','5층'],['6+','6층 이상']];
  return `<div class="compare-row-controls"><label for="area-${id}">면적 <span><input id="area-${id}" data-item-area="${id}" type="number" inputmode="decimal" min="0.1" max="10000" step="any" value="${esc(entry.pyeong??'')}" aria-label="${name} 면적 (평)" aria-invalid="${!item.area.valid}" aria-describedby="condition-${id} issue-${id}"> 평</span></label><label for="floor-${id}">층 <select id="floor-${id}" data-item-floor="${id}" aria-label="${name} 층" aria-describedby="condition-${id} issue-${id}">${floors.map(([key,label])=>`<option value="${key}"${key===item.floor.key?' selected':''}>${label}</option>`).join('')}</select></label><small id="condition-${id}" data-item-summary>${esc(comparisonCondition(item))}</small><small id="issue-${id}" data-item-error>${esc(comparisonIssue(item))}</small></div>`;
 }
 function comparisonTable(rows,reference,ids,settings){
  const area=comparisonArea(settings);
  if(!settings?.individual&&!area.valid)return '<p class="compare-empty">올바른 평수를 입력하면 선택한 모든 번화가의 가격을 다시 계산해요.</p>';
  const floor=comparisonFloor(settings?.floor,reference);
  if(!settings?.individual&&!floor.valid)return '<p class="compare-empty">지원하는 층을 선택해 주세요. 지하 2층 이하는 참고자료가 없습니다.</p>';
  if(!settings?.individual&&reference&&!floor.available)return '<p class="compare-empty">선택한 층의 참고 비율이 없어 가격을 계산할 수 없어요.</p>';
  const selection=comparisonRows(rows,reference,ids,settings);
  const filtered=filterComparisons(selection,settings?.budget);
  if(filtered.active&&!filtered.valid)return '<p class="compare-empty">최대 예산을 확인해 주세요. 비교에 담은 번화가와 조건은 유지됩니다.</p>';
  if(selection.length&&filtered.active&&!filtered.items.length)return '<p class="compare-empty">예산 안에 들어오는 번화가가 없어요. 최대 예산을 높이거나 ‘예산 안에만 보기’를 꺼 주세요.</p>';
  const sort=comparisonSortInfo(settings?.sort,settings?.budget);
  const items=sortComparisons(filtered.items,settings?.sort,settings?.budget);
  if(!items.length)return '<p class="compare-empty">위에서 번화가를 체크하면 보증금과 월세가 여기에 나란히 표시돼요.</p>';
  const basis=settings?.individual?'번화가별 면적·층 · 비교 비용':`${esc(floor.label)} · ${esc(area.label)} · ${area.mode==='custom'?'예상 비용':'모의 범위'}`;
  return `<table class="compare-prices${settings?.individual?' is-individual':''}"><caption>${filtered.active?'표시한':'선택한'} 번화가 ${items.length}곳 · ${basis} · 금액: 만원 · 유동인구: 명/일 · ${sort.ready?sort.label:'예산 입력 대기 · 담은 순서'}</caption><thead><tr><th scope="col">번화가 / ${settings?.individual?'개별 조건':'구 대비'}</th><th scope="col" data-sort-column="deposit" aria-sort="${sort.field==='deposit'?sort.aria:'none'}">보증금<small>만원</small></th><th scope="col" data-sort-column="monthly" aria-sort="${sort.field==='monthly'?sort.aria:'none'}">현금 월세<small>만원/월</small></th><th scope="col">유동인구<small>명/일 · 추정</small></th></tr></thead><tbody>${items.map(item=>{const {hotspot:h,district:d,premium}=item;return `<tr data-compare-row="${esc(h.id)}"><th scope="row"><button type="button" data-compare-map="${esc(h.id)}" aria-label="${esc(h.name)} 지도에서 선택">${esc(h.name)}</button><small>${esc(d.name)} · ${esc(h.dongName)}</small><span class="compare-premium">참고 단가 · 구 평균 ${premiumLabel(premium)}</span><div data-item-pricing>${comparisonPricing(item)}</div>${comparisonLocationControl(item)}${settings?.individual?comparisonControls(item,settings):''}<div data-item-handoff>${comparisonAction(item)}</div></th><td data-price="deposit">${comparisonPriceCell(item,'deposit',settings?.budget)}</td><td data-price="monthly">${comparisonPriceCell(item,'monthly',settings?.budget)}</td><td data-flow>${flowModel.cell(item.footfall,item.location?.traffic)}</td></tr>`;}).join('')}</tbody></table><p class="compare-note">골목길 체크는 해당 번화가에만 적용되고, 해제하면 대로변 지수가 적용돼요. 공간에서 저장한 지수를 사용하며 없으면 대로변 100·100, 골목 80·60의 예시값을 사용합니다. 같은 조건 모드에서도 입지는 개별 적용됩니다. 유동인구는 주변 행정동의 하루 평균에 입지 지수를 적용한 추정입니다.</p>${items.some(item=>item.pricing)?'<p class="compare-note">금액 차이는 직접 입력 − 같은 번화가·평수·층의 추정값, 퍼센트는 차이 ÷ 추정값 × 100입니다. 추정 보증금은 추정 월세 12개월분입니다. 금액은 천 원 단위, 비율은 소수 첫째 자리로 반올림합니다.</p>':''}`;
 }
 function rent(d,reference,status,hotspotId){
  const result=rentRange(d,reference,hotspotId);
  if(!result){
   const message=!d?'구를 선택하면 가격 범위를 확인할 수 있어요':status==='loading'?'가격자료 불러오는 중':status==='error'?'가격자료 연결 실패':'선택한 구의 참고 단가가 없습니다';
   return `<p class="primary-state">${message}</p><p class="short-note">서울시 구별 임대료를 바탕으로 1층 · 33~66㎡ 조건의 모의 비용을 계산해요.</p>${status==='error'?'<button type="button" id="rent-retry">가격자료 다시 불러오기</button>':''}<details><summary>가격자료 안내</summary><p>공공 환산임대료에 면적과 보증금 가정을 적용합니다. 실제 매물·계약 가격의 범위가 아닙니다.</p></details>`;
  }
  const money=values=>values.map(v=>Math.round(v/10000).toLocaleString('ko-KR')).join('~');
  const quarter=`${reference.quarter.slice(0,4)}년 ${reference.quarter.slice(4)}분기`;
  const areas=space.hotspotsFor(reference,d.code),district=space.rentalArea(reference,d.code);
  const difference=rate=>typeof district.firstFloor==='number'&&district.firstFloor>0?(rate/district.firstFloor-1)*100:null;
  const delta=rate=>{const p=difference(rate);return p===null?'비교 불가':`${p>=0?'+':''}${p.toFixed(1)}%`;};
  const selector=areas.length?`<div class="rent-area-control"><label for="rent-area">구 평균 / 번화가 주변 비교</label><select id="rent-area" aria-describedby="rent-area-help"><option value=""${hotspotId?'':' selected'}>${esc(d.name)} 평균</option>${areas.map(h=>`<option value="${esc(h.id)}"${h.id===hotspotId?' selected':''}>${esc(h.name)} · 구 평균 ${delta(h.firstFloor)}</option>`).join('')}</select><p id="rent-area-help" class="short-note">번화가 주변 행정동 평균으로 비교해요.<br>핵심 거리의 실제 매물 시세와는 달라요.</p></div>`:'<p class="short-note">이 구는 등록된 번화가 주변 자료가 없어 구 평균을 표시해요.</p>';
  const comparison=hotspotId?`<div class="rent-comparison"><strong>${esc(result.row.name)} · 구 평균 대비 ${delta(result.row.firstFloor)}</strong><p>적용 자료: ${esc(result.row.dongName)} 전체 · 1층 평균<br>${esc(d.name)} ${fmt(district.firstFloor)}원 → ${fmt(result.row.firstFloor)}원 / 3.3㎡·월</p></div>`:'';
  return `${selector}${comparison}<p class="primary-state">공공자료 기반 모의 범위</p><p class="rent-basis">1층 · 33~66㎡ (약 10~20평)</p>
   <dl class="data-pairs rent-pairs"><div><dt>보증금 범위 <small>추정</small></dt><dd>${money(result.deposit)}<small>만원</small></dd></div><div><dt>현금 월세 범위 <small>추정</small></dt><dd>${money(result.monthly)}<small>만원/월</small></dd></div></dl>
   <p class="short-note">보증금은 월세 12개월분으로 가정했어요.<br>같은 구에서도 동네·입지·건물에 따라 달라져요.</p>
   <p class="rent-vintage">${esc(quarter)} 임대료 기준 · 실제 매물 가격 아님</p>
   <details><summary>가격 출처 · 추정 기준</summary><p><a href="${esc(reference.source.url)}" target="_blank" rel="noopener">서울시 지역별 임대료 ↗</a> · <a href="${esc(reference.source.definitionUrl)}" target="_blank" rel="noopener">자료 출처 ↗</a></p>
   <p>${esc(result.row.dongName||d.name)} 1층 참고 단가: <strong>${fmt(result.row.firstFloor)}원 / 3.3㎡ / 월</strong> (환산임대료). 서울신용보증재단 보증 고객 자료에 기반하며 카페 한정 표본은 아닙니다. 조회 ${esc(reference.retrievedAt.slice(0,10))} · 저장된 자료 기준.</p>
   ${hotspotId?'<p>번화가 이름은 탐색용 명칭이며 가격 범위는 표시한 행정동 평균을 대신 적용한 모의값입니다. 구 대비 차이는 같은 자료·분기·1층 단가끼리 비교한 값입니다. 번화가 경계나 중심 거리의 임대료 상승률을 뜻하지 않습니다. 아래 인구·카페 통계는 선택 구 전체 기준으로 유지됩니다.</p>':''}
   <p>월 환산금액 = 선택한 구·행정동 단가 × 면적 ÷ 3.3. 원자료의 환산 정의는 보증금 × 연 12% ÷ 12 + 현금 월세입니다. 보증금을 월세 12개월분으로 가정해 현금 월세 = 월 환산금액 ÷ 1.12, 보증금 = 현금 월세 × 12로 계산했습니다.</p>
   <p>하한은 33㎡, 상한은 66㎡ 조건입니다. 면적에 따른 모의 범위이며 실제 최저·최고가나 통계적 예측구간이 아닙니다. 계산은 ‘공간 정하기’와 동일하며 표시는 만원 단위 반올림입니다.</p>
   <p>보증금 12개월은 제품의 가정입니다. 표본 수·오차와 전용/계약 면적 기준, 원자료의 관리비·VAT 포함 여부는 확인되지 않았습니다. 권리금·관리비·VAT·중개비를 별도로 가산하지 않았으므로 실제 예산에서는 확인이 필요합니다. 면적·층·보증금 조건은 ‘공간 정하기’에서 변경할 수 있어요.</p></details>`;
 }
 function detail(d,data=null,status='idle',rentalReference=null,rentalStatus='idle',hotspotId='',handoff=null,flowData=null){
  const name=d?esc(d.name):'서울에서 시작해보세요';
  const stats=d&&data?.districts.find(row=>row.code===d.code);
  const hotspot=hotspotId&&d&&space.rentalArea(rentalReference,d.code,hotspotId);
  const handoffUrl=hotspot&&handoff?.id===hotspotId?space.comparisonUrl(d.code,hotspotId,handoff.area,handoff.floor,rentalReference,handoff,Object.keys(locationFields(handoff)).length?locationFields(handoff):undefined):'';
  const handoffLabel=handoffUrl?space.comparisonTransfer(new URLSearchParams(handoffUrl.split('?')[1]),d.code,rentalReference).label:'';
  const quarter=data?`${data.quarter.slice(0,4)}년 ${data.quarter.slice(4)}분기`:'';
  const empty=!d?'구를 선택하면 표시돼요':status==='loading'?'통계 불러오는 중':status==='error'?'통계 연결 실패':'구 자료 없음';
  const notice=status==='error'?'<p class="data-notice" role="status">구 통계를 불러오지 못했어요. 지도 선택은 계속 사용할 수 있어요. <button type="button" id="stats-retry">통계 다시 불러오기</button></p>':status==='loading'?'<p class="data-notice" role="status">구 통계를 불러오고 있어요.</p>':data?`<p class="data-vintage">${esc(quarter)} · 서울시 공식 자치구 자료<br><span>조회 ${esc(data.retrievedAt.slice(0,10))} · 저장된 자료 기준</span></p>`:'';
  return `<div class="inspector-heading"><p class="eyebrow">${d?'선택한 지역 · 서울특별시':'카페를 열 동네 찾기'}</p><h1 id="detail-title" tabindex="-1">${name}</h1><p class="selection-meta">${d?`<span class="selected-tag">선택됨</span> 자치구 코드 ${esc(d.code)}`:'지도에서 구를 누르거나 이름으로 검색하세요.'}</p></div>
  ${d?`<a class="space-next" href="${handoffUrl?esc(handoffUrl):`space.html?district=${encodeURIComponent(d.code)}&amp;hotspot=${hotspot?encodeURIComponent(hotspot.id):''}`}">${hotspot?esc(hotspot.name):name}에서 공간 정하기 <span aria-hidden="true">→</span></a>${handoffUrl?`<p class="compare-note">비교에서 고른 ${esc(handoffLabel)} 조건을 함께 전달해요.</p>`:''}`:''}
  ${hotspot?'<button type="button" id="compare-add">이 번화가 비교에 담기</button>':''}
  ${notice}
  <p class="estimate-notice">추정한 값으로, 실제 수치와 차이가 있을 수 있습니다.</p>
  <p class="panel-intro">${d?`${name}의 공간 비용과 동네 배경을 한곳에서 살펴보세요.`:'상가를 구하듯, 지역부터 천천히 살펴보세요.'}</p>
  <section class="info-section"><div class="section-title"><span>01</span><h2>보증금 · 월세</h2><small>참고 가격대</small></div>${rent(d,rentalReference,rentalStatus,hotspotId)}</section>
  <section class="info-section"><div class="section-title"><span>02</span><h2>이 지역의 사람들</h2></div>${stats?people(stats,data,hotspot,flowData,handoff):`<dl class="data-lines"><div><dt>인구수 <small>주거 · 직장 배경</small></dt><dd>${empty}</dd></div><div><dt>시간대 · 요일 구성비</dt><dd>${empty}</dd></div></dl><p class="short-note">상주·직장인구와 길단위인구의 구성비를 함께 확인해요.</p>`}</section>
  <section class="info-section"><div class="section-title"><span>03</span><h2>주변 카페현황</h2></div>${stats?cafes(stats,data):`<dl class="data-pairs"><div><dt>카페 수</dt><dd>${empty}</dd></div><div><dt>프랜차이즈 비율</dt><dd>${empty}</dd></div></dl><p class="short-note">선택 구 전체의 커피·음료 업종 기준이에요.</p>`}</section>
  <p class="panel-footer">지역을 골랐다면 공간 조건에서 면적·층과 모의 비용을 비교해 보세요.</p>`;
 }
 function comparisonSnapshot(state){
  if(!Array.isArray(state?.ids)||state.ids.length>17||state.ids.some(id=>typeof id!=='string'||!/^11\d{6}$/.test(id))||new Set(state.ids).size!==state.ids.length)return null;
  const shared=state.shared,individual=state.individual,budget=state.budget;
  if(!locationShape(shared))return null;
  if(!['range','custom'].includes(shared?.mode)||typeof shared.pyeong!=='string'||shared.pyeong.length>40||!comparisonFloor(shared.floor).valid||typeof individual?.individual!=='boolean'||!individual.entries||typeof individual.entries!=='object'||Array.isArray(individual.entries))return null;
  if(typeof budget?.enabled!=='boolean'||['deposit','monthly'].some(k=>typeof budget[k]!=='string'||budget[k].length>40)||comparisonSortInfo(state.sort).key!==state.sort)return null;
  const entries={},restored=restoreComparisonIndividuals(individual);
  for(const id of state.ids){
   if(individual.entries[id]){
    const original=individual.entries[id],entry=restored.entries[id];
    if(!entry||!locationShape(original)||original.locationIndependent!==undefined&&typeof original.locationIndependent!=='boolean'||original.pricingMode!==undefined&&original.pricingMode!=='manual'||original.pricingMode==='manual'&&['deposit','monthly'].some(k=>typeof original[k]!=='string'||original[k].length>40))return null;
    entries[id]=entry;
   }else if(individual.individual)return null;
  }
  return {ids:[...state.ids],shared:{mode:shared.mode,pyeong:shared.pyeong,floor:shared.floor,...locationFields(shared)},individual:{individual:individual.individual,entries},budget:{enabled:budget.enabled,deposit:budget.deposit,monthly:budget.monthly},sort:state.sort};
 }
 function comparisonPlanLibrary(raw){
  if(raw===null)return {schemaVersion:1,plans:[]};
  const data=JSON.parse(raw);
  if(data?.schemaVersion!==1||!Array.isArray(data.plans)||data.plans.length>50)throw Error('비교안 저장자료를 읽을 수 없어요. 기존 저장자료는 유지됩니다.');
  const ids=new Set(),names=new Set();
  const plans=data.plans.map(plan=>{
   const state=comparisonSnapshot(plan?.state);
   if(!state||!state.ids.length||typeof plan.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(plan.id)||ids.has(plan.id)||typeof plan.name!=='string'||!plan.name.trim()||plan.name.length>60||names.has(plan.name.trim())||typeof plan.createdAt!=='string'||!Number.isFinite(Date.parse(plan.createdAt)))throw Error('비교안 저장자료를 읽을 수 없어요. 기존 저장자료는 유지됩니다.');
   if(plan.sourcePlanId!==undefined&&(typeof plan.sourcePlanId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(plan.sourcePlanId)||plan.sourcePlanId===plan.id)||plan.updatedAt!==undefined&&(typeof plan.updatedAt!=='string'||!Number.isFinite(Date.parse(plan.updatedAt))))throw Error('비교안 복사 정보가 올바르지 않습니다.');
   ids.add(plan.id);names.add(plan.name.trim());return {id:plan.id,name:plan.name.trim(),createdAt:plan.createdAt,state,...(plan.sourcePlanId?{sourcePlanId:plan.sourcePlanId}:{}),...(plan.updatedAt?{updatedAt:plan.updatedAt}:{})};
  });
  if(data.deleted!==undefined&&!Array.isArray(data.deleted))throw Error('삭제 복구자료를 읽을 수 없어요. 기존 저장자료는 유지됩니다.');
  const deleted=(data.deleted||[]).map(entry=>{
   if(!Number.isInteger(entry?.index)||entry.index<0||entry.index>=50)throw Error('삭제 복구자료 형식이 올바르지 않습니다.');
   const plan=comparisonPlanLibrary(JSON.stringify({schemaVersion:1,plans:[entry.plan]})).plans[0];
   if(ids.has(plan.id))throw Error('삭제 복구자료에 중복된 비교안이 있습니다.');ids.add(plan.id);
   return {plan,index:entry.index};
  });
  return {schemaVersion:1,plans,...(data.deleted!==undefined?{deleted}:{})};
 }
 function addComparisonPlan(library,name,state,id,createdAt){
  name=String(name??'').trim();
  if(!name||name.length>60)throw Error('비교안 이름을 1~60자로 입력해 주세요.');
  if(library.plans.some(plan=>plan.name===name))throw Error('같은 이름의 비교안이 있어요. 다른 이름으로 저장해 주세요.');
  if(library.plans.length>=50)throw Error('비교안은 최대 50개까지 저장할 수 있어요.');
  const snapshot=comparisonSnapshot(state);
  if(!snapshot||!snapshot.ids.length)throw Error('비교할 번화가를 한 곳 이상 선택해 주세요.');
  return comparisonPlanLibrary(JSON.stringify({...library,schemaVersion:1,plans:[...library.plans,{id,name,createdAt,state:snapshot}]}));
 }
 function renameComparisonPlan(library,id,name){
  name=String(name??'').trim();
  if(!name||name.length>60)throw Error('변경할 이름을 1~60자로 입력해 주세요.');
  if(!library.plans.some(p=>p.id===id))throw Error('선택한 비교안을 찾을 수 없어요. 목록을 다시 확인해 주세요.');
  if(library.plans.some(p=>p.id!==id&&p.name===name))throw Error('같은 이름의 비교안이 있어요. 다른 이름을 입력해 주세요.');
  return comparisonPlanLibrary(JSON.stringify({...library,plans:library.plans.map(p=>p.id===id?{...p,name}:p)}));
 }
 function copyComparisonPlan(library,sourceId,name,id,createdAt){
  const source=library.plans.find(p=>p.id===sourceId);if(!source)throw Error('복사할 비교안을 찾을 수 없어요.');
  const next=addComparisonPlan(library,name,source.state,id,createdAt);
  return comparisonPlanLibrary(JSON.stringify({...next,plans:next.plans.map(p=>p.id===id?{...p,sourcePlanId:sourceId}:p)}));
 }
 function updateCopiedComparisonPlan(library,id,state,updatedAt){
  const target=library.plans.find(p=>p.id===id);if(!target?.sourcePlanId)throw Error('수정할 복사본을 먼저 불러와 주세요.');
  const snapshot=comparisonSnapshot(state);if(!snapshot||!snapshot.ids.length)throw Error('비교할 번화가를 한 곳 이상 선택해 주세요.');
  return comparisonPlanLibrary(JSON.stringify({...library,plans:library.plans.map(p=>p.id===id?{...p,state:snapshot,updatedAt}:p)}));
 }
 function deleteComparisonPlan(library,id){
  const index=library.plans.findIndex(p=>p.id===id);if(index<0)throw Error('선택한 비교안을 찾을 수 없어요. 목록을 다시 확인해 주세요.');
  return comparisonPlanLibrary(JSON.stringify({...library,plans:library.plans.filter(p=>p.id!==id),deleted:[...(library.deleted||[]),{plan:library.plans[index],index}]}));
 }
 function undoDeleteComparisonPlan(library,id=library.deleted?.at(-1)?.plan.id){
  const entry=library.deleted?.find(e=>e.plan.id===id);if(!entry)throw Error('되돌릴 삭제가 없어요.');
  if(library.plans.length>=50)throw Error('저장된 비교안이 50개여서 복구할 수 없어요. 다른 안을 삭제한 뒤 복구할 비교안을 다시 선택해 주세요.');
  let name=entry.plan.name,n=1;
  while(library.plans.some(p=>p.name===name)){const suffix=n===1?' (복원)':` (복원 ${n})`;name=entry.plan.name.slice(0,60-suffix.length)+suffix;n++;}
  const plans=[...library.plans];plans.splice(Math.min(entry.index,plans.length),0,{...entry.plan,name});
  return comparisonPlanLibrary(JSON.stringify({...library,plans,deleted:library.deleted.filter(e=>e.plan.id!==id)}));
 }
 function planAmountChange(a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0)return null;
  const amount=b-a;return {amount,percent:a===0?null:amount/a*100};
 }
 function comparisonPlanPair(rows,reference,a,b){
  const left=comparisonSnapshot(a),right=comparisonSnapshot(b);if(!left||!right)return null;
  const items=s=>new Map(comparisonRows(rows,reference,s.ids,{...s.shared,...s.individual}).map(item=>[item.hotspot.id,item]));
  const aa=items(left),bb=items(right);
  const upper=(item,key)=>{const values=item?.range?.[key];return values?.length&&values.every(n=>Number.isFinite(n)&&n>=0)?Math.max(...values):null;};
  return [...new Set([...left.ids,...right.ids])].map(id=>{
   const inA=left.ids.includes(id),inB=right.ids.includes(id),a=aa.get(id),b=bb.get(id);
   return {id,a,b,inA,inB,status:inA&&inB?'both':inB?'added':'removed',deposit:inA&&inB?planAmountChange(upper(a,'deposit'),upper(b,'deposit')):null,monthly:inA&&inB?planAmountChange(upper(a,'monthly'),upper(b,'monthly')):null};
  });
 }
 function planChangeLabel(change){
  if(!change)return '<span class="ab-muted">비교 불가</span>';
  const {amount,percent}=change,kind=amount>0?'increase':amount<0?'decrease':'same',direction=amount>0?'증가':amount<0?'감소':'변동 없음';
  const money=(Math.abs(amount)/10000).toLocaleString('ko-KR',{maximumFractionDigits:4});
  const rate=percent===null?'원본이 0이라 증감률 계산 불가':percent===0?'0%':`${Math.abs(percent)<.1?'0.1% 미만':Math.abs(percent).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%'} ${direction}`;
  return `<strong class="ab-${kind}">${money}만원 ${direction}</strong><small>${rate}</small>`;
 }
 function editComparisonCopy(state,change,rows,reference){
  const next=comparisonSnapshot(state);if(!next)throw Error('비교 조건을 읽을 수 없어요.');
  const {field,id,value}=change;
  if(typeof value!=='string'||value.length>40)throw Error('입력값을 확인해 주세요.');
  if(field==='budget-deposit'||field==='budget-monthly'){next.budget[field.slice(7)]=value;return next;}
  if(field==='shared-area'){next.shared.mode='custom';next.shared.pyeong=value;return next;}
  if(field==='shared-floor'){if(!comparisonFloor(value).valid)throw Error('층을 선택해 주세요.');next.shared.floor=value;return next;}
  if(field.startsWith('shared-')&&space.LOCATION_KEYS.includes(field.slice(7))){const key=field.slice(7);if(key==='locationType'){const preset=space.locationPreset(value);if(!preset)throw Error('입지를 선택해 주세요.');Object.assign(next.shared,preset);}else next.shared[key]=value;return next;}
  if(!next.ids.includes(id)||!['area','floor','deposit','monthly','auto',...space.LOCATION_KEYS].includes(field))throw Error('수정할 항목을 찾을 수 없어요.');
  if(!next.individual.individual){
   if(next.shared.mode!=='custom'||!comparisonArea(next.shared).valid)throw Error('공통 평수를 먼저 입력해 주세요.');
   // Preserve the currently displayed shared conditions for every other hotspot.
   next.individual={individual:true,entries:Object.fromEntries(next.ids.map(key=>[key,{pyeong:next.shared.pyeong,floor:next.shared.floor,...locationFields(next.individual.entries[key]?.locationIndependent?next.individual.entries[key]:next.shared),...(next.individual.entries[key]?.locationIndependent?{locationIndependent:true}:{})}]))};
  }
  const entry=next.individual.entries[id];if(!entry)throw Error('번화가 조건을 찾을 수 없어요.');
  if(field==='area')entry.pyeong=value;
  else if(field==='locationType'){const preset=space.locationPreset(value);if(!preset)throw Error('입지를 선택해 주세요.');Object.assign(entry,preset);}
  else if(field==='rentFactor'||field==='trafficFactor')entry[field]=value;
  else if(field==='floor'){if(!comparisonFloor(value).valid)throw Error('층을 선택해 주세요.');entry.floor=value;}
  else if(field==='auto'){delete entry.pricingMode;delete entry.deposit;delete entry.monthly;}
  else{
   if(entry.pricingMode!=='manual'){
    const item=comparisonRows(rows,reference,[id],{...next.shared,...next.individual})[0];
    entry.deposit=item?.range?String(item.range.deposit[0]/10000):'';entry.monthly=item?.range?String(item.range.monthly[0]/10000):'';entry.pricingMode='manual';
   }
   entry[field]=value;
  }
  return next;
 }
 function comparisonCopyIssue(state,rows,reference){
  const snapshot=comparisonSnapshot(state);if(!snapshot||!snapshot.ids.length)return '번화가를 한 곳 이상 선택해 주세요.';
  const budget=filterComparisons([],snapshot.budget);if(!budget.valid)return '예산은 0~10,000,000만원으로 입력하거나 비워 주세요.';
  const items=comparisonRows(rows,reference,snapshot.ids,{...snapshot.shared,...snapshot.individual});
  if(items.length!==snapshot.ids.length)return '일부 번화가 자료를 찾을 수 없어요.';
  for(const item of items){const issue=comparisonIssue(item);if(issue)return `${item.hotspot.name}: ${issue}`;}
  return '';
 }
 function comparisonPlanPairHtml(rows,reference,a,b,{changedOnly=false,editable=false}={}){
  if(editable)changedOnly=false;
  const pairs=comparisonPlanPair(rows,reference,a.state,b.state);if(!pairs)return '<p>비교 조건을 읽을 수 없어요.</p>';
  const input=(field,id,value,label,invalid=false)=>`<label class="ab-edit-label" for="copy-${field}-${id}">${esc(label)}<input id="copy-${field}-${id}" data-copy-field="${field}" data-copy-id="${esc(id)}" type="text" inputmode="decimal" maxlength="40" value="${esc(value)}" aria-invalid="${invalid}" aria-describedby="compare-ab-edit-status"></label>`;
  const floorInput=(field,id,value,label)=>`<label class="ab-edit-label" for="copy-${field}-${id}">${esc(label)}<select id="copy-${field}-${id}" data-copy-field="${field}" data-copy-id="${esc(id)}">${['-1','1','2','3','4','5','6+'].map(key=>`<option value="${key}"${value===key?' selected':''}>${comparisonFloor(key).label}</option>`).join('')}</select></label>`;
  const locationInput=(field,id,value)=>`<label class="ab-edit-label" for="copy-${field}-${id}">입지 가정<select id="copy-${field}-${id}" data-copy-field="${field}" data-copy-id="${esc(id)}">${Object.entries(space.LOCATION_PRESETS).map(([key,preset])=>`<option value="${key}"${value===key?' selected':''}>${esc(preset.label)}</option>`).join('')}</select></label>`;
  let visible=0,hidden=0;
  const table=(caption,body)=>`<table class="ab-table"><caption>${caption}</caption><thead><tr><th scope="col">항목</th><th scope="col">원본</th><th scope="col">복사본</th></tr></thead><tbody>${body}</tbody></table>`;
  const row=(label,av,bv,changed=av!==bv)=>{
   if(changedOnly&&!changed){hidden++;return '';}
   visible++;return `<tr${changed?' class="ab-changed"':''}><th scope="row">${label}</th><td>${av}</td><td>${bv}</td></tr>`;
  };
  const delta=(label,change)=>`<tr class="ab-delta"><th scope="row">${label}<small>원본 대비</small></th><td colspan="2">${planChangeLabel(change)}</td></tr>`;
  const budgets=[a,b].map(p=>filterComparisons([],p.state.budget));
  const budgetValue=(n,key)=>budgets[n].errors[key]?'입력 확인':budgets[n].limits[key]===null?'제한 없음':`${(budgets[n].limits[key]/10000).toLocaleString('ko-KR',{maximumFractionDigits:4})}만원`;
  let settings='';for(const [key,label] of [['deposit','보증금 예산'],['monthly','월세 예산']]){
   const changed=Boolean(budgets[0].errors[key]||budgets[1].errors[key])||budgets[0].limits[key]!==budgets[1].limits[key];
   const entry=row(label,budgetValue(0,key),editable?input('budget-'+key,'all',b.state.budget[key],label+' (만원)',Boolean(budgets[1].errors[key]))+'<small>빈칸은 제한 없음</small>':budgetValue(1,key),changed);settings+=entry;
   const change=planAmountChange(budgets[0].errors[key]?null:budgets[0].limits[key],budgets[1].errors[key]?null:budgets[1].limits[key]);
   if(entry)settings+=change?delta('예산 증감',change):'<tr class="ab-delta"><td colspan="3">제한 없음·입력 오류 예산은 증감을 계산하지 않아요.</td></tr>';
  }
  settings+=row('예산 필터',a.state.budget.enabled?'예산 안에만':'전체',b.state.budget.enabled?'예산 안에만':'전체');
  settings+=row('정렬',esc(comparisonSortInfo(a.state.sort).label),esc(comparisonSortInfo(b.state.sort).label));
  if(editable&&!b.state.individual.individual){
   settings+=row('공통 면적',a.state.individual.individual?'번화가별 조건':esc(comparisonArea(a.state.shared).label||'입력 확인'),input('shared-area','all',b.state.shared.mode==='custom'?b.state.shared.pyeong:'','복사본 공통 면적 (평)',!comparisonArea(b.state.shared).valid));
   settings+=row('공통 층수',a.state.individual.individual?'번화가별 조건':esc(comparisonFloor(a.state.shared.floor).label),floorInput('shared-floor','all',b.state.shared.floor,'복사본 공통 층수'));
   const loc=space.locationScenario(b.state.shared);
   settings+=row('공통 입지',a.state.individual.individual?'번화가별 조건':esc(space.locationScenario(a.state.shared).label),locationInput('shared-locationType','all',loc.locationType));
   const sourceLoc=space.locationScenario(a.state.shared);
   settings+=row('공통 임대료 지수',a.state.individual.individual?'번화가별 조건':esc(sourceLoc.rent??'입력 확인'),input('shared-rentFactor','all',loc.rentFactor,'임대료 지수 (1~300)',loc.rent===null));
   settings+=row('공통 유동 가정',a.state.individual.individual?'번화가별 조건':esc(sourceLoc.traffic??'입력 확인'),input('shared-trafficFactor','all',loc.trafficFactor,'유동 가정 지수 (0~300)',loc.traffic===null));
  }
  const cell=(item,present,key,budget)=>{
   if(!present)return '선택 안 함';if(!item)return '자료 없음';
   if(key==='area')return esc(item.area.valid?item.area.label:'면적 입력 확인');
   if(key==='floor')return esc(item.floor.label);
   const amounts=item.range?.[key],text=amounts?amounts.map(n=>(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:4})).join('~')+'만원':'계산 불가';
   return `${text}<small>${item.pricing?'직접 입력':'추정값'}</small>${comparisonBudgetCell(item,key,budget)}`;
  };
  const cards=pairs.map(pair=>{
   const name=pair.a?.hotspot.name||pair.b?.hotspot.name||pair.id,tag=pair.status==='added'?'복사본에서 추가':pair.status==='removed'?'복사본에서 제외':'공통 번화가';
   const differs=key=>{
    if(pair.status!=='both'||!pair.a||!pair.b)return true;
    const x=pair.a,y=pair.b;
    if(key==='area')return !x.area.valid||!y.area.valid||x.area.mode!==y.area.mode||x.area.pyeong!==y.area.pyeong;
    if(key==='floor')return !x.floor.valid||!y.floor.valid||x.floor.key!==y.floor.key;
    const av=x.range?.[key],bv=y.range?.[key];
    // Budget gaps and pricing labels do not turn equal cash amounts into price changes.
    return !av?.length||!bv?.length||Math.min(...av)!==Math.min(...bv)||Math.max(...av)!==Math.max(...bv);
   };
   let body='';for(const [key,label] of [['area','면적'],['floor','층수'],['deposit','보증금'],['monthly','월세 / 월']]){
    let copyCell=cell(pair.b,pair.inB,key,b.state.budget);
    if(editable&&pair.inB&&pair.b){
     const own=b.state.individual.individual?b.state.individual.entries[pair.id]:b.state.shared,concrete=b.state.individual.individual||b.state.shared.mode==='custom';
     if(key==='area'&&concrete)copyCell=input(key,pair.id,own.pyeong,name+' 면적 (평)',!pair.b.area.valid);
     else if(key==='floor'&&concrete)copyCell=floorInput(key,pair.id,own.floor,name+' 층수');
     else if(['deposit','monthly'].includes(key)){
      if(!b.state.individual.individual&&b.state.shared.mode==='range')copyCell+='<small>금액을 수정하려면 위에서 공통 평수를 먼저 입력하세요.</small>';
      else{const value=pair.b.pricing?pair.b.pricing[key]:pair.b.range?String(pair.b.range[key][0]/10000):'';copyCell=input(key,pair.id,value,name+' '+label+' (만원)',!pair.b.pricingValid)+`<small>${pair.b.pricing?'직접 입력':'추정값 · 수정하면 직접 입력'}</small>`+comparisonBudgetCell(pair.b,key,b.state.budget);}
     }
    }
    const entry=row(label,cell(pair.a,pair.inA,key,a.state.budget),copyCell,differs(key));body+=entry;
    if(entry&&['deposit','monthly'].includes(key)){
     if(pair.status!=='both')body+='<tr class="ab-delta"><td colspan="3">한쪽에서만 선택한 번화가는 증감을 계산하지 않아요.</td></tr>';
     else if(!changedOnly||pair[key]?.amount!==0)body+=delta(`${key==='monthly'?'월세':label} 증감`,pair[key]);
    }
   }
   if(pair.status==='both'&&pair.a&&pair.b&&Boolean(pair.a.pricing)!==Boolean(pair.b.pricing))body+=row('금액 기준',pair.a.pricing?'직접 입력':'추정값',pair.b.pricing?'직접 입력':'추정값',true);
   for(const [key,label] of [['locationType','입지'],['rentFactor','임대료 지수'],['trafficFactor','유동 가정 지수']]){
    const av=pair.a?.location,bv=pair.b?.location,fieldValue=(loc,present)=>!present?'선택 안 함':!loc?'자료 없음':key==='locationType'?esc(loc.label):loc.valid?`${Number(loc[key]).toLocaleString('ko-KR')} / 기준 100`:'입력 확인';
    let copyValue=fieldValue(bv,pair.inB);
    if(editable&&pair.inB&&bv&&(b.state.individual.individual||b.state.shared.mode==='custom'))copyValue=key==='locationType'?locationInput(key,pair.id,bv.locationType):input(key,pair.id,bv[key],label,key==='rentFactor'?bv.rent===null:bv.traffic===null);
    const different=pair.status!=='both'||!av?.valid||!bv?.valid||(key==='locationType'?av[key]!==bv[key]:Number(av[key])!==Number(bv[key]));
    body+=row(label,fieldValue(av,pair.inA),copyValue,different);
   }
   body+=row('하루 평균 유동인구 (명/일)',pair.inA?flowModel.cell(pair.a?.footfall,pair.a?.location?.traffic):'선택 안 함',pair.inB?flowModel.cell(pair.b?.footfall,pair.b?.location?.traffic):'선택 안 함',pair.status!=='both'||flowModel.estimate(pair.a?.footfall,pair.a?.location?.traffic)!==flowModel.estimate(pair.b?.footfall,pair.b?.location?.traffic));
   if(!body)return '';
   return `<article class="ab-card" data-ab-hotspot="${esc(pair.id)}"><h3>${esc(name)} <small>${tag}</small></h3>${table(`${esc(name)} 조건과 비용 · 금액 단위 만원`,body)}${editable&&pair.b?.pricing?`<button type="button" data-copy-auto="${esc(pair.id)}" aria-label="${esc(name)} 금액을 추정값으로 전환">추정값으로 전환</button>`:''}</article>`;
  }).join('');
  const feedback=changedOnly?`<p class="compare-note" role="status" data-ab-filter-status>${visible}개 항목 표시 · 같은 항목 ${hidden}개 숨김</p>${visible?'':'<p class="ab-empty">바뀐 항목이 없습니다. ‘바뀐 항목만 보기’를 해제하면 전체 조건을 볼 수 있어요.</p>'}`:'';
  return `<div class="ab-names"><div><strong>원본</strong><span>${esc(a.name)}</span></div><div><strong>복사본</strong><span>${esc(b.name)}</span></div></div>${feedback}<p class="compare-note">조건이 달라진 칸은 배경으로 표시합니다. 증감액과 증감률은 원본 대비 복사본의 변화입니다. 추정 범위는 상한끼리 비교합니다. ${changedOnly?'같은 값과 변동 없는 번화가는 숨깁니다. 자료 없음·입력 오류는 확인이 필요해 표시합니다.':'예산 필터와 무관하게 양쪽의 모든 번화가를 표시합니다.'} 추정값은 같은 현재 자료로 계산합니다.</p><p class="compare-note">입지 선택값은 통계가 아닌 예시입니다. 이면도로: 임대료 90·유동 80, 골목 안쪽: 임대료 80·유동 60 (기준 100). 각 지수를 직접 바꿀 수 있어요. 유동 지수는 하루 평균 추정 유동인구에 적용하며 매출로 환산하지 않습니다. 직접 입력 금액에는 임대료 지수를 다시 적용하지 않습니다.</p>${settings?table('비교안별 최대 예산과 표시 설정',settings):''}${cards||(!pairs.length&&!changedOnly?'<p>선택한 번화가가 없어요.</p>':'')}`;
 }
 function writeComparisonState(storage,state){
  const snapshot=comparisonSnapshot(state);if(!snapshot)throw Error('비교 조건 형식이 올바르지 않습니다.');
  const values={'sim.hotspotCompare.v1':JSON.stringify(snapshot.ids),'sim.hotspotCompareArea.v1':JSON.stringify(snapshot.shared),'sim.hotspotCompareIndividual.v1':JSON.stringify(snapshot.individual),'sim.hotspotCompareBudget.v1':JSON.stringify(snapshot.budget),'sim.hotspotCompareSort.v1':snapshot.sort};
  const before=Object.fromEntries(Object.keys(values).map(key=>[key,storage.getItem(key)]));
  try{for(const [key,value] of Object.entries(values))storage.setItem(key,value);}
  catch(error){for(const [key,value] of Object.entries(before)){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch(_){}}throw error;}
 }
 const api={search,searchPlaces,detail,validate,validateStats,rentRange,hotspotPremium,premiumLabel,hotspotGroups,comparisonArea,comparisonFloor,comparisonRows,comparisonSortInfo,sortComparisons,restoreComparisonBudget,filterComparisons,comparisonBudgetGap,comparisonTable,comparisonIssue,comparisonPrice,comparisonDifference,comparisonPriceCell,comparisonCondition,comparisonAction,comparisonLocationControl,setComparisonLocation,restoreComparisonIndividuals,mergeComparisonReturn,comparisonSnapshot,comparisonPlanLibrary,addComparisonPlan,renameComparisonPlan,copyComparisonPlan,updateCopiedComparisonPlan,deleteComparisonPlan,undoDeleteComparisonPlan,planAmountChange,comparisonPlanPair,editComparisonCopy,comparisonCopyIssue,comparisonPlanPairHtml,writeComparisonState};if(typeof module!=='undefined')module.exports=api;else root.DistrictModel=api;
})(typeof window!=='undefined'?window:globalThis);
