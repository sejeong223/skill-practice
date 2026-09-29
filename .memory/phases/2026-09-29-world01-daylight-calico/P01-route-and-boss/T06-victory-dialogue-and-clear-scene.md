# Task: T06 삼색이 승리 대화와 황금색 클리어 씬

## Status: done

## Goal
삼색이 HP가 0이 되면 공격이 멎고 사용자 제공 승리 대화 8줄을 표시한다. 마지막 문장과 함께 삼색이가 기절한 뒤 별도의 클리어 씬을 띄워 화면 중앙에 큰 황금색 `[STAGE CLEAR!]`와 그 아래 `NEXT STAGE ->`를 표시한다. 사용자가 버튼을 누를 때만 월드 2 첫 스테이지로 이동한다.

## Decision Summary
- 승리는 12번째 실제 근접 슬리퍼 명중으로 발생한다. 보스 출구 접촉은 승리 조건이 아니다. 사망·승리 콜백은 둘 다 한 번만 처리한다.
- 승리 대사 마지막 줄 `삼색이: 말을 마친 후 기절한다.`는 화면에 그 문장을 정확히 표시하는 연출 문장으로 취급하고, 삼색이 기절 프레임과 동기화한다. 첫 관람에는 대사를 건너뛰지 않는다.

## Implementation

### I01. 보스 클리어 대화와 기절 연출

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD_CUTSCENES`, `world-01-boss-clear`; modify
  - `src/game/scenes/StageScene.ts` :: calico defeated callback, victory sequence, cleanup; modify
  - `src/game/systems/World01CalicoBoss.ts` :: `isDefeated`, `stopAttacks`, `showCollapseFrame`; modify
  - `src/game/cutscenes/CutsceneDirector.ts` :: `play`, `advance`, `skip`; read-only/use after T04
  - `src/game/cutscenes/CutsceneTimeline.ts` :: manual advance contract; read-only/use after T04
  - `src/game/assets/assetManifest.json` :: `world-01-calico-boss` 3-frame sheet from T01; read-only/use

#### Details
- **Signatures & Types**:
  ```typescript
  // Script: id "world-01-boss-clear", stageId "world-01-stage-boss", beats.length === 8.
  // StageScene.onCalicoDefeated(): Promise<void>; guarded by victorySequenceStarted.
  // World01CalicoBoss.stopAttacks(): void; showCollapseFrame(): void.
  ```
- **Data & Schema Fields**:
  - Exact eight ordered on-screen lines, one beat each, with `speaker:"calico"` for 삼색이 and `speaker:"corgi"` for 코기:
    1. 삼색이: 윽... 이 둔해보이는 애가 대체 어떻게 날 때린 거냐옹...?!
    2. 코기: 패배자는 말이 없다! 턱시도 그 녀석 어디로 갔냐 멍?!
    3. 삼색이: 칫... 어차피 턱시도 형님을 따라가 봤자 넌 끝이다냥!
    4. 삼색이: 형님은 '동네 놀이터'로 가셨다냥!
    5. 코기: 놀이터? 그 모래사장과 미끄럼틀이 난무하는 곳을 말하는 건가?
    6. 삼색이: 그래냥! 그곳을 지키는 우리 연합의 '치즈 태비' 녀석은 나랑 차원이 다르다냥!
    7. 삼색이: 네 짧은 다리로는 미끄럼틀 하나도 못 올라가고 미끄러져서 평생 태초마을이나 빙빙 돌 거다냥!
    8. 삼색이: 말을 마친 후 기절한다.
  - Replace the existing single-beat `world-01-boss-clear` narration and `멍!` dialogue with these eight beats; no extra line may interrupt the supplied exchange. Each beat has a unique ID, `manualAdvance:true` through T04's director path, `skipAllowedAfterSeen:true`, and overlay count `/ 8`. First-time skip remains disabled. The eighth beat switches calico to T01's third sprite frame before the clear scene appears.
- **Execution Flow / Logic**:
  1. On the HP12→0 transition, disable fishbone creation, destroy active fishbone and dog surround, lock corgi control, set runtime status `cutscene`, then call `CutsceneDirector.play("world-01-boss-clear")` exactly once. Do not call `DeathSystem`; a simultaneous projectile must not reduce a heart after victory.
  2. Show all eight text beats, revealing each complete line before advance. While line eight displays, show the collapse sprite. After line eight is acknowledged, call `StageRuntime.complete()` once and start `World01StageClearScene` with `{stageId:"world-01-stage-boss",nextStageId:"world-02-stage-1"}`. T07 ensures clear/reward save is committed before the scene switch.
  3. If the scene shuts down during a cutscene, cancel director/timers and never start the clear scene afterward. On repeat boss clear after the script was seen, skipping the dialogue still calls completion and shows the clear scene once.

### I02. 별도 클리어 씬과 NEXT STAGE 버튼

- Related Files:
  - `src/game/scenes/World01StageClearScene.ts` :: `create`, `continueToNextStage`; new
  - `src/game/config.ts` :: `createPhaserConfig` scene list; modify
  - `src/game/stages/stageEvents.ts` :: `stage-clear-scene-opened`; modify
  - `src/components/game/GameEventBridge.tsx` :: forwarded event list; modify
  - `src/components/game/GameShell.tsx` :: `UiMode` and HUD visibility; modify
  - `src/game/core/types.ts` :: `StageId`; read-only/use

#### Details
- **Signatures & Types**:
  ```typescript
  interface World01StageClearSceneData {
    stageId: "world-01-stage-boss";
    nextStageId: "world-02-stage-1";
  }
  // StageEventMap["stage-clear-scene-opened"]:
  // {stageId: "world-01-stage-boss"; nextStageId: "world-02-stage-1"}.
  ```
- **Data & Schema Fields**:
  - Scene key `World01StageClearScene`, canvas 1280×720. Use existing World 1 daytime colors and a dimmed arena/defeated calico backdrop. Center the modal banner near x640/y300 with literal `[STAGE CLEAR!]`, very large `Galmuri11Pixel` glyphs (target 64px), metallic gold `#FFD34D`, darker gold stroke/shadow, high contrast against a dark translucent panel. Place literal `NEXT STAGE ->` on a distinct focusable/clickable button beneath at x640/y430. Render all text in Phaser scene; no new PNG is required for the banner.
  - On scene open emit `stage-clear-scene-opened`; `GameShell` mode `stage-clear` hides normal `GameOverlay` HUD/pause/reset elements so they cannot cover the centered banner. `CutsceneOverlay` has already closed on `cutscene-finished`.
