(function(root){
 'use strict';
 const MODES=['unknown','extra','final'],MAX=1e7,S=typeof module!=='undefined'?require('./supplies-finance.js'):root.SuppliesFinance;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const numeric=(v,max=MAX)=>((typeof v==='number'||typeof v==='string')&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max);
 const won=v=>Math.round(Number(v)*10000);
 const fresh=()=>({own:'0',loan:'0',rate:'4.5',months:'36',method:'annuity',missingBudget:'',extra:'0',working:'0',premiumVat:'unknown',equipmentVat:'unknown',interiorVat:'extra'});
 const OPENING_ITEMS={ingredients:['원두·우유·시럽 등 첫 원재료 재고','50'],signage:['간판·외부 안내물','100'],pos:['POS·결제기 설치','50'],installation:['전기·급배수·장비 배송·설치','100'],insurance:['개업 보험·신고·교육 등','30']};
 const openingDefaults=()=>Object.fromEntries(Object.entries(OPENING_ITEMS).map(([key,[label,amount]])=>[key,{mode:'review',amount,kind:'estimate'}]));
 function openingReview(s){const rows={...openingDefaults(),...clone(s.openingItems||{})};let additional=0,included=0,ingredients=0;const pending=[];
  for(const [key,v] of Object.entries(rows)){const value=won(v.amount);if(v.mode==='additional')additional+=value;if(v.mode==='included')included+=value;if(v.mode==='review')pending.push(OPENING_ITEMS[key][0]);if(key==='ingredients'&&['additional','included'].includes(v.mode))ingredients=value;}
  return {rows,additional,included,ingredients,pending};
 }
 function validate(s,c){const errors={};if(!s||typeof s!=='object')return {valid:false,errors:{own:'입력값을 확인해 주세요.'}};
  for(const k of ['own','loan','extra','working'])if(!numeric(s[k]))errors[k]='0~1,000만 만원 사이 금액을 입력하세요.';
  if(s.startupTotal!==undefined&&s.startupTotal!==''&&!numeric(s.startupTotal))errors.startupTotal='초기 지출 총액을 0 이상 입력하세요.';
  if(c&&numeric(s.startupTotal)&&won(s.startupTotal)<c.deposit)errors.startupTotal='보증금 이상인 총 개업 지출을 입력하세요.';
  if(s.missingBudget!==''&&!numeric(s.missingBudget))errors.missingBudget='미입력 장비의 합계 예산을 0 이상 입력하세요.';
  if(s.openingItems!==undefined){for(const [key,item] of Object.entries(s.openingItems||{}))if(!OPENING_ITEMS[key]||!item||!['review','included','additional','none'].includes(item.mode)||!numeric(item.amount))errors.openingItems='개업 항목의 포함 여부와 0 이상 금액을 확인하세요.';
   if(!errors.openingItems&&openingReview(s).included>won(s.extra))errors.openingItems='기타 개업비에 포함한 항목의 합계가 기존 기타 개업비를 넘습니다. 추가 지출로 바꾸거나 기타 개업비를 직접 조정하세요.';
   if(!errors.openingItems&&c&&numeric(s.startupTotal)&&openingReview(s).ingredients>won(s.startupTotal)-c.deposit)errors.openingItems='첫 원재료 재고가 직접 입력한 총 개업 지출의 보증금 외 금액보다 큽니다.';
  }
  for(const k of ['premiumVat','equipmentVat','interiorVat'])if(!MODES.includes(s[k]))errors[k]='부가세 처리 방식을 선택하세요.';
  if(!['annuity','principal'].includes(s.method))errors.method='상환 방식을 선택하세요.';
  if(numeric(s.loan)&&Number(s.loan)>0){if(!numeric(s.rate,100))errors.rate='연 금리를 0~100%로 입력하세요.';if(!numeric(s.months,600)||Number(s.months)<1||!Number.isInteger(Number(s.months)))errors.months='상환기간을 1~600개월의 정수로 입력하세요.';}
  return {valid:!Object.keys(errors).length,errors};
 }
 // Monthly nominal rate; no grace period or fees. Final row settles remaining principal.
 function amortize(principal,annualRate,months,method){
  if(!Number.isFinite(principal)||principal<0||principal>1e11||!['annuity','principal'].includes(method))throw Error('대출 조건 오류');
  if(principal===0)return {rows:[],first:0,last:0,interest:0,total:0};
  if(!Number.isFinite(annualRate)||annualRate<0||annualRate>100||!Number.isInteger(months)||months<1||months>600)throw Error('대출 조건 오류');
  const rate=annualRate/1200,fixed=rate===0?principal/months:principal*rate/-Math.expm1(-months*Math.log1p(rate));
  let balance=principal,totalInterest=0;const rows=[];
  for(let i=1;i<=months;i++){const interest=balance*rate;const capital=i===months?balance:Math.min(balance,method==='principal'?principal/months:fixed-interest);balance=Math.max(0,balance-capital);totalInterest+=interest;rows.push({month:i,principal:capital,interest,payment:capital+interest,balance});}
  return {rows,first:rows[0].payment,last:rows.at(-1).payment,interest:totalInterest,total:principal+totalInterest};
 }
 function sources(space,kitchen,interior,operations,code,K,I,O){
  const c=O.sources(space,kitchen,interior,code,K,I);
  if(!space.costs||!['deposit','monthly','premium'].every(k=>typeof space.costs[k]==='number'&&numeric(space.costs[k],1e13)))throw {step:'space',message:'공간 조건의 보증금·월세·권리금을 다시 저장해 주세요.'};
  if(!O.restore(operations,code,Object.keys(K.CATALOG))||operations.sourceSignature!==c.signature)throw {step:'operations',message:'현재 좌석·장비에 맞는 운영·메뉴를 저장해 주세요.'};
  const equipment=K.costs(kitchen.layout),decor=I.costs(interior.layout);
  const missingItems=kitchen.layout.items.filter(item=>!K.finite(kitchen.layout.prices[item.type],0,1e10));
  return {...c,districtCode:code,operation:O.restore(operations,code,Object.keys(K.CATALOG)),deposit:space.costs.deposit,premium:space.costs.premium,monthly:space.costs.monthly,equipment:equipment.known,estimatedEquipment:equipment.estimated,estimatedEquipmentAmount:equipment.rows.filter(r=>r.kind==='estimate').reduce((sum,r)=>sum+r.price,0),equipmentVatIncluded:equipment.rows.filter(r=>r.kind==='estimate'&&r.vat==='included').reduce((sum,r)=>sum+r.price,0),ancillary:equipment.ancillary,missing:equipment.missing,missingNames:[...new Set(missingItems.map(i=>K.CATALOG[i.type].name))],construction:decor.construction,furniture:decor.furniture,reserve:decor.reserve,pricingMode:space.pricingMode,signature:JSON.stringify([space,kitchen,interior,operations])};
 }
 function calculate(s,c){if(!validate(s,c).valid)return null;
  const missingCovered=c.missing===0||s.missingBudget!=='';
  const legacyOverride=!c.missing&&c.estimatedEquipment>0&&s.missingBudget!=='';
  const equipment=legacyOverride?c.equipment-c.estimatedEquipmentAmount+won(s.missingBudget):c.equipment+(c.missing&&s.missingBudget!==''?won(s.missingBudget):0);
  const bases={premium:c.premium,equipment:Math.max(0,equipment-(legacyOverride?0:c.equipmentVatIncluded||0)),interior:c.construction+c.furniture};
  const tax=Object.fromEntries(Object.entries(bases).map(([key,base])=>[key,s[key+'Vat']==='extra'?Math.round(base*.1):0]));
  const unknownTax=Object.keys(bases).filter(key=>bases[key]>0&&s[key+'Vat']==='unknown');
  const vat=Object.values(tax).reduce((a,b)=>a+b,0),base=c.deposit+c.premium+equipment+c.construction+c.furniture+c.reserve;
  const opening=openingReview(s),supplies=S.inspect(s.supplies,c.operation,c.districtCode),total=base+vat+won(s.extra)+won(s.working)+supplies.initial+opening.additional,own=won(s.own),loan=won(s.loan),funds=own+loan;
  const override=s.startupTotal!==undefined&&s.startupTotal!==''?won(s.startupTotal):null;
  const effectiveTotal=override===null?total:override+won(s.working)+c.reserve;
  return {base,total:effectiveTotal,itemizedTotal:total,startupOverride:override,opening,openingIngredients:opening.ingredients,vat,tax,equipment,supplies,own,loan,funds,gap:Math.max(0,effectiveTotal-funds),surplus:Math.max(0,funds-effectiveTotal),missingCovered,unknownTax,complete:(override!==null||missingCovered&&!unknownTax.length)&&supplies.complete,repayment:amortize(loan,Number(s.rate),Number(s.months),s.method)};
 }
 function restore(saved,code){return saved?.schemaVersion===1&&saved.districtCode===code&&validate(saved.inputs).valid?clone(saved.inputs):null;}
 // Compare priced inputs, not timestamps, staff plans or furniture positions.
 function costBasis(signature){try{const [space,kitchen,interior]=JSON.parse(signature),k=kitchen.layout,i=interior.layout;
  const quote=layout=>layout.items.map(item=>[item.type,layout.prices[item.type]??null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {premium:JSON.stringify(space.costs.premium),equipment:JSON.stringify(quote(k)),interior:JSON.stringify([i.areaSqm-i.kitchenArea,i.rate,quote(i)])};
 }catch(_){return null;}}
 function rebase(state,previousSignature,nextSignature){const next=clone(state);if(previousSignature===nextSignature)return next;const before=costBasis(previousSignature),after=costBasis(nextSignature);
  if(!before||!after||before.equipment!==after.equipment){next.costReview=true;}
  if(!before||!after||before.premium!==after.premium)next.costReview=true;
  if(!before||!after||before.interior!==after.interior)next.costReview=true;
  return next;
 }
 const api={MODES,clone,numeric,won,fresh,validate,amortize,sources,calculate,restore,costBasis,rebase,OPENING_ITEMS,openingDefaults,openingReview};if(typeof module!=='undefined')module.exports=api;else root.FundingModel=api;
})(typeof window!=='undefined'?window:globalThis);
