# Task: T02 월드 3 마지막 체크포인트 부활

## Status: done

## Goal

월드 3 일반 스테이지에서 체크포인트 깃발을 지난 뒤 장애물·철근·꺼지는 바닥 등 어떤 이유로 죽어도 현재 스테이지의 마지막 활성 체크포인트(x=2496, 바닥 y=504)로 부활한다. 아직 지나지 않았을 때만 스테이지 시작점(x=96)을 쓴다.

## Decision Summary

- 현재 `StageRuntime`은 일반 스테이지 체크포인트를 만들고 `RestartController`는 `CheckpointSystem.getRespawnPosition() ?? spawn`을 쓴다. 시작점 부활의 원인이 접촉 활성화 누락인지 스냅샷 소실인지는 정적 코드만으로 확정되지 않았으므로 **활성 이벤트→스냅샷→사망 직전 상태→부활 좌표**를 검증한다.
- 월드 3에서는 코기의 중심이 체크포인트 x를 통과하면 점프 중이어도 활성화한다. 기존 물리 overlap도 유지하되 같은 체크포인트에서 이벤트·효과음은 한 번만 낸다. 여러 다른 ID가 존재할 때는 가장 나중에 도달한 체크포인트 스냅샷이 최신 위치다.

## Implementation

### I01. 월드 3 체크포인트 통과 판정

- Related Files:
  - `src/game/systems/world03CheckpointCrossing.ts` :: `shouldActivateWorld03Checkpoint`, `World03CheckpointCrossingInput` — 스테이지·x좌표·활성 상태를 검사하는 순수 함수; new
  - `src/game/scenes/StageScene.ts` :: `StageScene.update`, `StageScene.activateCheckpoint`, `StageScene.activateWorld03CheckpointByCrossing`, `getCheckpointSpawn` — 플레이어 이동 직후, 위험물 처리 전에 체크포인트 통과를 보강; modify
  - `src/game/stages/StageRuntime.ts` :: `StageRuntime.addCheckpoint` — 기본 체크포인트가 섹션 4 시작 x2496에 생성되는 계약 확인; read-only
  - `src/game/stages/StageEntityFactory.ts` :: `createCheckpoint` — 현재 바닥 부활 좌표 y504와 깃발/overlap 생성 확인; read-only
  - `src/game/data/worlds.ts` :: `createStageMap`, `createNormalStage` — 체크포인트 ID와 맵 x2496 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface World03CheckpointCrossingInput {
    readonly stageId: StageId;
    readonly playerCenterX: number;
    readonly checkpointX: number;
    readonly latestActiveX: number | null;
  }
  function shouldActivateWorld03Checkpoint(input: World03CheckpointCrossingInput): boolean;
  private activateWorld03CheckpointByCrossing(): void;
  private activateCheckpoint(checkpointId: string): void; // 기존 함수를 재사용
  ```
- **Data & Schema Fields**:
  - `checkpointId`: `${stageId}-checkpoint`. 현재 월드 3 스테이지 1~4 각각 하나이고 `CheckpointSnapshot`에는 `stageId`, `checkpointId`, `x=2496`, `y=504`, `facing`, `randomSeed`, `mapSnapshot` 등이 남는다.
  - `latestActiveX`: `CheckpointSystem.getSnapshot()?.x ?? null`. 저장 스키마를 새로 만들지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 순수 함수는 `/^world-03-stage-[1-4]$/`에만 true 가능하고, 두 x가 유한수여야 한다. `playerCenterX < checkpointX` 또는 `latestActiveX !== null && checkpointX <= latestActiveX`면 false다. `stage-boss`와 타 월드는 영향을 받지 않는다.
  2. Core Processing: `StageScene.update`의 `playerController?.update(time, delta)` 다음, `world03CollapsingFloor`/`world03Obstacles`/`world03SteelBeamDrops` 처리 전에 `activateWorld03CheckpointByCrossing()`을 호출한다. 이 메서드는 `runtime.getEntities("checkpoint")`에서 `respawnPosition.x`가 현재 코기 중심 이하인 후보를 오름차순으로 보고, helper가 true인 가장 오른쪽 후보 ID에 기존 `activateCheckpoint(id)`를 호출한다. 기존 물리 overlap은 그대로 두며 `activateCheckpoint`가 스냅샷·오디오 이벤트·맵 상태 저장을 한 경로에서 처리한다.
  3. Error & Exception Handling: 체크포인트 엔터티나 `respawnPosition`이 없으면 조용히 반환한다. x가 NaN이면 활성화하지 않는다. 점프로 overlap을 건너뛰어도 중심 x 통과로 활성화하되 깃발보다 먼저 먼 거리에서 활성화하지 않는다. 같은 ID가 이미 활성화되었으면 다시 호출하지 않는다.
  4. State Transition & Return: 통과 전 `snapshot=null/runtime.checkpointId=null`, 통과 후 최신 `snapshot`과 `runtime.checkpointId`가 일치한다. 이후 DeathSystem → RestartController 경로는 이미 활성화한 스냅샷 x/y를 부활 위치로 사용한다.

### I02. 최근 체크포인트 스냅샷 유지

- Related Files:
  - `src/game/systems/CheckpointSystem.ts` :: `CheckpointSystem.activate`, `getRespawnPosition`, `resetForStage` — 같은 ID 중복은 막고 다른 ID는 최신 스냅샷으로 갱신; modify
  - `src/game/systems/RestartController.ts` :: `restartAtCheckpointOrSpawn` — `getRespawnPosition() ?? spawn`과 월드 1 별도 우회 경로 확인; read-only
  - `src/game/systems/DeathSystem.ts` :: `handleDeath` — 사망 원인에 관계없이 동일 RestartController를 호출하는 경로 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  CheckpointSystem.activate(
    checkpointId: string, x: number, y: number, facing: 1 | -1,
    now: number, options?: { readonly silent?: boolean },
  ): boolean;
  CheckpointSystem.getRespawnPosition(): CheckpointSnapshot | null;
  RestartController.restartAtCheckpointOrSpawn(): void;
  ```
