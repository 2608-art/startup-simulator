(function(root){
 'use strict';const M=typeof module!=='undefined'?require('./live-model.js'):root.LiveModel,clone=v=>JSON.parse(JSON.stringify(v));
 const opSignature=op=>JSON.stringify({days:op.days,menus:op.menus.filter(m=>m.enabled).map(m=>({id:m.id,recipe:m.recipe,iced:m.iced}))});
 const preparationSignature=p=>p?JSON.stringify([p.inputs,p.menuSignatures,p.finance||null]):null;
 function validBasis(a,op){const numeric=(v,min,max)=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;return a&&numeric(a.dailyGuests,0,10000)&&numeric(a.unitsPerGuest,.01,100)&&numeric(a.dineIn,0,100)&&Array.isArray(a.menus)&&a.menus.length===op.menus.filter(m=>m.enabled).length&&new Set(a.menus.map(m=>m.id)).size===a.menus.length&&a.menus.every(m=>op.menus.some(v=>v.enabled&&v.id===m.id)&&numeric(m.weight,0,10000))&&a.menus.some(m=>Number(m.weight)>0);}
 // Current demand is derived; manual procurement prices, stock and pack choices survive.
 function automatic(prep,results,live,op,code,row){
  const prior=results?.districtCode===code?results.inputs:null,menus=op.menus.filter(m=>m.enabled),basis={dailyGuests:prior?.guestSource==='scenario'?prior.dailyGuests:op.dailyGuests,unitsPerGuest:prior?.unitsPerGuest||'1',dineIn:prior?.dineIn||'70',menus:menus.map(m=>({id:m.id,weight:prior?.menus?.find(v=>v.id===m.id)?.weight||'1'}))};
  if(!validBasis(basis,op))return {schemaVersion:1,status:'missing',message:'현재 손님 수·구매량·메뉴 비중을 확인하세요.'};
  const plan=M.restorePlan(prep,code,op),day=op.days[Number(live?.settings?.day)]?.enabled?String(live.settings.day):String(op.days.findIndex(d=>d.enabled));
  return {schemaVersion:1,status:'linked',automatic:true,districtCode:code,plan,basis,day,flow:row?.flow||prep?.finance?.flow||null,operationSignature:opSignature(op),preparationSignature:preparationSignature(prep)};
 }
 function capture(prep,results,live,op,code,row){
  const missing=message=>({schemaVersion:1,status:'missing',message,preparationSignature:preparationSignature(prep)});
  if(!prep||prep.schemaVersion!==1||prep.districtCode!==code)return missing('소모품 준비 계획을 먼저 저장해 주세요.');
  if(!M.validatePlan(prep.inputs,op).valid||op.menus.filter(m=>m.enabled).some(m=>prep.menuSignatures?.[m.id]!==JSON.stringify([m.recipe,m.iced])))return missing('현재 메뉴에 맞는 소모품 포장 유형·단가를 다시 저장해 주세요.');
  const basis=prep.finance?.assumptions||(results?.districtCode===code?results.inputs:null),day=prep.finance?.day??live?.settings?.day??String(op.days.findIndex(d=>d.enabled));
  if(!validBasis(basis,op)||!Number.isInteger(Number(day))||!op.days[Number(day)]?.enabled)return missing('소모품 준비의 손님·요일 가정을 다시 저장해 주세요.');
  const flow=prep.finance?prep.finance.flow:row?.flow||null;
  return {schemaVersion:1,status:'linked',districtCode:code,plan:clone(prep.inputs),basis:{dailyGuests:basis.dailyGuests,unitsPerGuest:basis.unitsPerGuest,dineIn:basis.dineIn,menus:basis.menus.map(m=>({id:m.id,weight:m.weight}))},day:String(day),flow:flow?clone(flow):null,operationSignature:opSignature(op),preparationSignature:preparationSignature(prep)};
 }
 function valid(s,op){return s?.schemaVersion===1&&s.status==='linked'&&M.validatePlan(s.plan,op).valid&&validBasis(s.basis,op)&&s.operationSignature===opSignature(op)&&Number.isInteger(Number(s.day))&&op.days[Number(s.day)]?.enabled;}
 function inspect(s,op,code){if(s===undefined)return {legacy:true,initial:0,complete:true,plan:null,issues:[]};
  if(!valid(s,op)||(code&&s.districtCode!==code))return {initial:0,complete:false,plan:null,issues:[s?.message||'소모품 준비 계획을 다시 연결해 주세요.']};
  try{const p=M.planResources(op,s.basis,{day:s.day,service:'3'},s.flow?{flow:s.flow}:null,s.plan);return {initial:p.knownCost,complete:p.complete,plan:p,issues:[...(p.missingPrices.length?['구매 단가 미정: '+p.missingPrices.map(k=>M.SUPPLIES[k]).join(', ')]:[]),...(p.unknown.length?['포장 유형 미정: '+p.unknown.join(', ')]:[])]};}catch(e){return {initial:0,complete:false,plan:null,issues:[e.message]};}
 }
 function current(s,prep,op){return s?.preparationSignature===preparationSignature(prep)&&(s?.status==='missing'||s?.operationSignature===opSignature(op));}
 function monthly(s,a,c,horizon=120,factors=null){const initial=inspect(s,c.operation,c.districtCode),empty={linked:false,complete:s===undefined,issues:s===undefined?[]:initial.issues,unitByMenu:{},quantities:{},usage:0,months:Array.from({length:horizon},()=>({cost:0,quantities:{},remaining:{}}))};if(!initial.plan)return empty;
  const totalWeight=a.menus.reduce((v,m)=>v+Number(m.weight),0),units=Number(a.dailyGuests)*Number(a.unitsPerGuest)*c.hours.openDays*52/12,napkins=Math.min(1,Number(a.unitsPerGuest))/Number(a.unitsPerGuest),takeout=1-Number(a.dineIn)/100,quantities=Object.fromEntries(Object.keys(M.SUPPLIES).map(k=>[k,0])),unitByMenu={},issues=new Set();
  for(const menu of a.menus){const share=Number(menu.weight)/totalWeight,type=s.plan.packaging[menu.id],rates={napkin:napkins};if(type==='hot'||type==='cold'){rates[type]=takeout;rates[type+'Lid']=takeout;if(type==='cold')rates.straw=takeout;}else if(type==='food')rates.food=takeout;else if(type==='unknown'&&share>0&&takeout>0)issues.add('포장 유형 미정 메뉴가 있습니다.');let unit=0;
   for(const [key,rate] of Object.entries(rates)){const use=rate*Number(s.plan.items[key].usage),price=s.plan.items[key].unitPrice;quantities[key]+=units*share*use;if(share>0&&use>0&&price==='')issues.add(M.SUPPLIES[key]+' 단가가 미정입니다.');if(price!=='')unit+=use*Number(price);}unitByMenu[menu.id]=unit;
  }
  const stock=Object.fromEntries(Object.entries(initial.plan.items).map(([k,v])=>[k,v.afterPurchase])),months=[];let usage=0;for(const key of Object.keys(quantities))usage+=quantities[key]*Number(s.plan.items[key].unitPrice||0);
  for(let month=0;month<horizon;month++){let cost=0;const bought={},factor=factors?.[month]??1;for(const [key,baseQty] of Object.entries(quantities)){const qty=baseQty*factor,item=s.plan.items[key],shortfall=Math.max(0,qty-stock[key]);bought[key]=Math.max(0,Math.ceil(shortfall/Number(item.pack)-1e-9))*Number(item.pack);stock[key]=Math.max(0,stock[key]+bought[key]-qty);cost+=bought[key]*Number(item.unitPrice||0);}months.push({cost,usage:usage*factor,quantities:bought,remaining:clone(stock)});}
  return {linked:true,complete:issues.size===0,issues:[...issues],unitByMenu,quantities,usage:usage*(factors?.[0]??1),months};
 }
 const api={opSignature,preparationSignature,validBasis,automatic,capture,valid,inspect,current,monthly};if(typeof module!=='undefined')module.exports=api;else root.SuppliesFinance=api;
})(typeof window!=='undefined'?window:globalThis);
