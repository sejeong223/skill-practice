# Task: T04 월드 1 진행·저장과 전체 검증

## Status: pending

## Goal
월드 1 일반 1~4단계와 보스를 실제로 순서대로 플레이할 수 있게 연결하고, 클리어·보상 저장을 확인한다. 자동 검사와 플레이테스트 결과를 새 30개 정적 배치 기준으로 기록한다.

## Decision Summary
- T01~T03이 정적 장애물, 일반 맵, 쉬운 보스전을 만든 뒤 실행한다.
- 보스 클리어 뒤 월드 1 완료 화면에서 멈춘다. 사용자가 경로를 확인하기 전에는 월드 2로 자동 진입하지 않는다.
- 현재 `StageRuntime.complete()`는 `stage-completed`를 발생시키지만 `ProgressState.clearedStages`를 채우지 않고, `StageScene`은 다음 스테이지로 이동하지 않는다. 두 흐름을 연결해야 한다.

## Implementation

### I01. 클리어와 보상 데이터 저장

- Related Files:
  - `src/game/stages/StageRuntime.ts` :: `complete` — 완료 ID를 이벤트 전에 기록; modify
  - `src/game/scenes/StageScene.ts` :: `create`의 `stage-completed` 리스너 — 월드 1 보스 보상 및 진행 처리; modify
  - `src/game/core/types.ts` :: `ProgressState.clearedStages`, `unlockedSkills`, `SkillId`; read-only
  - `src/game/stages/stageEvents.ts` :: `stage-completed`, `skill-unlocked` 페이로드; read-only
  - `src/game/persistence/AutoSaveCoordinator.ts` :: 이벤트 후 저장 예약; read-only
  - `src/game/systems/SkillSystem.ts` :: `unlockAfterBoss`가 내부 Set만 변경하는 현재 동작 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  public complete(): void; // StageRuntime
  // ProgressState.clearedStages: StageId[];
  // ProgressState.unlockedSkills: SkillId[];
  // "stage-completed": { stageId: StageId; nextStageId: StageId | null; bankedCoins: number }
  // "skill-unlocked": { skillId: string }
  ```
- **Data & Schema Fields**:
  - 성공한 일반/보스 ID를 `progress.clearedStages`에 중복 없이 기록한다. 월드 1 보스 ID는 `"world-01-stage-boss"`다.
  - 보스 최초 클리어 보상은 `"bark"`이며 `progress.unlockedSkills`에 한 번만 넣는다.
- **Execution Flow / Logic**:
  1. `StageRuntime.complete()`의 기존 `status === "completed"` 가드를 유지한다. `progress`가 있으면 기존 코인 정산과 함께 `definition.id`가 `clearedStages`에 없는 경우 push한다. 그 뒤 `stage-completed`를 emit한다. 이벤트를 먼저 발행하지 않아 자동 저장이 변경 전 배열을 읽는 경우를 막는다.
  2. `StageScene`의 완료 리스너는 `payload.stageId !== this.stageId`면 반환한다. 보스 완료일 때 `unlockedSkills`에 `"bark"`가 없으면 push한 뒤 `eventBus.emit("skill-unlocked",{skillId:"bark"})`한다. 저장된 보상을 다시 중복 추가하거나 이벤트를 다시 발생시키지 않는다.
  3. `AutoSaveCoordinator`는 `stage-completed`와 `skill-unlocked`를 이미 저장 대상으로 등록했다. 새 보스 보상은 실제 `ProgressState`를 먼저 바꾼 뒤 이벤트를 내보내야 한다. `SkillSystem.unlockAfterBoss`만 호출하면 `ProgressState.unlockedSkills`가 채워지지 않으므로 이 경로는 사용하지 않는다.
  4. 보스전 체력은 영구 저장 필드가 아니다. 재입장 시 다시 2로 시작하며 완료 스테이지 기록·해금된 기술은 유지한다.

### I02. 연속 진행, 재실행, 완료 화면

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `stage-completed` 리스너, `reviewNextWorld01Stage`, `shutdown` 정리 — 스테이지 이동과 F2 검수; modify
  - `src/game/scenes/PreloadScene.ts` :: `create` — 저장 데이터로 일반 1~4/보스 중 첫 미완료 월드 1 스테이지 선택; modify
  - `src/game/scenes/IntroScene.ts` :: `player-name-confirmed` 이후 새 게임의 첫 스테이지 시작; read-only
  - `src/game/data/worlds.ts` :: `STAGE_DEFINITIONS`, `WORLD_DEFINITIONS`; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  private reviewNextWorld01Stage(): void;
  // StageScene.scene.restart(data: StageSceneData): void;
  // StageSceneData: { readonly stageId?: StageId; readonly seed?: number; readonly playerName?: string }
  // Phaser.Time.TimerEvent: delayedCall(700, callback)
  ```
