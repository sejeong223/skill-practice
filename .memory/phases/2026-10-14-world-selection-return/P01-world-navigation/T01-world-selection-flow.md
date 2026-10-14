# Task: T01 월드 선택·재도전 흐름

## Status: done

## Goal

월드 1 클리어 후 오른쪽 위 월드 선택 아이콘으로 월드 1 또는 월드 2의 첫 스테이지에 이동하고, 선택한 월드·체크포인트를 저장해 새로고침해도 올바른 월드에서 재개한다.

## Decision Summary

- 사용자 결정: 월드 1 선택은 반드시 1스테이지 시작점에서 시작하고, 새로고침은 선택한 월드에서 재개한다.
- 화면: HUD 버튼 순서는 일시정지, 초기화, 월드 선택. 월드 선택은 월드 1 보스 클리어 뒤 제공하며 열려 있는 동안 게임을 멈춘다.
- 저장: 기존 클리어·보상·코인·통계는 유지한다. 월드 1 선택 때 예전 월드 1 체크포인트와 Phaser registry의 스냅샷만 지운다.

## Implementation

### I01. 선택 월드 모델과 복귀 경로

- Related Files:
  - `src/game/core/types.ts` :: `SelectableWorldId`, `ProgressState` — 선택 가능 ID와 저장 필드; modify
  - `src/game/core/constants.ts` :: `createDefaultProgressState` — 기본값; modify
  - `src/game/persistence/migrations.ts` :: `migrateSave` — 저장 값 검증과 이전 저장 호환; modify
  - `src/game/systems/worldSelection.ts` :: `isWorldSelectionUnlocked`, `getWorldStartStageId`, `getSelectedWorldResume` — 해금 조건·시작/재개 대상; new
  - `src/game/scenes/PreloadScene.ts` :: `create` — 저장된 선택 월드 우선 복귀; modify

#### Details

- **Signatures & Types**:
  ```typescript
  type SelectableWorldId = Extract<WorldId, "world-01" | "world-02">;
  interface ProgressState { selectedWorldId: SelectableWorldId | null; }
  function isWorldSelectionUnlocked(progress: Pick<ProgressState, "clearedStages">): boolean;
  function getWorldStartStageId(worldId: SelectableWorldId): "world-01-stage-1" | "world-02-stage-1";
  function getSelectedWorldResume(progress: Pick<ProgressState, "selectedWorldId" | "clearedStages" | "world01CheckpointStageId">):
    { stageId: StageId; resumeCheckpointId?: string } | null;
  ```
- **Data & Schema Fields**: `ProgressState.selectedWorldId`는 `"world-01" | "world-02" | null`; 기본값 `null`은 월드 선택을 쓰지 않은 기존 캠페인 경로를 뜻한다. `migrateSave`는 유효한 두 문자열만 받아들이고 없거나 잘못된 값은 `null`로 바꾼다. 세이브 형식은 기존 `schemaVersion: 2`의 선택 필드 확장으로 유지한다.
- **Execution Flow / Logic**:
  1. `clearedStages.includes("world-01-stage-boss")`만 월드 선택 해금으로 인정한다. 값이 없으면 선택 월드가 저장됐어도 복귀 보정 함수는 `null`을 반환한다.
  2. 월드 1 선택은 `getWorld01Respawn(progress)`를 재사용한다. 선택 순간 체크포인트를 비우므로 첫 진입은 1스테이지, 이후 새 깃발을 밟으면 해당 깃발로 재개한다.
  3. 월드 2 선택은 첫 미클리어 월드 2 스테이지로 재개한다. 전부 클리어했다면 월드 2의 1스테이지로 재개한다. 선택 직후의 이동은 언제나 1스테이지다.
  4. `PreloadScene.create`는 온보딩 완료이고 유효한 선택 월드가 있을 때 해당 스테이지로 직접 간다. 값이 `null`인 오래된 저장의 월드 1 클리어/월드 2 진입 연출 복원은 그대로 유지한다.

### I02. Phaser Scene 전환과 저장 동기화

