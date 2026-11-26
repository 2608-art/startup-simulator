(function(root){
 'use strict';
 const data=typeof module!=='undefined'?require('./cost-reference.js'):root.CostReference;
 const clone=x=>JSON.parse(JSON.stringify(x)),hasPrice=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
 const equipment=Object.fromEntries(data.equipment.map(x=>[x.key,x]));
 const consumables=Object.fromEntries(data.consumables.map(x=>[x.key,x]));
 const reusable=Object.fromEntries(data.reusable.map(x=>[x.key,x]));
 const small=Object.fromEntries(data.small.map(x=>[x.key,x]));
 function quote(layout,item){
  const manual=layout.prices?.[item.type];if(hasPrice(manual))return {price:Number(manual),kind:'manual',label:'직접 입력',source:null};
  let ref=equipment[item.type],price=ref?.price,note='조사 상품을 참고한 동급 예산 추정 · 도면 기종의 견적 아님';
  if(item.type==='bench'){ref=equipment[item.w<=.65?'bench600':'bench1500'];price=Math.round(ref.price*Math.max(1,item.w/(item.w<=.65?.6:1.5)));note='폭별 조사 상품 기준 추정 · 깊이·맞춤 제작 차액 별도';}
  if(item.type==='filter'){price=equipment.filter.price+equipment.filterHead.price;note='필터+헤드 추정 · 배관·호스·호환 확인 별도';}
  if(item.type==='tools'){ref=equipment.knockbox;price=ref.price;note='넉박스 가격 · 피처·탬퍼 등은 아래 소도구 수량으로 한 번만 합산';}
  if(item.type==='rack'){ref=equipment.wallShelf;price=150000;note='바닥형 선반 임시 예산 15만원(제품 가정) · 조사한 벽 선반과 다른 품목, 실견적 필요';}
  if(item.type==='drip'){price=equipment.drip.price+30000;note='드리퍼·서버·필터 조사액 + 주전자 임시 예산 3만원(제품 가정)';}
  return {price:price??0,kind:'estimate',label:'추정값',source:ref?.source,vat:ref?.vat||'unverified',note,checkedAt:data.checkedAt};
 }
 function ancillary(layout,stockRows){
  const manualBundle=layout.items.some(x=>x.type==='tools')&&hasPrice(layout.prices?.tools);
  const rows=stockRows.map(r=>{const p=layout.supplyPrices?.[r.key],ref=reusable[r.key];return {key:r.key,name:r.name,quantity:r.buy,unitPrice:hasPrice(p)?Number(p):ref.unitPrice,kind:hasPrice(p)?'manual':'estimate',source:ref.source};});
  // A legacy user-entered tools bundle already includes small tools. Never add them twice.
  if(!manualBundle)for(const [key,quantity] of Object.entries(layout.small||{})){const p=layout.smallPrices?.[key],ref=small[key];rows.push({key,name:ref.name,quantity,unitPrice:hasPrice(p)?Number(p):ref.unitPrice,kind:hasPrice(p)?'manual':'estimate',source:ref.source});}
  return {rows,total:rows.reduce((sum,r)=>sum+r.quantity*r.unitPrice,0),manualBundle};
 }
 function fillSupplies(plan){const next=clone(plan);for(const [key,ref] of Object.entries(consumables)){const item=next.items[key];if(item.unitPrice===null||item.unitPrice===undefined||String(item.unitPrice).trim()===''){item.unitPrice=String(ref.unitPrice);item.priceKind='estimate';item.priceReference=data.checkedAt; // Old default 100 was a placeholder, preserve other pack choices.
    if(item.pack===undefined||item.pack===''||item.pack==='100'&&!item.packKind)item.pack=String(ref.pack);
   }else if(!item.priceKind)item.priceKind='manual';}
  return next;
 }
 const api={data,hasPrice,equipment,consumables,reusable,small,quote,ancillary,fillSupplies};if(typeof module!=='undefined')module.exports=api;else root.PriceModel=api;
})(typeof window!=='undefined'?window:globalThis);
