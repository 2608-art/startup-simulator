(function(root){
 'use strict';
 const DAYS=['월','화','수','목','금','토','일'];
 const WAGES={2026:10320,2027:10700};
 const WAGE_SOURCE='https://www.minimumwage.go.kr/minWage/policy/decisionMain.do';
 const WAGE_NOTICE='https://www.moel.go.kr/common/downloadFile.do?file_seq=20260800249&bbs_seq=20260800150&bbs_id=19&file_ext=pdf';
 function employmentDefaults(){return {year:'2027',hourly:'10700',holiday:'yes',extraMonthly:'0'};}
 function payroll(s){
  const e=s.employment||employmentDefaults(),errors={};
  if(!Object.hasOwn(WAGES,e.year))errors['employment-year']='2026년 또는 2027년을 선택하세요.';
  if(!number(s.staffCount,0,30,true))errors.staffCount='직원 수를 확인하세요.';
  if(Number(s.staffCount)===0)return {valid:!Object.keys(errors).length,errors,count:0,perPerson:0,total:0,base:0,extra:0,weeklyHours:0,holidayHours:0,paidMonthlyHours:0};
  if(!number(e.hourly,0,1000000,true)||Number(e.hourly)<(WAGES[e.year]||0))errors['employment-hourly']='선택 연도 최저시급 이상을 원 단위로 입력하세요.';
  if(!['yes','no'].includes(e.holiday))errors['employment-holiday']='주휴 반영 여부를 선택하세요.';
  if(!number(e.extraMonthly,0,10000000))errors['employment-extraMonthly']='직원 1인당 추가 월 고용비를 0 이상 입력하세요.';
  if(!number(s.staffDays,0,7,true)||!number(s.staffHours,0,24))errors.staffHours='직원 근무일·시간을 확인하세요.';
  if(Object.keys(errors).length)return {valid:false,errors};
  const weeklyHours=Number(s.staffDays)*Number(s.staffHours),holidayHours=e.holiday==='yes'&&weeklyHours>=15?Math.min(weeklyHours,40)/5:0;
  const paidMonthlyHours=Math.ceil((weeklyHours+holidayHours)*365/7/12),base=paidMonthlyHours*Number(e.hourly),extra=Math.round(Number(e.extraMonthly)*10000),perPerson=base+extra;
  return {valid:true,errors,count:Number(s.staffCount),weeklyHours,holidayHours,paidMonthlyHours,base,extra,perPerson,total:perPerson*Number(s.staffCount),overtime:weeklyHours>40};
 }
 function demandDefaults(){return {mode:'direct',passers:'',entryPercent:'2',purchasePercent:'75',trafficFactor:'100'};}
 function demand(s){
  const d=s.demand||demandDefaults(),errors={};
  if(d.mode==='direct')return {valid:true,errors,guests:Number(s.dailyGuests)};
  if(d.mode!=='flow')errors['demand-mode']='방문 가정 계산 방식을 선택하세요.';
  for(const [key,max] of [['passers',10000000],['entryPercent',100],['purchasePercent',100],['trafficFactor',300]])if(!number(d[key],0,max))errors['demand-'+key]='0~'+max.toLocaleString()+' 사이 숫자를 입력하세요.';
  if(Object.keys(errors).length)return {valid:false,errors};
  const adjusted=Number(d.passers)*Number(d.trafficFactor)/100,entries=adjusted*Number(d.entryPercent)/100,guests=Math.round(entries*Number(d.purchasePercent)/100);
  if(guests>10000)errors['demand-passers']='하루 구매 손님 가정은 10,000명까지 지원합니다. 통행량·전환율을 확인하세요.';
  return {valid:!Object.keys(errors).length,errors,adjusted,entries,guests};
 }
 function flowProfile(row){
  const days=row?.flow?.dayPercent,times=row?.flow?.timePercent,lengths=[6,5,3,3,4,3];
  const valid=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>Number.isFinite(v)&&v>=0)&&a.reduce((x,y)=>x+y,0)>0;
  return {days:valid(days,7)?days.map((share,i)=>({label:DAYS[i]+'요일',share,index:share/(days.reduce((a,b)=>a+b,0)/7)*100})):null,times:valid(times,6)?times.map((share,i)=>({label:['00–06시','06–11시','11–14시','14–17시','17–21시','21–24시'][i],share,hours:lengths[i],index:share/lengths[i]/(times.reduce((a,b)=>a+b,0)/24)*100})):null};
 }
 const RECIPES={espresso:{name:'에스프레소 음료',needs:[['machine'],['grinder']]},latte:{name:'우유 커피',needs:[['machine'],['grinder'],['fridge']]},tea:{name:'뜨거운 차',needs:[['boiler','machine']]},drip:{name:'핸드드립',needs:[['drip'],['grinder'],['boiler','machine']]},smoothie:{name:'냉동과일 스무디',needs:[['blender'],['freezer']]},bake:{name:'직접 굽는 디저트',needs:[['oven']]},dessert:{name:'납품 디저트 진열',needs:[['showcase']]},custom:{name:'직접 정한 조리 방식',needs:[]}};
 const TEMPLATES={americano:{name:'아메리카노',recipe:'espresso',price:'4000'},latte:{name:'카페라테',recipe:'latte',price:'5000'},tea:{name:'티',recipe:'tea',price:'4500'},drip:{name:'핸드드립',recipe:'drip',price:'6000'},smoothie:{name:'과일 스무디',recipe:'smoothie',price:'6000'},bake:{name:'직접 구운 디저트',recipe:'bake',price:'4500'},dessert:{name:'납품 디저트',recipe:'dessert',price:'5500'},custom:{name:'새 메뉴',recipe:'custom',price:''}};
 const clone=v=>JSON.parse(JSON.stringify(v));
 const number=(v,min,max,integer=false)=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max&&(!integer||Number.isInteger(Number(v)));
 const minutes=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
 function duration(day){const start=minutes(day.open),end=minutes(day.close);if(start===null||end===null)return null;return end-start+(day.overnight?1440:0);}
 function menu(id,type,example=false){const t=TEMPLATES[type];return {id,name:t.name,recipe:t.recipe,price:t.price||'5000',priceKind:'estimate',enabled:true,iced:false,required:[]};}
 function fresh(){return {schemaVersion:1,days:DAYS.map((_,i)=>({enabled:i<6,open:'09:00',close:'18:00',overnight:false,breakMinutes:'0'})),staffCount:'1',staffDays:'5',staffHours:'6',ownerDays:'6',ownerHours:'9',dailyGuests:'60',peakOrders:'20',iceSource:'self',menus:[menu(1,'americano'),menu(2,'latte')],nextId:3,example:null};}
 function validate(s,equipmentKeys=[]){
  const errors={};if(s?.schemaVersion!==1||!Array.isArray(s.days)||s.days.length!==7)return {valid:false,errors:{form:'운영 자료 형식이 올바르지 않습니다.'}};
  let enabled=0;
  s.days.forEach((d,i)=>{if(!d||typeof d.enabled!=='boolean'||typeof d.overnight!=='boolean'){errors['day-'+i]='요일 설정을 확인하세요.';return;}if(!d.enabled)return;enabled++;const len=duration(d);if(len===null||len<=0||len>1440||!number(d.breakMinutes,0,1439,true)||Number(d.breakMinutes)>=len)errors['day-'+i]='종료·익일 여부와 휴게 시간을 확인하세요. 하루 영업은 0시간 초과~24시간입니다.';});
  if(!enabled)errors.schedule='영업일을 하루 이상 선택하세요.';
  // Check midnight spill against the next day, including Sunday → Monday.
  s.days.forEach((d,i)=>{const next=s.days[(i+1)%7];if(d?.enabled&&d.overnight&&next?.enabled&&minutes(d.close)>minutes(next.open))errors['day-'+i]='익일 종료 시간이 다음 영업일의 시작 시간과 겹칩니다.';});
  for(const [key,min,max,int] of [['staffCount',0,30,true],['ownerDays',0,7,true],['ownerHours',0,24,false],['dailyGuests',0,10000,true],['peakOrders',0,2000,true]])if(!number(s[key],min,max,int))errors[key]=`${min}~${max} 사이 ${int?'정수':'숫자'}를 입력하세요.`;
  if(number(s.staffCount,0,30,true)&&Number(s.staffCount)>0){for(const [key,max,int] of [['staffDays',7,true],['staffHours',24,false]])if(!number(s[key],0,max,int))errors[key]=`0~${max} 사이 ${int?'정수':'숫자'}를 입력하세요.`;}
  if(!['self','purchase'].includes(s.iceSource))errors.iceSource='얼음 조달 방식을 선택하세요.';
  if(!Array.isArray(s.menus)||s.menus.length>40||!Number.isSafeInteger(s.nextId)||s.nextId<1)return {valid:false,errors:{...errors,menus:'메뉴는 최대 40개입니다. 저장 자료를 확인하세요.'}};
  let active=0;const ids=new Set();for(const m of s.menus){
   if(!m||!Number.isSafeInteger(m.id)||m.id<1||m.id>=s.nextId||ids.has(m.id)||typeof m.enabled!=='boolean'||typeof m.iced!=='boolean'||typeof m.name!=='string'||m.name.length>50||!Object.hasOwn(RECIPES,m.recipe)||!Array.isArray(m.required)||new Set(m.required).size!==m.required.length||m.required.some(k=>!equipmentKeys.includes(k))){errors.menus='메뉴 자료가 올바르지 않습니다.';continue;}ids.add(m.id);
   if(m.enabled){active++;if(!m.name.trim())errors['menu-name-'+m.id]='메뉴 이름을 입력하세요.';if(!number(m.price,0,1000000,true))errors['menu-price-'+m.id]='판매가격을 0~1,000,000원 사이 정수로 입력하세요.';}
  }
  if(!active)errors.menus='판매할 메뉴를 하나 이상 선택하세요.';
  if(s.employment!==undefined)Object.assign(errors,payroll(s).errors);
  if(s.demand!==undefined){const derived=demand(s);Object.assign(errors,derived.errors);if(derived.valid&&s.demand.mode==='flow'&&Number(s.dailyGuests)!==derived.guests)errors.dailyGuests='유동 가정으로 계산한 손님 수를 다시 반영하세요.';}
  return {valid:!Object.keys(errors).length,errors};
 }
 function totals(s){const businessMinutes=s.days.reduce((sum,d)=>sum+(d.enabled?duration(d)-Number(d.breakMinutes):0),0),staffHours=Number(s.staffCount)?Number(s.staffCount)*Number(s.staffDays)*Number(s.staffHours):0,ownerHours=Number(s.ownerDays)*Number(s.ownerHours);return {openDays:s.days.filter(d=>d.enabled).length,businessHours:businessMinutes/60,staffHours,ownerHours,totalPersonHours:staffHours+ownerHours,activeMenus:s.menus.filter(m=>m.enabled).length};}
 function equipmentCheck(m,s,counts){const groups=clone(RECIPES[m.recipe].needs);if(m.recipe==='custom')groups.push(...m.required.map(k=>[k]));if(m.iced&&s.iceSource==='self')groups.push(['ice']);return groups.filter(g=>!g.some(k=>counts[k]>0));}
 function localHint(row){const p=row?.flow?.dayPercent;if(!Array.isArray(p)||p.length!==7)return null;const weekday=p.slice(0,5).reduce((a,b)=>a+b,0)/5,weekend=(p[5]+p[6])/2;if(!weekday&&!weekend)return null;return {weekday,weekend,kind:weekday>weekend*1.1?'weekday':weekend>weekday*1.1?'weekend':'balanced'};}
 function scenario(type,context){
  const s=fresh(),seat=context.seats,py=context.guestSqm/(400/121),scale=Math.max(seat,Math.round(py));
  const setup={light:{factor:2,min:30,staff:0,days:5,hours:8,staffHours:0},shared:{factor:3,min:60,staff:1,days:6,hours:9,staffHours:6},peak:{factor:5,min:100,staff:2,days:6,hours:10,staffHours:6}}[type];if(!setup)throw Error('Unknown scenario');
  s.dailyGuests=String(Math.min(10000,Math.max(setup.min,scale*setup.factor)));s.peakOrders=String(Math.ceil(Number(s.dailyGuests)*(type==='peak'?.3:.2)));s.staffCount=String(setup.staff);s.staffDays=setup.staff?'5':'0';s.staffHours=String(setup.staffHours);s.ownerDays=String(setup.days);s.ownerHours=String(setup.hours+1);
  s.days.forEach((d,i)=>{d.enabled=i<setup.days;d.close=String(9+setup.hours).padStart(2,'0')+':00';});
  const available=k=>equipmentCheck(menu(1,k,true),s,context.equipment).length===0;
  const candidates=['americano','latte','tea',...(type!=='light'?['drip','dessert','smoothie','bake']:[])].filter(available).slice(0,type==='light'?3:type==='shared'?5:7);
  s.menus=candidates.length?candidates.map((k,i)=>menu(i+1,k,true)):[menu(1,'custom')];s.nextId=s.menus.length+1;s.example=type;return s;
 }
 function comparisonDefaults(context){return {common:{ticket:'5000',costPercent:'30',fees:'3',otherMonthly:'100',taxMonthly:'0',interestMonthly:'0',initialTotal:''},variants:['light','shared','peak'].map(type=>{const s=scenario(type,context);return {type,staffCount:s.staffCount,staffDays:'5',staffHours:'6',openDays:String(totals(s).openDays),dailyGuests:s.dailyGuests};})};}
 function comparisonResult(common,variant,employment,capital){
  const errors={},ranges={ticket:[0,1000000],costPercent:[0,100],fees:[0,100],otherMonthly:[0,1e7],taxMonthly:[0,1e7],interestMonthly:[0,1e7]};
  for(const [key,[min,max]] of Object.entries(ranges))if(!number(common[key],min,max))errors[key]='입력 범위를 확인하세요.';
  for(const [key,min,max,int] of [['openDays',1,7,true],['dailyGuests',0,10000,true]])if(!number(variant[key],min,max,int))errors[key]='입력 범위를 확인하세요.';
  const pay=payroll({...variant,employment});Object.assign(errors,pay.errors);
  const initialKnown=common.initialTotal!==''||Number.isFinite(capital.initial);
  if(common.initialTotal!==''&&(!number(common.initialTotal,0,1e7)||Number(common.initialTotal)*10000<capital.deposit))errors.initialTotal='보증금 이상인 총 초기비용을 입력하세요.';
  if(!Number.isFinite(capital.monthly)||capital.monthly<0||!Number.isFinite(capital.deposit)||capital.deposit<0)errors.capital='공간 비용을 다시 확인하세요.';
  if(Object.keys(errors).length)return {valid:false,errors};
  const days=Number(variant.openDays)*52/12,revenue=days*Number(variant.dailyGuests)*Number(common.ticket),variable=revenue*(Number(common.costPercent)+Number(common.fees))/100;
  const fixed=pay.total+capital.monthly+10000*(Number(common.otherMonthly)+Number(common.taxMonthly)+Number(common.interestMonthly))+(capital.interest||0),profit=revenue-variable-fixed;
  const initial=initialKnown?(common.initialTotal!==''?Math.round(Number(common.initialTotal)*10000):capital.initial):null,investment=initialKnown?initial-capital.deposit:null;
  const recovery=investment===null?null:investment===0?0:profit>0?investment/profit:null;
  return {valid:true,errors,pay,days,revenue,variable,fixed,profit,initial,investment,recovery,recoveryDays:recovery===null?null:Math.ceil(recovery*days)};
 }
 function comparisonSample(variant,context){const s=scenario(variant.type,context);for(const key of ['staffCount','staffDays','staffHours','dailyGuests'])s[key]=variant[key];s.days.forEach((d,i)=>d.enabled=i<Number(variant.openDays));s.ownerDays=variant.openDays;s.peakOrders=String(Math.ceil(Number(s.dailyGuests)*(variant.type==='peak'?.3:.2)));return s;}
 function sources(space,kitchen,interior,code,K,I){
  if(space?.schemaVersion!==1||space.districtCode!==code||!K.finite(space.areaSqm,1,10000))throw {step:'space',message:'공간 조건에서 면적을 저장해 주세요.'};
  if(kitchen?.schemaVersion!==1||kitchen.districtCode!==code||kitchen.spaceAreaSqm!==space.areaSqm||kitchen.layout?.areaSqm!==space.areaSqm||kitchen.kitchenAreaSqm!==kitchen.layout?.kitchenArea||!Array.isArray(kitchen.layout?.items)||kitchen.layout.items.some(i=>!i||!Object.hasOwn(K.CATALOG,i.type))||!K.validate(kitchen.layout)||K.invalid(kitchen.layout).length)throw {step:'kitchen',message:'현재 공간 면적에 맞는 주방 배치를 저장해 주세요.'};
  if(interior?.schemaVersion!==1||interior.districtCode!==code||interior.sourceAreaSqm!==space.areaSqm||interior.sourceKitchenAreaSqm!==kitchen.kitchenAreaSqm||!interior.kitchenLinked||interior.isAreaExperiment||!I.validate(interior.layout)||interior.layout.areaSqm!==space.areaSqm||interior.layout.kitchenArea!==kitchen.kitchenAreaSqm||I.invalidItems(interior.layout).length||(typeof kitchen.roomWidthM==='number'&&interior.layout.width!==kitchen.roomWidthM))throw {step:'interior',message:'현재 주방과 연결된 인테리어 배치를 저장해 주세요. 면적 비교안은 앞 단계 면적으로 돌린 뒤 저장해야 합니다.'};
  const seats=I.costs(interior.layout).seats,equipment=Object.fromEntries(Object.keys(K.CATALOG).map(k=>[k,kitchen.layout.items.filter(i=>i.type===k).length]));
  return {districtCode:code,areaSqm:space.areaSqm,kitchenSqm:kitchen.kitchenAreaSqm,guestSqm:space.areaSqm-kitchen.kitchenAreaSqm,seats,equipment,signature:JSON.stringify([space.areaSqm,kitchen.savedAt,kitchen.layout,interior.savedAt,interior.layout]),kitchenSavedAt:kitchen.savedAt,interiorSavedAt:interior.savedAt};
 }
 function restore(saved,code,keys){if(saved?.schemaVersion!==1||saved.districtCode!==code)return null;const next=clone(saved.inputs);if(Array.isArray(next?.menus))for(const m of next.menus){if(m.price===undefined||m.price===null||String(m.price).trim()===''){m.price=Object.values(TEMPLATES).find(t=>t.name===m.name)?.price||'5000';m.priceKind='estimate';}}return validate(next,keys).valid?next:null;}
 const api={DAYS,WAGES,WAGE_SOURCE,WAGE_NOTICE,employmentDefaults,payroll,demandDefaults,demand,flowProfile,RECIPES,TEMPLATES,clone,number,minutes,duration,menu,fresh,validate,totals,equipmentCheck,localHint,scenario,comparisonDefaults,comparisonResult,comparisonSample,sources,restore};if(typeof module!=='undefined')module.exports=api;else root.OperationsModel=api;
})(typeof window!=='undefined'?window:globalThis);
