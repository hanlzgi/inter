/* ==========================================================================
 * content/c1/scenario.js — 콘텐츠 패키지 (c1 · 대한민국 임시 정부)
 *
 * 이 파일 하나 + 같은 폴더의 에셋만 교체하면 다른 편이 된다.
 * engine.js 는 손대지 않는다.
 *
 * JSON이 아니라 JS 파일인 이유:
 *   fetch()로 JSON을 읽으면 file:// 로 열었을 때 CORS에 막힌다.
 *   <script> 로 읽으면 웹서버 / 로컬파일 / USB 키오스크 모두에서 동작한다.
 *
 * 등록 방식:
 *   window.SCENARIOS['c1'] 에 자기를 꽂는다. 여러 편이 공존할 수 있다.
 *   주소는 #/c1        → 이 편의 시작 노드
 *          #/c1/hub    → 이 편의 특정 노드
 *
 * 좌표 단위는 모두 % (무대 16:9 = 1920×1080 기준). 시안 판넬을 비례 환산한 값.
 *
 * ★ 영상 파일 : 노드마다 1개씩만 둔다.
 *   전·후반으로 나뉘어 있던 파일을 하나로 합쳐 넣고, 아래 src 를 그 파일명으로
 *   고치면 끝이다(길이가 달라져도 고칠 곳은 없다).
 *      q0 ← 도입   : c1_main-1_1.mp4 + c1_main-1_2.mp4
 *      a1 ← 선택 1 : c1_opt-1_1.mp4  + c1_opt-1_2.mp4
 *      a2 ← 선택 2 : c1_opt-2_1.mp4  + c1_opt-2_2.mp4
 *      a3 ← 선택 3 : c1_opt_3_1.mp4  + c1_opt_3_2.mp4
 *
 * 배경은 이미지가 아니라 css/theme.css 의 #stage 그라데이션이다.
 * 메뉴 썸네일도 이미지가 아니라 시작 영상의 첫 컷을 그대로 쓴다.
 * ========================================================================== */

window.SCENARIOS = window.SCENARIOS || {};

window.SCENARIOS['c1'] = {

  id:    'c1',
  title: '대한민국 임시 정부 인터랙티브 — 내가 김구였다면',
  base:  'content/c1/',        // 아래 모든 경로의 기준
  aspect: '16:9',
  start:  'q0',                 // 메뉴에서 이 편을 고르면 여기부터
  escapeTo: 'hub',              // ESC 키가 향하는 곳

  /* 통합 메뉴에 실릴 정보. thumb 을 안 적으면 start 노드의 영상 첫 컷을 쓴다. */
  menu: {
    badge: '제1편',
    label: '내가 김구였다면',
    desc:  '1931년, 일본인처럼 보이는 청년이 찾아온다'
  },

  /* 영상이 놓이는 자리 */
  stage: {
    video: { x: 15.0, y: 21.4, w: 70.0, h: 70.0 }   /* w == h 이면 정확히 16:9 */
  },

  /* 전 노드에 상시 노출되는 버튼 (아이콘은 CSS 도형) */
  chrome: [
    { icon: 'home',       title: '메뉴로',
      action: 'menu',         x: 2.9,  y: 6.2,  w: 5.9,  h: 10.4 },
    { label: '건너뛰기',  title: '선택지로 건너뛰기',
      go: 'hub',              x: 72.4, y: 11.4, w: 14.6, h: 6.8 },
    { icon: 'fullscreen', title: '화면 전체 보기',
      action: 'fullscreen',   x: 94.0, y: 5.4,  w: 3.6,  h: 6.4 }
  ],

  /* ----------------------------------------------------------- 노드 */
  nodes: {

    /* 도입 질문 영상 */
    q0: {
      type:  'video',
      src:   'video/c1_main-1_1.mp4',
      badge: '1931년',
      title: '내가 김구라면, 일본인처럼 보이는 청년을 만날까?',
      actions: [
        { label: '선택하러 가기', go: 'hub' }
      ]
    },

    /* 선택 허브 */
    hub: {
      type: 'choice',
      dim:  0.25,
      delay: 200,
      question: '김구는 어떤 선택을 하였을까?',
      /* 오디오 파일을 audio/ 에 넣으면 아래 두 줄을 되살린다
      sfx:       { src: 'audio/whoosh.mp3',   delay: 200, volume: 0.7 },
      narration: { src: 'audio/hub_narr.mp3', delay: 800, volume: 0.8 },
      */
      options: [
        { label: '독립운동에 투신하겠다고 했으니 활동을 모의한다.', go: 'a1' },
        { label: '어느 정도 시간을 두고 관찰한 뒤 판단한다.',       go: 'a2' },
        { label: '일제의 간첩일 수 있으므로 제거한다.',            go: 'a3' }
      ]
    },

    /* 결과 영상 — 구조가 완전히 동일하다. 추가는 이 블록 복사로 끝. */
    a1: {
      type:  'video',
      src:   'video/c1_opt-1_1.mp4',
      title: '독립운동에 투신하겠다고 했으니 활동을 모의한다.',
      actions: [ { label: '다시 선택하기', go: 'hub' } ]
    },

    a2: {
      type:  'video',
      src:   'video/c1_opt-2_1.mp4',
      title: '어느 정도 시간을 두고 관찰한 뒤 판단한다.',
      actions: [ { label: '다시 선택하기', go: 'hub' } ]
    },

    a3: {
      type:  'video',
      src:   'video/c1_opt_3_1.mp4',
      title: '일제의 간첩일 수 있으므로 제거한다.',
      actions: [ { label: '다시 선택하기', go: 'hub' } ]
    }

  }
};
