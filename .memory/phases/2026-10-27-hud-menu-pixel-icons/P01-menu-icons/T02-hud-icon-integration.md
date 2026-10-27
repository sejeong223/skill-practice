# Task: T02 HUD 메뉴와 일시정지 화면에 컬러 아이콘 연결

## Status: pending

## Goal

실제 게임 우측 상단의 여섯 메뉴 버튼에서 새 컬러 픽셀 이미지가 보이게 한다. 정지 중에는 `계속하기`에도 재생 그림을 표시하여 재생/일시정지 두 상태를 모두 알아볼 수 있게 하면서 기존 메뉴 동작을 유지한다.

## Decision Summary

- T01의 20×20 RGBA PNG 7장을 React `public` 정적 URL로 사용한다. 사용자가 이번 범위를 아이콘 교체로 정했으므로 32×32 버튼 크기·좌표·모바일 재배치는 변경하지 않는다.
- `GameOverlay`는 일시정지 시 `inert`이고 `PauseOverlay`가 HUD 위에 뜬다. 일시정지 중 플레이 아이콘은 HUD의 상태값에도 매핑하되, 사용자가 실제 누르는 중앙 `계속하기` 버튼에도 표시한다.

## Implementation

### I01. 여섯 HUD 버튼의 SVG를 각 PNG로 교체

- Related Files:
  - `src/components/game/Hud.tsx` :: `Hud`, `HudProps` 및 여섯 메뉴 버튼 — SVG 교체와 상태별 이미지 매핑; modify
  - `src/components/game/GameOverlay.tsx` :: `inert={paused}`, `worldSelectUnlocked`, `Hud` props 전달 계약 확인; read-only
  - `src/components/game/GameShell.tsx` :: 기존 메뉴 핸들러와 `PauseOverlay` 렌더 조건 확인; read-only
  - `public/assets/pixel/ui/menu-palette.png` :: 그림판; read-only (T01 산출물)
  - `public/assets/pixel/ui/menu-bag.png` :: 카탈로그; read-only (T01 산출물)
  - `public/assets/pixel/ui/menu-shop.png` :: 상점; read-only (T01 산출물)
  - `public/assets/pixel/ui/menu-pause.png` :: 플레이 중 일시정지; read-only (T01 산출물)
  - `public/assets/pixel/ui/menu-play.png` :: 정지 중 재생; read-only (T01 산출물)
  - `public/assets/pixel/ui/menu-reset-clockwise.png` :: 초기화; read-only (T01 산출물)
  - `public/assets/pixel/ui/menu-map.png` :: 월드 선택; read-only (T01 산출물)

#### Details

- **Signatures & Types**:
  ```typescript
  export function Hud(props: HudProps): ReactElement;
  // HudProps의 paused: boolean, worldSelectUnlocked: boolean 및 onOpen*/onToggle* 함수는 변경하지 않는다.
  // 각 버튼 내부: <Image src="/assets/pixel/ui/menu-*.png" width={20} height={20}
  //   alt="" aria-hidden="true" draggable={false} unoptimized className="hud-menu-icon" />
  ```
- **Data & Schema Fields**:
  - 매핑: `paint-open-button → menu-palette.png`, `catalog-open-button → menu-bag.png`, `shop-open-button → menu-shop.png`, `pause-button → paused ? menu-play.png : menu-pause.png`, `reset-progress-button → menu-reset-clockwise.png`, `world-select-button → menu-map.png`.
  - 신규 React 상태·저장 필드·Phaser 에셋 키는 없다. 아이콘의 `alt`는 빈 값이고 버튼의 기존 한국어 `aria-label`을 유일한 접근성 이름으로 사용한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01의 7개 파일과 `scripts/hud-menu-icon-assets.test.mjs`가 있는지 확인한다. 로컬 Next 가이드 `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` 및 `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`에서 현재 버전의 `Image`와 `unoptimized` 동작을 확인한다.
  2. Core Processing: `next/image`를 import하고 현재 6개 버튼의 SVG 자식만 매핑된 `Image`로 교체한다. 20×20 원본 PNG가 변형·보간되지 않도록 `unoptimized`를 사용한다. 일시정지 버튼에는 기존 `aria-label` 조건에 맞는 `title={paused ? "계속하기" : "일시정지"}`를 붙인다. `onClick`, `type="button"`, 다른 버튼의 `aria-label`·`title`, 월드 선택 조건부 렌더링을 보존한다.
  3. Error & Exception Handling: 이미지 404 또는 최적화 과정의 흐림은 파일 경로·`unoptimized`·CSS 렌더링을 바로잡는다. PNG를 못 읽을 때 버튼 기능이나 접근성 이름이 사라지지 않아야 한다. 리셋 버튼은 확인 대화상자를 여는 기존 핸들러 그대로 둔다.
  4. State Transition & Return: 플레이 중 여섯 그림이 버튼에 보이고 `paused=true`에서는 pause 버튼의 이미지 src가 재생 PNG로 바뀐다. 메뉴 개폐·초기화 확인·월드 선택 해금 상태는 기존과 동일하다.

### I02. 기존 버튼 크기 안에 선명히 맞추고 실제 재생 버튼에도 이미지 연결

