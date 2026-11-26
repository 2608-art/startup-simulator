/* Pure public-data presentation, shared by browser and built-in Node tests. */
(function(root){
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>n===null||n===undefined?'자료 없음':Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
 const percent=(n,d)=>n===null||n===undefined||!d?'자료 없음':(n/d*100).toFixed(2)+'%';
 const source=(id,label)=>`<a href="https://data.seoul.go.kr/dataList/${id}/S/1/datasetView.do" target="_blank" rel="noopener">${label} · 공개 출처 ↗</a>`;
 const bars=(rows,total)=>rows.map(r=>`<li class="bar-row"><span>${esc(r.label)}${r.hours?` <small>(${r.hours}시간)</small>`:''}</span><strong>${percent(r.value,total)}</strong><span class="track" aria-hidden="true"><i style="width:${r.value==null||!total?0:r.value/total*100}%"></i></span></li>`).join('');
 function detail(m){return `<h2 id="detail-title" tabindex="-1">${esc(m.name)} <small>· ${esc(m.id)}</small></h2><p class="selected-label">선택됨 · 서울시 발달상권</p><p class="meta">보관 공식 영역 DBF 중심 · EPSG:5181 → WGS84 참고 위치. 현재 집계 경계와 일치 여부·영역 기준시점 미확인: 경계 표시 불가, 폴리곤은 표시하지 않습니다. 보관 자료 확인일 2026-11-11.</p>
 <section><h3>시간대별 길단위 인구 구성비</h3><p class="meta">2026년 2분기 · 응답 총값 대비 % · 구간 길이가 서로 다릅니다.</p><ul class="bars">${bars(m.times,m.total)}</ul><h3>요일별 길단위 인구 구성비</h3><ul class="bars">${bars(m.days,m.total)}</ul><p class="warning">주의 · 실제 방문객·시간당 유입이 아닙니다. 총값의 누적/일평균·고유인원 정의는 미확인입니다. 일수로 나누지 않았으며 반올림 합계는 100%와 다를 수 있습니다.</p><p class="meta">서울신용보증재단·서울시 상권분석서비스 / 상권 ${esc(m.id)} / 길단위인구-상권 / 2026Q2 / 조회 2026-11-16. 분모: TOT_FLPOP_CO, 구간값 ÷ 응답 총값 × 100. ${source('OA-15568','길단위인구')}</p></section>
 <section><h3>직장·주거 배경</h3><dl class="metrics"><div><dt>직장인구(상권 내 직장 기반)</dt><dd>${num(m.workers)}명</dd></div><div><dt>상주인구(주거 배경)</dt><dd>${num(m.residents)}명</dd></div></dl><p class="meta">서울신용보증재단·서울시 상권분석서비스 / 상권 ${esc(m.id)} / 2026Q2 라벨 / 조회 2026-11-16. 전년도 4분기 값 이월 가능, 원 조사일 미확인. 서로 다른 모집단으로 합산하지 않습니다. ${source('OA-15569','직장인구')} · ${source('OA-15584','상주인구')}</p></section>
 <section><h3>카페와 가맹점</h3><dl class="metrics"><div><dt>커피전문점 수 · 2026년 9월</dt><dd>${num(m.cafeCount)}곳</dd></div><div><dt>서울시 가맹점 비율 · 2025Q4</dt><dd>${percent(m.franchiseCount,m.franchiseDenominator)}</dd></div></dl><p class="meta">카페 수: 소상공인시장진흥공단 상가업소정보 / I21201 커피전문점 / 보관 시험상권 추출 열 기준 / 확인 2026-11-11. 원 좌표의 폴리곤 공간결합은 독립 재검증하지 않았습니다. <a href="https://www.data.go.kr/data/15083033/fileData.do" target="_blank" rel="noopener">공개 출처 ↗</a></p><p class="meta">가맹점: 서울신용보증재단·서울시 점포-상권 / 상권 ${esc(m.id)} / CS100010 커피-음료 / 2025Q4 / 확인 2026-11-11. 분자 가맹점 수 / 분모 유사업종 점포 수 = ${m.franchiseCount} / ${m.franchiseDenominator}. 브랜드 접두어 집계가 아닙니다. 두 자료는 업종·시점·모집단이 다르며 밀도·경쟁강도가 아닙니다. ${source('OA-15577','점포-상권')}</p></section>`;}
 function rone(rows,region,type){
 if(!region)return '<p>권역을 직접 골라 참고하세요. 서울시 상권과 자동 연결하지 않습니다.</p>';
 const found=rows.filter(r=>(r.GRP_NM||r.CLS_NM)===region&&r.table_label.startsWith(type+'_'));
 const floors=found.filter(r=>r.table_label.includes('층별')&&r.ITM_NM==='임대료');
 if(!found.length)return '<p>자료 없음 · 해당 건물유형의 공식 권역 코드가 없습니다. 0이 아닙니다.</p>';
 const base=found.find(r=>r.table_label.includes('임대료_'));
 const order=['지하1층','1층','2층','3층','4층','5층','6층이상'];
 return `<h4>${esc(region)} · ${esc(type)} · 2026년 3분기</h4><p>지역 임대료(1층 기준): <strong>${num(base?.DTA_VAL)}</strong> 천원/㎡·월</p><div class="table-wrap"><table><caption>층별 원값 · 임대료 천원/㎡·월, 효용비율 %</caption><thead><tr><th>층</th><th>임대료</th><th>효용비율</th></tr></thead><tbody>${order.map(f=>{const rent=floors.find(r=>r.CLS_NM===f);const ratio=found.find(r=>r.CLS_NM===f&&r.ITM_NM.includes('효용'));return `<tr><th>${f}</th><td>${num(rent?.DTA_VAL)}</td><td>${num(ratio?.DTA_VAL)}</td></tr>`;}).join('')}</tbody></table></div><p class="meta">한국부동산원 R-ONE 상업용부동산 임대동향조사 / ${esc(region)} / ${esc(type)} / 2026Q3 / 조회 2026-11-16. 통계표: ${[...new Set(found.map(r=>r.STATBL_ID))].join(', ')}. 층별 수록 원값이며 비율을 곱해 복원하지 않았습니다. 미공표·null은 자료 없음.</p>`;
 }
 const api={search:(rows,q)=>rows.filter(m=>(m.name+' '+m.id).includes(q.trim())),detail,rone,percent};
 if(typeof module!=='undefined')module.exports=api;else root.MapModel=api;
})(typeof window!=='undefined'?window:globalThis);
