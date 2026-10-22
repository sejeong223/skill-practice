# Task: T02 상단 그림판 메뉴와 픽셀 편집기

## Status: done

## Goal

월드 1~5의 플레이 중에 그림판을 열어 무료 흰 옷을 픽셀 단위로 그리고, 최대 세 슬롯에 저장할 수 있게 한다.

## Decision Summary

- 사용자 결정: 펜·지우개·채우기·되돌리기, 게임 기본색과 자유 색상 선택기. 세 메뉴는 모든 월드의 플레이 중 사용한다.
- 코드 사실: 상점/카탈로그는 현재 월드 1·2 제한이고 열 때 `pause-requested`를 보낸다. `OwnedItemCatalogDialog`가 Escape·Tab·초점 복귀 패턴을 제공한다.

## Implementation

### I01. 그리기 로직과 편집 화면

- Related Files:
  - `src/game/data/customOutfitPaint.ts` :: 신규 순수 함수 `paintCell`, `eraseCell`, `fillRegion`, `undoChange`, `isPaintableCell`.
  - `src/components/game/CustomOutfitPaintDialog.tsx` :: 신규 클라이언트 대화상자.
  - `src/app/globals.css` :: 그림판·모바일 반응형 픽셀 그리드 스타일.
  - `scripts/custom-outfit-paint.test.mjs` :: 신규, flood fill/마스크/undo 경계 검증.
- **Signatures & Types**: `PaintTool = "pen"|"eraser"|"fill"`; `PaintState={cells:(string|null)[]; undo:(string|null)[][]}`; `paintCell(cells, index, color, mask): cells`; `eraseCell(cells,index,mask): cells`; `fillRegion(cells,index,color,mask): cells`는 상하좌우 연결된 같은 색 셀만 채운다. Undo는 마지막 20변경을 보관한다.
- **Data & Schema Fields**: 그리드 56열×32행, 셀 1792개. null은 흰색. 기본 팔레트는 기존 게임 픽셀 색 8색 이상; `<input type="color">`에서 받는 값은 6자리 hex로 정규화. 편집 가능한 위치는 T01의 흰 옷 마스크 알파 내부뿐이다.
- **Execution Flow / Logic**:
  1. 슬롯 1~3 선택 시 기존 디자인을 불러오거나 빈 흰 옷으로 시작한다.
  2. 포인터를 누르고 움직이면 펜/지우개는 연속 셀을 변경한다. 채우기는 클릭 1회; 마스크 바깥은 무시. 터치 포인터와 키보드 버튼을 지원한다.
  3. 셀 변경 전에 이전 배열을 undo에 넣되 한 번의 드래그는 한 단계로 묶는다. 새 작업 뒤 redo는 제공하지 않는다.
  4. 이미 저장된 슬롯은 ‘덮어쓰기’ 확인 후 저장한다. 저장하지 않은 변경이 있는 상태에서 닫기·Escape·슬롯 변경 시 ‘계속 편집/버리기’ 확인을 띄운다. 취소는 그림판을 유지한다.
  5. 대화상자는 `role=dialog`, `aria-modal=true`, 제목·도구/색상 라벨, Tab 초점 순환과 닫은 뒤 그림판 버튼 초점 복귀를 갖는다.
- **Error & State Transition**: 색상 값이 잘못되거나 셀 수가 다르면 저장 버튼 비활성화/안내; 원래 슬롯은 덮어쓰기 확인 전 유지. 브라우저 새로고침 전 저장하지 않은 편집은 저장하지 않으며 브라우저 기본 이탈 경고를 쓴다.

### I02. 월드 1~5 메뉴·일시정지 연결

- Related Files:
  - `src/components/game/GameShell.tsx` :: `paintOpen`, `handleOpenPaint`, `handleClosePaint`, `handleSaveCustomOutfit`; 상점·카탈로그의 월드 1·2 제한 제거.
  - `src/components/game/GameOverlay.tsx` :: `onOpenPaint` 전달.
  - `src/components/game/Hud.tsx` :: 상단 그림판 아이콘 버튼 추가.
  - `src/game/stages/stageEvents.ts` :: `"paint-state-changed":{open:boolean;closeViaEscape:boolean}` 이벤트 추가.
  - `src/game/scenes/StageScene.ts` :: `paintOpen` 상태를 상점/카탈로그와 동일한 일시정지·Escape 보호에 연결.
  - `src/app/globals.css` :: 상단 5개 버튼이 HUD/보스 체력과 겹치지 않도록 데스크톱·모바일 오른쪽 오프셋과 max-width 조정.
  - `scripts/goodboy-shop-ui.test.mjs` :: 세 메뉴 노출 범위·상호 배제 검사 추가.
- **Signatures & Types**: `handleSaveCustomOutfit(id:CustomOutfitId,cells:(string|null)[]):void`; 저장 시 `updatedAt=new Date().toISOString()`; `paint-state-changed` payload는 기존 shop/catalog 상태 이벤트와 동일 구조.
- **Execution Flow / Logic**: 플레이 중, 인트로 준비 완료, 모든 메뉴 닫힘일 때만 열고 pause; 닫으면 resume. 상점·카탈로그·월드 선택·초기화 확인·그림판은 동시에 열리지 않는다. 컷신/사망/클리어 중에는 열 수 없다. 저장 시 진행 데이터를 즉시 복제·갱신하고 `AutoSaveCoordinator.flush()`한다.
- **Error & State Transition**: 메뉴 닫기에서 저장되지 않은 변경 확인이 열려 있으면 resume하지 않는다. 스테이지 강제 전환/언마운트 때 메뉴 상태와 포커스 리스너를 정리한다. 상점·카탈로그는 월드 3~5에서도 같은 pause/resume 동작을 한다.

## Acceptance Criteria

- [x] 월드 1~5에서 그림판·상점·카탈로그 버튼이 보이고 플레이 중 정상 작동한다.
- [x] 그림판은 흰 옷 내부만 편집하며 네 도구·기본색·자유색이 동작한다.
- [x] 3벌 저장·덮어쓰기 확인·미저장 닫기 확인·Escape·모바일 터치가 동작한다.

## Validation

- `node --test scripts/custom-outfit-paint.test.mjs scripts/goodboy-shop-ui.test.mjs` — 편집 규칙과 메뉴 경계.
- `npx tsc --noEmit && npm run lint && npm run build` — 타입·UI 빌드.
- 브라우저 1280px 및 좁은 모바일 폭에서 버튼·초점·터치·일시정지를 수동 확인.

## Commit Message

```text
feat(그림판): 세 벌까지 그리는 픽셀 편집 메뉴 추가

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P02-pixel-outfit-editor
Task: T02-paint-menu

- 펜 지우개 채우기 되돌리기와 자유 색상 선택 제공
- 모든 월드에서 상점 카탈로그 그림판을 일시정지 메뉴로 열기
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 그리기·메뉴 테스트 6건, TypeScript, ESLint, 빌드, Chrome 1280/390px 메뉴·그리기·저장·닫기 확인
- commit: 이 Task의 한국어 커밋