- **Execution Flow / Logic**:
  1. Register scene in `src/game/config.ts`. `World01StageClearScene.create` verifies stage data and reads shared `progressState`/`gameEventBus`. On invalid data show a visible error instead of silently routing to another stage.
  2. `NEXT STAGE ->` responds to pointer click and Enter/Space when focused; use a one-shot transition guard and start `StageScene` with `{stageId:"world-02-stage-1",playerName:progress.playerName}`. No timer, idle or cutscene completion automatically changes world. Leave the banner on screen until input.
  3. On next stage `stage-started`, `GameShell` returns to play mode and the normal HUD uses the new stage title. Remove pointer/key/event listeners on scene shutdown. Refresh after a saved World 1 clear reopens this clear scene (T07), still awaiting a button click.

## Acceptance Criteria
- [ ] At 12th real slipper hit, calico stops attacking, first-time victory dialogue shows all eight exact lines in order with `/ 8`, and the eighth line displays calico collapsed.
- [ ] Before the eighth line is acknowledged, `[STAGE CLEAR!]` is absent. Afterwards a separate central golden banner and `NEXT STAGE ->` button appear; normal HUD is hidden.
- [ ] Waiting does not enter World 2. One click or keyboard activation enters `world-02-stage-1` exactly once. Boss clear and bark reward are not duplicated.

## Validation
- `npx.cmd tsc --noEmit` — new scene/event types compile.
- `npm.cmd run lint` — cutscene lifecycle and scene registration pass.
- `npm.cmd run build` — scene and font assets bundle.
- `npm.cmd run dev` — win manually, advance eight lines, inspect center alignment at desktop/mobile aspect ratios, wait without transition, then click/press Enter to enter World 2.

## Commit Message
```text
feat(world01): add calico victory dialogue and golden clear scene

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T06-victory-dialogue-and-clear-scene

- Show eight victory beats and calico collapse on defeat
- Open a separate stage clear scene with manual next-stage action
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`tsc --noEmit`, `lint`, `build`, 브라우저 12회 명중·승리 대화 8장면·기절 프레임·클리어 배너·대기·Enter 이동)
- commit: T06 한국어 커밋
