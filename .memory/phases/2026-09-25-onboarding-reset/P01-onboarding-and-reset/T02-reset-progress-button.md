# Task: T02 확인형 저장 진행 초기화 버튼

## Status: done

## Goal
플레이 중 사용자가 일시정지 옆 회전 픽셀 버튼을 눌러 확인한 경우에만 저장된 진행 전체를 제거하고 첫 실행 화면으로 돌아가게 한다.

## Decision Summary
- 새 버튼은 기존 일시정지 버튼과 같은 16×16 crisp-edge SVG 픽셀 스타일을 사용하고 바로 옆에 놓는다.
- 확인 창 문구는 `저장된 진행이 모두 초기화됩니다. 그래도 계속하시겠습니까?`; 취소는 저장 상태를 바꾸지 않는다.
- 확인 시 먼저 autosave listener를 제거한 뒤 기존 `ProgressStore.clear()`를 호출하고 `window.location.reload()`로 최초 실행 상태를 다시 연다.

## Implementation

### I01. HUD 버튼과 초기화 확인 dialog
- Related Files:
  - `src/components/game/Hud.tsx` :: `HudProps`, `Hud` — 일시정지 옆 회전 버튼; modify
  - `src/components/game/GameOverlay.tsx` :: `GameOverlayProps`, `GameOverlay` — 초기화 callback 전달; modify
  - `src/components/game/ResetProgressDialog.tsx` :: `ResetProgressDialogProps`, `ResetProgressDialog` — 접근 가능한 확인 dialog; new
  - `src/app/globals.css` :: HUD 버튼 및 dialog 스타일 — 버튼 배치와 픽셀 표현; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface HudProps {
    readonly onResetProgress: () => void;
    // existing fields remain unchanged
  }

  interface GameOverlayProps {
    readonly onResetProgress: () => void;
    // existing fields remain unchanged
  }

  export interface ResetProgressDialogProps {
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }
  ```
- **Execution Flow / Logic**:
  1. Add a `type="button"` next to the existing pause button; `aria-label="저장된 진행 초기화"`; SVG uses `viewBox="0 0 16 16"`, `shapeRendering="crispEdges"`, and inherited fill color.
  2. Button invokes `onResetProgress`, which only opens the dialog.
  3. Dialog uses `role="alertdialog"`, `aria-modal="true"`, a labelled heading, explanatory text, and `취소` / `초기화` controls.
  4. Cancel closes the dialog without touching autosave or persisted data.
  5. Confirm invokes the parent reset callback. The callback calls `autoSaveRef.current?.destroy()` first (its destroy flushes and unregisters `beforeunload`), then `storeRef.current.clear()`, then `window.location.reload()`.
  6. Style dialog above gameplay overlays with an accessible responsive layout; keep pause button behavior and all other HUD controls unchanged.

### I02. Shell confirmation state and full-save clearing
- Related Files:
  - `src/components/game/GameShell.tsx` :: reset-dialog state, `handleResetProgress`, render — wire confirm/cancel and storage clearing; modify
  - `src/game/persistence/ProgressStore.ts` :: existing `clear()` — remove the combined profile save; read-only unless safe error handling is required by implementation

#### Details
- **Data & Schema Fields**:
  - No new persisted fields. The one `PROGRESS_STORAGE_KEY` envelope already contains player name, deaths, coins, equipment, collectibles, unlocks, cutscene markers, and keybinds.
- **Execution Flow / Logic**:
  1. The reset button appears only as part of the existing gameplay `GameOverlay` after onboarding.
  2. Store dialog visibility in `GameShell` boolean state, initialized `false`.
  3. Passing `onResetProgress` through `GameOverlay` to `Hud` opens the dialog.
  4. Confirmation destroys the existing autosave coordinator before clearing storage; this order prevents its `beforeunload` flush from recreating the deleted save.
  5. Reload starts at defaults, so the opening and name setup appear again.

## Acceptance Criteria
- [ ] A 16×16 crisp-edge rotation icon appears directly beside the pause icon in gameplay.
- [ ] Activating the icon opens a confirmation dialog with the agreed Korean warning.
- [ ] Cancel closes the dialog and preserves the save.
- [ ] Confirm deletes the complete saved progress envelope and reloads into first-time onboarding.
- [ ] Autosave cannot restore the deleted profile during the reload.
- [ ] No other save key or unrelated UI behavior changes.

## Validation
- `npm.cmd run lint` — ESLint completes successfully.
- `npm.cmd run build` — Next.js production build and TypeScript checking complete successfully.

## Commit Message
```text
feat(game-ui): 저장 진행 초기화 버튼 추가

Plan: 2026-09-25-onboarding-reset
Phase: P01-onboarding-and-reset
Task: T02-reset-progress-button

- 일시정지 옆에 픽셀 회전 아이콘과 확인 dialog 추가
- 확인 후 autosave를 멈추고 전체 저장 진행을 삭제
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `0aa8be4`