- **Data & Schema Fields**:
  - `snapshot.checkpointId`: 현재 최신 ID. 같은 ID 중복 접촉은 false, 다른 실제 ID는 새 `x/y/facing/randomSeed/mapSnapshot`으로 교체한다. `isFakeCheckpoint(id)===true`는 여전히 false다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 현재 `if (this.snapshot || isFake)`는 첫 체크포인트만 허용한다. 이를 `isFake` 또는 `this.snapshot?.checkpointId === checkpointId`일 때만 거절하도록 변경한다. 현재 월드 3에서는 단일 ID이므로 중복 소리가 나지 않는다.
  2. Core Processing: 다른 ID 도달 시 기존 스냅샷 생성·runtime 필드 갱신·`checkpoint-reached` 1회 발행을 반복한다. 사망 요청의 `checkpointId`가 무엇이든 RestartController는 **현재 CheckpointSystem 스냅샷**을 선택한다. 월드 1의 `onRestartElsewhere`는 그대로 유지한다.
  3. Error & Exception Handling: 가짜 체크포인트·동일 ID 반복 접촉은 스냅샷/효과음/세이브를 바꾸지 않는다. `resetForStage`는 진짜 스테이지 종료에만 호출하고, 월드 3 시도 재시작에서는 호출하지 않는다. 다른 ID의 스냅샷 복원 뒤에는 그 ID의 중복 접촉도 거절한다.
  4. State Transition & Return: 마지막 활성 체크포인트가 부활 위치와 `restart` 이벤트의 `checkpointId`가 된다. 체크포인트 이전 사망은 기존 시작점으로 돌아간다.

### I03. 부활 원인 분리와 회귀 검사

- Related Files:
  - `scripts/checkpoint-feedback.test.mjs` :: `CheckpointSystem 활성화` — 같은 ID 중복/다른 ID 최신 갱신/가짜 ID 검사; modify
  - `scripts/world03-checkpoint-respawn.test.mjs` :: `월드 3 통과·사망·부활` — 월드 3 좌표와 `CheckpointSystem`·`RestartController`·`DeathSystem` 연결 검사; new
  - `scripts/death-system.test.mjs` :: `DeathSystem` — 기존 사망 처리 회귀; read-only
  - `.memory/test-plans/2026-10-28-world03-beam-drum-sequence-impact.md` :: `T02 체크포인트 실플레이 결과` — x2496 전후의 부활 좌표 기록; modify

