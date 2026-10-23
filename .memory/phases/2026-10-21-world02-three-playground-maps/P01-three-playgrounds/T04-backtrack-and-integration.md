# Task: T04 월드 2 맵 왕복과 보스전 연결 확인

## Status: done

## Goal

월드 2 맵 2·3의 왼쪽 경계에서 이전 맵으로 돌아갈 수 있게 하고, 맵 3 오른쪽은 맵 4를 건너뛰어 기존 보스 스테이지로 연결한다. 왕복·사망 후 체크포인트, 코인, 무작위 배치가 꼬이지 않는지 실제 플레이로 검증한다.

## Decision Summary

- 맵 2→1, 맵 3→2는 왼쪽 이동 입력을 유지하고 코기가 왼쪽 경계에 닿을 때만 발생한다. 맵 1 왼쪽은 기존 월드 경계로 남긴다. 역방향 이동은 스테이지 클리어·코인 정산 이벤트를 발생시키지 않는다.
- 맵 3→`world-02-stage-boss`는 사용자가 확정한 정방향 경로다. `world-02-stage-4` ID는 옛 저장과 다른 코드의 호환성을 위해 남기되, 새 월드 2 플레이·진행 이벤트·저장 복귀에서 지나가지 않는다. 보스전의 전투 로직 제작은 별도 범위다.
- 한 번 시작한 월드 2 플레이에서는 같은 시드를 맵 왕복·사망에 사용한다. 기존의 코인 장부와 체크포인트 스냅샷을 stage별로 보존한다. 새 실행/새 월드 2 플레이 진입에는 새 시드를 만든다.

## Implementation

### I01. 한 곳에서 월드 2의 실제 플레이 순서를 정의

- Related Files:
  - `src/game/core/constants.ts` :: `WORLD02_PLAYABLE_STAGE_IDS`, `getNextStageId`, `getPreviousWorld02StageId`; modify. 기존 `STAGE_IDS`와 `STAGE_SUFFIXES`는 변경하지 않는다.
  - `src/game/stages/StageRuntime.ts` :: `StageRuntime.complete`; modify. 완료 이벤트의 `nextStageId` 계산을 위 함수와 통일한다.
  - `src/game/systems/worldSelection.ts` :: `getSelectedWorldResume`; modify. 월드 2의 미완료 stage 찾기에 실제 플레이 순서를 사용한다.
  - `src/game/scenes/PreloadScene.ts` :: `PreloadScene.create`의 `firstUncleared` fallback; modify, 미완료 stage 탐색에서 맵 4를 제외한다. 개발 모드의 첫 맵 강제 시작 정책은 유지한다.
  - `scripts/stage-progression.test.mjs`, `scripts/world-selection.test.mjs` :: 진입 순서와 저장 복귀 검증; modify.

#### Details

- **Signatures & Types**:
  ```typescript
  export const WORLD02_PLAYABLE_STAGE_IDS = [
    "world-02-stage-1", "world-02-stage-2", "world-02-stage-3", "world-02-stage-boss",
  ] as const satisfies readonly StageId[];
  export type World02PlayableStageId = typeof WORLD02_PLAYABLE_STAGE_IDS[number];
  export function getNextStageId(stageId: StageId): StageId | null;
  export function getPreviousWorld02StageId(
    stageId: StageId,
  ): "world-02-stage-1" | "world-02-stage-2" | null;
  ```
- **Data & Schema Fields**: `WORLD02_PLAYABLE_STAGE_IDS`에는 맵 4가 없고 보스가 네 번째이다. `STAGE_IDS`에는 맵 4가 계속 있다. `getNextStageId("world-02-stage-3")`는 보스를 반환한다. 기존 맵 4 직접 진입 시에는 옛 동작대로 보스로 이어지게 둔다. 보스 또는 월드 2 밖 stage의 역방향 결과는 `null`이다.
- **Execution Flow / Logic**: `StageRuntime.complete`는 `getNextStageId(this.definition.id)`를 이벤트에 실어 Scene 전환과 일치시킨다. 월드 2 재개는 위 네 stage 중 처음 미완료인 stage를 선택한다. `PreloadScene`의 범용 `STAGE_IDS.find` fallback도 `world-02-stage-4`를 후보에서 제외한다. 맵 3을 클리어한 뒤 새로고침하여 미완료 맵 4로 빠지지 않아야 한다. 월드 1과 다른 월드의 전역 진행 순서는 그대로 둔다.
- **Error & Exception Handling**: 알 수 없는 stage ID는 기존 `getNextStageId`의 `null` 의미를 지킨다. 예전 저장에서 맵 4가 이미 클리어되어 있어도 `clearedStages`를 임의 삭제하지 않는다.

