(function(root){
 'use strict';
 const Pricing=typeof module!=='undefined'?require('./price-model.js'):root.PriceModel;
 const BOUNDS=[0,360,660,840,1020,1260,1440],DAYS=['월','화','수','목','금','토','일'],STEP=.25;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const time=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const bucket=t=>BOUNDS.findIndex((v,i)=>i<6&&t>=v&&t<BOUNDS[i+1]);
 const random=n=>{let x=(n+0x9e3779b9)>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;};
 function distribution(row){const day=row?.flow?.dayPercent,times=row?.flow?.timePercent,valid=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0)&&v.reduce((a,b)=>a+b,0)>0;return {day:valid(day,7)?day:[1,1,1,1,1,1,1],times:valid(times,6)?times:BOUNDS.slice(1).map((v,i)=>v-BOUNDS[i]),officialDay:valid(day,7),officialTime:valid(times,6)};}
 function windowFor(d,day){const start=time(d.open),end=time(d.close)+(d.overnight?1440:0),pause=Number(d.breakMinutes),pauseStart=start+Math.floor((end-start-pause)/2);return {day,start,end,pause,pauseStart,pauseEnd:pauseStart+pause};}
 const onBreak=(w,t)=>w.pause>0&&t>=w.pauseStart&&t<w.pauseEnd;
 function profile(operations,assumptions,row){
  const dist=distribution(row),windows=operations.days.map((d,i)=>d.enabled?windowFor(d,i):null),weights=windows.map(w=>{if(!w)return [];const a=[];for(let t=w.start;t<w.end;t++){const b=bucket(t%1440),calendarDay=(w.day+Math.floor(t/1440))%7;a.push(onBreak(w,t)?0:dist.day[calendarDay]*dist.times[b]/(BOUNDS[b+1]-BOUNDS[b]));}return a;}),masses=weights.map(a=>a.reduce((x,y)=>x+y,0)),total=masses.reduce((a,b)=>a+b,0),openDays=windows.filter(Boolean).length,weekly=Math.round(Number(assumptions.dailyGuests)*openDays);
  const exact=masses.map(v=>total>0?v/total*weekly:0),counts=exact.map(Math.floor),remaining=weekly-counts.reduce((a,b)=>a+b,0);
  if(total>0)exact.map((v,i)=>({i,f:v-counts[i]})).filter(v=>windows[v.i]).sort((a,b)=>b.f-a.f||a.i-b.i).slice(0,remaining).forEach(v=>counts[v.i]++);
  return {dist,windows,weights,masses,counts,weekly,unallocated:total>0?0:weekly};
 }
 function arrivals(p,day){const w=p.windows[day],n=p.counts[day];if(!w||!n)return [];const weights=p.weights[day],total=p.masses[day],out=[];let i=0,cumulative=weights[0];for(let k=0;k<n;k++){const value=(k+random(k+day*12345))/n*total;while(i<weights.length-1&&cumulative<=value)cumulative+=weights[++i];const before=cumulative-weights[i],fraction=weights[i]?(value-before)/weights[i]:0;out.push(Math.min(w.end-STEP,Math.floor((w.start+i+fraction)/STEP)*STEP));}return out;}
 function defaults(operations){return {day:String(operations.days.findIndex(d=>d.enabled)),workers:'1',service:'3',stay:'30',queueLimit:'10',patience:'15',speed:'5'};}
 function validate(s,operations){const errors={};for(const [key,min,max,int] of [['day',0,6,true],['workers',1,Math.max(1,Number(operations.staffCount)+1),true],['service',.25,30,false],['stay',1,180,false],['queueLimit',0,100,true],['patience',1,120,false],['speed',1,30,false]])if(typeof s?.[key]!=='string'||s[key].trim()===''||!Number.isFinite(Number(s[key]))||Number(s[key])<min||Number(s[key])>max||(int&&!Number.isInteger(Number(s[key]))))errors[key]=`${min}~${max} 사이 ${int?'정수':'숫자'}를 입력하세요.`;if(!errors.day&&!operations.days[Number(s.day)].enabled)errors.day='영업하는 요일을 선택하세요.';return {valid:!Object.keys(errors).length,errors};}
 function seats(layout,I){const out=[];for(const item of layout.items){const def=I.CATALOG[item.type],size=I.size(item);for(let n=0;n<def.seat;n++)out.push({itemId:item.id,x:item.x+size.w*(n+.5)/def.seat,y:item.y+size.h/2});}return out;}
 function create(context,assumptions,settings,row,layout,I){if(!validate(settings,context.operation).valid)throw Error('영업 체험 조건을 확인하세요.');const p=profile(context.operation,assumptions,row),day=Number(settings.day),window=p.windows[day];return {settings:clone(settings),assumptions:clone(assumptions),context,profile:p,window,arrivals:arrivals(p,day),next:0,tick:0,minute:window.start,seats:seats(layout,I),active:[],events:[],done:false,arrived:0,served:0,units:0,revenue:0,lost:0,browsing:0,exited:0,maxQueue:0,maxSeated:0,waitSum:0,consumed:{hot:0,cold:0,lid:0,straw:0,napkin:0,food:0},menuSales:Object.fromEntries(context.menus.map(m=>[m.id,0]))};}
 function order(sim,id){const qty=Math.floor(id*Number(sim.assumptions.unitsPerGuest)+.5)-Math.floor((id-1)*Number(sim.assumptions.unitsPerGuest)+.5),mix=sim.assumptions.menus,weight=mix.reduce((a,m)=>a+Number(m.weight),0),items=[];let value=0;for(let i=0;i<qty;i++){let choice=random(id*1009+i*37)*weight,picked=mix[mix.length-1];for(const m of mix){choice-=Number(m.weight);if(choice<0){picked=m;break;}}const menu=sim.context.operation.menus.find(m=>m.id===picked.id),found=items.find(v=>v.id===menu.id);if(found)found.qty++;else items.push({id:menu.id,name:menu.name,price:Number(menu.price),iced:menu.iced,custom:menu.recipe==='custom',food:['bake','dessert'].includes(menu.recipe),qty:1});value+=Number(menu.price);}return {qty,items,value};}
 function leave(sim,p,reason){p.phase='leaving';p.from=reason;p.changed=sim.minute;p.until=sim.minute+.75;if(reason!=='served'&&reason!=='browse'){sim.lost++;p.lost=true;}if(p.seat!==null){p.lastSeat=p.seat;p.seat=null;}}
 function deliver(sim,p){sim.served++;sim.units+=p.order.qty;sim.revenue+=p.order.value;sim.waitSum+=sim.minute-p.arrival;sim.consumed.napkin++;for(const m of p.order.items){sim.menuSales[m.id]+=m.qty;if(!p.dineIn&&!m.custom){if(m.food)sim.consumed.food+=m.qty;else{sim.consumed[m.iced?'cold':'hot']+=m.qty;sim.consumed.lid+=m.qty;if(m.iced)sim.consumed.straw+=m.qty;}}}sim.events.unshift({minute:sim.minute,customer:p.id,items:p.order.items.map(m=>m.name+' × '+m.qty).join(' · '),value:p.order.value,takeout:!p.dineIn});sim.events=sim.events.slice(0,8);p.changed=sim.minute;if(p.dineIn){p.phase='to-seat';p.until=sim.minute+.75;}else leave(sim,p,'served');}
 function step(sim){sim.tick++;sim.minute=sim.window.start+sim.tick*STEP;const now=sim.minute,w=sim.window;
  while(sim.next<sim.arrivals.length&&sim.arrivals[sim.next]<=now){const id=sim.next+1,arrival=sim.arrivals[sim.next++],dineIn=Math.floor(id*Number(sim.assumptions.dineIn)/100)>Math.floor((id-1)*Number(sim.assumptions.dineIn)/100);sim.arrived++;sim.active.push({id,arrival,phase:'entering',changed:arrival,until:arrival+.5,seat:null,lastSeat:null,dineIn,order:order(sim,id),lane:0});}
  for(const p of sim.active){
   if(p.phase==='entering'&&now>=p.until){if(!p.order.qty){sim.browsing++;leave(sim,p,'browse');}else if(now>=w.end)leave(sim,p,'closed');else if(p.dineIn&&sim.seats.length===0)leave(sim,p,'no-seat');else if(sim.active.filter(v=>v.phase==='queue').length>=Number(sim.settings.queueLimit)&&sim.active.filter(v=>v.phase==='making').length>=Number(sim.settings.workers))leave(sim,p,'queue-full');else{p.phase='queue';p.changed=now;}}
   else if(p.phase==='making'){if(!onBreak(w,now-STEP)){p.remaining-=STEP;if(p.remaining<=1e-9)deliver(sim,p);}}
   else if(p.phase==='to-seat'&&now>=p.until){p.phase='seated';p.changed=now;p.until=now+Number(sim.settings.stay);}
   else if(p.phase==='seated'&&now>=p.until)leave(sim,p,'served');
   else if(p.phase==='queue'&&(now>=w.end||now-p.arrival>=Number(sim.settings.patience)))leave(sim,p,now>=w.end?'closed':'patience');
  }
  for(const p of sim.active)if(p.phase==='leaving'&&now>=p.until){p.phase='gone';sim.exited++;}sim.active=sim.active.filter(p=>p.phase!=='gone');
  if(now<w.end&&!onBreak(w,now)){let making=sim.active.filter(p=>p.phase==='making');while(making.length<Number(sim.settings.workers)){const p=sim.active.find(p=>p.phase==='queue');if(!p)break;if(p.dineIn){const occupied=new Set(sim.active.filter(v=>v.seat!==null).map(v=>v.seat)),seat=sim.seats.findIndex((_,i)=>!occupied.has(i));if(seat<0)break;p.seat=seat;}p.phase='making';p.changed=now;p.remaining=Number(sim.settings.service);p.lane=Array.from({length:Number(sim.settings.workers)},(_,i)=>i).find(i=>!making.some(v=>v.lane===i));making.push(p);}
  }
  const queue=sim.active.filter(p=>p.phase==='queue');while(queue.length>Number(sim.settings.queueLimit)){const p=queue.pop();leave(sim,p,'queue-full');}
  sim.maxQueue=Math.max(sim.maxQueue,queue.length);sim.maxSeated=Math.max(sim.maxSeated,sim.active.filter(p=>p.phase==='seated').length);if(now>=w.end&&sim.next===sim.arrivals.length&&sim.active.length===0)sim.done=true;
 }
 function advance(sim,target){if(!Number.isFinite(target)||target<sim.minute)return sim;const finalTick=Math.floor((target-sim.window.start)/STEP+1e-8);while(sim.tick<finalTick&&!sim.done)step(sim);return sim;}
 function snapshot(sim){return {minute:sim.minute,done:sim.done,planned:sim.arrivals.length,arrived:sim.arrived,inside:sim.active.length,queue:sim.active.filter(p=>p.phase==='queue').length,making:sim.active.filter(p=>p.phase==='making').length,seated:sim.active.filter(p=>p.phase==='seated').length,reserved:sim.active.filter(p=>p.seat!==null&&p.phase!=='seated').length,served:sim.served,units:sim.units,revenue:sim.revenue,lost:sim.lost,browsing:sim.browsing,exited:sim.exited,maxQueue:sim.maxQueue,maxSeated:sim.maxSeated,averageWait:sim.served?sim.waitSum/sim.served:0,consumed:clone(sim.consumed)};}
 // Procurement is based on planned demand, never on the animation's completed sales.
 const SUPPLIES={hot:'뜨거운 음료 컵',cold:'찬 음료 컵',hotLid:'뜨거운 컵용 뚜껑',coldLid:'찬 컵용 뚜껑',straw:'빨대',napkin:'휴지·냅킨 (장)',food:'디저트 포장재'};
 function packaging(menu){return menu.recipe==='custom'?'unknown':['bake','dessert'].includes(menu.recipe)?'food':menu.iced?'cold':'hot';}
 function planningDefaults(operation){return Pricing.fillSupplies({days:'7',spare:'20',utilization:'80',items:Object.fromEntries(Object.keys(SUPPLIES).map(k=>[k,{owned:'0',unitPrice:'',pack:'100',extra:'0',usage:'1'}])),packaging:Object.fromEntries(operation.menus.filter(m=>m.enabled).map(m=>[m.id,packaging(m)]))});}
 function validatePlan(plan,operation){const errors={};const check=(key,value,min,max,int,blank=false)=>{if(blank&&value==='')return;if(typeof value!=='string'||value.trim()===''||!Number.isFinite(Number(value))||Number(value)<min||Number(value)>max||(int&&!Number.isInteger(Number(value))))errors[key]=`${min}~${max} 사이 ${int?'정수':'숫자'}를 입력하세요.`;};
  check('days',plan?.days,1,90,true);check('spare',plan?.spare,0,200,false);check('utilization',plan?.utilization,10,100,false);
  for(const k of Object.keys(SUPPLIES))for(const [field,min,max,int,blank] of [['owned',0,1e8,true],['unitPrice',0,1e6,false,true],['pack',1,1e6,true],['extra',0,1e8,true],['usage',0,20,false]])check(k+'-'+field,plan?.items?.[k]?.[field],min,max,int,blank);
  for(const m of operation.menus.filter(m=>m.enabled))if(!['hot','cold','food','none','unknown'].includes(plan?.packaging?.[m.id]))errors['menu-'+m.id]='포장 유형을 선택하세요.';
  return {valid:Object.keys(errors).length===0,errors};
 }
 function restorePlan(record,code,operation){const plan=planningDefaults(operation);if(record?.schemaVersion!==1||record.districtCode!==code)return plan;const saved=record.inputs;
  for(const k of ['days','spare','utilization'])if(saved?.[k]!==undefined)plan[k]=saved[k];
  for(const k of Object.keys(SUPPLIES))if(saved?.items?.[k])plan.items[k]={...plan.items[k],...saved.items[k],priceKind:saved.items[k].priceKind||(Pricing.hasPrice(saved.items[k].unitPrice)?'manual':'estimate')};
  // A changed recipe must not silently keep the previous cup type.
  for(const m of operation.menus.filter(m=>m.enabled))if(record.menuSignatures?.[m.id]===JSON.stringify([m.recipe,m.iced])&&saved?.packaging?.[m.id])plan.packaging[m.id]=saved.packaging[m.id];
  return Pricing.fillSupplies(plan);
 }
 function planningRecord(plan,code,operation,signature){return {schemaVersion:1,districtCode:code,inputs:clone(plan),sourceSignature:signature,menuSignatures:Object.fromEntries(operation.menus.filter(m=>m.enabled).map(m=>[m.id,JSON.stringify([m.recipe,m.iced])])),savedAt:new Date().toISOString()};}
 function staffPeak(p,day,service,utilization,buyRate){const w=p.windows[day];if(!w)return null;let best={day,start:w.start,end:w.start,minutes:0,orders:0,perHour:0,people:0};const weights=p.weights[day],scale=p.masses[day]>0?p.counts[day]/p.masses[day]*buyRate:0;
  // Compare every 60-minute window within each uninterrupted service segment.
  // Short segments are normalized by their actual working minutes.
  const segments=w.pause?[[w.start,w.pauseStart],[w.pauseEnd,w.end]]:[[w.start,w.end]];
  for(const [start,end] of segments){const length=Math.min(60,end-start);if(length<=0)continue;let sum=0;for(let t=start;t<start+length;t++)sum+=weights[t-w.start]*scale;
   for(let t=start;t+length<=end;t++){if(t>start)sum+=(weights[t+length-1-w.start]-weights[t-1-w.start])*scale;const rate=Math.max(0,sum)*60/length;if(rate>best.perHour)best={day,start:t,end:t+length,minutes:length,orders:Math.max(0,sum),perHour:rate,people:Math.ceil(rate*service/(60*utilization)-1e-10)};}
  }return best;
 }
 function planResources(operation,assumptions,settings,row,plan){if(!validatePlan(plan,operation).valid)throw Error('준비 수량의 입력값을 확인하세요.');const p=profile(operation,assumptions,row);if(p.unallocated)throw Error('영업구간의 분포가 없어 준비 수량을 계산할 수 없습니다.');
  let visitors=0;const schedule=[];for(let offset=0;schedule.length<Number(plan.days)&&offset<Number(plan.days)*7;offset++){const day=(Number(settings.day)+offset)%7;if(p.windows[day]){visitors+=p.counts[day];schedule.push(day);}}
  const units=visitors*Number(assumptions.unitsPerGuest),takeout=1-Number(assumptions.dineIn)/100,buyRate=Math.min(1,Number(assumptions.unitsPerGuest)),orders=visitors*buyRate,base={hot:0,cold:0,hotLid:0,coldLid:0,straw:0,napkin:orders,food:0},unknown=[];
  const totalWeight=assumptions.menus.reduce((a,m)=>a+Number(m.weight),0);
  for(const m of assumptions.menus){const qty=totalWeight?units*Number(m.weight)/totalWeight*takeout:0,type=plan.packaging[m.id];if(type==='unknown'&&qty>0)unknown.push(operation.menus.find(v=>v.id===m.id)?.name||String(m.id));if(type==='hot'||type==='cold'){base[type]+=qty;base[type+'Lid']+=qty;if(type==='cold')base.straw+=qty;}else if(type==='food')base.food+=qty;}
  let knownCost=0,usageCost=0;const missingPrices=[];
  const items=Object.fromEntries(Object.keys(SUPPLIES).map(k=>{const v=plan.items[k],expected=base[k]*Number(v.usage),need=Math.max(0,Math.ceil(expected-1e-9)),spare=Math.max(0,Math.ceil(need*Number(plan.spare)/100-1e-9))+Number(v.extra),target=need+spare,shortfall=Math.max(0,target-Number(v.owned)),packs=Math.ceil(shortfall/Number(v.pack)),buy=packs*Number(v.pack),price=v.unitPrice===''?null:Number(v.unitPrice),cost=buy===0?0:price===null?null:buy*price;if(cost===null)missingPrices.push(k);else knownCost+=cost;if(price!==null)usageCost+=expected*price;return [k,{expected,need,spare,target,shortfall,packs,buy,cost,afterPurchase:Number(v.owned)+buy,unitPrice:price}];}));
  const staff=p.windows.map((_,day)=>staffPeak(p,day,Number(settings.service),Number(plan.utilization)/100,buyRate)),peak=staff.filter(Boolean).reduce((a,b)=>b.people>a.people||b.people===a.people&&b.perHour>a.perHour?b:a,{people:0,perHour:0});
  return {profile:p,visitors,units,orders,schedule,items,unknown,knownCost,missingPrices,complete:!unknown.length&&!missingPrices.length,usageCost,usageCostComplete:!unknown.length&&Object.values(items).every(v=>v.expected===0||v.unitPrice!==null),staff,peak};
 }
 function planningExamples(operation,assumptions,settings,row,plan){return [3,7,14].map(days=>({days,result:planResources(operation,assumptions,settings,row,{...plan,days:String(days)})}));}
 const api={BOUNDS,DAYS,STEP,time,bucket,random,distribution,windowFor,onBreak,profile,arrivals,defaults,validate,seats,create,advance,snapshot,SUPPLIES,planningDefaults,validatePlan,restorePlan,planningRecord,staffPeak,planResources,planningExamples};if(typeof module!=='undefined')module.exports=api;else root.LiveModel=api;
})(typeof window!=='undefined'?window:globalThis);
