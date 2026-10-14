# Task: T01 월드 1 시작 지점 목록과 재도전

## Status: done

## Goal

월드 1 카드를 눌러 `처음부터 → 체크포인트 1 → 체크포인트 2 → 보스전` 세로 목록을 열고, 고른 지점에서 플레이·사망·새로고침 복귀가 일관되게 작동하게 한다.

## Decision Summary

- 실제 월드 1 체크포인트는 `world-01-stage-2-checkpoint`와 `world-01-stage-4-checkpoint` 두 개다. 선택 시 깃발 위치로 이동하고 그 지점을 새 저장 복귀 지점으로 삼는다.
- 보스 직접 선택은 패배·새로고침 때 보스전에서 다시 시작한다. 기존 클리어, 스킬, 코인, 장비는 유지한다.
- 월드 2 카드는 현재처럼 바로 월드 2의 1스테이지를 시작한다.

## Implementation

### I01. 지점 데이터와 저장 형식

- Related Files:
  - `src/game/core/types.ts` :: `World01ReplayPoint`, `WorldSelectionRequest`, `ProgressState` — 선택 지점과 보스 직접 재도전 플래그; modify
  - `src/game/core/constants.ts` :: `createDefaultProgressState` — 플래그 기본값; modify
  - `src/game/persistence/migrations.ts` :: `migrateSave` — 이전 저장과 잘못된 플래그를 보정; modify
  - `src/game/systems/worldSelection.ts` :: `getWorld01ReplayTarget`, `getSelectedWorldResume` — 지점→Scene 데이터와 새로고침 대상 계산; modify
  - `src/game/scenes/PreloadScene.ts` :: `create` — 기존 `getSelectedWorldResume` 반환값을 그대로 사용; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type World01ReplayPoint = "start" | "checkpoint-1" | "checkpoint-2" | "boss";
  type WorldSelectionRequest =
    | { worldId: "world-01"; point: World01ReplayPoint }
    | { worldId: "world-02" };
  interface ProgressState { world01BossReplayActive: boolean; }
  function getWorld01ReplayTarget(point: World01ReplayPoint): {
    stageId: "world-01-stage-1" | "world-01-stage-2" | "world-01-stage-4" | "world-01-stage-boss";
    resumeCheckpointId?: string;
    checkpointStageId: World01CheckpointStageId | null;
    bossReplayActive: boolean;
  };
  ```
- **Data & Schema Fields**: `world01BossReplayActive`는 `boolean`, 기본값 `false`; 이전 저장에서 누락되거나 `true` 이외의 값이면 `false`로 마이그레이션한다. 현재 `schemaVersion: 2`의 추가 선택 필드로 유지한다. `selectedWorldId`와 `world01CheckpointStageId`는 기존 필드를 사용한다.
- **Execution Flow / Logic**:
  1. 네 지점의 시작 Scene은 각각 `world-01-stage-1`, `world-01-stage-2`, `world-01-stage-4`, `world-01-stage-boss`다.
  2. 체크포인트 1/2는 각각 `resumeCheckpointId`를 `world-01-stage-2-checkpoint`/`world-01-stage-4-checkpoint`로 지정하고 `checkpointStageId`를 해당 스테이지로 설정한다. `처음부터`와 `보스전`은 체크포인트를 `null`로 둔다.
  3. `getSelectedWorldResume()`는 월드 1 선택 저장의 `world01BossReplayActive`가 참일 때 보스 Scene을 반환하고, 그 외에는 기존 `getWorld01Respawn()`을 사용한다. 월드 2와 월드 선택 전 이전 저장 경로는 그대로 둔다.
  4. 보스 직접 재도전 상태는 보스전 선택에서만 `true`가 된다. 다른 월드/지점 선택, 보스 재클리어 뒤에는 `false`가 된다.

### I02. 이벤트와 실제 Scene 전환·사망

- Related Files:
  - `src/game/stages/stageEvents.ts` :: `StageEventMap["world-selection-requested"]` — 요청 payload 세분화; modify
  - `src/game/scenes/StageScene.ts` :: 월드 선택 리스너, `restartAtWorldCheckpoint`, `handleCalicoThirdHit`, `handleCalicoDefeat` — 체크포인트 진입과 보스 반복 재시작; modify
  - `src/components/game/GameShell.tsx` :: `handleSelectWorld` — 세분화된 요청 전달; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface StageEventMap { "world-selection-requested": WorldSelectionRequest; }
  const handleSelectWorld: (selection: WorldSelectionRequest) => void;
  ```
