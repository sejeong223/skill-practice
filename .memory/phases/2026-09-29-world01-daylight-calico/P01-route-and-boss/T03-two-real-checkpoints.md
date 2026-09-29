# Task: T03 월드 1의 진짜 체크포인트를 두 곳으로 제한

## Status: pending

## Goal
월드 1 일반 맵 네 개 전체에서 체크포인트를 2단계 x1920과 4단계 x3488의 진짜 체크포인트 두 개만 남긴다. 1·3단계 사망은 해당 맵 시작점, 2·4단계는 활성화된 체크포인트에서 다시 시작하게 한다.

## Decision Summary
- 2단계 체크포인트는 section 3의 중간 x1920, 4단계 체크포인트는 section 4의 보스 입구 직전 x3488이다. 둘 다 가시/가짜 트리거가 아니다.
- 나머지 월드의 일반 맵마다 체크포인트 하나라는 계약은 유지한다. 월드 1만 `[] | [id]`를 허용한다.

## Implementation

### I01. 스테이지·맵 스키마와 생성

- Related Files:
  - `src/game/data/world01Maps.ts` :: `createStageMap`, `requiredObjects`, `sectionDefinitions`; modify
  - `src/game/data/worlds.ts` :: `createNormalStage`; modify
  - `src/game/core/types.ts` :: `StageDefinition.checkpointIds`, `checkpointSectionIndex`; read-only unless union tightening needed
  - `src/game/core/constants.ts` :: `NORMAL_STAGE_CHECKPOINT_COUNT`; read-only
  - `scripts/world01-maps.mjs` :: `verifyMap`, generated object check; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-1.json` through `world-01-stage-4.json` :: generated object layers; modify

#### Details
- **Signatures & Types**:
  ```typescript
  function world01Checkpoint(stageNumber: 1 | 2 | 3 | 4):
    { id: string; x: number; sectionIndex: 3 | 4 } | null;
  // StageDefinition.checkpointIds: readonly string[]; [] for World 1 stages 1/3.
  // StageDefinition.checkpointSectionIndex?: number; undefined for stages 1/3.
  ```
- **Data & Schema Fields**:
  - `world-01-stage-2-checkpoint`: `kind:"checkpoint"`, x1920, width18, height128, y=`getWorld01FloorY(2,1920)-128`, `properties:{trueCheckpoint:true}`, section3 role `checkpoint-gauntlet`.
  - `world-01-stage-4-checkpoint`: same schema at x3488, section4. The position is at least 384px after the last ant and before exit; no hazard touches its respawn bounds.
  - Stages 1/3: `checkpointIds:[]`, no checkpoint object, no `checkpointSectionIndex`, sections 2–4 `gauntlet`. Stage 2: section3 checkpoint role, section4 gauntlet. Stage 4: section4 checkpoint role. All have 192px safe entry/exit.
- **Execution Flow / Logic**:
  1. Build the checkpoint object only from the stage-number lookup; remove old unconditional checkpoint at section4 start. Derive `checkpointIds` and `checkpointSectionIndex` from the same lookup to avoid mismatches.
  2. Generate Tiled JSON via `npm.cmd run world01:maps`. Check Tiled object IDs, positions and `trueCheckpoint` property against the TS map definitions.
  3. Keep `StageRuntime.addCheckpoint` no-op for empty IDs; ensure `StageRuntime.buildFromMap` cannot invent one for stages 1/3. `CheckpointSystem` and `RestartController` should use spawn when ID is null.

### I02. Validator and restart contract

- Related Files:
  - `src/game/data/validateContent.ts` :: `validateContentRegistry`; modify
  - `src/game/data/validateMaps.ts` :: `validateStageMap`, `validateNormalSections`, `validateCampaignMaps`; modify
  - `src/game/stages/StageRuntime.ts` :: `buildFromMap`, `addCheckpoint`; modify if needed
  - `src/game/systems/CheckpointSystem.ts` :: `activate`; read-only
  - `src/game/systems/RestartController.ts` :: `restartAtCheckpointOrSpawn`; read-only
  - `src/game/scenes/StageScene.ts` :: `activateCheckpoint`; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  const expectedWorld01Count = (stageId: StageId): 0 | 1 =>
    stageId === "world-01-stage-2" || stageId === "world-01-stage-4" ? 1 : 0;
  ```
- **Data & Schema Fields**:
  - Normal World 1 expected count derives from stage ID; all other normal stages use `NORMAL_STAGE_CHECKPOINT_COUNT === 1`; boss maps stay 0.
  - A section with role `checkpoint-gauntlet` must hold the one defined checkpoint; a stage with zero IDs must have zero checkpoint objects and zero checkpoint roles. Reject mismatched `section.checkpointId`.
- **Execution Flow / Logic**:
  1. Update both content and map validators, including section-role array; count across four World 1 maps must equal 2. Keep other worlds' constraints untouched.
  2. On real checkpoint overlap, snapshot state as before. When no checkpoint exists, death returns to stage spawn. Checkpoint activation is idempotent and cannot be spoofed by a removed fake checkpoint.
  3. On stage4 entry or return from boss, checkpoint should be truly active only after overlap; T05 will explicitly target this ID when hearts are exhausted.

## Acceptance Criteria
- [ ] World 1 checkpoints exist exactly at stage2 x1920 and stage4 x3488; stages1/3/boss have none and no fake checkpoint.
- [ ] Stage2/4 death after checkpoint activation restarts there; stage1/3 death restarts at spawn. Other worlds retain one normal checkpoint per map.
- [ ] Tiled objects, stage metadata and section roles agree and all validators pass.

## Validation
- `npm.cmd run world01:maps` — regenerate stage object layers.
- `npm.cmd run world01:maps:check` — exactly two genuine checkpoints and zero fake markers.
- `npx.cmd tsc --noEmit` — stage and section types compile.
- `npm.cmd run lint` — validation branch logic passes.
- `npm.cmd run dev` — activate stage2 and stage4 checkpoints, die, and inspect restart coordinates; stage1/3 respawn at entry.

## Commit Message
```text
feat(world01): place two real checkpoints before the boss

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T03-two-real-checkpoints

- Put checkpoints at stage two midpoint and stage four exit approach
- Align map generation, stage metadata and validators
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
