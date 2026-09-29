# Task: T07 월드 1 연속 진행·승리 보상·최종 플레이테스트

## Status: pending

## Goal
월드 1의 일반 4개 스테이지를 출구로 차례로 통과해 삼색이 보스로 진입시키고, 승리 대화와 클리어 씬에 이르도록 연결한다. 승리 후 짖기 해금과 클리어 저장을 완료하고, 낮 디자인·장애물·체크포인트·대사·보스 체력·다음 스테이지 버튼을 실제 플레이로 검증한다.

## Decision Summary
- 일반 출구는 다음 월드 1 스테이지로만 연결한다. 보스는 HP 0→승리 대화→클리어 씬 순서이고, `NEXT STAGE ->`를 직접 눌러야 월드 2 첫 스테이지에 들어간다.
- 자동 검사와 수동 플레이 기록을 모두 남긴다. 눈에 보이지 않는 충돌, 막힌 맨홀, 가짜 체크포인트, 하트 중복 차감, 승리 대화 누락은 완료 결함이다.

## Implementation

### I01. 스테이지 순서·저장·보상

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `stage-completed` handler and next-stage transition; modify
  - `src/game/stages/StageRuntime.ts` :: `complete`; modify
  - `src/game/scenes/PreloadScene.ts` :: `create`; modify
  - `src/game/scenes/World01StageClearScene.ts` :: saved-clear resume route; modify if needed
  - `src/game/systems/SkillSystem.ts` :: `unlockAfterBoss`; read-only/use
  - `src/game/persistence/AutoSaveCoordinator.ts` :: stage-completed persistence; read-only/use
  - `src/game/data/cutscenes/worlds.ts` :: T06's eight-beat `world-01-boss-clear`; read-only/use
  - `src/components/game/GameShell.tsx` :: live stage/clear state; modify as needed

#### Details
- **Signatures & Types**:
  ```typescript
  const WORLD01_SEQUENCE: readonly StageId[] = [
    "world-01-stage-1", "world-01-stage-2", "world-01-stage-3",
    "world-01-stage-4", "world-01-stage-boss",
  ];
  // StageRuntime.complete(): idempotently record this.definition.id in
  // progress.clearedStages before emitting "stage-completed".
  ```
- **Data & Schema Fields**:
  - `ProgressState.clearedStages` holds each cleared World 1 stage once; `unlockedSkills` gets `bark` once on calico win; `bankedCoins` receives stage coins once. Keep existing save version and IDs.
  - `StageScene` stage transition carries `stageId`, seed if appropriate, and player name; next stage enters with fresh runtime. A repeated overlap must not double save/reward/transition. The boss exit never completes the stage; boss completion follows T06 victory dialogue only if `World01CalicoBoss.isDefeated()`.
- **Execution Flow / Logic**:
  1. In `StageRuntime.complete`, guard already completed, append stage ID to `clearedStages`, bank coins and emit once. `AutoSaveCoordinator` already listens to `stage-completed`; verify save reflects these changes before transition.
  2. In StageScene, on normal completion start the next ID from `WORLD01_SEQUENCE` after a short visible clear state. Stage4 leads to the boss. When calico HP reaches 0, T06 plays the victory dialogue. After its final beat and before `StageRuntime.complete()`, call `SkillSystem.unlockAfterBoss("world-01-boss")` once. Then record boss clear once and start `World01StageClearScene`; do not skip the dialogue by using the boss exit. Save both clear and skill before `NEXT STAGE ->` can be activated.
  3. In `PreloadScene.create`, resume at the first uncleared World 1 stage when onboarding is complete; if all five are cleared, reopen `World01StageClearScene` so the golden banner/next-stage button are still available after refresh. Reload during an unfinished boss encounter starts a fresh 3-heart fight; the first two damaging hits did not persist or increment death count. Reload after third-hit death resumes the last cleared path without pretending a boss victory was stored.

### I02. Automated and manual acceptance record

- Related Files:
  - `scripts/world01-maps.mjs` :: `verifyMap`; modify if a missing invariant was found in playtest
  - `src/game/data/validateMaps.ts` :: `validateCampaignMaps`; modify if a missing invariant was found in playtest
  - `.memory/test-plans/2026-09-29-world01-daylight-calico.md` :: fill expected/actual results and screenshots; modify
  - `.memory/test-plans/assets/world01-stage1-overview.png` through `world01-stage4-overview.png` :: existing baseline screenshots; read-only

#### Details
- **Signatures & Types**:
  ```text
  Test record columns: case ID | setup | input/path | expected | actual | pass/fail | screenshot/path.
  ```
- **Data & Schema Fields**:
  - Every stage overview includes a full map check and normal-zoom check. Screenshot artifacts must show 2/4 daytime routes, spike/manhole art and 2 checkpoints. Boss shots show first-encounter 8th beat, victory 8th beat/collapse, 12-cell HP, 3→2→1→0 hearts, third-block dogs, stage4 checkpoint return and the golden clear scene.
- **Execution Flow / Logic**:
  1. Run generator check, typecheck, lint and production build after T01–T06. Fix any concrete regression before marking this Task done.
  2. Perform test-plan cases in browser: ant jump without transparent wall; each static danger visibly present; both holes physical; coins optional/recognizable; 2/4 climbability; stage2/stage4 checkpoint restarts; first dialogue; exact 12 hits; fishbone jump/block; third-block surround; two hits continue same fight; third hit returns to stage4; victory dialogue/collapse; golden clear banner; save/reload; manual World 2 button.
  3. Record actual outcomes, screenshots and any remaining limitation in test plan. A failed required case prevents completion; repair in this Task or a clearly scoped follow-up before updating `.memory/current.md` beyond T07.

## Acceptance Criteria
- [ ] Stage1→2→3→4→boss works via normal exits, without F2 or manual URL changes. Boss exit cannot bypass victory dialogue.
- [ ] Boss win unlocks bark once, stores all five clear IDs and saves; reload reopens clear scene. World 2 opens only after `NEXT STAGE ->` input.
- [ ] All automated commands pass and each required playtest case has an actual result and evidence. No invisible wall or sudden hazard remains in World 1.

## Validation
- `npm.cmd run world01:maps:check` — map/catalogue and hole/checkpoint assertions pass.
- `npx.cmd tsc --noEmit` — all TypeScript changes compile.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — production bundle succeeds.
- `npm.cmd run dev` — complete `.memory/test-plans/2026-09-29-world01-daylight-calico.md` manual path, boss damage matrix and victory screen.

## Commit Message
```text
feat(world01): connect calico victory to saved campaign progress

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T07-progression-and-verification

- Link four easy stages to the boss and save bark reward once
- Verify victory dialogue, clear scene and manual next-stage transition
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
