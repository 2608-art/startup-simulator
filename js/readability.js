(() => {
 'use strict';
 const pages=[
  {file:'index.html',label:'업종',steps:[['업종 선택','#industry-grid'],['지역부터 결과까지 순서대로 진행',null]]},
  {file:'map.html',label:'지역',steps:[['지역·번화가 검색','#search'],['가격과 지역 정보 확인','#detail'],['여러 번화가 비교','#compare-open']]},
  {file:'space.html',label:'공간',steps:[['면적·층·입지 설정','#space-form'],['보증금·월세 확인','.cost-card'],['공간 조건 저장','.save-row']]},
  {file:'kitchen.html',label:'주방',steps:[['면적·동시 인원 확인','.area-panel'],['메뉴와 장비 구성','.summary'],['배치 확인·저장','.workbench'],['식기·소도구 확인','.stock-panel']]},
  {file:'interior.html',label:'인테리어',steps:[['마감·가구 선택','#palette-panel'],['좌석과 배치 확인','.workbench'],['비용 확인·저장','#budget-panel']]},
  {file:'operations.html',label:'운영',steps:[['요일·시간대 정보','.local-panel'],['추천 예시 비교','.example-section'],['직원·영업시간·메뉴 입력','#operation-form'],['운영 계획 저장','.save-bar']]},
  {file:'funding.html',label:'자금',steps:[['개업 비용 확인','#funding-form'],['빠진 비용 포함 여부','#opening-checklist'],['자기자금·대출 입력','#own'],['확인 후 저장','.save-bar']]},
  {file:'results.html',label:'결과',steps:[['비용·잔액·버틸 기간','.business-overview'],['손님·초기 매출 비교','#scenario-settings'],['처리량과 월별 현금','.scenario-controls'],['결과 가정 저장','.save-bar']]},
  {file:'live.html',label:'영업 준비',steps:[['소모품·인원 준비','#preparation'],['가상 영업 확인','#controls'],['처리시간 등 조건 조정','#settings-form']]}
 ];
 const pathName=location.pathname.replace(/\/$/,'').split('/').pop()||'index',file=pathName.includes('.')?pathName:pathName+'.html',index=pages.findIndex(p=>p.file===file);if(index<0)return;
 function setup(){
  const page=pages[index],main=document.querySelector('main');if(!main)return;
  let district=new URLSearchParams(location.search).get('district');if(!district){try{district=localStorage.getItem('sim.district');}catch(_){}}
  const nav=document.createElement('nav');nav.className='ui-journey';nav.setAttribute('aria-label','창업 준비 전체 순서');const list=document.createElement('ol');
  pages.forEach((p,i)=>{const li=document.createElement('li'),a=document.createElement('a');a.href=p.file+(district&&i>0?'?district='+encodeURIComponent(district):'');if(i===index)a.setAttribute('aria-current','page');const n=document.createElement('span');n.className='ui-step-number';n.textContent=i===0?'시작':i===8?'추가':String(i).padStart(2,'0');a.append(n,document.createTextNode(p.label));li.append(a);list.append(li);});nav.append(list);main.before(nav);
  const compact=index===1||index===2;
  const guide=document.createElement(compact?'details':'section');guide.className='ui-guide';guide.setAttribute('aria-label','이 페이지를 보는 순서');const title=document.createElement(compact?'summary':'p');title.className='ui-guide-heading';title.textContent=compact?'처음이라면 · 이용 순서 보기':'이번 단계에서 할 일';const steps=document.createElement('ol');
  page.steps.forEach(([label,selector],i)=>{const li=document.createElement('li');if(!selector){li.textContent=label;}else{const a=document.createElement('a');a.textContent=label;const target=document.querySelector(selector);if(target){if(!target.id)target.id='ui-section-'+(i+1);target.dataset.uiAnchor='';a.href='#'+target.id;a.addEventListener('click',event=>{const hidden=target.closest('[hidden]');if(hidden){event.preventDefault();const msg=document.getElementById('load-message')||document.getElementById('loading');msg?.scrollIntoView({block:'center'});return;}if(target.id==='compare-open'){event.preventDefault();target.click();return;}let node=target;while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}if(!target.matches('input,button,select,a,textarea'))target.setAttribute('tabindex','-1');requestAnimationFrame(()=>target.focus({preventScroll:true}));});}else{a.href='#';a.addEventListener('click',e=>e.preventDefault());}li.append(a);}steps.append(li);});
  guide.append(title,steps);if(index>0){const note=document.createElement('p');note.className='ui-guide-note';note.textContent='상세 설명은 펼쳐볼 수 있어요. 입력을 바꿨다면 저장한 뒤 다른 단계로 이동하세요.';guide.append(note);}
  const intro=main.querySelector('.intro,.ops-intro,.studio-intro,.space-intro,.picker-lede');if(intro)intro.after(guide);else main.before(guide);
  const budget=document.querySelector('.startup-budget');if(budget){budget.querySelector('details').open=false;if(index===0)main.append(budget);else if(index===1)guide.after(budget);else guide.after(budget);}
  // Show the current step in the horizontal mobile strip without moving the page.
  const active=nav.querySelector('[aria-current]');if(active)list.scrollLeft=Math.max(0,active.offsetLeft-list.offsetLeft-list.clientWidth/2+active.offsetWidth/2);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
