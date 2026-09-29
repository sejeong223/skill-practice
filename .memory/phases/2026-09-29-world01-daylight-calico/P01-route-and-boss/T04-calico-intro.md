# Task: T04 삼색이 첫 조우 대화와 월드별 고양이 정체성

## Status: done

## Goal
월드 1 보스를 삼색이 쫄병으로 바꾸고, 첫 조우 때 사용자 제공 대사 여덟 줄을 모두 보여준 후에만 전투를 연다. 턱시도는 이야기 속 행동대장으로 유지한다. 월드 2는 삼색이의 승리 대사에 등장하는 `치즈 태비`이며, 월드 3~5도 각각 다른 고양이라는 정체성과 이후 아트 제작 기준을 등록한다.

## Decision Summary
- 첫 방문에는 8줄을 순서대로 진행하고 마지막 문장이 끝난 뒤 공격이 시작된다. 사망 후 같은 보스전 재도전에서는 이미 본 대화를 반복하지 않는다.
- 다른 월드의 보스전 구현과 PNG 제작은 해당 월드의 Phase에서 처리하지만 보스 고양이의 이름·무늬·실루엣 기준은 지금 고정한다.

## Implementation

### I01. 대사 스크립트·표기

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD_CUTSCENES`, `world-01-boss-intro`; modify
  - `src/game/cutscenes/types.ts` :: `CutsceneSpeaker`, `ActorAction`; modify
  - `src/components/game/DialogueBox.tsx` :: `SPEAKER_LABELS`; modify
  - `src/game/cutscenes/CutsceneDirector.ts` :: `handleBeat`; modify
  - `src/game/cutscenes/CutsceneTimeline.ts` :: `play`, new `advance`; modify
  - `src/game/stages/stageEvents.ts` :: `StageEventMap["cutscene-beat"]`; modify
  - `src/components/game/CutsceneOverlay.tsx` :: beat count rendering; modify
  - `src/game/scenes/IntroScene.ts` :: `cutscene-beat` emission; modify for total count

#### Details
- **Signatures & Types**:
  ```typescript
  type CutsceneSpeaker = "narrator" | "owner" | "corgi" | "cat" | "calico";
  // StageEventMap["cutscene-beat"] adds totalBeats: number.
  // Optional actor "calico-cat"; position is in the boss arena, never the intro Tuxedo rig.
  // CutsceneTimeline.advance(): void clears current timeout and starts the next beat once.
  // CutsceneDirector.advance(): void forwards only while playing.
  ```
- **Data & Schema Fields**:
  - `CutsceneScript.id:"world-01-boss-intro"`, `stageId:"world-01-stage-boss"`, exactly eight beats, one dialogue line per beat, `skipAllowedAfterSeen:true`.
  - Exact ordered lines:
    1. 삼색이: 넌 누구냐옹?
    2. 코기: 턱시도 그 녀석 어디 있어! 내 왕갈비뼈를 내놔!
    3. 삼색이: 아~ 그 영롱하고 육즙 터지는 갈비뼈?
    4. 삼색이: 그건 이미 우리 행동대장 턱시도 형님이 본부로 모셔갔다냥.
    5. 코기: 당장 비켜라, 냥아치!
    6. 삼색이: 캬하학! 다리도 15cm밖에 안되는 게 어디서 행패냐옹?
    7. 삼색이: 쫄병인 나 하나도 못 넘을 녀석이 형님을 쫓아가겠다고?
    8. 삼색이: 억울하면 어디 한 번 지나가 봐라냥! 자, 간다냥!
  - `speaker:"calico"` maps to label `삼색이`; `speaker:"cat"` remains `턱시도` for the existing opening cutscene. 기존 한 줄짜리 보스 클리어 스크립트의 교체는 T06에서 수행한다.
- **Execution Flow / Logic**:
  1. Register the new script in `WORLD_CUTSCENES` and include it in `CUTSCENE_SCRIPTS`; keep dialogue text and order exact.
  2. Emit actual `totalBeats` from `CutsceneDirector` and `IntroScene`; show `index+1 / totalBeats` in overlay so this encounter reads `/ 8` and home intro retains its own count. Both `world-01-boss-intro` and later `world-01-boss-clear` use the shared `manualAdvance:true` branch; extend `CutsceneTimeline` so `advance()` moves one beat, clears the pending timer and cannot double-advance. After line 8 is acknowledged, the promise resolves. Keep timed behavior for other scripts and first-time skip disabled.
  3. Add an optional calico actor tag only if needed to animate the already loaded calico sprite; do not relabel the existing Tuxedo intro.

### I02. Boss stage first-encounter gate and roster

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`, `update`, shutdown cleanup; modify
  - `src/game/data/worlds.ts` :: `WORLD_BLUEPRINTS`, `BOSS_DEFINITIONS`; modify
  - `src/game/data/cutscenes/index.ts` :: `CUTSCENE_SCRIPTS`; read-only
  - `src/game/stages/StageRuntime.ts` :: `setStatus`; read-only
  - `src/game/core/types.ts` :: `ProgressState.seenCutsceneIds`; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // StageScene owns CutsceneDirector for boss stage and calls play("world-01-boss-intro").
  // Runtime status: enter -> cutscene -> play; if seen, enter -> play on retry.
  ```
- **Data & Schema Fields**:
  - Boss roster keyed by existing IDs: `world-01-boss` 삼색이 (calico subordinate); `world-02-boss` 치즈 태비 (orange tabby guarding the playground); `world-03-boss` 공장장 (brown-white patched, broad body/apron); `world-04-boss` 번개 (black long silhouette); `world-05-boss` 은회색 우두머리 (silver-gray tall silhouette). Keep rewards and stage IDs unchanged. Add future PNG/combat design obligation to corresponding world plans, not placeholder reuse.
  - World 1 metadata phases must describe telegraphed single fishbone throws and 12 slipper hits, without phase-two surprise attack.
- **Execution Flow / Logic**:
  1. On first boss entry, create calico art, set runtime to `cutscene`, call `CutsceneDirector.play`. Lock player combat and disable fishbone timers until promise resolves; then set `play` and begin encounter. On already seen retry, go straight to `play` but keep a brief visible readiness cue.
  2. Subscribe shared `cutscene-skip-requested` and `cutscene-advance-requested` to director; dispose listeners/director on shutdown. The 8th line must finish and be acknowledged before either attack system is active. Pause during cutscene should not start combat.
  3. Update World 1 and World 2 boss names in metadata; preserve Tuxedo in the opening cutscene and story references. In future-world plan documents record unique cat art/attack tasks without marking them implemented. Leave boss victory copy to T06.

## Acceptance Criteria
- [ ] First encounter shows all eight exact lines in order, labels 삼색이/코기 correctly, shows `/ 8`, and only then starts combat.
- [ ] Repeated boss attempt does not force the whole dialogue again. Existing home intro still labels Tuxedo correctly and displays its own beat count.
- [ ] All five boss stage IDs have different named cat concepts; World 1 lists 삼색이 rather than 턱시도.

## Validation
- `npx.cmd tsc --noEmit` — speaker, events and director integrations compile.
- `npm.cmd run lint` — no new lint errors.
- `npm.cmd run build` — cutscene data and stage bundle compile.
- `npm.cmd run dev` — first encounter manually advance 8 lines; repeat entry and verify no attack before initial line 8 completion.

## Commit Message
```text
feat(world01): introduce calico boss through eight dialogue beats

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T04-calico-intro

- Preserve Tuxedo as action leader and name a distinct cat for each world
- Gate first calico fight behind the full conversation
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`tsc --noEmit`, `lint`, `build`)
- commit: T04 한국어 커밋
