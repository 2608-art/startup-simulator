/* Page 1/2 display estimates only. Never feeds sales or saved manual prices. */
(function(root){
 'use strict';
 const count=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function validate(data){
  if(data?.schemaVersion!==1||!/^\d{4}[1-4]$/.test(data.quarter)||!Array.isArray(data.districts)||data.districts.length!==25||!Array.isArray(data.hotspots)||data.hotspots.length!==17||!data.methodology)throw Error('유동인구 자료 형식 오류');
  for(const list of [data.districts,data.hotspots]){
   if(new Set(list.map(r=>r.id)).size!==list.length)throw Error('유동인구 지역 중복');
   for(const r of list){
    if(!/^11\d{3}(\d{3})?$/.test(r.id)||!r.name||!r.scopeLabel||!count(r.daily)||!Array.isArray(r.timeDaily)||r.timeDaily.length!==6||!r.timeDaily.every(count)||!Array.isArray(r.weekdayDaily)||r.weekdayDaily.length!==7||!r.weekdayDaily.every(count))throw Error('유동인구 수치 오류');
    for(const a of [r.timePercent,r.dayPercent])if(!Array.isArray(a)||a.some(v=>!count(v)||v>100))throw Error('유동인구 비중 오류');
    if(r.timePercent.length!==6||r.dayPercent.length!==7)throw Error('유동인구 구간 오류');
   }
  }
  return data;
 }
 function find(data,code,hotspotId=''){return (hotspotId?data?.hotspots:data?.districts)?.find(r=>r.id===(hotspotId||code))||null;}
 function estimate(row,factor=100){
  if(!row||factor===null||factor===undefined||String(factor).trim()===''||!Number.isFinite(Number(factor))||Number(factor)<0||Number(factor)>300)return null;
  return row.daily*Number(factor)/100;
 }
 const format=n=>count(n)?'약 '+Math.round(n).toLocaleString('ko-KR')+'명':'자료 확인 필요';
 function cell(row,factor){return `<strong>${format(estimate(row,factor))}</strong><small>하루 평균 · 추정</small>${row?`<small>${esc(row.scopeLabel)}</small>`:''}`;}
 function distributions(row,factor=100){
  if(!row||estimate(row,factor)===null)return '';
  const scale=Number(factor)/100,times=['00–06시','06–11시','11–14시','14–17시','17–21시','21–24시'],days=['월','화','수','목','금','토','일'];
  const list=(labels,percents,counts)=>`<dl class="flow-distribution">${labels.map((label,i)=>`<div><dt>${label}</dt><dd><span class="share-track" aria-hidden="true"><i style="width:${percents[i]}%"></i></span><span>${percents[i].toFixed(1)}%</span><strong>${format(counts[i]*scale)}</strong></dd></div>`).join('')}</dl>`;
  return `<div class="distribution"><h3>시간대 구성비 · 추정 인원</h3><p class="flow-basis">하루 평균 중 해당 시간대 · ${esc(row.scopeLabel)}</p>${list(times,row.timePercent,row.timeDaily)}<h3>요일 구성비 · 추정 인원</h3><p class="flow-basis">해당 요일 하루 평균 · 비율은 주간 구성비</p>${list(days,row.dayPercent,row.weekdayDaily)}</div>`;
 }
 function source(data){return data?`<details class="flow-method"><summary>유동인구 추정 기준 · 출처</summary><p>${esc(data.methodology)}</p><p>구 전체와 번화가 주변 행정동은 서로 다른 범위입니다. 동일인이 여러 시간·장소에 포함될 수 있어 실제 방문객 또는 고유 인원수와 같지 않습니다. 면적·층수는 지역 전체 인원수에 곱하지 않습니다. 골목길 선택 시 유동 지수만 적용합니다.</p><p>${esc(data.quarter.slice(0,4))}년 ${esc(data.quarter.slice(4))}분기 · 서울특별시·서울신용보증재단 · 공공누리 제1유형</p><a href="https://data.seoul.go.kr/dataList/OA-22179/S/1/datasetView.do" target="_blank" rel="noopener">서울시 자치구 자료 ↗</a> · <a href="https://data.seoul.go.kr/dataList/OA-22178/S/1/datasetView.do" target="_blank" rel="noopener">서울시 행정동 자료 ↗</a> · <a href="https://golmok.seoul.go.kr/source.do" target="_blank" rel="noopener">자료 정의 ↗</a></details>`:'';}
 const api={validate,find,estimate,format,cell,distributions,source};
 if(typeof module!=='undefined')module.exports=api;else root.FootfallModel=api;
})(typeof window!=='undefined'?window:globalThis);
