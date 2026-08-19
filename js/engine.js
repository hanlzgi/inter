/* ==========================================================================
 * engine.js — 인터랙티브 영상 노드 플레이어
 *
 * 설계 방침
 *  1) 콘텐츠 비의존 : 이 파일은 4·19를 모른다. window.SCENARIO 만 읽는다.
 *  2) 버퍼 노드 없음 : 정지 이미지 중계 슬라이드를 두지 않는다.
 *  3) 영상 종료 감지 없음 : 'ended' 이벤트로 화면을 바꾸지 않는다.
 *                          1회 재생 후 마지막 프레임에서 정지(브라우저 기본).
 *                          재진입 시 currentTime = 0 으로 되돌린 뒤 재생.
 *  4) 호환 우선 : ES5 문법만. fetch / Promise / 화살표함수 / 템플릿리터럴 /
 *                ES모듈 미사용. file:// 로 열어도 그대로 동작.
 * ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------- 유틸 */

  function $(id) { return document.getElementById(id); }

  function on(el, type, fn) {
    if (el.addEventListener) { el.addEventListener(type, fn, false); }
    else if (el.attachEvent) { el.attachEvent('on' + type, fn); }
  }

  function addClass(el, c) {
    if (!el) { return; }
    if ((' ' + el.className + ' ').indexOf(' ' + c + ' ') < 0) {
      el.className = el.className ? el.className + ' ' + c : c;
    }
  }

  function removeClass(el, c) {
    if (!el) { return; }
    el.className = (' ' + el.className + ' ')
      .replace(' ' + c + ' ', ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  function empty(el) { while (el.firstChild) { el.removeChild(el.firstChild); } }

  function isStr(v) { return typeof v === 'string' && v.length > 0; }

  function warn(msg) { if (window.console && console.warn) { console.warn('[engine] ' + msg); } }

  /* --------------------------------------------------------- DOM 참조 */

  var dom = {
    stage:    $('stage'),
    bg:       $('bg-img'),
    screen:   $('screen'),
    video:    $('video'),
    poster:   $('screen-poster'),
    tap:      $('tap-to-play'),
    dim:      $('dim'),
    title:    $('node-title'),
    chrome:   $('chrome'),
    actions:  $('actions'),
    choice:   $('choice'),
    question: $('choice-question'),
    list:     $('choice-list'),
    hero:     $('hero-play'),
    loading:  $('loading'),
    narr:     $('aud-narr'),
    sfx:      $('aud-sfx'),
    debug:    $('debug')
  };

  /* ------------------------------------------------------------ 상태 */

  var S = window.SCENARIO;
  var base = '';            // 콘텐츠 에셋 기준 경로
  var current = null;       // 현재 노드 id
  var ratio = 16 / 9;
  var timers = [];          // 노드 전환 시 정리할 setTimeout 핸들

  /* --------------------------------------------------- 레터박스 계산 */
  /* aspect-ratio / vh 계산에 기대지 않고 JS로 직접 맞춘다(호환 우선). */

  function fitStage() {
    var w = dom.stage.parentNode.clientWidth;
    var h = dom.stage.parentNode.clientHeight;
    var sw, sh;
    if (w / h > ratio) { sh = h; sw = Math.round(h * ratio); }
    else               { sw = w; sh = Math.round(w / ratio); }
    dom.stage.style.width  = sw + 'px';
    dom.stage.style.height = sh + 'px';
    // CSS는 rem 으로만 크기를 잡는다. 1rem = 무대 짧은 변의 1% 로 고정하면
    // 뷰포트가 아니라 '무대'를 기준으로 모든 요소가 비례 확대된다.
    document.documentElement.style.fontSize = (Math.min(sw, sh) / 100) + 'px';
  }

  /* ------------------------------------------------------ 오디오 버스 */

  function stopAudio() {
    var list = [dom.narr, dom.sfx], i;
    for (i = 0; i < list.length; i++) {
      try { list[i].pause(); list[i].currentTime = 0; } catch (e) {}
    }
  }

  function playAudio(el, cfg) {
    if (!cfg || !isStr(cfg.src)) { return; }
    var delay = cfg.delay || 0;
    timers.push(setTimeout(function () {
      try {
        el.src = base + cfg.src;
        el.volume = (typeof cfg.volume === 'number') ? cfg.volume : 0.8;
        el.currentTime = 0;
        var p = el.play();
        if (p && p['catch']) { p['catch'](function () {}); }
      } catch (e) {}
    }, delay));
  }

  /* ------------------------------------------------------ 비디오 버스 */

  function stopVideo() {
    try {
      dom.video.pause();
      dom.video.removeAttribute('src');
      // 일부 브라우저는 load() 를 불러야 이전 프레임이 남지 않는다
      dom.video.load();
    } catch (e) {}
    removeClass(dom.tap, 'on');
  }

  /* 1회 재생. loop 를 걸지 않으므로 마지막 프레임에서 자연 정지한다. */
  function playVideo(node) {
    var v = dom.video;

    // 포스터를 먼저 덮어 첫 프레임 깜빡임을 가린다
    if (isStr(node.poster)) {
      dom.poster.src = base + node.poster;
      addClass(dom.poster, 'on');
    } else {
      dom.poster.removeAttribute('src');
      removeClass(dom.poster, 'on');
    }

    addClass(dom.loading, 'on');

    v.loop = false;
    v.muted = !!node.muted;
    v.setAttribute('playsinline', '');
    v.src = base + node.src;

    try { v.currentTime = 0; } catch (e) {}   // 재진입 시 0프레임부터
    try { v.load(); } catch (e) {}

    var p = v.play();
    if (p && p['catch']) {
      p['catch'](function () {
        // 자동재생 차단 → 사용자 제스처 유도
        removeClass(dom.loading, 'on');
        addClass(dom.tap, 'on');
      });
    }
  }

  // 재생이 실제로 시작된 순간에만 포스터를 걷는다 (종료 감지가 아님)
  on(dom.video, 'playing', function () {
    removeClass(dom.poster, 'on');
    removeClass(dom.loading, 'on');
    removeClass(dom.tap, 'on');
  });
  on(dom.video, 'waiting', function () { addClass(dom.loading, 'on'); });
  on(dom.video, 'canplay', function () { removeClass(dom.loading, 'on'); });
  on(dom.video, 'error', function () {
    removeClass(dom.loading, 'on');
    // src 를 비우는 정리 과정에서도 error 가 발생하므로 실제 소스가 있을 때만 알린다
    if (dom.video.getAttribute('src')) {
      warn('영상을 불러오지 못했습니다 : ' + dom.video.getAttribute('src'));
    }
  });

  on(dom.tap, 'click', function () {
    try { dom.video.currentTime = 0; } catch (e) {}
    var p = dom.video.play();
    if (p && p['catch']) { p['catch'](function () {}); }
    removeClass(dom.tap, 'on');
  });

  /* -------------------------------------------------------- 버튼 생성 */

  function makeButton(label, ghost, onClick, extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (ghost ? ' btn-ghost' : '') + (extraClass ? ' ' + extraClass : '');
    b.appendChild(document.createTextNode(label));
    on(b, 'click', function (e) {
      if (e && e.preventDefault) { e.preventDefault(); }
      onClick();
    });
    return b;
  }

  /* -------------------------------------------------- 공통 크롬(홈/메뉴) */

  function renderChrome() {
    empty(dom.chrome);
    var items = S.chrome || [], i;
    for (i = 0; i < items.length; i++) {
      (function (item) {
        var b = makeButton(item.label || '', !!item.ghost, function () { go(item.go); },
                           item.icon === 'home' ? 'btn-home' : '');
        if (item.icon === 'home') {
          empty(b);
          b.appendChild(document.createTextNode('\u2302'));   // ⌂
          b.setAttribute('aria-label', item.title || '처음으로');
          b.title = item.title || '처음으로';
        }
        b.style.left   = item.x + '%';
        b.style.top    = item.y + '%';
        b.style.width  = item.w + '%';
        b.style.height = item.h + '%';
        dom.chrome.appendChild(b);
      })(items[i]);
    }
  }

  /* ------------------------------------------------------- 화면 초기화 */

  function clearScreen() {
    var i;
    for (i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
    timers = [];

    stopAudio();
    stopVideo();

    removeClass(dom.title, 'on');
    removeClass(dom.hero, 'on');
    removeClass(dom.loading, 'on');
    removeClass(dom.poster, 'on');
    dom.dim.style.opacity = 0;
    dom.choice.setAttribute('data-open', '0');
    dom.choice.setAttribute('aria-hidden', 'true');
    empty(dom.actions);
    empty(dom.list);
  }

  /* --------------------------------------------------------- 노드 렌더 */

  function render(node) {
    clearScreen();

    // 배경
    if (isStr(node.bg))      { dom.bg.src = base + node.bg; dom.bg.style.display = 'block'; }
    else if (isStr(S.bg))    { dom.bg.src = base + S.bg;    dom.bg.style.display = 'block'; }
    else                     { dom.bg.style.display = 'none'; }

    // 타이틀
    if (isStr(node.title)) {
      empty(dom.title);
      dom.title.appendChild(document.createTextNode(node.title));
      timers.push(setTimeout(function () { addClass(dom.title, 'on'); }, 60));
    }

    // 딤드
    if (typeof node.dim === 'number' && node.dim > 0) {
      timers.push(setTimeout(function () { dom.dim.style.opacity = node.dim; }, 20));
    }

    // 유형별
    if (node.type === 'video') {
      dom.screen.style.display = 'block';
      playVideo(node);
    } else {
      dom.screen.style.display = 'none';
    }

    if (node.type === 'poster') {
      // 진입 화면 : 배경 위에 재생 삼각형만 노출
      dom.hero.setAttribute('data-go', node.go || '');
      addClass(dom.hero, 'on');
    }

    if (node.type === 'choice') {
      renderChoice(node);
    }

    // 액션 버튼(상시 노출)
    var acts = node.actions || [], i;
    for (i = 0; i < acts.length; i++) {
      (function (a) {
        dom.actions.appendChild(makeButton(a.label, !!a.ghost, function () { go(a.go); }));
      })(acts[i]);
    }
  }

  // 진입 재생 버튼은 한 번만 바인딩한다(렌더마다 붙이면 핸들러가 쌓인다)
  on(dom.hero, 'click', function () {
    var target = dom.hero.getAttribute('data-go');
    if (target) { go(target); }
  });

  /* --------------------------------------------------------- 선택 허브 */

  function renderChoice(node) {
    empty(dom.question);
    dom.question.appendChild(document.createTextNode(node.question || ''));

    var opts = node.options || [], i;
    for (i = 0; i < opts.length; i++) {
      (function (o, idx) {
        var li = document.createElement('li');
        var b = makeButton(o.label, false, function () { go(o.go); });
        b.setAttribute('data-index', idx + 1);
        li.appendChild(b);
        dom.list.appendChild(li);
      })(opts[i], i);
    }

    dom.choice.setAttribute('aria-hidden', 'false');
    timers.push(setTimeout(function () {
      dom.choice.setAttribute('data-open', '1');
      var first = dom.list.getElementsByTagName('button')[0];
      if (first && first.focus) { try { first.focus(); } catch (e) {} }
    }, node.delay || 200));

    playAudio(dom.sfx,  node.sfx);
    playAudio(dom.narr, node.narration);
  }

  /* ------------------------------------------------------------ 라우팅 */

  function go(id) {
    if (!id) { return; }
    if (location.hash !== '#/' + id) { location.hash = '#/' + id; }
    else { show(id); }   // 같은 노드 재진입(리셋) 도 허용
  }

  function show(id) {
    var node = S.nodes[id];
    if (!node) { warn('알 수 없는 노드 : ' + id); node = S.nodes[S.start]; id = S.start; }
    current = id;
    document.title = (node.title ? node.title + ' — ' : '') + (S.title || '');
    render(node);
    updateDebug();
  }

  function readHash() {
    var h = location.hash.replace(/^#\/?/, '');
    return h || S.start;
  }

  on(window, 'hashchange', function () { show(readHash()); });

  /* ------------------------------------------------------------- 키보드 */

  on(document, 'keydown', function (e) {
    var k = e.keyCode || e.which;
    if (k === 27) {                                   // ESC → 선택 허브
      if (S.escapeTo) { go(S.escapeTo); }
    } else if (k >= 49 && k <= 57) {                  // 1~9 → 선택지
      var btns = dom.list.getElementsByTagName('button');
      var idx = k - 49;
      if (btns[idx]) { btns[idx].click(); }
    }
  });

  /* -------------------------------------------------------------- 디버그 */

  function updateDebug() {
    if (dom.debug.hidden) { return; }
    empty(dom.debug);
    var key, a;
    for (key in S.nodes) {
      if (!S.nodes.hasOwnProperty(key)) { continue; }
      a = document.createElement('a');
      a.href = '#/' + key;
      a.appendChild(document.createTextNode((key === current ? '\u25B6' : '') + key));
      dom.debug.appendChild(a);
    }
  }

  /* ---------------------------------------------------------------- 부트 */

  function boot() {
    if (!S || !S.nodes) {
      warn('scenario 를 찾지 못했습니다. content/<id>/scenario.js 를 확인하세요.');
      return;
    }

    base = S.base || '';
    if (base && base.charAt(base.length - 1) !== '/') { base += '/'; }

    if (isStr(S.aspect) && S.aspect.indexOf(':') > 0) {
      var p = S.aspect.split(':');
      ratio = parseFloat(p[0]) / parseFloat(p[1]);
    }

    // 영상 무대 좌표(%) 주입
    var sv = (S.stage && S.stage.video) || { x: 14.7, y: 20.9, w: 70.7, h: 70.7 };
    dom.screen.style.left   = sv.x + '%';
    dom.screen.style.top    = sv.y + '%';
    dom.screen.style.width  = sv.w + '%';
    dom.screen.style.height = sv.h + '%';

    renderChrome();
    fitStage();
    on(window, 'resize', fitStage);
    on(window, 'orientationchange', function () { setTimeout(fitStage, 120); });

    if (location.search.indexOf('debug=1') >= 0) { dom.debug.hidden = false; }

    show(readHash());
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    on(document, 'DOMContentLoaded', boot);
  }

})();