- Related Files:
  - `src/game/stages/stageEvents.ts` :: `StageEventMap` — 선택 요청·완료 이벤트; modify
  - `src/game/scenes/StageScene.ts` :: `create`, `setPaused`, shutdown listener — 해금 검증·체크포인트 제거·새 Scene 시작; modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: `constructor` — 선택 완료 즉시 저장; modify
  - `src/components/game/GameShell.tsx` :: `cloneProgress`, `stage-started` listener — 선택 필드 UI 반영 및 자연 진행 때 월드 갱신; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface StageEventMap {
    "world-selection-requested": { worldId: SelectableWorldId };
    "world-selection-committed": { worldId: SelectableWorldId };
  }
  ```
- **Data & Schema Fields**: `world-selection-requested`는 React → Phaser, `world-selection-committed`는 Phaser → React/AutoSave. 플레이어의 기존 `ProgressState` 공유 객체를 수정하므로 다른 저장 배열을 복제하거나 리셋하지 않는다.
- **Execution Flow / Logic**:
  1. Scene의 요청 리스너는 보스 클리어가 확인되고 전환이 이미 시작되지 않았을 때만 처리한다. 선택 월드가 현재 월드여도 첫 스테이지에서 새로 시작한다.
  2. 처리 시작 시 `stageTransitionStarted = true`, 선택 필드 저장. 월드 1이면 `world01CheckpointStageId = null`과 registry의 `world01CheckpointSnapshot`을 제거한다.
  3. `world-selection-committed`를 발생시켜 `AutoSaveCoordinator.flush()`가 즉시 저장하고 `GameShell`이 창과 UI를 갱신하게 한다. 이어서 기존 `setPaused(false)`로 물리·오디오 정지를 풀고 `this.scene.start("StageScene", {stageId: getWorldStartStageId(worldId), playerName: progress.playerName})`를 호출한다.
  4. 새 스테이지가 실제로 다른 월드에 진입하면 `GameShell`의 기존 `stage-started` 처리에서 `selectedWorldId`를 변경하고 저장한다. 월드 1 재클리어 후 월드 2 진입도 반영한다. 아직 선택한 적이 없는 `null` 저장은 자연 진행 중 그대로 `null`로 남겨 기존 복원 방식을 유지한다.
  5. 취소 시 `pause-requested({paused:false})`만 발생시키고 저장/스테이지는 건드리지 않는다.

### I03. HUD 아이콘과 월드 선택 대화상자

- Related Files:
  - `src/components/game/Hud.tsx` :: `Hud`, `HudProps` — 월드 선택 SVG 아이콘과 이름; modify
  - `src/components/game/GameOverlay.tsx` :: `GameOverlay`, `GameOverlayProps` — 버튼 조건과 클릭 전달; modify
  - `src/components/game/GameShell.tsx` :: `GameShell` — 대화상자·일시정지·현재 월드; modify
  - `src/components/game/WorldSelectDialog.tsx` :: `WorldSelectDialog` — 월드 1/2, 현재 월드 표시, 취소; new
  - `src/app/globals.css` :: HUD 우측 버튼·보스 하트·대화상자 선택자 — 위치 및 반응형 스타일; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface WorldSelectDialogProps {
    currentWorldId: SelectableWorldId;
    onSelect: (worldId: SelectableWorldId) => void;
    onCancel: () => void;
  }
  interface HudProps { worldSelectUnlocked: boolean; onOpenWorldSelect: () => void; }
  interface GameOverlayProps { worldSelectUnlocked: boolean; onOpenWorldSelect: () => void; }
  ```
