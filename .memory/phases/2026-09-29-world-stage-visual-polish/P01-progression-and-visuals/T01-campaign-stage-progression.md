# Task: T01 캠페인 스테이지 진행 연결

## Status: done

## Goal
일반 스테이지 출구를 완료하면 다음 STAGE_IDS 항목으로 이동시키고, 새로고침 뒤에도 월드 2 이후 첫 미완료 맵에서 이어 시작한다. 월드 1 보스 승리 대화와 별도 클리어 화면은 계속 거친다.

## Decision Summary
- 캠페인 순서는 src/game/core/constants.ts의 STAGE_IDS 배열을 단일 기준으로 쓴다.
- world-01-stage-boss는 World01StageClearScene이 별도로 처리하므로 StageScene의 일반 출구 전환에서 제외한다.

## Implementation

### I01. 공용 다음 단계 조회와 씬 전환
- Related Files:
  - src/game/core/constants.ts :: STAGE_IDS, getNextStageId; modify
  - src/game/scenes/StageScene.ts :: stage-completed handler; modify
  - scripts/stage-progression.test.mjs :: ordered campaign cases; new
  - package.json :: scripts.test:progression; modify

#### Details
- Add the exported signature getNextStageId(stageId: StageId): StageId | null to constants.ts. It returns the item immediately after stageId in STAGE_IDS; unknown and last IDs return null.
- Remove WORLD01_SEQUENCE from StageScene. On stage-completed, retain the current-stage check and stageTransitionStarted guard, set the runtime to completed, and find the next ID through getNextStageId.
- Return without scheduling a scene change for world-01-stage-boss. Its handleCalicoDefeat flow continues to save the win and open World01StageClearScene after the victory dialogue.
- For every other stage with a next ID, display STAGE CLEAR! and start StageScene with that next stage after 700ms, carrying the current random seed and player name. If there is no next ID, do not start an undefined scene.
- Keep the event listener one-shot through stageTransitionStarted so the exit overlap cannot queue multiple transitions.
- Add Node built-in tests for world-01-stage-1 -> stage-2, stage-4 -> world-01 boss, world-01 boss -> world-02 stage-1 lookup, world-02 stage-1 -> stage-2, world-05 boss -> null, and unknown -> null.

### I02. 캠페인 이어하기 위치
- Related Files:
  - src/game/scenes/PreloadScene.ts :: create; modify
  - src/game/scenes/World01StageClearScene.ts :: world-1 completion handoff; read-only

#### Details
- Compute the first uncleared stage across all STAGE_IDS rather than only the first five.
- When all five World 1 IDs are cleared and the first uncleared stage is world-02-stage-1, open World01StageClearScene so the player can use the existing NEXT STAGE -> action.
- Once a later stage has been cleared, resume at the first uncleared campaign stage. Preserve current intro routing when onboarding is incomplete or required assets fail.

## Acceptance Criteria
- [x] General stage completion advances through all campaign IDs in order, including from World 2 stage 1 onward.
- [x] World 1 boss victory still opens the existing gold clear banner and waits for NEXT STAGE -> before entering World 2.
- [x] Reload after clearing World 2 stage 1 starts World 2 stage 2.
- [x] Repeated exit overlap cannot queue duplicate transitions.

## Validation
- node --experimental-strip-types --test scripts/stage-progression.test.mjs — all route cases pass.
- npx.cmd tsc --noEmit — no type errors.
- npm.cmd run lint — no lint errors.
- npm.cmd run build — production build succeeds.
- Browser scene check — active GameEventBus completion moves World 1 stage 1 to stage 2 and World 2 stage 2 to stage 3; after saving the World 2 stage 2 clear and reloading, PreloadScene resumes stage 3.

## Commit Message
fix(캠페인): 월드 간 스테이지 진행 연결

Plan: 2026-09-29-world-stage-visual-polish
Phase: P01-progression-and-visuals
Task: T01-campaign-stage-progression

- 전체 캠페인 순서로 출구 이후 다음 맵을 시작한다
- 재접속 시 월드 2 이후 첫 미완료 단계를 찾는다

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: Korean T01 commit
