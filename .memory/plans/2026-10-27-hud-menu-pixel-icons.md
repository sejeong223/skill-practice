# Plan: 우측 상단 메뉴 컬러 픽셀 아이콘

## Goal

게임 화면 우측 상단의 그림판·카탈로그·상점·일시정지/재생·진행 초기화·월드 선택 버튼을 20×20 투명 컬러 픽셀 PNG로 구별 가능하게 만든다. 일시정지 중에는 중앙의 `계속하기` 버튼에도 재생 그림을 보여준다. 기존 버튼의 동작·접근성 이름·배치·32×32 크기·메뉴 잠금 조건을 유지한다.

## Confirmed Decisions

- 사용자 지정 그림: 팔레트(그림판), 가방(카탈로그), 상점, 재생/일시정지, 시계방향의 끊어진 원형 화살표(초기화), 접힌 지도(월드 선택). 일시정지 버튼의 두 상태 때문에 PNG는 총 7장이다.
- 모든 그림은 기존 베이지색 버튼 바탕 위에서 읽히도록 짙은 외곽선과 서로 다른 포인트 색을 갖는 투명 픽셀 이미지로 만든다. 글자·버튼 배경·그림자 판은 PNG 안에 그리지 않는다.
- 2026-10-27 사용자 답변: 이번에는 아이콘만 바꾼다. 모바일 버튼의 32×32 터치 영역 확대와 전체 HUD 재배치는 범위에 넣지 않는다.
- `Hud.tsx`의 기존 `aria-label`, `title`, 클릭 핸들러 및 월드 선택 해금 조건은 유지한다. `PauseOverlay.tsx`의 `계속하기` 텍스트와 포커스 복원도 유지한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 7개 컬러 PNG 제작·검증 후 HUD와 일시정지 화면에 연결 | [P01](../phases/2026-10-27-hud-menu-pixel-icons/P01-menu-icons/phase.md) |

## Baseline & Boundaries

- `src/components/game/Hud.tsx`에 16×16 단색 SVG 6종이 있고, `paused` 값에 따라 SVG 재생/일시정지 모양을 바꾼다. `src/app/globals.css`는 버튼 32×32, 패딩 4px, 테두리 2px 및 16×16 SVG 스타일을 사용한다.
- `src/components/game/GameOverlay.tsx`의 부모는 일시정지 중 `inert={paused}`이고 `PauseOverlay`가 HUD 위에 뜬다. 따라서 재생 아이콘은 HUD의 상태 표현뿐 아니라 실제 보이는 중앙 `계속하기` 버튼에도 붙인다.
- 이 아이콘은 React가 `public/assets/pixel/ui/menu-*.png` 경로로 직접 표시한다. Phaser의 `src/game/assets/assetManifest.json`과 게임 저장 스키마는 수정하지 않는다.
- 작업 시작 전부터 다른 기능의 미커밋 파일이 있다. 이 계획의 Task가 지정한 파일과 `.memory` 진행 파일만 커밋하고 기존 수정은 보존한다.
- 실행 Task에서 로컬 Next 가이드 `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`와 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`를 확인한다. 계획 단계에서는 이미지·구현 코드를 생성하지 않는다.