### I02. stage별 방문 상태와 좌우 경계 전환

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `StageSceneData`, `StageScene.create`, `StageScene.update`, `activateCheckpoint`, `stage-completed` 구독, scene 종료 핸들러; modify.
  - `src/game/systems/CheckpointSystem.ts` :: `CheckpointSystem.restore`는 기존 메서드를 그대로 사용; read-only.
  - `src/game/stages/StageRuntime.ts` :: `setMapSnapshot`·`resetCoins`; existing helpers; read-only except I01.
  - `src/game/systems/coinLedger.ts` :: `hasCollectedCoin`·`recordCollectedCoin`; read-only. stage별 코인 중복 방지에 기존 장부를 사용한다.
  - `scripts/world02-backtrack.test.mjs` :: 경로·방문 상태·체크포인트·코인 동작; new.

#### Details

- **Signatures & Types**:
  ```typescript
  type World02EntrySide = "left" | "right";
  interface World02StageVisit {
    readonly seed: number;
    readonly checkpointSnapshot: CheckpointSnapshot | null;
  }
  type World02TravelState = Partial<Record<
    "world-02-stage-1" | "world-02-stage-2" | "world-02-stage-3", World02StageVisit
  >>;
  // StageSceneData에 추가:
  readonly entrySide?: World02EntrySide;
  ```
- **Data & Schema Fields**: Phaser registry 키 `world02TravelState`의 기본값은 빈 객체, `world02RunSeed`는 첫 진입 때 생성하는 양의 32비트 정수다. `World02StageVisit.checkpointSnapshot`은 해당 stage ID가 일치하는 기존 `CheckpointSnapshot` 또는 `null`이다. 다른 월드의 방문 상태를 이 구조에 넣지 않는다.
- **Execution Flow / Logic**:
  1. `StageScene.create`: T03에서 마련한 registry `world02RunSeed`와 `data.seed`를 사용한다. 이미 방문한 stage는 `world02TravelState[stage.id].seed`를 재사용한다. StageRuntime과 T03의 배치 함수 모두 이 값을 사용한다. 월드 1의 체크포인트 시드 계산은 변경하지 않는다. 상단 메뉴에서 월드 2를 **새로 선택**한 경우에는 `world02RunSeed`와 `world02TravelState`를 먼저 지워 새 배치를 만든다. 맵 간 정상 이동에는 지우지 않는다.
  2. 정상 map1→2, map2→3, map3→보스 전환 직전에 현재 stage의 시드·체크포인트 스냅샷을 저장한다. 기존 `runtime.complete()`를 유지하여 정방향 스테이지 클리어와 코인 기록을 수행한다. 대상 stage는 I01의 `getNextStageId` 결과다. 새 stage는 `entrySide:"left"`, 시작 위치 x=96/y=440, 오른쪽을 향한다.
  3. `StageScene.update`에서 `runtime.getStatus()==="play"`, `!stageTransitionStarted`, `!shopOpen`, 플레이어 조작 가능, `input.left===true`, `player.getBounds().left<=48`인 경우에만 `getPreviousWorld02StageId(this.stageId)`를 검사한다. 이전 맵이 있으면 현재 방문 상태를 저장하고 `stageTransitionStarted=true`로 중복 입력을 막은 뒤 `scene.start("StageScene",{stageId:previous,seed:runSeed,playerName,entrySide:"right"})`로 전환한다. 이 경로에서 `runtime.complete()`와 `stage-completed`를 호출하지 않는다.
  4. `entrySide==="right"`이면 Player 생성 후 x=`stage.mapWidth-144`, y=440으로 배치하고 `setFlipX(true)` 및 속도 0으로 시작한다. 이 위치는 장애물 없는 마지막 192px 안에 있다. 기본 `left` 진입은 stage.spawn을 쓴다. 카메라 팔로우와 비둘기 reset은 실제 배치된 플레이어 위치를 기준으로 시작한다.
  5. 되돌아온 stage의 스냅샷은 stage ID를 검사한 뒤 `CheckpointSystem.restore(snapshot)`로 불러온다. 이 메서드는 **체크포인트 상태만 복원하고 플레이어를 옮기지 않으므로**, map snapshot은 `runtime.setMapSnapshot`/`mapInteraction.reset`/`gimmickSystem.reset`으로 맞춘다. `StageScene.restoreCheckpoint`는 플레이어를 깃발로 순간 이동시키므로 경계 재진입에는 쓰지 않는다. 이미 획득한 코인은 `coinLedger`와 `runtime.resetCoins()`로 비활성화한다. 이후 죽으면 복원된 체크포인트에서 재시작하고, 아직 깃발을 밟지 않은 맵이면 기존 시작점에서 재시작한다.
  6. 씬 종료 시 이벤트·타이머·위험물 시스템을 기존 정리 경로대로 해제한다. 일시정지·상점·사망·컷신 중 왼쪽을 누르더라도 전환하지 않는다. stage1 왼쪽에서는 전환하지 않는다.