- **Data & Schema Fields**:
  - 진행 배열: `"world-01-stage-1"`, `"world-01-stage-2"`, `"world-01-stage-3"`, `"world-01-stage-4"`, `"world-01-stage-boss"`.
  - 일반 스테이지 완료 후 이동 대기 700ms. `stage-completed`가 같은 스테이지에서 한 번만 실행되도록 런타임 완료 가드와 장면 ID 비교를 사용한다.
  - 보스 완료 화면: 텍스트 `"월드 1 완료"`와 `"턱시도를 이겼어요!"`; 카메라 고정 `setScrollFactor(0)`, 깊이 1000. 기존 게임 화면 위에 읽을 수 있는 반투명 패널을 만든다.
- **Execution Flow / Logic**:
  1. 현재 `StageScene` 완료 리스너의 무조건 `setStatus("completed")` 처리에 월드 1 진행 로직을 더한다. 스테이지 1~4는 위 배열의 다음 ID로 700ms 뒤 `this.scene.restart({stageId:nextId,seed:runtime.runtimeState.randomSeed,playerName:progress.playerName})`한다. 장면이 이미 shutdown 되었거나 다른 스테이지로 바뀌었으면 콜백은 아무 일도 하지 않는다. 월드 1 외 스테이지의 기존 동작을 바꾸지 않는다.
  2. 월드 1 보스는 `stage-completed.nextStageId`가 월드 2를 가리켜도 사용하지 않는다. 완료 패널을 표시하고 장면에 머문다. F2 개발 검수는 패널 상태에서도 사용할 수 있다.
  3. F2 배열에 보스를 추가해 일반 1→2→3→4→보스→1로 순환시킨다. F3 개요 모드는 기존처럼 유지한다. F2로 이동할 때 진행도 배열을 조작하지 않는다.
  4. `PreloadScene.create`에서 `progress.onboardingCompleted`가 참이면 진행 배열 중 `!progress.clearedStages.includes(id)`인 첫 스테이지를 시작한다. 모두 완료했다면 첫 일반 스테이지를 시작하고 완료 기록은 유지한다. 유효하지 않은 저장 ID는 기존 마이그레이션 결과를 따른다.
  5. `shutdown`에서 지연 이동 `Phaser.Time.TimerEvent`와 완료 패널을 정리한다. 사용자 F2 이동과 자동 이동이 겹쳐도 옛 장면의 타이머가 새 장면을 덮어쓰지 않게 한다.

### I03. 맵·보스 자동 검사와 플레이테스트 기록

- Related Files:
  - `scripts/world01-maps.mjs` :: `run` 및 새 `verifyBossRoute` — 보스 바닥·출구·무기습 조건; modify
  - `src/game/data/worlds.ts` :: `STAGE_DEFINITIONS`의 월드 1 보스 항목; read-only
  - `.memory/test-plans/2026-09-29-world01-easy-pass.md` :: `Manual matrix`와 증거/메모; modify
  - `package.json` :: `world01:maps:check`, `lint`, `build` 명령 확인; read-only

#### Details
- **Signatures & Types**:
  ```javascript
  function verifyBossRoute(stage) { /* returns string[] of validation errors */ }
  function run() { /* --check 검사 또는 4개 일반 Tiled JSON 생성 */ }
  ```
