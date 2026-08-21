/* ==========================================================================
 * engine.js — 인터랙티브 영상 플레이어 (통합 메뉴 + 노드 그래프)
 *
 * 설계 방침
 *  1) 콘텐츠 비의존 : 이 파일은 콘텐츠를 모른다.
 *                    window.MENU(구성표) 와 window.SCENARIOS(편별 데이터)만 읽는다.
 *  2) 버퍼 노드 없음 : 정지 이미지 중계 슬라이드를 두지 않는다.
 *  3) 영상 종료 감지 없음 : 'ended' 로 화면을 바꾸지 않는다.
 *                          1회 재생 후 마지막 프레임에서 정지(브라우저 기본).
 *                          재진입 시 currentTime = 0 으로 되돌린 뒤 재생.
 *                          (ended 는 재생 버튼 아이콘 복귀에만 쓴다)
 *  4) 포스터 이미지 없음 : 별도 포스터 이미지를 두지 않는다.
 *                          메뉴 썸네일도 영상의 첫 컷을 그대로 쓴다.
 *  4-1) 선택 허브는 '노드' 가 아니라 '팝업' 이다.
 *                          영상 노드(current) 위에 choice 노드(overlay)가 겹친다.
 *                          팝업을 열고 닫아도 영상 플레이어는 전혀 건드리지 않는다.
 *  5) 호환 우선 : ES5 문법만. fetch / Promise / 화살표함수 / 템플릿리터럴 /
 *                ES모듈 미사용. file:// 로 열어도 그대로 동작.
 *                전체화면 API 는 벤더 접두사를 모두 훑는다.
 *
 * 주소 규칙
 *      #/           통합 메뉴
 *      #/c1         c1 편의 시작 노드
 *      #/c1/hub     c1 편의 hub 노드
 * ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------- 유틸 */

  function $(id) { return document.getElementById(id); }

  function on(el, type, fn) {
    if (!el) { return; }
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

  function empty(el) { while (el && el.firstChild) { el.removeChild(el.firstChild); } }

  function setText(el, str) { empty(el); el.appendChild(document.createTextNode(str)); }

  function isStr(v) { return typeof v === 'string' && v.length > 0; }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function warn(msg) { if (window.console && console.warn) { console.warn('[engine] ' + msg); } }

  /* --------------------------------------------------------- DOM 참조 */

  var dom = {
    app:      $('app'),
    stage:    $('stage'),
    bg:       $('bg-img'),
    screen:   $('screen'),
    video:    $('video'),
    tap:      $('tap-to-play'),
    dim:      $('dim'),
    badge:    $('node-badge'),
    title:    $('node-title'),
    chrome:   $('chrome'),
    actions:  $('actions'),
    choice:   $('choice'),
    panel:    $('choice-panel'),
    question: $('choice-question'),
    list:     $('choice-list'),
    extra:    $('choice-extra'),
    loading:  $('loading'),
    narr:     $('aud-narr'),
    sfx:      $('aud-sfx'),
    debug:    $('debug'),
    menu:     $('menu'),
    menuTitle:$('menu-title'),
    menuSub:  $('menu-sub'),
    menuList: $('menu-list'),
    menuHint: $('menu-hint'),
    vctrl:    $('vctrl'),
    vbar:     $('vbar'),
    vfill:    $('vbar-fill'),
    vknob:    $('vbar-knob'),
    vtoggle:  $('v-toggle'),
    vreplay:  $('v-replay'),
    vtime:    $('v-time'),
    vmute:    $('v-mute'),
    vvolbar:  $('vvolbar'),
    vvolfill: $('vvol-fill'),
    vvolknob: $('vvol-knob'),
    vfull:    $('v-full'),
    vrates:   []                // collectRates() 가 채운다
  };

  /* ------------------------------------------------------------ 상태 */

  var ALL = window.SCENARIOS || {};   // 편 id → 시나리오
  var M   = window.MENU || {};        // 메뉴 구성표

  var S = null;             // 현재 편의 시나리오 (메뉴에서는 null)
  var cid = null;           // 현재 편 id
  var base = '';            // 콘텐츠 에셋 기준 경로
  var current = null;       // 재생 중인 '영상' 노드 id
  var overlay = null;       // 그 위에 떠 있는 '선택 허브' 노드 id (없으면 null)
  var ctimers = [];         // 팝업 전용 타이머 (영상 노드 타이머와 섞이면 안 된다)
  var quiet = false;        // true 인 동안 hashchange 를 한 번 무시한다
  var resumeOnClose = false; // 팝업을 열기 전 영상이 재생 중이었는가 (닫을 때 이어서 틀지 판단)
  var ratio = 16 / 9;
  var timers = [];          // 화면 전환 시 정리할 setTimeout 핸들
  var rate = 1;             // 배속 : 편이 바뀌어도 유지된다
  var vol = 1;              // 음량 0~1 : 편이 바뀌어도 유지된다
  var muted = false;
  var ctrlTimer = null;     // 터치로 띄운 컨트롤바 자동 숨김 핸들
  var sliders = [];         // 드래그 상태를 물어볼 슬라이더들
  var menuCards = [];       // 메뉴에서 숫자키로 고를 수 있는 카드들

  /* --------------------------------------------------- 레터박스 계산 */
  /* aspect-ratio / vh 계산에 기대지 않고 JS로 직접 맞춘다(호환 우선). */

  function fitStage() {
    var w = dom.stage.parentNode.clientWidth;
    var h = dom.stage.parentNode.clientHeight;
    var sw, sh;
    if (!w || !h) { return; }
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

  function playAudio(el, cfg, bucket) {
    if (!cfg || !isStr(cfg.src)) { return; }
    var delay = cfg.delay || 0;
    (bucket || timers).push(setTimeout(function () {
      try {
        el.src = base + cfg.src;
        el.volume = ((typeof cfg.volume === 'number') ? cfg.volume : 0.8) * vol;
        el.muted = muted;
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

    addClass(dom.loading, 'on');

    v.loop = false;
    v.setAttribute('playsinline', '');
    v.src = base + node.src;

    try { v.currentTime = 0; } catch (e) {}   // 재진입 시 0프레임부터
    try { v.load(); } catch (e) {}
    applyAudioState(!!node.muted);            // 음량·음소거 유지
    try { v.playbackRate = rate; } catch (e) {}

    resetCtrl();

    var p = v.play();
    if (p && p['catch']) {
      p['catch'](function () {
        removeClass(dom.loading, 'on');
        updateToggle();
        // 팝업이 떠 있는 동안 우리가 일부러 멈춘 것이므로 안내를 띄우지 않는다
        if (overlay) { return; }
        // 자동재생 차단 → 사용자 제스처 유도
        addClass(dom.tap, 'on');
        showCtrl(false);            // 멈춘 상태에서는 컨트롤바를 띄워 둔다
      });
    }
  }

  on(dom.video, 'playing', function () {
    removeClass(dom.loading, 'on');
    removeClass(dom.tap, 'on');
    updateToggle();
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

  /* ====================================================== 전체화면 API */
  /* 접두사가 브라우저마다 다르므로 존재하는 것을 순서대로 찾아 쓴다. */

  function fsEl() {
    return document.fullscreenElement || document.webkitFullscreenElement ||
           document.webkitCurrentFullScreenElement || document.mozFullScreenElement ||
           document.msFullscreenElement || null;
  }

  function enterFS(el) {
    var fn = el.requestFullscreen || el.webkitRequestFullscreen ||
             el.webkitRequestFullScreen || el.mozRequestFullScreen ||
             el.msRequestFullscreen;
    if (fn) {
      try {
        var p = fn.call(el);
        if (p && p['catch']) { p['catch'](function () {}); }
        return true;
      } catch (e) {}
    }
    // iOS 사파리는 문서 전체화면이 없고 video 요소만 전체화면이 된다
    if (dom.video.webkitEnterFullscreen && hasSource()) {
      try { dom.video.webkitEnterFullscreen(); return true; } catch (e) {}
    }
    return false;
  }

  function leaveFS() {
    var fn = document.exitFullscreen || document.webkitExitFullscreen ||
             document.webkitCancelFullScreen || document.mozCancelFullScreen ||
             document.msExitFullscreen;
    if (fn) { try { fn.call(document); } catch (e) {} }
  }

  function toggleFS(el) {
    var cur = fsEl();
    if (cur === el) { leaveFS(); return; }
    if (cur) { leaveFS(); }
    if (!enterFS(el)) { warn('이 브라우저에서는 전체화면을 쓸 수 없습니다.'); }
  }

  function onFsChange() {
    if (fsEl() === dom.screen) {
      // 영상만 전체화면 : 무대가 아니라 화면 크기를 기준으로 rem 을 다시 잡는다
      var w = window.innerWidth || (screen && screen.width) || 0;
      var h = window.innerHeight || (screen && screen.height) || 0;
      if (w && h) { document.documentElement.style.fontSize = (Math.min(w, h) / 100) + 'px'; }
    } else {
      fitStage();
    }
    updateFsBtn();
  }

  function updateFsBtn() {
    var el = fsEl();
    var vLabel = (el === dom.screen) ? '전체화면 끝내기' : '전체화면';
    if (dom.vfull) { dom.vfull.setAttribute('aria-label', vLabel); dom.vfull.title = vLabel; }
    var cLabel = (el === dom.app) ? '화면 전체 보기 끝내기' : '화면 전체 보기';
    var cb = dom.chrome.getElementsByClassName ?
             dom.chrome.getElementsByClassName('btn-fullscreen') : null;
    if (cb && cb[0]) { cb[0].setAttribute('aria-label', cLabel); cb[0].title = cLabel; }
  }

  on(document, 'fullscreenchange',       onFsChange);
  on(document, 'webkitfullscreenchange', onFsChange);
  on(document, 'mozfullscreenchange',    onFsChange);
  on(document, 'MSFullscreenChange',     onFsChange);

  /* ==================================================== 재생 컨트롤바 */
  /* 재생/일시정지 · 다시 보기 · 배속(0.5/1/2) · 진행바 · 음량 · 전체화면.
     '영상 종료 감지 없음' 방침은 화면 전환에만 적용된다 — 여기서 ended 를
     읽는 것은 버튼 아이콘을 바꾸기 위한 용도이고 노드를 옮기지 않는다. */

  function hasSource() {
    return !!(dom.video.getAttribute('src') || dom.video.src);
  }

  function isVideoNode() {
    var n = (S && current && S.nodes) ? S.nodes[current] : null;
    return !!(n && n.type === 'video');
  }

  function fmtTime(t) {
    if (typeof t !== 'number' || !isFinite(t) || t < 0) { t = 0; }
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function duration() {
    var d = dom.video.duration;
    return (typeof d === 'number' && isFinite(d) && d > 0) ? d : 0;
  }

  function anyDragging() {
    var i;
    for (i = 0; i < sliders.length; i++) { if (sliders[i].dragging()) { return true; } }
    return false;
  }

  /* ---- 공용 슬라이더 : 진행바와 음량바가 같은 코드를 쓴다 ---- */
  function makeSlider(el, apply) {
    var drag = false;

    function ratioOf(e) {
      var box = el.getBoundingClientRect();
      var w = box.width || (box.right - box.left);
      var pt = null;
      if (e.touches && e.touches.length)                     { pt = e.touches[0]; }
      else if (e.changedTouches && e.changedTouches.length)  { pt = e.changedTouches[0]; }
      var x = pt ? pt.clientX : e.clientX;
      if (typeof x !== 'number' || !w) { return null; }
      return clamp01((x - box.left) / w);
    }

    function down(e) {
      if (e && e.preventDefault) { e.preventDefault(); }
      drag = true;
      addClass(el, 'dragging');
      var r = ratioOf(e);
      if (r !== null) { apply(r); }
    }
    function move(e) {
      if (!drag) { return; }
      if (e && e.preventDefault) { e.preventDefault(); }
      var r = ratioOf(e);
      if (r !== null) { apply(r); }
    }
    function up() {
      if (!drag) { return; }
      drag = false;
      removeClass(el, 'dragging');
    }

    on(el, 'mousedown',  down);
    on(document, 'mousemove', move);
    on(document, 'mouseup',   up);
    on(el, 'touchstart', down);
    on(el, 'touchmove',  move);
    on(el, 'touchend',   up);
    on(el, 'touchcancel', up);

    var api = { dragging: function () { return drag; } };
    sliders.push(api);
    return api;
  }

  /* ---- 진행바 ---- */
  function updateProgress() {
    var v = dom.video, d = duration(), pct = d ? (v.currentTime / d) * 100 : 0;
    if (pct < 0)   { pct = 0; }
    if (pct > 100) { pct = 100; }
    dom.vfill.style.width = pct + '%';
    dom.vknob.style.left  = pct + '%';
    var label = fmtTime(v.currentTime) + ' / ' + fmtTime(d);
    setText(dom.vtime, label);
    dom.vbar.setAttribute('aria-valuenow', Math.round(pct));
    dom.vbar.setAttribute('aria-valuetext', label);
  }

  function seekRatio(r) {
    var d = duration();
    if (!d) { return; }
    try { dom.video.currentTime = clamp01(r) * d; } catch (e) {}
    updateProgress();
  }

  function seekBy(sec) {
    var d = duration();
    if (!d) { return; }
    seekRatio((dom.video.currentTime + sec) / d);
  }

  /* ---- 음량 ---- */
  function applyAudioState(nodeMuted) {
    try {
      dom.video.volume = vol;                     // iOS 는 무시(읽기 전용)
      dom.video.muted  = muted || !!nodeMuted;
    } catch (e) {}
  }

  function updateVolUI() {
    var pct = muted ? 0 : Math.round(vol * 100);
    dom.vvolfill.style.width = pct + '%';
    dom.vvolknob.style.left  = pct + '%';
    dom.vvolbar.setAttribute('aria-valuenow', pct);
    dom.vvolbar.setAttribute('aria-valuetext', pct + '%');
    if (muted) { addClass(dom.vmute, 'muted'); } else { removeClass(dom.vmute, 'muted'); }
    var label = muted ? '음소거 해제' : '음소거';
    dom.vmute.setAttribute('aria-label', label);
    dom.vmute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    dom.vmute.title = label;
  }

  function setVolume(v) {
    vol = clamp01(v);
    if (vol > 0) { muted = false; }
    applyAudioState(false);
    updateVolUI();
  }

  function toggleMute() {
    muted = !muted;
    if (!muted && vol === 0) { vol = 1; }
    applyAudioState(false);
    updateVolUI();
  }

  /* ---- 재생 버튼 ---- */
  function updateToggle() {
    var playing = hasSource() && !dom.video.paused && !dom.video.ended;
    if (playing) { addClass(dom.vtoggle, 'playing'); }
    else         { removeClass(dom.vtoggle, 'playing'); }
    var label = playing ? '일시정지' : '재생';
    dom.vtoggle.setAttribute('aria-label', label);
    dom.vtoggle.title = label;
  }

  function togglePlay() {
    var v = dom.video;
    if (!hasSource()) { return; }
    if (v.paused || v.ended) {
      // ended 상태에서 play() 는 명세상 0초로 되돌아간 뒤 재생된다
      var p = v.play();
      if (p && p['catch']) { p['catch'](function () { addClass(dom.tap, 'on'); }); }
    } else {
      v.pause();
    }
    updateToggle();
  }

  function replay() {
    var v = dom.video;
    if (!hasSource()) { return; }
    try { v.currentTime = 0; } catch (e) {}
    removeClass(dom.tap, 'on');
    var p = v.play();
    if (p && p['catch']) { p['catch'](function () { addClass(dom.tap, 'on'); }); }
    updateProgress();
    updateToggle();
    showCtrl(true);
  }

  /* ---- 배속 ---- */
  function collectRates() {
    var all = dom.vctrl ? dom.vctrl.getElementsByTagName('button') : [], i;
    for (i = 0; i < all.length; i++) {
      if (!all[i].getAttribute('data-rate')) { continue; }
      dom.vrates.push(all[i]);
      (function (b) {
        on(b, 'click', function (e) {
          if (e && e.preventDefault) { e.preventDefault(); }
          setRate(parseFloat(b.getAttribute('data-rate')));
          showCtrl(false);
        });
      })(all[i]);
    }
  }

  function setRate(r) {
    rate = r;
    try { dom.video.playbackRate = r; } catch (e) {}
    var i, b;
    for (i = 0; i < dom.vrates.length; i++) {
      b = dom.vrates[i];
      if (parseFloat(b.getAttribute('data-rate')) === r) {
        addClass(b, 'on');    b.setAttribute('aria-pressed', 'true');
      } else {
        removeClass(b, 'on'); b.setAttribute('aria-pressed', 'false');
      }
    }
  }

  /* ---- 노출 / 숨김 ---- */
  function showCtrl(autoHide) {
    if (overlay) { return; }        // 팝업이 떠 있는 동안에는 가린다
    if (!isVideoNode()) { return; }
    addClass(dom.vctrl, 'on');
    dom.vctrl.setAttribute('aria-hidden', 'false');
    if (ctrlTimer) { clearTimeout(ctrlTimer); ctrlTimer = null; }
    if (autoHide) { ctrlTimer = setTimeout(function () { hideCtrl(); }, 3000); }
  }

  /* 드래그 중이거나 영상이 멈춰 있으면 숨기지 않는다(재생 버튼을 찾아야 하므로) */
  function hideCtrl() {
    if (anyDragging()) { return; }
    if (hasSource() && (dom.video.paused || dom.video.ended)) { return; }
    forceHideCtrl();
  }

  function forceHideCtrl() {
    if (ctrlTimer) { clearTimeout(ctrlTimer); ctrlTimer = null; }
    removeClass(dom.vbar, 'dragging');
    removeClass(dom.vvolbar, 'dragging');
    removeClass(dom.vctrl, 'on');
    dom.vctrl.setAttribute('aria-hidden', 'true');
  }

  function resetCtrl() {
    forceHideCtrl();
    dom.vfill.style.width = '0%';
    dom.vknob.style.left  = '0%';
    setText(dom.vtime, '0:00 / 0:00');
    dom.vbar.setAttribute('aria-valuenow', 0);
    updateToggle();
    updateVolUI();
  }

  /* ---- 배선 ---- */
  makeSlider(dom.vbar,    seekRatio);
  makeSlider(dom.vvolbar, setVolume);

  on(dom.vbar, 'keydown', function (e) {
    var k = e.keyCode || e.which;
    if (k === 37)      { seekBy(-1); }
    else if (k === 39) { seekBy(1); }
    else if (k === 36) { seekRatio(0); }
    else if (k === 35) { seekRatio(1); }
    else if (k === 32 || k === 13) { togglePlay(); }
    else { return; }
    if (e.preventDefault)  { e.preventDefault(); }
    if (e.stopPropagation) { e.stopPropagation(); }
  });

  on(dom.vvolbar, 'keydown', function (e) {
    var k = e.keyCode || e.which;
    if (k === 37)      { setVolume(vol - 0.1); }
    else if (k === 39) { setVolume(vol + 0.1); }
    else if (k === 36) { setVolume(0); }
    else if (k === 35) { setVolume(1); }
    else if (k === 32 || k === 13) { toggleMute(); }
    else { return; }
    if (e.preventDefault)  { e.preventDefault(); }
    if (e.stopPropagation) { e.stopPropagation(); }
  });

  on(dom.vtoggle, 'click', function (e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    togglePlay();
  });
  on(dom.vreplay, 'click', function (e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    replay();
  });
  on(dom.vmute, 'click', function (e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    toggleMute();
    showCtrl(false);
  });
  on(dom.vfull, 'click', function (e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    toggleFS(dom.screen);
    showCtrl(false);
  });

  /* 컨트롤바 위에 있는 동안은 자동 숨김 타이머를 멈춘다 */
  on(dom.vctrl, 'mouseover', function () { showCtrl(false); });

  /* 영상 위에 마우스를 올렸을 때만 노출. 터치는 탭으로 띄우고 3초 후 숨김. */
  on(dom.screen, 'mouseover', function () { showCtrl(false); });
  on(dom.screen, 'mouseout', function (e) {
    var to = e.relatedTarget || e.toElement;
    while (to) {                       // 내부 요소끼리의 이동은 무시
      if (to === dom.screen) { return; }
      to = to.parentNode;
    }
    hideCtrl();
  });
  on(dom.screen, 'touchstart', function () { showCtrl(true); });
  on(dom.screen, 'dblclick',   function () { toggleFS(dom.screen); });

  /* 영상 상태 → UI 동기화 */
  on(dom.video, 'play',           function () { updateToggle(); });
  on(dom.video, 'pause',          function () { updateToggle(); showCtrl(false); });
  on(dom.video, 'ended',          function () { updateToggle(); showCtrl(false); });
  on(dom.video, 'ratechange',     function () { updateToggle(); });
  on(dom.video, 'volumechange',   function () { updateToggle(); });
  on(dom.video, 'timeupdate',     updateProgress);
  on(dom.video, 'durationchange', updateProgress);
  on(dom.video, 'seeked',         updateProgress);
  on(dom.video, 'emptied',        function () { updateToggle(); });
  on(dom.video, 'loadedmetadata', function () {
    // 로드할 때 배속·음량을 초기화하는 브라우저가 있어 다시 적용한다
    try { dom.video.playbackRate = rate; } catch (e) {}
    applyAudioState(false);
    updateProgress();
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

  /* CSS 도형 아이콘.
     시나리오가 쓰는 이름(home, fullscreen) → CSS 클래스(ic-home, ic-fs) 대응표.
     모서리가 4개 필요한 아이콘은 자식 <i> 로 의사요소를 2개 더 만든다. */
  var ICON_CLASS = { home: 'ic-home', fullscreen: 'ic-fs' };

  function makeIcon(name) {
    var ic = document.createElement('span');
    ic.className = 'ic ' + (ICON_CLASS[name] || 'ic-' + name);
    if (name === 'fullscreen') { ic.appendChild(document.createElement('i')); }
    return ic;
  }

  /* -------------------------------------------- 공통 크롬(홈/건너뛰기/전체화면) */

  function renderChrome(items) {
    empty(dom.chrome);
    items = items || [];
    var i;
    for (i = 0; i < items.length; i++) {
      (function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn' +
          (item.ghost ? ' btn-ghost' : '') +
          (item.icon ? ' btn-icon btn-' + item.icon : '');

        if (item.icon) {
          b.appendChild(makeIcon(item.icon));
          b.setAttribute('aria-label', item.title || item.label || '');
          b.title = item.title || item.label || '';
        } else {
          b.appendChild(document.createTextNode(item.label || ''));
          if (item.title) { b.title = item.title; }
        }

        // 지금 보고 있는 노드로 가는 버튼은 숨기려고 표시해 둔다
        if (item.go) { b.setAttribute('data-go', item.go); }

        b.style.left   = item.x + '%';
        b.style.top    = item.y + '%';
        b.style.width  = item.w + '%';
        b.style.height = item.h + '%';

        on(b, 'click', function (e) {
          if (e && e.preventDefault) { e.preventDefault(); }
          if (item.action === 'fullscreen')  { toggleFS(dom.app); }
          else if (item.action === 'menu')   { goMenu(); }
          else if (item.go) { go(item.go); }
        });

        dom.chrome.appendChild(b);
      })(items[i]);
    }
    updateFsBtn();
    updateChromeState();
  }

  /* 지금 있는 곳으로 가는 크롬 버튼은 숨긴다.
     (선택 허브에서 '선택하기' 가 자기 자신을 가리키면 눌러도 아무 일이 없어
      혼란스럽다. 이 두 줄만 지우면 항상 보이는 예전 동작으로 돌아간다) */
  function updateChromeState() {
    // 지금 보고 있는 곳(팝업이 떠 있으면 그 팝업)을 가리키는 버튼은 숨긴다
    var here = overlay || current;
    var btns = dom.chrome.getElementsByTagName('button'), i, go;
    for (i = 0; i < btns.length; i++) {
      go = btns[i].getAttribute('data-go');
      if (go && go === here) { btns[i].style.display = 'none'; }
      else                   { btns[i].style.display = ''; }
    }
  }

  /* 메뉴 화면에서 쓰는 크롬 : 전체화면 버튼만 (돌아갈 곳이 없으므로 홈은 뺀다) */
  var MENU_CHROME = [
    { icon: 'fullscreen', title: '화면 전체 보기',
      action: 'fullscreen', x: 94.0, y: 5.4, w: 3.6, h: 6.4 }
  ];

  /* ========================================================== 통합 메뉴 */

  /* 편의 시작 노드가 영상이면 그 영상을 썸네일로 쓴다(첫 컷이 곧 표지). */
  function thumbSrcOf(sc) {
    if (!sc) { return null; }
    if (sc.menu && isStr(sc.menu.thumb)) { return (sc.base || '') + sc.menu.thumb; }
    var n = sc.nodes ? sc.nodes[sc.start] : null;
    if (n && n.type === 'video' && isStr(n.src)) { return (sc.base || '') + n.src; }
    return null;
  }

  function makeThumb(src) {
    var box = document.createElement('span');
    box.className = 'menu-thumb';
    if (!src) { return box; }

    var v = document.createElement('video');
    v.className = 'menu-thumb-v';
    v.setAttribute('preload', 'metadata');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.muted = true;
    v.loop = true;

    // 0프레임은 검은 화면인 경우가 많아 살짝 뒤로 옮겨 첫 컷을 잡는다
    on(v, 'loadedmetadata', function () {
      try { if (v.currentTime < 0.1) { v.currentTime = 0.1; } } catch (e) {}
    });
    on(v, 'error', function () { addClass(box, 'no-thumb'); });

    v.src = src;
    box.appendChild(v);
    return box;
  }

  function makeMenuCard(id, info, ready) {
    var card, thumbSrc = ready ? thumbSrcOf(ALL[id]) : null;

    if (ready) {
      card = document.createElement('a');
      card.className = 'menu-card';
      card.href = '#/' + id;
    } else {
      card = document.createElement('span');
      card.className = 'menu-card is-off';
      card.setAttribute('aria-disabled', 'true');
    }

    card.appendChild(makeThumb(thumbSrc));

    var body = document.createElement('span');
    body.className = 'menu-body';

    var badge = document.createElement('span');
    badge.className = 'menu-badge';
    badge.appendChild(document.createTextNode(info.badge || ''));
    body.appendChild(badge);

    if (!ready) {
      var off = document.createElement('span');
      off.className = 'menu-off';
      off.appendChild(document.createTextNode(M.notReady || '준비 중'));
      body.appendChild(off);
    }

    var label = document.createElement('span');
    label.className = 'menu-label';
    label.appendChild(document.createTextNode(info.label || ''));
    body.appendChild(label);

    if (isStr(info.desc)) {
      var desc = document.createElement('span');
      desc.className = 'menu-desc';
      desc.appendChild(document.createTextNode(info.desc));
      body.appendChild(desc);
    }

    card.appendChild(body);

    // 마우스를 올리면 썸네일이 살짝 움직인다(미리보기).
    // 부담스러우면 아래 두 줄만 지우면 정지 화면으로 돌아간다.
    if (ready && thumbSrc) {
      var vv = card.getElementsByTagName('video')[0];
      on(card, 'mouseover', function () { try { var p = vv.play(); if (p && p['catch']) { p['catch'](function () {}); } } catch (e) {} });
      on(card, 'mouseout',  function () { try { vv.pause(); vv.currentTime = 0.1; } catch (e) {} });
    }

    return card;
  }

  function renderMenu() {
    setText(dom.menuTitle, M.title || '');
    setText(dom.menuSub,   M.subtitle || '');
    setText(dom.menuHint,  M.hint || '');

    empty(dom.menuList);
    menuCards = [];

    var order = M.order || [], i, id, sc, fb, info, ready, li;
    for (i = 0; i < order.length; i++) {
      id    = order[i];
      sc    = ALL[id];
      ready = !!(sc && sc.nodes);
      fb    = (M.fallback && M.fallback[id]) || {};
      info  = {
        badge: (ready && sc.menu && sc.menu.badge) || fb.badge || '',
        label: (ready && sc.menu && sc.menu.label) || fb.label || id,
        desc:  (ready && sc.menu && sc.menu.desc)  || fb.desc  || ''
      };

      li = document.createElement('li');
      li.className = 'menu-item';
      var card = makeMenuCard(id, info, ready);
      li.appendChild(card);
      dom.menuList.appendChild(li);
      if (ready) { menuCards.push(id); }
    }

    // 카드 개수에 맞춰 폭을 계산한다(3개든 5개든 알아서 맞는다)
    // ul(무대 폭의 84%) 기준 %. 합이 100% 를 넘으면 줄바꿈되므로 99.6 을 예산으로 쓴다.
    var n = order.length || 1;
    var gap = 2.9, w = (99.6 - gap * (n - 1)) / n;
    var items = dom.menuList.getElementsByTagName('li');
    for (i = 0; i < items.length; i++) {
      items[i].style.width = w + '%';
      items[i].style.marginRight = (i === items.length - 1 ? 0 : gap) + '%';
    }
  }

  function showMenu() {
    clearScreen(false);
    dom.screen.style.display = 'none';
    dom.bg.removeAttribute('src');
    dom.bg.style.display = 'none';

    closeOverlay(false);
    S = null; cid = null; current = null; base = '';
    ratio = 16 / 9;
    fitStage();

    renderChrome(MENU_CHROME);
    renderMenu();

    dom.app.className = 'mode-menu';
    dom.menu.setAttribute('aria-hidden', 'false');
    document.title = M.title || '인터랙티브 영상';
    updateDebug();
  }

  /* ------------------------------------------------------- 화면 초기화 */

  /* 영상 노드를 새로 그리기 전 정리. 팝업(선택 허브)은 여기서 다루지 않는다. */
  function clearScreen() {
    var i;
    for (i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
    timers = [];

    stopAudio();
    stopVideo();

    removeClass(dom.title, 'on');
    removeClass(dom.badge, 'on');
    removeClass(dom.badge, 'has');
    removeClass(dom.loading, 'on');
    // 이전 화면의 글자를 남기면(투명해도) 스크린리더가 계속 읽는다
    empty(dom.title);
    empty(dom.badge);
    forceHideCtrl();
    dom.dim.style.opacity = 0;
    empty(dom.actions);
  }

  /* --------------------------------------------------------- 노드 렌더 */

  function render(node) {
    clearScreen();

    dom.app.className = 'mode-play';
    dom.menu.setAttribute('aria-hidden', 'true');

    // 배경 : bg 를 지정하지 않으면 CSS 그라데이션(theme.css #stage)이 보인다
    if (isStr(node.bg))   { dom.bg.src = base + node.bg; dom.bg.style.display = 'block'; }
    else if (isStr(S.bg)) { dom.bg.src = base + S.bg;    dom.bg.style.display = 'block'; }
    else                  { dom.bg.removeAttribute('src'); dom.bg.style.display = 'none'; }

    // 배지 + 제목
    if (isStr(node.badge)) {
      setText(dom.badge, node.badge);
      addClass(dom.badge, 'has');
      timers.push(setTimeout(function () { addClass(dom.badge, 'on'); }, 60));
    }
    if (isStr(node.title)) {
      setText(dom.title, node.title);
      timers.push(setTimeout(function () { addClass(dom.title, 'on'); }, 60));
    }

    // 딤드
    if (typeof node.dim === 'number' && node.dim > 0) {
      timers.push(setTimeout(function () { dom.dim.style.opacity = node.dim; }, 20));
    }

    // 영상
    if (node.type === 'video') {
      dom.screen.style.display = 'block';
      playVideo(node);
    } else {
      dom.screen.style.display = 'none';
    }

    // 보조 버튼 — 영상 노드는 무대 아래 가운데에 놓는다
    var acts = node.actions || [], i;
    for (i = 0; i < acts.length; i++) {
      (function (a) {
        dom.actions.appendChild(makeButton(a.label, !!a.ghost, function () { go(a.go); }));
      })(acts[i]);
    }
  }

  /* ================================================ 선택 허브 (팝업) */
  /* 허브는 노드가 아니라 '영상 노드 위에 겹치는 팝업' 이다.
     열고 닫아도 영상 플레이어(소스·재생 위치·재생 여부)를 건드리지 않는다.
     그래서 팝업을 닫으면 하던 영상이 그대로 이어진다. */

  function clearChoice() {
    var i;
    for (i = 0; i < ctimers.length; i++) { clearTimeout(ctimers[i]); }
    ctimers = [];
    stopAudio();                       // 팝업이 틀던 나레이션/효과음만 끈다
    dom.choice.setAttribute('data-open', '0');
    dom.choice.setAttribute('aria-hidden', 'true');
    dom.dim.style.opacity = 0;
    empty(dom.question);
    empty(dom.list);
    empty(dom.extra);
  }

  /* 팝업이 떠 있는 동안 밑의 영상을 멈춘다. 소스와 재생 위치는 그대로 둔다. */
  function pauseUnder() {
    if (!hasSource()) { return; }
    try { dom.video.pause(); } catch (e) {}
    forceHideCtrl();      // 멈췄다고 컨트롤바가 팝업 뒤에 남지 않도록
    updateToggle();
  }

  /* 팝업을 열기 전에 재생 중이었을 때만 이어서 튼다.
     사용자가 직접 멈춰 놓고 팝업을 열었다면 멈춘 채로 둔다. */
  function resumeUnder() {
    if (!hasSource()) { return; }
    var v = dom.video, p;
    if (resumeOnClose && v.paused && !v.ended) {
      p = v.play();
      if (p && p['catch']) {
        p['catch'](function () { addClass(dom.tap, 'on'); updateToggle(); showCtrl(false); });
      }
    }
    updateToggle();
    // 여전히 멈춰 있으면 컨트롤바를 띄워 둔다(이어서 볼 수 있도록)
    if (v.paused || v.ended) { showCtrl(false); }
  }

  function openOverlay(id) {
    var node = S.nodes[id];
    if (!node) { return; }

    // 밑에 깔릴 영상이 아직 없으면(주소로 곧장 들어온 경우) 시작 노드를 먼저 띄운다
    var fresh = false;
    if (!current) { showNode(S.start); fresh = true; }

    overlay = id;

    // 닫을 때 이어서 틀지 여부를 '멈추기 전에' 기억해 둔다
    resumeOnClose = fresh || (hasSource() && !dom.video.paused && !dom.video.ended);
    pauseUnder();

    clearChoice();
    renderChoice(node);
    updateChromeState();
    updateDebug();
  }

  /* resume 이 true 일 때만 밑의 영상을 이어서 튼다.
     다른 영상 노드로 넘어가는 길(선택지 클릭·메뉴로 나가기)에서는 false 로 부른다 —
     어차피 곧 새 영상을 걸 것이므로 여기서 옛 영상을 다시 틀면 안 된다. */
  function closeOverlay(resume) {
    if (!overlay) { return; }
    overlay = null;
    clearChoice();
    updateChromeState();
    updateDebug();
    if (resume) { resumeUnder(); }
  }

  /* 팝업만 닫고 영상은 이어서 튼다. 주소도 조용히 영상 노드로 되돌린다
     (주소를 바꾸면 hashchange 가 영상을 다시 틀어 버리므로 quiet 로 한 번 막는다) */
  function dismissOverlay() {
    if (!overlay) { return; }
    closeOverlay(true);
    if (!cid || !current) { return; }
    var h = '#/' + cid + '/' + current;
    if (location.hash !== h) { quiet = true; location.hash = h; }
  }

  function renderChoice(node) {
    setText(dom.question, node.question || '');

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

    // 선택지가 아닌 보조 버튼(예: 질문 다시 보기)
    var acts = node.actions || [];
    for (i = 0; i < acts.length; i++) {
      (function (a) {
        dom.extra.appendChild(makeButton(a.label, !!a.ghost, function () { go(a.go); }));
      })(acts[i]);
    }

    dom.choice.setAttribute('aria-hidden', 'false');
    ctimers.push(setTimeout(function () {
      dom.choice.setAttribute('data-open', '1');
      if (typeof node.dim === 'number' && node.dim > 0) { dom.dim.style.opacity = node.dim; }
      var first = dom.list.getElementsByTagName('button')[0];
      if (first && first.focus) { try { first.focus(); } catch (e) {} }
    }, node.delay || 200));

    playAudio(dom.sfx,  node.sfx,       ctimers);
    playAudio(dom.narr, node.narration, ctimers);
  }

  /* 팝업 바깥을 누르면 닫는다(패널 안쪽은 반응하지 않는다).
     닫히면 클릭이 그대로 통과하므로 아래 영상 컨트롤을 바로 쓸 수 있다. */
  on(dom.choice, 'click', function (e) {
    if (!overlay) { return; }
    var t = e.target || e.srcElement;
    while (t && t !== dom.choice) {
      if (t === dom.panel) { return; }
      t = t.parentNode;
    }
    dismissOverlay();
  });

  /* ------------------------------------------------------------ 라우팅 */
  /*  #/            메뉴
   *  #/c1          c1 의 시작 노드
   *  #/c1/hub      c1 의 hub 노드                                        */

  function goMenu() {
    if (location.hash !== '#/') { location.hash = '#/'; }
    else { showMenu(); }
  }

  function go(nodeId) {
    if (!nodeId || !cid) { return; }
    var h = '#/' + cid + '/' + nodeId;
    if (location.hash !== h) { location.hash = h; }
    else { show(nodeId); }   // 같은 곳 재진입(리셋) 도 허용
  }

  function enterContent(id, nodeId) {
    var sc = ALL[id];
    if (!sc || !sc.nodes) { warn('없는 편 : ' + id); showMenu(); return; }

    if (cid !== id) {
      S = sc;
      cid = id;
      base = S.base || '';
      if (base && base.charAt(base.length - 1) !== '/') { base += '/'; }

      ratio = 16 / 9;
      if (isStr(S.aspect) && S.aspect.indexOf(':') > 0) {
        var p = S.aspect.split(':');
        ratio = parseFloat(p[0]) / parseFloat(p[1]);
      }

      var sv = (S.stage && S.stage.video) || { x: 15.0, y: 21.4, w: 70.0, h: 70.0 };
      dom.screen.style.left   = sv.x + '%';
      dom.screen.style.top    = sv.y + '%';
      dom.screen.style.width  = sv.w + '%';
      dom.screen.style.height = sv.h + '%';

      renderChrome(S.chrome);
      fitStage();
    }

    show(nodeId || S.start);
  }

  /* 목적지가 팝업(choice)이면 팝업만 띄우고, 영상 노드면 팝업을 닫고 새로 그린다 */
  function show(id) {
    var node = S.nodes[id];
    if (!node) { warn('알 수 없는 노드 : ' + id); node = S.nodes[S.start]; id = S.start; }
    if (node.type === 'choice') { openOverlay(id); return; }
    closeOverlay(false);
    showNode(id);
  }

  function showNode(id) {
    var node = S.nodes[id];
    current = id;
    document.title = (node.title ? node.title + ' — ' : '') + (S.title || '');
    render(node);
    updateChromeState();
    updateDebug();
  }

  function readHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    return { content: parts[0] || null, node: parts[1] || null };
  }

  function route() {
    var r = readHash();
    if (!r.content || !ALL[r.content]) { showMenu(); }
    else { enterContent(r.content, r.node); }
  }

  on(window, 'hashchange', function () {
    // dismissOverlay() 가 주소만 조용히 되돌리는 경우 — 영상을 다시 틀지 않는다
    if (quiet) { quiet = false; return; }
    route();
  });

  /* ------------------------------------------------------------- 키보드 */

  on(document, 'keydown', function (e) {
    var k = e.keyCode || e.which;
    var t = e.target || e.srcElement;
    var tag = t && t.nodeName ? t.nodeName.toUpperCase() : '';
    // 버튼/링크/슬라이더에 포커스가 있을 때는 그쪽 기본 동작을 방해하지 않는다
    var onControl = (tag === 'BUTTON' || tag === 'A' ||
                     t === dom.vbar || t === dom.vvolbar);

    if (k === 27) {                                   // ESC
      // 전체화면 중이면 해제가 우선. 브라우저가 알아서 빠져나오는 경우가 많지만
      // 그렇지 않은 환경(키오스크 셸 등)에서 갇히지 않도록 직접 호출한다.
      if (fsEl()) { leaveFS(); return; }
      if (!S)     { return; }                         // 메뉴에서는 할 일 없음
      if (overlay) { dismissOverlay(); return; }      // 떠 있는 팝업부터 닫는다
      if (S.escapeTo) { go(S.escapeTo); }
      return;
    }

    if (k >= 49 && k <= 57) {                         // 1~9
      var idx = k - 49;
      if (!S) {                                       // 메뉴 : 편 고르기
        if (menuCards[idx]) { location.hash = '#/' + menuCards[idx]; }
      } else if (overlay) {                           // 팝업이 떠 있을 때만 선택지 고르기
        var btns = dom.list.getElementsByTagName('button');
        if (btns[idx]) { btns[idx].click(); }
      }
      return;
    }

    /* ---- 영상 노드에서만 동작하는 재생 단축키 ---- */
    if (!isVideoNode()) { return; }

    if (k === 32 && !onControl) {                     // Space → 재생/일시정지
      togglePlay(); showCtrl(true);
    } else if (k === 82) {                            // R → 다시 보기
      replay();
    } else if (k === 37 && !onControl) {              // ← → 1초 뒤로
      seekBy(-1); showCtrl(true);
    } else if (k === 39 && !onControl) {              // → → 1초 앞으로
      seekBy(1); showCtrl(true);
    } else if (k === 188) {                           // , → 배속 낮추기
      setRate(rate === 2 ? 1 : 0.5); showCtrl(true);
    } else if (k === 190) {                           // . → 배속 높이기
      setRate(rate === 0.5 ? 1 : 2); showCtrl(true);
    } else if (k === 77) {                            // M → 음소거
      toggleMute(); showCtrl(true);
    } else if (k === 70) {                            // F → 영상 전체화면
      toggleFS(dom.screen);
    } else if (k === 38 && !onControl) {              // ↑ → 음량 +
      setVolume(vol + 0.1); showCtrl(true);
    } else if (k === 40 && !onControl) {              // ↓ → 음량 −
      setVolume(vol - 0.1); showCtrl(true);
    } else {
      return;
    }
    if (e.preventDefault) { e.preventDefault(); }
  });

  /* -------------------------------------------------------------- 디버그 */

  function updateDebug() {
    if (dom.debug.hidden) { return; }
    empty(dom.debug);

    var a = document.createElement('a');
    a.href = '#/';
    a.appendChild(document.createTextNode((S ? '' : '▶') + 'menu'));
    dom.debug.appendChild(a);

    var order = M.order || [], i, id, key;
    for (i = 0; i < order.length; i++) {
      id = order[i];
      if (!ALL[id] || !ALL[id].nodes) { continue; }
      for (key in ALL[id].nodes) {
        if (!ALL[id].nodes.hasOwnProperty(key)) { continue; }
        a = document.createElement('a');
        a.href = '#/' + id + '/' + key;
        a.appendChild(document.createTextNode(
          ((id === cid && (key === current || key === overlay)) ? '▶' : '') + id + ':' + key));
        dom.debug.appendChild(a);
      }
    }
  }

  /* ---------------------------------------------------------------- 부트 */

  function boot() {
    var any = false, k;
    for (k in ALL) { if (ALL.hasOwnProperty(k)) { any = true; break; } }
    if (!any) {
      warn('시나리오를 찾지 못했습니다. index.html 의 content/<id>/scenario.js 를 확인하세요.');
    }
    if (!M.order) {
      // 메뉴 구성표가 없으면 등록된 편을 그대로 순서로 삼는다
      M.order = [];
      for (k in ALL) { if (ALL.hasOwnProperty(k)) { M.order.push(k); } }
    }

    collectRates();
    setRate(rate);
    updateVolUI();

    fitStage();
    on(window, 'resize', fitStage);
    on(window, 'orientationchange', function () { setTimeout(fitStage, 120); });

    if (location.search.indexOf('debug=1') >= 0) { dom.debug.hidden = false; }

    route();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    on(document, 'DOMContentLoaded', boot);
  }

})();