- **Error & Exception Handling**: registry가 잘못된 stage ID·시드·스냅샷을 담으면 그 항목은 버리고 안전한 기본값으로 시작한다. `scene.start`는 전환 플래그로 한 번만 실행한다. 왕복만 한 맵을 클리어 상태로 기록하지 않고, 은행 코인을 한 번 더 늘리지 않는다.

### I03. 실행 환경의 통합 검증

- Related Files:
  - `.memory/test-plans/browser-world02-three-playgrounds.mjs` :: Chrome/CDP 왕복 플레이와 시각 확인; new.
  - `scripts/world02-backtrack.test.mjs` :: 새 단위/통합 검사; new.
  - `scripts/development-world02-start.test.mjs`, `scripts/world02-bone-coins.test.mjs`, `scripts/world02-pigeon-drops.test.mjs` :: 기존 동작 회귀 확인; modify only if expectations legitimately change.

#### Details

- **Execution Flow / Logic**: 로컬 서버를 띄우고 기존 `.memory/test-plans/browser-world02-repeating-pigeons.mjs`의 Chrome/CDP 연결 방식을 사용한다. 키 입력 또는 검사용 위치 이동으로 1→2→3→2→1→2→3→보스 순서를 확인한다. 맵 2·3 각각 다른 중경 이미지와 모든 새 장애물 외형, 각 맵의 비둘기 세 낙하 위치·3초 생성 간격, 접촉 즉사, 고양이 할퀴기를 확인한다. 죽음/재진입 후 같은 시드의 장애물 좌표와 체크포인트 복원, 코인 잔액 불변, 맵 4 미진입을 확인한다. 맵 3→보스에서는 **씬 진입까지만** 검사한다(보스 전투가 아직 없다). 콘솔 오류와 누락 에셋도 검사한다.
- **Error & Exception Handling**: Chrome 자동화로 경계 입력을 확인할 때 위치 이동을 사용했다면 테스트 기록에 명시하고, 실제 왼쪽 키 입력 경로를 최소 1회 검증한다. 브라우저에서 실패하면 사용자가 요청한 범위의 코드·에셋 원인을 고친 뒤 다시 검사한다.

## Acceptance Criteria

- [x] 월드 2 맵 2 왼쪽에서 1로, 맵 3 왼쪽에서 2로 돌아간다. 맵 1 왼쪽과 월드 1 진행은 바뀌지 않는다.
- [x] 맵 3을 오른쪽으로 마치면 맵 4가 아닌 월드 2 보스 스테이지에 진입하고, 완료 이벤트와 저장 후 복귀 경로도 일치한다.
- [x] 왼쪽 왕복은 클리어/코인 정산을 일으키지 않으며, 코인 중복 획득을 막고 체크포인트·장애물 배치가 유지된다.
- [x] 맵 2·3 배경이 서로 구별되고 새 장애물·비둘기·사망/재시작이 실제 Chrome에서 작동한다.

## Validation

- `node --test scripts/world02-backtrack.test.mjs scripts/stage-progression.test.mjs scripts/world-selection.test.mjs scripts/world02-bone-coins.test.mjs scripts/world02-stage-hazards.test.mjs scripts/world02-pigeon-drops.test.mjs scripts/development-world02-start.test.mjs`
- `node scripts/validate-assets.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node .memory/test-plans/browser-world02-three-playgrounds.mjs` — 실행 중인 로컬 서버와 Chrome CDP에서 왕복·보스 진입·시각 확인.

## Commit Message

```text
feat(world02): 놀이터 맵 왕복과 맵 3 보스전 연결하기

Plan: 2026-10-21-world02-three-playground-maps
Phase: P01-three-playgrounds
Task: T04-backtrack-and-integration

- 왼쪽 경계 왕복과 단계별 체크포인트·시드 유지
- 맵 3 이후 보스 진입 및 저장 복귀 경로 통일
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- Browser: Chrome 프로덕션 빌드에서 1→2→3→2→1→2→3→보스→새 월드 2 시작 경로 확인. 왼쪽 복귀 키 입력, 장애물 사망·체크포인트·코인·시드 유지, 새 배치 초기화 및 에셋/콘솔 오류 0건. 맵 2·3 비둘기 간격 각각 약 3016ms.
- Screenshots: [맵 2](../../../test-plans/assets/2026-10-23-world02-map2-integration.png), [맵 3](../../../test-plans/assets/2026-10-23-world02-map3-integration.png)
- commit: see T04 commit
