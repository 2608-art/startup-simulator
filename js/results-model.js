(function(root){
 'use strict';
 const WEEKS=52/12,HORIZON=120,S=typeof module!=='undefined'?require('./supplies-finance.js'):root.SuppliesFinance;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const number=(v,min,max,int=false)=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max&&(!int||Number.isInteger(Number(v)));
 const won=v=>Math.round(Number(v)*10000);
 function sources(space,kitchen,interior,operations,funding,code,K,I,O,F){
  const c=F.sources(space,kitchen,interior,operations,code,K,I,O),inputs=F.restore(funding,code);
  if(!inputs||funding.sourceSignature!==c.signature)throw {step:'funding',message:'현재 비용에 맞는 자금 계획을 저장해 주세요.'};
  const budget=F.calculate(inputs,c);if(!budget)throw {step:'funding',message:'현재 보증금과 자금 입력 범위를 확인해 주세요.'};const operation=clone(c.operation),hours=O.totals(operation);
  const missingEquipment=operation.menus.filter(m=>m.enabled).filter(m=>O.equipmentCheck(m,operation,O.sources(space,kitchen,interior,code,K,I).equipment).length).map(m=>m.name);
  return {...c,budget,funding:inputs,operation,hours,payroll:operation.employment?O.payroll(operation):null,menus:operation.menus.filter(m=>m.enabled).map(m=>({id:m.id,name:m.name,price:Number(m.price)})),missingEquipment,signature:JSON.stringify([space,kitchen,interior,operations,funding])};
 }
 function baseDefaults(c){return {dailyGuests:c.operation.dailyGuests,unitsPerGuest:'1',dineIn:c.seats===0?'0':'70',staffMonthly:c.payroll?.valid?String(c.payroll.perPerson/10000):'250',...(c.payroll?.valid?{staffSource:'operations'}:{}),otherFixed:'100',fees:'3',rentVat:'final',taxMonthly:'0',ownerDraw:'200',reserveUse:'0',closureMonth:'12',depositRecovery:'100',premiumRecovery:'0',equipmentRecovery:'30',furnitureRecovery:'20',closureCost:'500',menus:c.menus.map(m=>({id:m.id,weight:'1',cost:String(Math.round(m.price*.3))}))};}
 const FINANCE_FIELDS=['revenueMode','averageTicket','costPercent','fees','otherFixed','taxMonthly','interestExtra'];
 function financialDefaults(c){const f=c.operation.financial;if(!f)return {};return {revenueMode:'average',averageTicket:f.ticket,costPercent:f.costPercent,fees:f.fees,otherFixed:f.otherMonthly,taxMonthly:f.taxMonthly,interestExtra:f.interestMonthly};}
 function fresh(c){const s={...baseDefaults(c),revenueMode:'menus',averageTicket:'5000',costPercent:'30',interestExtra:'0',...financialDefaults(c)};if(c.operation.financial)s.financeLinked=Object.fromEntries(FINANCE_FIELDS.map(k=>[k,true]));return s;}
 function validate(s,c){const errors={};if(!s||typeof s!=='object')return {valid:false,errors:{dailyGuests:'가정을 입력해 주세요.'}};
  for(const [key,min,max,int] of [['dailyGuests',0,10000,true],['unitsPerGuest',.01,100,false],['dineIn',0,100,false],['otherFixed',0,1e7,false],['fees',0,100,false],['taxMonthly',0,1e7,false],['ownerDraw',0,1e7,false],['reserveUse',0,100,false],['closureMonth',0,HORIZON,true],['depositRecovery',0,100,false],['premiumRecovery',0,100,false],['equipmentRecovery',0,100,false],['furnitureRecovery',0,100,false],['closureCost',0,1e7,false]])if(!number(s[key],min,max,int))errors[key]=`${min.toLocaleString()}~${max.toLocaleString()} 사이 ${int?'정수':'숫자'}를 입력하세요.`;
  if(c.seats===0&&Number(s.dineIn)>0)errors.dineIn='좌석이 없는 가게는 포장 전용입니다.';
  if(Number(c.operation.staffCount)>0&&!number(s.staffMonthly,0,1e7))errors.staffMonthly='직원 1인당 월 총고용비를 0 이상 입력하세요.';
  if(s.revenueMode!==undefined&&!['menus','average'].includes(s.revenueMode))errors.revenueMode='매출 계산 방식을 선택하세요.';
  for(const [key,max] of [['averageTicket',1000000],['costPercent',100],['interestExtra',1e7]])if(s[key]!==undefined&&!number(s[key],0,max))errors[key]='0 이상 범위 내 숫자를 입력하세요.';
  if(!['final','extra'].includes(s.rentVat))errors.rentVat='월세 부가세 가정을 선택하세요.';
  if(s.suppliesMode!==undefined&&!['included','separate'].includes(s.suppliesMode))errors.suppliesMode='메뉴 원가의 소모품 포함 여부를 선택하세요.';
  if(s.capacityMode!==undefined&&!['observe','limit'].includes(s.capacityMode))errors.capacityMode='처리량 반영 방식을 선택하세요.';
  if(s.rampMode!==undefined&&!['steady','gradual'].includes(s.rampMode))errors.rampMode='초기 매출 방식을 선택하세요.';
  for(const [key,min,max,int] of [['serviceMinutes',.25,30,false],['capacityWorkers',1,Math.max(1,Number(c.operation.staffCount)+1),true],['capacityUtilization',10,100,false],['rampStart',0,100,false],['rampMonths',2,24,true]])if(s[key]!==undefined&&!number(s[key],min,max,int))errors[key]=`${min}~${max} 범위로 입력하세요.`;
  if(!Array.isArray(s.menus)||s.menus.length!==c.menus.length||new Set(s.menus.map(m=>m?.id)).size!==c.menus.length||s.menus.some(m=>!m||!c.menus.some(v=>v.id===m.id)))errors.menus='앞 단계 메뉴를 다시 불러오세요.';
  else{let weight=0;for(const m of s.menus){if(!number(m.weight,0,10000))errors['weight-'+m.id]='판매 비중을 0 이상 입력하세요.';else weight+=Number(m.weight);if(!number(m.cost,0,10000000))errors['cost-'+m.id]='개당 원가를 0 이상 입력하세요.';}if(!weight)errors.menus='판매 비중을 하나 이상 0보다 크게 입력하세요.';}
  return {valid:!Object.keys(errors).length,errors};
 }
 function required(cost,margin,days){if(cost<=0)return {monthly:0,daily:0};if(margin<=0)return null;const monthly=Math.ceil(cost/margin);return {monthly,daily:Math.ceil(monthly/days)};}
 function scenarioDefaults(c){return {capacityMode:'observe',serviceMinutes:'3',capacityWorkers:String(Math.max(1,Number(c.operation.staffCount)+1)),capacityUtilization:c.funding.supplies?.plan?.utilization||'80',rampMode:'steady',rampStart:'60',rampMonths:'6'};}
 function demandPlan(s,c){
  const L=typeof module!=='undefined'?require('./live-model.js'):root.LiveModel,v={...scenarioDefaults(c),...s},target=Number(s.dailyGuests),buyRate=Math.min(1,Number(s.unitsPerGuest)),service=Number(v.serviceMinutes),utilization=Number(v.capacityUtilization)/100,workers=Number(v.capacityWorkers);
  let cap=Infinity,peak=0,known=Array.isArray(c.operation.days)&&c.operation.days.some(d=>d.enabled);
  if(known&&buyRate>0){const p=L.profile(c.operation,{...s,dailyGuests:'1000'},c.funding.supplies?.flow?{flow:c.funding.supplies.flow}:null);known=!p.unallocated;
   if(known){peak=Math.max(0,...p.windows.map((_,day)=>L.staffPeak(p,day,service,utilization,buyRate)?.perHour||0));
    const hourly=workers*60/service*utilization,weeklyHours=c.hours.ownerHours+c.hours.staffHours;
    cap=Math.max(0,Math.min(peak>0?1000*hourly/peak:0,weeklyHours*60/service*utilization/(c.hours.openDays*buyRate)));
   }
  }
  const limit=v.capacityMode==='limit'&&known,months=Array.from({length:HORIZON},(_,i)=>{const ramp=v.rampMode==='gradual'?Number(v.rampStart)/100+(1-Number(v.rampStart)/100)*Math.min(1,i/(Number(v.rampMonths)-1)):1,requested=target*ramp,served=limit?Math.min(requested,cap):requested;return {month:i+1,ramp,requested,served,factor:target>0?served/target:0};});
  return {known,limit,cap:known?cap:null,peak:peak*target/1000,workers,service,utilization,target,months,limited:known&&target>cap+1e-7,flow:!!c.funding.supplies?.flow};
 }
 function calculate(s,c){if(!validate(s,c).valid)return null;
  if(c.funding.supplies?.automatic){const funding=clone(c.funding);funding.supplies.basis={dailyGuests:s.dailyGuests,unitsPerGuest:s.unitsPerGuest,dineIn:s.dineIn,menus:s.menus.map(m=>({id:m.id,weight:m.weight}))};const F=typeof module!=='undefined'?require('./funding-model.js'):root.FundingModel;c={...c,funding,budget:F.calculate(funding,c)};}
  const demand=demandPlan(s,c),factors=demand.months.map(m=>m.factor),supplies=S.monthly(c.funding.supplies,s,c,HORIZON,factors),suppliesMode=s.suppliesMode||'included',costIssues=[];
  const weight=s.menus.reduce((a,m)=>a+Number(m.weight),0),menuRows=c.menus.map(original=>{const m={...original,price:s.revenueMode==='average'?Number(s.averageTicket)/Math.max(1,Number(s.unitsPerGuest)):original.price};const row=s.menus.find(v=>v.id===m.id),share=Number(row.weight)/weight,supplyCost=supplies.unitByMenu[m.id]||0,inputCost=s.revenueMode==='average'?m.price*Number(s.costPercent)/100:Number(row.cost);if(suppliesMode==='included'&&share>0&&inputCost<supplyCost-1e-7)costIssues.push(m.name+'의 포함 원가가 계산된 소모품 원가보다 작습니다. 원가 또는 포함 방식을 확인하세요.');const cost=inputCost+(suppliesMode==='separate'?supplyCost:0);return {...m,share,cost,supplyCost,ingredientCost:Math.max(0,cost-supplyCost),margin:m.price-cost-m.price*Number(s.fees)/100};});
  const price=menuRows.reduce((a,m)=>a+m.price*m.share,0),unitCost=menuRows.reduce((a,m)=>a+m.cost*m.share,0),margin=menuRows.reduce((a,m)=>a+m.margin*m.share,0);
  const days=c.hours.openDays*WEEKS,targetUnits=Number(s.dailyGuests)*Number(s.unitsPerGuest)*days,units=targetUnits*factors[0],revenue=units*price,materials=units*unitCost,ingredientUnit=menuRows.reduce((sum,m)=>sum+m.ingredientCost*m.share,0),ingredientMaterials=units*ingredientUnit,fees=revenue*Number(s.fees)/100;
  const staff=Number(c.operation.staffCount)>0?Number(c.operation.staffCount)*won(s.staffMonthly):0,rent=c.monthly*(s.rentVat==='extra'?1.1:1),other=won(s.otherFixed),tax=won(s.taxMonthly),interestExtra=won(s.interestExtra||'0'),draw=won(s.ownerDraw),fixed=staff+rent+other;
  const complete=c.budget.complete&&supplies.complete&&!costIssues.length,recurringComplete=supplies.complete&&!costIssues.length,firstSuppliesPurchase=supplies.months[0].cost;
  const openingIngredients=c.budget.openingIngredients||0,firstIngredientPurchase=Math.max(0,ingredientMaterials-openingIngredients);
  const firstPayment=c.budget.repayment.first+interestExtra,operatingCash=revenue-firstIngredientPurchase-firstSuppliesPurchase-fees-fixed,available=operatingCash-tax-firstPayment,net=available-draw;
  const baseNeed=required(fixed+tax+firstPayment,margin,days),ownerNeed=required(fixed+tax+firstPayment+draw,margin,days);
  const ownerMonthlyHours=c.hours.ownerHours*WEEKS,staffMonthlyHours=c.hours.staffHours*WEEKS;
  // Working capital and unused interior contingency remain cash, not opening expenses.
  const initialSpent=c.budget.total-won(c.funding.working)-c.reserve*(1-Number(s.reserveUse)/100),openingCash=c.budget.funds-initialSpent;
  let cash=openingCash,minCash=cash,ruin=null;const rows=[{month:0,cash,payment:0,principal:0,interest:0,balance:c.budget.loan,change:0}];
  let ingredientStock=openingIngredients;
  for(let month=1;month<=HORIZON;month++){const loanRow=c.budget.repayment.rows[month-1]||{payment:0,principal:0,interest:0,balance:0},payment={...loanRow,payment:loanRow.payment+interestExtra,interest:loanRow.interest+interestExtra},suppliesPurchase=supplies.months[month-1].cost,d=demand.months[month-1],monthUnits=targetUnits*d.factor,monthRevenue=monthUnits*price,monthMaterials=monthUnits*unitCost,monthFees=monthRevenue*Number(s.fees)/100,ingredientUsage=monthUnits*ingredientUnit,ingredientPurchase=Math.max(0,ingredientUsage-ingredientStock);ingredientStock=Math.max(0,ingredientStock-ingredientUsage);const change=monthRevenue-ingredientPurchase-suppliesPurchase-monthFees-fixed-tax-payment.payment-draw,previous=cash;cash+=change;if(cash<-1e-7&&ruin===null)ruin=previous>=0?month-1+previous/-change:0;minCash=Math.min(minCash,cash);rows.push({month,cash,change,revenue:monthRevenue,materials:monthMaterials,fees:monthFees,guests:d.served,requested:d.requested,ramp:d.ramp,ingredientPurchase,ingredientStock,suppliesPurchase,payment:payment.payment,principal:payment.principal,interest:payment.interest,balance:payment.balance});}
  const averageNet=rows.slice(1,13).reduce((sum,row)=>sum+row.change,0)/12,averageRevenue=rows.slice(1,13).reduce((sum,row)=>sum+row.revenue,0)/12;
  const runway=!complete?{kind:'unknown'}:openingCash<0?{kind:'opening-shortfall',shortfall:-openingCash}:ruin===null?{kind:'beyond',months:HORIZON}:{kind:'depleted',months:ruin};
  const month=Number(s.closureMonth),closing=rows[month],minimum=Math.min(...rows.slice(0,month+1).map(r=>r.cash)),injection=Math.max(0,-minimum);
  const recovery={deposit:c.deposit*Number(s.depositRecovery)/100,premium:c.premium*Number(s.premiumRecovery)/100,equipment:c.budget.equipment*Number(s.equipmentRecovery)/100,furniture:c.furniture*Number(s.furnitureRecovery)/100};
  const recovered=Object.values(recovery).reduce((a,b)=>a+b,0),closingCash=closing.cash+injection,closureCost=won(s.closureCost),settlement=closingCash+recovered-closureCost-closing.balance,withdrawn=draw*month;
  const loss=c.budget.own+injection-withdrawn-settlement;
  const closure=complete?{month,recovery,recovered,cash:closingCash,rawCash:closing.cash,injection,cost:closureCost,debt:closing.balance,settlement,withdrawn,loss}:null;
  return {budget:c.budget,demand,averageNet,averageRevenue,firstIngredientPurchase,complete,recurringComplete,costIssues,supplies,suppliesMode,ingredientMaterials,firstSuppliesPurchase,days,units,menuRows,price,unitCost,margin,revenue,materials,fees,staff,rent,other,tax,draw,fixed,firstPayment,operatingCash,available,net,baseNeed,ownerNeed,ownerMonthlyHours,staffMonthlyHours,hourly:ownerMonthlyHours>0?available/ownerMonthlyHours:null,seatVisits:baseNeed&&c.seats>0?baseNeed.daily/Number(s.unitsPerGuest)*Number(s.dineIn)/100/c.seats:null,initialSpent,openingCash,runway,rows,closure};
 }
 function alignMenus(state,c,signature){
  const next=clone(state);if(!Array.isArray(next.menus))return next;
  let oldMenus=[];try{oldMenus=JSON.parse(signature)[3].inputs.menus;}catch(_){}
  const archive={...(next.archivedMenuCosts||{})};for(const row of next.menus){const name=oldMenus.find(m=>m.id===row.id)?.name;if(name)archive[name]={weight:row.weight,cost:row.cost};}
  next.menus=c.menus.map(menu=>{const old=oldMenus.find(m=>m.name===menu.name),row=next.menus.find(m=>m.id===(old?.id??menu.id));return {id:menu.id,...(archive[menu.name]||row&&{weight:row.weight,cost:row.cost}||{weight:'1',cost:String(Math.round(menu.price*.3))})};});
  if(Object.keys(archive).length)next.archivedMenuCosts=archive;return next;
 }
 function restore(saved,code,c){if(saved?.schemaVersion!==1||saved.districtCode!==code||!saved.inputs||typeof saved.inputs!=='object')return null;const inputs=clone(saved.inputs);if(c.seats===0)inputs.dineIn='0';if(validate(inputs,c).valid)return inputs;const next=alignMenus(inputs,c,saved.sourceSignature),errors=Object.keys(validate(next,c).errors);return errors.every(key=>['capacityWorkers','capacityMode','serviceMinutes','capacityUtilization','rampMode','rampStart','rampMonths'].includes(key))?next:null;}
 function businessOutcome(r,c,s){
  if(!r||!r.recurringComplete)return null;
  const firstInterest=r.rows[1]?.interest||0,operatingSurplus=r.revenue-r.materials-r.fees-r.fixed-r.tax-firstInterest;
  const needed=required(r.fixed+r.tax+firstInterest,r.margin,r.days),neededGuests=needed?Math.ceil(needed.daily/Number(s.unitsPerGuest)):null;
  const d=c.operation.demand,linked=s.guestSource==='operations'&&d?.mode==='flow';
  const conversion=linked?Number(d.trafficFactor)/100*Number(d.entryPercent)/100*Number(d.purchasePercent)/100:null;
  const neededPassers=linked&&conversion>0&&neededGuests!==null?Math.ceil(neededGuests/conversion):null;
  const investment=r.complete?Math.max(0,r.initialSpent-c.deposit):null;
  let accumulated=0,recovery=null,firstPositive=null;
  for(const row of r.rows.slice(1)){
   const surplus=row.revenue-row.materials-row.fees-r.fixed-r.tax-row.interest;
   if(firstPositive===null&&surplus>0)firstPositive=row.month;
   const net=row.change+r.draw+row.principal,previous=accumulated;accumulated+=net;
   if(investment!==null&&recovery===null&&accumulated>=investment&&net>0)recovery=Math.max(0,row.month-1+(investment-previous)/net);
  }
  if(investment===0)recovery=0;
  const needsExtraCash=recovery!==null&&r.rows.slice(0,Math.ceil(recovery)+1).some(row=>row.cash<0);
  return {operatingSurplus,neededGuests,neededPassers,linked,investment,recovery,firstPositive,operatingDaysToRecovery:recovery===null?null:Math.ceil(recovery*r.days),needsExtraCash};
 }
 // Older records had no source flag: infer only from their own saved upstream plan.
 function reconcile(state,previousSignature,c){const next=clone(state);if(c.seats===0)next.dineIn="0";if(!['operations','scenario'].includes(next.guestSource)){let previous;try{previous=JSON.parse(previousSignature)[3].inputs.dailyGuests;}catch(_){}
   next.guestSource=previous!==undefined&&Number(next.dailyGuests)===Number(previous)?'operations':'scenario';
  }
  const financial=financialDefaults(c);for(const key of FINANCE_FIELDS)if((next.financeLinked?.[key]||next[key]===undefined)&&financial[key]!==undefined){next[key]=financial[key];next.financeLinked??={};next.financeLinked[key]=true;}
  if(next.guestSource==='operations')next.dailyGuests=c.operation.dailyGuests;
  if(next.staffSource==='operations'&&c.payroll?.valid)next.staffMonthly=String(c.payroll.perPerson/10000);
  return next;
 }
 const api={WEEKS,HORIZON,clone,number,won,sources,fresh,validate,required,calculate,businessOutcome,restore,reconcile,alignMenus,financialDefaults,FINANCE_FIELDS,scenarioDefaults,demandPlan};if(typeof module!=='undefined')module.exports=api;else root.ResultsModel=api;
})(typeof window!=='undefined'?window:globalThis);
