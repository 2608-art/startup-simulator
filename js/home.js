/* 홈 화면: 업종 카드를 그리고 선택을 기억한다. */
(() => {
  'use strict';

  const grid = document.getElementById('industry-grid');
  const status = document.getElementById('pick-status');
  const KEY = 'sim.industry';

  // 받침 유무에 따라 '을/를'을 고른다 (예: 카페를, 한식당을).
  const objectParticle = (word) => {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return '을(를)';
    return code % 28 ? '을' : '를';
  };

  (window.INDUSTRIES || []).forEach((item) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'industry-card';
    btn.dataset.id = item.id;

    const emoji = document.createElement('span');
    emoji.className = 'industry-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = item.emoji;

    const name = document.createElement('span');
    name.className = 'industry-name';
    name.textContent = item.name;

    btn.append(emoji, name);
    btn.addEventListener('click', () => {
      try { localStorage.setItem(KEY, item.id); } catch (_) { /* 저장 불가여도 탐색 가능 */ }
      location.href = 'map.html';
      grid.querySelectorAll('.industry-card').forEach((c) =>
        c.setAttribute('aria-pressed', String(c === btn)));
      status.textContent = `${item.name}${objectParticle(item.name)} 골랐어요. 상권 지도로 이동합니다.`;
      status.hidden = false;
    });
    btn.setAttribute('aria-pressed', 'false');

    li.appendChild(btn);
    grid.appendChild(li);
  });
})();
