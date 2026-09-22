/*
 * 명조 "공명자 선택" 홈 — 좌측 타일을 가리키면 우측 상세가 바뀐다.
 *
 * 설계 원칙 (이게 이 파일에서 제일 중요한 부분이다):
 *
 *  1. 링크를 절대 가로채지 않는다.
 *     타일은 진짜 <a href="글 주소"> 다. click 에 preventDefault 를 걸면
 *     키보드 사용자가 Enter 로 글에 들어갈 수 없게 되고, 그건 명백한 퇴보다.
 *     그래서 "가리키면 미리보기 / 누르면 이동" 으로 나눴다.
 *     게임에서도 커서를 옮기면 상세가 바뀌고, 확인을 눌러야 들어간다.
 *
 *  2. 이 스크립트가 없어도 홈은 멀쩡해야 한다.
 *     JS 가 실패하면 타일은 그냥 링크 목록이고, 숨겨 둔 상세는
 *     home.html 의 <noscript> 가 전부 펼친다. 내용이 가려지는 경우는 없다.
 *
 *  3. 좁은 화면에서는 아무것도 하지 않는다.
 *     850px(Chirpy 의 lg 기준점) 미만에서는 CSS 가 상세 칸을 숨긴다.
 *     숨겨진 걸 바꿔 봐야 의미가 없고, 터치 기기에서 hover 는 눌러붙는다.
 */
(function () {
  'use strict';

  var root = document.getElementById('wuwa-select');
  if (!root) return;

  var tiles = Array.prototype.slice.call(root.querySelectorAll('[data-wuwa-tile]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-wuwa-panel]'));
  if (tiles.length === 0 || panels.length === 0) return;

  // Chirpy 의 lg 기준점은 992px 이 아니라 850px 이다. CSS 쪽과 반드시 같아야 한다.
  var wide = window.matchMedia('(min-width: 850px)');
  var canHover = window.matchMedia('(hover: hover)');

  function select(index) {
    tiles.forEach(function (tile) {
      tile.classList.toggle('is-active', Number(tile.dataset.wuwaTile) === index);
    });
    panels.forEach(function (panel) {
      panel.hidden = Number(panel.dataset.wuwaPanel) !== index;
    });
  }

  function preview(event) {
    if (!wide.matches) return;
    select(Number(event.currentTarget.dataset.wuwaTile));
  }

  tiles.forEach(function (tile) {
    // 키보드로 탭 이동할 때도 상세가 따라온다 — 마우스가 없어도 같은 경험.
    tile.addEventListener('focus', preview);

    if (canHover.matches) {
      tile.addEventListener('mouseenter', preview);
    }
  });

  // 창을 좁히면 상세가 숨으므로, 다시 넓혔을 때 첫 항목부터 보이도록 되돌린다.
  var onChange = function () {
    if (!wide.matches) select(0);
  };

  if (typeof wide.addEventListener === 'function') {
    wide.addEventListener('change', onChange);
  } else if (typeof wide.addListener === 'function') {
    // Safari 13 이하
    wide.addListener(onChange);
  }
})();