#### Details

- **Signatures & Types**:
  ```javascript
  // 월드 3 스테이지마다 checkpointId = `${stageId}-checkpoint`;
  // activation: x < 2496 -> false, x >= 2496 -> true, repeat -> false
  // after death: player.resetTo({ x: 2496, y: 504 }), restart.checkpointId = checkpointId
  ```
- **Data & Schema Fields**:
  - 테스트는 월드 3 스테이지 1~4, 시작 x96, 체크포인트 x2496/y504, 사망 원인 `trap`, `fall`, `enemy`, 철근의 `gimmickId` 포함 여부를 각각 검사한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 체크포인트 전 사망은 x96, 코기가 2496 바로 전이면 미활성, 2496을 통과하면 활성이다. 높은 점프 중에도 x 기준으로 활성화한다.
  2. Core Processing: 실제 `CheckpointSystem`을 사용한 harness에 `RestartController`와 `DeathSystem`을 연결한다. `phaser`의 `Math.Vector2`와 Player의 `resetTo/clearAllControlOverrides/setFlipX`만 mock하고, 사망 요청 후 player의 최종 x/y·runtime ID·`checkpoint-reached`·`restart` 이벤트를 확인한다. 다른 ID 활성화 테스트에서는 마지막 ID/x가 우선한다.
  3. Error & Exception Handling: 동일 ID overlap이 여러 프레임이어도 `checkpoint-reached` 1회다. 체크포인트 활성 뒤 사망 원인별로 x96으로 돌아가면 Task를 완료하지 않는다. 정적 코드에서 원인을 단정하지 말고 브라우저에서 깃발 통과→활성 이벤트/스냅샷→사망→부활 순서를 확인해 실제 누락 지점을 기록한다.
  4. State Transition & Return: 죽기 전 활성 스냅샷이 남고 재시작 후 동일 위치에 나타난다. 월드 1과 월드 2의 기존 체크포인트 회귀 테스트를 함께 돌린다.

## Acceptance Criteria

- [ ] 월드 3 스테이지 1~4에서 깃발을 지나면 점프 여부와 관계없이 한 번만 활성화된다.
- [ ] 체크포인트 이후 장애물·철근·구덩이·적 사망은 마지막 활성 지점 x2496/y504에서 부활한다. 그 전 사망만 x96에서 부활한다.
- [ ] 다른 ID가 나중에 활성화되면 최신 위치를 사용하고, 월드 1의 별도 스테이지 간 부활 규칙은 유지된다.

## Validation

- `node --test scripts/world03-checkpoint-respawn.test.mjs scripts/checkpoint-feedback.test.mjs scripts/death-system.test.mjs scripts/world03-steel-beams.test.mjs scripts/world03-construction-obstacles.test.mjs scripts/world03-collapsing-floor.test.mjs` — 통과 전/후와 각 사망 원인, 다른 월드 회귀 통과.
- `npx.cmd tsc --noEmit` — 타입 오류 없음.
- `npm.cmd run lint` — 오류 없음.
- `npm.cmd run dev` — 격리 테스트 저장의 월드 3 스테이지 1~4에서 깃발을 통과한 뒤 실제 함정 사망과 부활 x좌표를 관찰해 검증 기록에 남김. 인트로 진행이 막히면 T01의 격리된 직접 시작 경로를 사용.

## Commit Message

```text
fix(world03): 마지막 체크포인트에서 다시 부활하도록 보정

Plan: 2026-10-28-world03-beam-drum-sequence-impact
Phase: P01-beam-sequence-impact
Task: T02-checkpoint-respawn

- 월드 3 깃발 통과 시 활성화를 보장하고 최신 체크포인트 스냅샷 유지
- 사망 원인별 체크포인트 부활과 다른 월드 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (수동 플레이 한계는 검증 기록 참조)
- commit: Task 커밋에 포함