- Related Files:
  - `src/components/game/PauseOverlay.tsx` :: `PauseOverlay`, 중앙 `계속하기` 버튼에 재생 PNG 추가; modify
  - `src/app/globals.css` :: `.pause-button svg, ...` 선택자를 `.hud-menu-icon` 이미지 규칙으로 바꾸고 중앙 버튼의 이미지 정렬; modify
  - `src/components/game/ResetProgressDialog.tsx` :: 초기화 확인/취소 경로 비교; read-only
  - `src/components/game/WorldSelectDialog.tsx` :: 월드 선택 버튼의 기존 열림 조건 비교; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export function PauseOverlay({ onResume }: { readonly onResume: () => void }): ReactElement;
  // CSS: .hud-menu-icon { display:block; width:20px; height:20px;
  //   object-fit:contain; image-rendering:pixelated; }
  ```
- **Data & Schema Fields**:
  - `PauseOverlay`의 텍스트 `계속하기`, 자동 포커스와 이전 포커스 복원은 그대로 둔다. 새 상태·저장 데이터는 없다.
  - 기존 공통 버튼의 `width:32px`, `height:32px`, `padding:4px`, `border:2px`는 유지하므로 내용 공간이 정확히 20×20이다. 모바일 `@media`의 우측 위치 및 헤더 폭은 변경하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `Hud.tsx`에서 SVG 6개가 모두 제거됐는지, `PauseOverlay`가 별도 z-index 15 계층에 있고 부모 `GameOverlay`가 `inert={paused}`인지 확인한다.
  2. Core Processing: CSS의 여섯 `... svg` 규칙을 `.hud-menu-icon` 규칙으로 교체한다. `PauseOverlay`의 `계속하기` 버튼 앞에 동일한 `menu-play.png`를 장식용으로 추가하고 버튼 내부 정렬만 `inline-flex; align-items:center; gap:6px`로 지정한다. 버튼의 크기·텍스트·클릭 동작은 유지한다.
  3. Error & Exception Handling: 아이콘이 보이더라도 텍스트 라벨을 지우거나 이미지 alt에 같은 이름을 다시 넣어 중복 낭독하지 않는다. `PauseOverlay`가 HUD 위에 있으므로 정지 중 우측 상단 버튼 클릭을 테스트 성공 기준으로 삼지 않고 중앙 `계속하기`와 ESC 복귀를 검사한다.
  4. State Transition & Return: 정지 오버레이의 재생 그림과 글자를 누르면 기존처럼 플레이로 돌아간다. 월드 선택 잠금/해금, 리셋 대화상자 취소, 그림판/가방/상점의 열기·닫기 상태는 변화가 없다.

### I03. 화면·상호작용 회귀 확인

- Related Files:
  - `scripts/hud-menu-icon-assets.test.mjs` :: T01의 이미지 규격 검증 재실행; read-only
  - `scripts/world-selection.test.mjs` :: 지도 버튼 조건에 연관된 해금 로직 회귀; read-only
  - `scripts/goodboy-shop-ui.test.mjs` :: 상점/카탈로그/그림판의 공유 메뉴 조건 회귀; read-only

#### Details

- **Signatures & Types**: 새 테스트 헬퍼/모델은 추가하지 않는다. 브라우저 검증은 실제 렌더된 버튼의 이름·이미지·클릭 결과를 관찰한다.
- **Data & Schema Fields**: PNG 경로 7개, 버튼의 기존 한국어 `aria-label` 6개, 플레이/정지 두 UI 상태를 검증 대상으로 사용한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: dev 서버의 실제 게임 화면을 1280×720과 480px 폭에서 확인한다. 월드 선택은 해금 저장 상태에서만 버튼이 나타나는 점을 고려한다.
  2. Core Processing: 일곱 이미지의 로딩/색/픽셀 선명도를 눈으로 보고, 그림판·카탈로그·상점 각각을 열고 닫는다. 일시정지 → 중앙 재생 아이콘 `계속하기` → 복귀, 초기화 아이콘 → 확인 대화상자 → 취소, 해금 상태의 지도 → 월드 선택 → 취소를 확인한다. 키보드 포커스와 한국어 접근성 이름도 확인한다.
  3. Error & Exception Handling: 초기화 대화상자에서 실제 확정은 누르지 않는다. 월드 선택 미해금 상태에서 아이콘이 없는 것은 정상이다. 좁은 화면에서 기존 배치 문제를 아이콘 제작 실패와 혼동하지 않고 관찰만 기록한다.
  4. State Transition & Return: 각 메뉴를 닫으면 게임으로 돌아오고, 새 PNG가 32×32 버튼의 테두리 안에서 잘리지 않는다.

## Acceptance Criteria

- [ ] 우측 상단 여섯 메뉴가 사용자가 지정한 컬러 픽셀 그림으로 표시되고 이미지 404가 없다.
- [ ] 플레이와 일시정지 화면에서 각각 일시정지/재생 그림이 보이며 정지·복귀가 작동한다.
- [ ] 그림판·가방·상점·초기화 확인·해금된 월드 선택의 기존 클릭과 접근성 이름이 유지된다.
- [ ] 32×32 버튼 크기와 모바일 위치·HUD 레이아웃을 변경하지 않는다.

## Validation

- `node --test scripts/hud-menu-icon-assets.test.mjs scripts/world-selection.test.mjs scripts/goodboy-shop-ui.test.mjs` — 이미지와 기존 메뉴 조건 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — React/Next 타입 오류 0개.
- `node node_modules/eslint/bin/eslint.js src/components/game/Hud.tsx src/components/game/PauseOverlay.tsx` — 지정 파일 lint 오류 0개.
- `node node_modules/next/dist/bin/next build` — PNG를 포함한 프로덕션 빌드 통과.
- 실제 브라우저 1280×720·480px에서 일곱 그림, 메뉴 열기/닫기, 정지·재생, 초기화 취소, 월드 선택 조건부 표시 확인.

## Commit Message

```text
feat(ui): 메뉴 버튼에 컬러 픽셀 아이콘 연결하기

Plan: 2026-10-27-hud-menu-pixel-icons
Phase: P01-menu-icons
Task: T02-hud-icon-integration

- 여섯 HUD 버튼의 단색 SVG를 기능별 PNG로 교체
- 계속하기에 재생 그림을 추가하고 기존 동작을 확인
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