- **Data & Schema Fields**: 다이얼로그는 컴포넌트 상태만 사용한다. `role="dialog"`, `aria-modal="true"`, 제목 연결, 포커스 가능한 버튼, 현재 월드 표시를 제공한다. 월드 선택 아이콘은 16×16 인라인 SVG의 지도/위치 표시 형태로 제작한다.
- **Execution Flow / Logic**:
  1. 보스 클리어 기록이 있을 때만 HUD에 버튼을 렌더링한다. `GameShell`은 플레이 중 버튼 클릭으로 `worldSelectOpen=true` 후 `pause-requested({paused:true})`를 보낸다.
  2. 월드 선택 창이 열린 동안 기존 `PauseOverlay`는 숨기고 `GameOverlay`의 `inert={paused}`를 유지한다. 다이얼로그는 `GameOverlay` 바깥에 렌더링한다.
  3. CSS에서 버튼 오른쪽 좌표를 일시정지 `100px`, 초기화 `58px`, 월드 선택 `16px`로 두고 보스 하트는 버튼을 가리지 않도록 왼쪽으로 옮긴다. 작은 화면의 HUD 폭도 세 버튼과 하트 공간을 반영한다.
  4. 월드 선택/취소 버튼은 클릭과 Enter/Space로 작동한다. 현재 월드도 선택 가능하며 선택 시 1스테이지로 다시 시작한다.

### I04. 회귀 테스트

- Related Files:
  - `scripts/world-selection.test.mjs` :: 저장·복귀·해금 테스트 — new

#### Details

- Node `node:test`와 기존 TypeScript CommonJS 변환 방식으로 테스트한다. 보스 클리어 전 잠금, 월드 1 첫 시작/새 깃발 재개, 월드 2 첫 미클리어 스테이지 재개, 이전 저장의 `null`, 잘못된 저장 값 무시, 보스 클리어·코인·스킬 보존과 선택 후 저장 왕복을 검증한다.
- `scripts/stage-progression.test.mjs`, `scripts/world01-respawn.test.mjs` 회귀를 함께 실행한다. UI 배치는 타입·lint·빌드 검사 후 실제 화면에서 버튼 순서와 겹침을 확인한다.

## Acceptance Criteria

- [x] 월드 1 보스 클리어 후 HUD 오른쪽 위에 일시정지, 초기화, 월드 선택 순서로 보이고 기존 기능이 작동한다.
- [x] 월드 2에서 월드 1을 선택하면 1스테이지 시작점에서 플레이하며 기존 클리어/보상/자산을 잃지 않는다.
- [x] 새로고침하면 선택 월드에서 재개하고, 월드 1 새 체크포인트를 밟으면 그 위치에서 복귀한다.
- [x] 월드 선택 창 취소 후 게임이 재개되고, 월드 선택 시 중복 전환이나 뒤쪽 게임 조작이 일어나지 않는다.
- [x] 월드 1 보스 클리어 전에는 선택 기능이 열리지 않고 기존 저장 데이터는 이전 복귀 경로를 따른다.

## Validation

- `node --test scripts/world-selection.test.mjs scripts/stage-progression.test.mjs scripts/world01-respawn.test.mjs` — 선택/저장/기존 진행 회귀 통과
- `npx.cmd tsc --noEmit` — 타입 오류 0건
- `npm.cmd run lint` — ESLint 오류 0건
- `npm.cmd run build` — Next.js 프로덕션 빌드 통과

## Commit Message

```text
feat(game): 월드 선택과 클리어 월드 재도전 추가

Plan: 2026-10-14-world-selection-return
Phase: P01-world-navigation
Task: T01-world-selection-flow

- 월드 선택 아이콘과 대화상자를 HUD 오른쪽 위에 연결
- 월드 1 첫 스테이지 재도전과 선택 월드 저장·복귀 구현
- 월드 선택 및 기존 진행 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이번 Task 커밋

## Validation Result

- 자동 테스트 14건 통과. 타입 검사, ESLint, Next.js 프로덕션 빌드 통과.
- Chrome 브라우저에서 월드 2 HUD의 세 아이콘 순서, 월드 선택 대화상자, 월드 1 첫 스테이지 이동, 코인·보스 클리어 보존, 체크포인트 초기화, 월드 1 새로고침 복귀, 취소 후 재개, 월드 2 복귀를 확인했다.
- 브라우저 확인은 데스크톱 크기에서 수행했다. 실제 모바일 터치 확인은 별도로 수행하지 않았다.
