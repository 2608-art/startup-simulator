(function(root){
 'use strict';
 const node=typeof module!=='undefined',K=node?require('./kitchen-model.js'):root.KitchenModel,I=node?require('./interior-model.js'):root.InteriorModel,O=node?require('./operations-model.js'):root.OperationsModel,F=node?require('./funding-model.js'):root.FundingModel,R=node?require('./results-model.js'):root.ResultsModel,S=node?require('./supplies-finance.js'):root.SuppliesFinance;
 function upstream(code,read){
  const records=['space','kitchen','interior','operations'].map(p=>read('sim.'+p+'.v1.'+code));
  const source=O.sources(...records.slice(0,3),code,K,I),operation=O.restore(records[3],code,Object.keys(K.CATALOG));
  if(!operation)throw {step:'operations',message:'운영·메뉴를 한 번 저장해 주세요.'};
  // Revalidate the real physical chain first. Only the derived signature changes, not user records.
  records[3]={...records[3],inputs:operation,sourceSignature:source.signature};return records;
 }
 function context(code,read){
  const records=[...upstream(code,read),read('sim.funding.v1.'+code)];
  const c=F.sources(...records.slice(0,4),code,K,I,O),saved=records[4],inputs=F.restore(saved,code);
  if(!inputs)throw {step:'funding',message:'자기자금·대출 조건을 자금 화면에서 한 번 저장해 주세요.'};
  if(inputs.startupTotal===undefined&&c.operation.financial?.initialTotal)inputs.startupTotal=c.operation.financial.initialTotal;
  const prep=read('sim.preparation.v1.'+code);
  const flow=prep?.finance?.flow||inputs.supplies?.flow;
  inputs.supplies=S.automatic(prep,read('sim.results.v1.'+code),read('sim.live.v1.'+code),c.operation,code,flow?{flow}:null,c.seats);
  const effective={...saved,inputs,sourceSignature:c.signature};
  const result=R.sources(...records.slice(0,4),effective,code,K,I,O,F);
  result.signature=JSON.stringify([...records,S.preparationSignature(prep)]);
  result.refreshed=saved.sourceSignature!==c.signature;
  return result;
 }
 const api={context,upstream};if(node)module.exports=api;else root.PlanLink=api;
})(typeof window!=='undefined'?window:globalThis);
