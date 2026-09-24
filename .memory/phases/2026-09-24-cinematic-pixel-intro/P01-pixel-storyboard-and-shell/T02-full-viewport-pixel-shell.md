# Task: T02 전체 창 게임 셸과 로컬 픽셀 폰트

## Status: in_progress

## Goal

게임 캔버스와 DOM 기반 컷신·타이틀·게임 UI를 하나의 전체 창 16:9 장면 프레임에 정렬하고, 앱에서 보이는 글자를 로컬 한글 픽셀 폰트로 렌더링한다.

## Decision Summary

- 브라우저 콘텐츠 영역은 가득 채우되 Phaser 논리 해상도 1280×720과 16:9 비율은 유지한다. 특이 화면비의 남는 영역은 테마색으로 채운다.
- Google 원격 Geist 폰트를 제거하고 라이선스가 포함된 Galmuri 로컬 폰트를 사용한다. 인트로 이전 페이지 헤더는 제거한다.

## Implementation

### I01. 전체 뷰포트 레이아웃

- Related Files:
  - src/app/page.tsx :: Home — 정적 헤더 제거 및 전체 창 GameShell 호스트; modify
  - src/app/globals.css :: html/body, .game-page, .game-shell, .game-content-frame, .phaser-viewport — 프레임 배치와 반응형 스타일; modify
  - src/components/game/GameShell.tsx :: GameShell — Phaser와 모든 DOM 오버레이를 동일 16:9 자식 프레임 안에 배치; modify
  - src/components/game/PhaserGame.tsx :: PhaserGame — 프레임의 크기를 마운트 요소로 사용; read-only unless measurement fails
  - src/game/config.ts :: GAME_WIDTH, GAME_HEIGHT, scale — 1280×720 + FIT/CENTER_BOTH 보존; read-only unless required

#### Details

- 문서와 body를 너비 100vw, 높이 100dvh로 만들고 margin, 페이지 padding, body flex 여백, 게임 카드 border/radius/shadow, 1280px max-width를 제거한다.
- page.tsx의 game-header, kicker, WORLD 01 레이블을 제거한다. 게임 제목은 컷신 뒤 기존 title overlay에서만 나타나게 한다.
- GameShell은 전체 뷰포트 셸을 유지하고, 그 안에 PhaserGame, CutsceneOverlay, IntroTitleOverlay, GameOverlay, toast, exit button을 동일한 .game-content-frame 안에 둔다.
- .game-content-frame은 position relative, aspect-ratio 16/9, width min(100vw, 177.7778dvh)로 중앙 정렬한다. 이 프레임이 DOM UI와 Phaser 캔버스의 공통 좌표 경계다.
- .game-shell 바탕은 프로젝트 팔레트 색으로 채운다. 16:9에서는 장면 프레임이 viewport를 끝까지 채운다. ultrawide 또는 세로 화면에서는 프레임 비율을 유지하고 남는 영역을 themed letterbox로 둔다.
- canvas는 부모 너비/높이 100%로 배치하고 image-rendering: pixelated를 유지한다. Phaser FIT/CENTER_BOTH 및 논리 크기 1280×720을 바꿔 늘이거나 잘라내지 않는다.
- browser fullscreen API나 사용자 동의 없는 전체화면 전환을 추가하지 않는다.
- title/name, HUD와 패널이 DOM 장면 프레임 기준으로 위치하며 캔버스의 실제 그림 영역에서 벗어나지 않는지 확인한다.

### I02. 로컬 한글 픽셀 폰트

- Related Files:
  - src/app/layout.tsx :: RootLayout — next/font/google 의존성 제거; modify
  - src/app/globals.css :: @font-face, :root, body, button, input, .game-shell — 로컬 폰트 지정; modify
  - public/assets/fonts/Galmuri11-Bold.woff2 — Galmuri 11 Bold 글꼴; new
  - public/assets/fonts/OFL.txt — 해당 배포본 라이선스 전문; new
  - src/components/game/CutsceneOverlay.tsx :: CutsceneOverlay — 텍스트 레이어 픽셀 폰트 적용 확인; modify only if selector is needed
  - src/components/game/IntroTitleOverlay.tsx :: title/name labels and input — 폰트 상속 확인; modify only if needed

#### Details

- 공식 Galmuri 배포본에서 한글 음절을 포함하는 Galmuri 11 Bold 웹 폰트 파일과 OFL-1.1 라이선스 전문을 로컬에 추가한다. 파일 형식/이름이 upstream에서 다르면 실제 파일명에 맞춰 @font-face URL을 일치시킨다.
- family 이름은 Galmuri11Pixel, font-weight는 700으로 고정하고 body와 게임 내 모든 DOM 텍스트, 버튼, 입력 필드가 이 family를 상속하도록 한다.
- next/font/google Geist 및 Geist_Mono import와 html variable class를 제거한다. CSS에 일반 sans-serif 대체를 지정하지 않는다.
- 한글 지원이 없는 글꼴의 Unicode 범위 밖으로 콘텐츠가 빠지는지 확인한다. 인트로 원문, 왕갈비뼈 아이템명, 타이틀, 코기 이름 입력 placeholder, 월드 HUD의 대표 문자열로 글리프를 점검한다.
- 입력창/버튼의 사용자 에이전트 폰트가 별도로 적용되지 않게 font: inherit을 명시한다. 로컬 폰트 로드 실패를 조용한 비픽셀 대체로 숨기지 않고 브라우저 네트워크/폰트 검사에서 드러나게 한다.

## Acceptance Criteria

- [ ] 1920×1080 브라우저 창에서 게임 장면 프레임이 1920×1080으로 테두리·페이지 여백 없이 표시된다.
- [ ] 16:9 외 화면비에서는 장면이 잘리거나 늘어나지 않고 DOM 오버레이가 같은 프레임에 정렬된다.
- [ ] 기존 1280×720 논리 해상도와 pixelArt/roundPixels 설정이 보존된다.
- [ ] 인트로 전 화면에 정적 헤더/제목이 표시되지 않는다.
- [ ] Galmuri 파일과 OFL 라이선스가 로컬에 있고, 지정 문자열의 한글과 버튼/입력이 픽셀 글꼴로 표시된다.

## Validation

- npm.cmd run lint — TypeScript/JSX와 CSS에서 사용하지 않는 font class나 레이아웃 참조 오류가 없어야 한다.
- npm.cmd run build — 원격 폰트 빌드 의존 없이 성공해야 한다.
- npm.cmd run dev — 1920×1080, 2560×1080, 1280×720에서 프레임 크기·여백·DOM/캔버스 정렬을 눈으로 확인한다.
- 브라우저 개발자 도구의 document.fonts.check와 네트워크 패널에서 Galmuri 로드 및 로컬 파일 응답을 확인한다.

## Commit Message

    feat(viewport): 게임을 전체 창 픽셀 프레임으로 표시

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P01-pixel-storyboard-and-shell
    Task: T02-full-viewport-pixel-shell

    - Phaser 캔버스와 DOM 게임 UI를 공통 16:9 프레임에 정렬
    - 로컬 Galmuri 글꼴과 라이선스로 전체 UI 글자를 픽셀화

## Progress

- [ ] 전체 뷰포트 셸 및 aspect-ratio 프레임 구현
- [ ] 로컬 픽셀 폰트 및 라이선스 등록
- [ ] 다중 화면비와 한국어 글리프 확인
- commit: pending