- **Data & Schema Fields**:
  - `scripts/world01-maps.mjs` 상단의 기존 TS 로딩 방식에 맞춰 `const { STAGE_DEFINITIONS } = require(path.join(root, "src/game/data/worlds.ts"));`를 추가한다.
  - `verifyBossRoute` 대상은 `STAGE_DEFINITIONS.find(stage => stage.id === "world-01-stage-boss")`.
  - 예상 바닥: 첫 플랫폼 중심 `x=960`, `y=520`, `width=1888`, `height=32`. 시작점 `spawn={x:160,y:504}`와 출구 중심 x1824를 모두 덮어야 한다.
  - 보스 세그먼트 `traps`, `enemies`, `coins`, `collectibles`는 각각 0개; 보스 맵 `gimmicks`, `chainRules` 0개; `objectDefinitions`에서 `trap`/`enemy-spawn` 0개, `exit` 정확히 1개.
- **Execution Flow / Logic**:
  1. `scripts/world01-maps.mjs`가 이미 검사하는 4개 일반 맵의 30개 기믹·Tiled JSON 동기화에 보스 검사를 더한다. 바닥 시작/끝은 `platform.x ± platform.width/2`, 상단은 `platform.y - platform.height/2`로 계산한다. 모든 조건 위반을 기존 `problems`에 넣어 `--check`에서 종료 코드 1로 보고한다.
  2. `npm.cmd run world01:maps:check`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`를 수행한다. Tiled JSON 생성은 T02에서 완료한 상태여야 한다.
  3. 개발 서버에서 F2/F3로 일반 4개·보스를 확인하고 실제 이동/점프/J 입력으로 테스트 계획의 각 행을 검증한다. 정적 장애물은 미리 보여야 하고, 가짜 코인은 걷기만 할 때 닿지 않아야 하며, 보스는 두 번 공격해야 승리하고 그 전에는 출구가 잠겨야 한다.
  4. 자동 검사 성공을 수동 통과로 대신 쓰지 않는다. 브라우저 조작 환경이 없다면 해당 행을 `미실행`으로 남기고 실행 불가 이유를 적는다. 실패 시 스테이지·좌표/기믹 ID·재현 조건을 기록한다. 월드 2 작업은 사용자 경로 확인 전까지 시작하지 않는다.

## Acceptance Criteria
- [ ] 일반 1→2→3→4→보스를 출구를 통해 순서대로 플레이할 수 있다. 보스 승리 뒤 월드 1 완료 화면에서 멈춘다.
- [ ] 일반/보스 클리어 ID가 한 번씩 저장되고, 최초 보스 클리어 시 `bark` 해금이 저장된다. 새로고침 시 첫 미완료 월드 1 스테이지부터 시작한다.
- [ ] F2는 일반 4개와 보스만 순환하며 진행도/보상 데이터를 임의로 바꾸지 않는다.
- [ ] 맵 검사에서 일반 4개 3840×720·정적 24개·가짜 코인 6개와 보스 바닥·출구·무기습 조건을 검증한다.
- [ ] 플레이테스트 표의 실제 결과 또는 `미실행` 사유가 기록된다. 월드 2는 자동 시작하지 않는다.

## Validation
- `npm.cmd run world01:maps:check` — 일반 4개 Tiled JSON과 보스 경로 검사 통과
- `npx.cmd tsc --noEmit` — 타입 검사 통과
- `npm.cmd run lint` — 전체 린트 통과
- `npm.cmd run build` — 프로덕션 빌드 통과
- `npm.cmd run dev` + F2/F3·이동/점프/J 수동 확인 — `.memory/test-plans/2026-09-29-world01-easy-pass.md`에 결과 기록

## Commit Message
```text
feat(game): connect world one progression and verify the easy route

Plan: 2026-09-29-world01-easy-pass
Phase: P01-easy-route
Task: T04-progression-and-playtest

- Save stage clears and the world one bark reward
- Advance through the four stages and boss, then record validation
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