- **Data & Schema Fields**: 요청은 discriminated union을 사용한다. 월드 1만 `point`가 필수이며 월드 2에는 `point`가 없다. 완료 이벤트 `world-selection-committed: {worldId: SelectableWorldId}`는 저장 및 UI 갱신을 위해 유지한다.
- **Execution Flow / Logic**:
  1. 기존 보스 클리어 검증과 `stageTransitionStarted` 중복 전환 방지를 유지한다.
  2. 월드 1을 고르면 `getWorld01ReplayTarget(selection.point)`로 목표를 얻고 `selectedWorldId`, 체크포인트 필드, 보스 재도전 플래그를 설정한다. 모든 월드 1 재선택에서 registry `world01CheckpointSnapshot`은 제거하여 예전 맵 상태가 새로운 지점에 섞이지 않게 한다.
  3. 월드 2를 고르면 `selectedWorldId="world-02"`, `world01BossReplayActive=false`, 목표 `world-02-stage-1`. 진행 자산은 손대지 않는다.
  4. `world-selection-committed`를 발생시켜 현재 `AutoSaveCoordinator.flush()`가 변경된 필드를 바로 저장하게 한다. 일시정지를 풀고 목표 `StageScene`을 `resumeCheckpointId`와 함께 시작한다.
  5. 보스 직접 재도전 상태에서 보스 패배 이벤트는 `checkpointId:null`을 사용하고 `restartAtWorldCheckpoint()`는 약 900ms 후 `world-01-stage-boss` Scene 자체를 다시 시작한다. 보스 HP·패턴이 초기화되도록 현재 Scene에서 플레이어만 리셋하지 않는다.
  6. 보스 재클리어 성공 시 보스 직접 재도전 플래그를 끄고 선택 월드가 월드 1이면 월드 2로 갱신한 다음 기존 `runtime.complete()` 및 해금/클리어 화면 순서를 유지한다.

### I03. 세로 목록과 작은 화면

- Related Files:
  - `src/components/game/WorldSelectDialog.tsx` :: `WorldSelectDialog`, `WorldSelectDialogProps` — 월드 1 하위 목록, 뒤로가기, 포커스 이동; modify
  - `src/app/globals.css` :: `.world-select-checkpoints`, `.world-select-dialog` — 세로 옵션과 화면 높이 제한; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface WorldSelectDialogProps {
    currentWorldId: SelectableWorldId;
    onSelect: (selection: WorldSelectionRequest) => void;
    onCancel: () => void;
  }
  ```
- **Data & Schema Fields**: `view: "worlds" | "world-01"`은 다이얼로그 내부 React 상태만 사용하며 저장하지 않는다. `WORLD01_REPLAY_OPTIONS`는 `point`, `label`, `detail`을 가진 순서 고정 배열이다.
- **Execution Flow / Logic**:
  1. 처음에는 기존 월드 1/2 카드 두 개를 표시한다. 월드 1 카드는 하위 목록으로 이동하고 월드 2 카드는 바로 선택 이벤트를 보낸다.
  2. 월드 1 하위 목록은 `처음부터`, `체크포인트 1`, `체크포인트 2`, `보스전`을 한 열로 렌더링하고 각 체크포인트의 스테이지 번호를 작은 설명으로 보여준다. 뒤로가기와 취소를 제공한다.
  3. 화면 전환 시 첫 항목에 키보드 포커스를 옮긴다. 기존 Esc 취소와 원래 포커스 복귀를 유지한다.
  4. 작은 화면에서 네 항목이 넘치면 다이얼로그 내부만 세로 스크롤한다. 기존 HUD 버튼과 월드 2 직접 이동 UI는 유지한다.

### I04. 의미 있는 회귀 검증

- Related Files:
  - `scripts/world-selection.test.mjs` :: 지점 매핑·저장 복귀 테스트 — modify

#### Details

- 네 선택 지점의 정확한 `stageId`/`resumeCheckpointId`/저장 필드를 비교한다. 체크포인트 선택 이후 월드 1 새로고침 복귀, 보스 선택 이후 새로고침 복귀, 이전 저장의 플래그 `false` 보정, 보스 클리어 전 월드 선택 잠금과 보유 자산 보존을 확인한다.
- 브라우저에서 월드 1 카드→세로 4항목→체크포인트 1/2 실제 깃발 근처 진입→보스전 진입·새로고침, 월드 2 직접 이동과 취소 동작을 확인한다.

## Acceptance Criteria

- [x] 월드 1을 누르면 네 지점이 지정 순서로 한 열에 보이며 월드 2는 기존처럼 직접 이동한다.
- [x] 체크포인트 1/2 선택 시 각각 2/4스테이지의 실제 깃발 위치에서 시작한다.
- [x] 보스전을 직접 고르면 보스전에서 시작하고 패배·새로고침 후에도 보스전에서 재도전한다.
- [x] 시작 지점 변경 뒤 예전 스냅샷이 섞이지 않고 코인·클리어·스킬·장비는 유지된다.
- [x] 뒤로가기·취소·키보드 포커스가 동작하고 세로 목록은 작은 화면에서 스크롤 가능하다.

## Validation

- `node --test scripts/world-selection.test.mjs scripts/world01-respawn.test.mjs scripts/stage-progression.test.mjs` — 지점 선택·저장·기존 복귀 회귀 통과
- `npx.cmd tsc --noEmit` — 타입 오류 0건
- `npm.cmd run lint` — ESLint 오류 0건
- `npm.cmd run build` — Next.js 프로덕션 빌드 통과

## Commit Message

```text
feat(game): 월드 1 재도전 시작 지점 선택 추가

Plan: 2026-10-14-world01-replay-entry-selection
Phase: P01-replay-entry
Task: T01-entry-list-and-respawn

- 월드 1 시작·두 체크포인트·보스전을 세로 목록으로 제공
- 선택 지점 저장 복귀와 보스전 직접 재도전 연결
- 월드 선택 및 기존 진행 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 자동 테스트 16건, 타입 검사, 린트, 빌드. Chrome에서 두 깃발·보스전 진입, 저장 복귀, 보스 패배 재도전, PC 전체 목록 및 모바일 스크롤 확인.
- commit: `dba6ff7`
