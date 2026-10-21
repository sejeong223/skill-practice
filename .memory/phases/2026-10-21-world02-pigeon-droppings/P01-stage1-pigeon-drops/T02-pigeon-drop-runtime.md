# Task: T02 비둘기 비행·똥 낙하와 즉시 사망 연결

## Status: pending

## Goal

월드 2 첫 스테이지의 기존 장애물 사이 세 지점에서 비둘기가 실제로 날며 낙하 위치를 예고하고 똥을 떨어뜨린다. 낙하 똥과 코기의 몸체가 겹치면 한 번만 즉시 사망하며, 재시작·일시정지·장면 종료 뒤 잔여 오브젝트가 남지 않는다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-21-world02-pigeon-droppings.md)에 따라 **첫 스테이지의 비 Tiled 경로**에서만 생성한다. 비둘기 몸체와 착지 자국은 무해하다.
- 똥 사망은 기존 `GameplayEventBus`의 `death-requested` → `DeathSystem`을 거친다. 새 사망/저장 경로를 만들지 않고 체크포인트를 유지한다.

## Implementation

### I01. 고정 비행 구간 데이터와 배치 검증

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `World02PigeonPassDefinition`, `WORLD02_STAGE1_PIGEON_PASSES` — 고정 구간; new.
  - `src/game/data/world02Obstacles.ts` :: `WORLD02_STAGE1_OBSTACLES` — 기존 x/폭과 안전 간격 확인; read-only.
  - `src/game/data/worlds.ts` :: `createNormalStage`, `createStageMap` — 첫 스테이지 폭 3840·체크포인트 x=2496 확인; read-only.
  - `scripts/world02-pigeon-drops.test.mjs` — 좌표·속도·안전 간격 및 런타임 검증; new.

#### Details

- **Signatures & Types**:
  ```typescript
  export interface World02PigeonPassDefinition {
    readonly id: string;
    readonly triggerX: number;
    readonly dropX: number;
    readonly flightY: number;
    readonly birdSpeedX: number;
    readonly droppingSpeedY: number;
  }
  export const WORLD02_STAGE1_PIGEON_PASSES: readonly World02PigeonPassDefinition[];
  ```
- **Data & Schema Fields**: 정확히 세 항목을 x 오름차순으로 둔다. `id`는 `world-02-stage-1-pigeon-1`부터 `-3`까지 유일하게 지정한다. `(triggerX, dropX)`는 `(830,1280)`, `(1530,1980)`, `(2590,3040)`이며 모두 `flightY: 160`, `birdSpeedX: 160`(속도의 양의 크기), `droppingSpeedY: 850`이다. 비둘기 시작 x=`dropX+240`, 종료 x=`dropX-320`, 그림자 예고 시작 x=`dropX+80`은 시스템의 공통 상수로 둔다. 낙하 바닥 y=504도 첫 스테이지 모래 표면 상수로 둔다.
- **Execution Flow / Logic**: x=1280은 삽 1100과 라바콘 1460, x=1980은 오리 1810과 잠자는 고양이 2160, x=3040은 코끼리 2850과 토끼 3220 사이에 있다. 각 `dropX`와 이웃 장애물 충돌체 사이에 코기 몸체 72px 이상 회피 여백을 검사한다. 시작 안전 구간 0~192, 체크포인트 2496±250, 출구 3648~3840에는 낙하하지 않는다. 초기값은 T03의 실제 플레이 결과에 따라 필요할 때만 수정한다.
- **Error & Exception Handling**: 정의 순서·중복 ID·구간 밖 좌표는 테스트에서 실패한다.
- **State Transition & Return**: 세 구간은 매 시도 같은 위치에서 한 번씩 작동하며 저장 데이터에는 넣지 않는다.

### I02. 비행·예고·낙하·충돌 수명주기

- Related Files:
  - `src/game/systems/World02PigeonDropSystem.ts` :: `World02PigeonDropSystem` — 새 전용 시스템; new.
  - `src/game/core/events.ts` :: `GameplayEventMap["death-requested"]` — 기존 이벤트 타입 확인; read-only.
  - `src/game/entities/Player.ts` :: `Player.body` — 72×40 Arcade 충돌 몸체 확인; read-only.
  - `scripts/world02-pigeon-drops.test.mjs` — Phaser 장면·물리 모의체로 생명주기 검증; new.

#### Details

- **Signatures & Types**:
  ```typescript
  export class World02PigeonDropSystem {
    public constructor(
      scene: Phaser.Scene,
      player: Player,
      eventBus: GameplayEventBus,
      stageId: StageId,
      definitions: readonly World02PigeonPassDefinition[],
      getCheckpointId: () => string | null,
      canHandleContact: () => boolean,
    );
    public update(deltaMs: number): void;
    public resetForAttempt(respawnX: number): void;
    public destroy(): void;
  }
  ```
- **Data & Schema Fields**: 각 패스에 `status: "armed" | "flying" | "released" | "finished"`, `bird?: Phaser.GameObjects.Sprite`, `dropping?: Phaser.Physics.Arcade.Sprite`, `warning?: Phaser.GameObjects.Graphics`, `splat?: Phaser.GameObjects.Image`, `overlap?: Phaser.Physics.Arcade.Collider`, `splatRemainingMs: number`를 보관한다. 나머지 위치·속도는 readonly 정의에서 읽는다. 전역 저장 상태나 새 경제 필드는 만들지 않는다.
- **Execution Flow / Logic**:
  1. `canHandleContact()`가 참이고 코기 x가 `triggerX` 이상이면 `world-02-pigeon-fly` 스프라이트를 (`dropX+240`, `flightY`)에 만든다. 부리가 왼쪽을 향한 원본 프레임을 그대로 사용하고 뒤집지 않는다. 깊이 4, 화면 배율 1, 3프레임을 120ms 간격으로 반복한다. 비둘기에는 물리 몸체/콜라이더를 붙이지 않는다.
  2. `update`에서 유효한 `deltaMs`를 0~50ms로 제한해 bird x를 `speed × dt`만큼 **왼쪽으로** 이동한다. bird x가 `dropX+80`을 통과하면 모래 표면 y≈499에 폭 44px의 작고 분명한 연보라/짙은 자주색 경고 그림자를 만든다. 경고 시작부터 낙하물 접지까지 정상 속도에서 약 0.86초가 남는다. 화면 전체 경고나 새 대사는 추가하지 않는다.
  3. bird x가 `dropX`를 통과하면 비둘기 아래 y=`flightY+20`에서 `world-02-pigeon-dropping` Arcade sprite를 떨어뜨린다. 중력은 끄고 y 속도 `droppingSpeedY`를 적용한다. 몸체는 이미지보다 작은 가운데 **14×20px**로 지정하고 depth 9로 둔다. bird는 계속 왼쪽으로 날아 `dropX-320`을 넘으면 제거한다.
  4. 낙하물과 코기의 `physics.add.overlap`에서 `destroyed`/`status`/`canHandleContact()`를 검사한다. 처음 겹친 순간 **콜라이더와 낙하물을 먼저 비활성화/정리한 뒤** `eventBus.emit("death-requested", { stageId, cause: "trap", checkpointId: getCheckpointId(), now: scene.time.now })`를 한 번만 보낸다. `DeathSystem`이 같은 호출 안에서 재시작할 수 있으므로 중복 콜백과 재진입을 막는다.
  5. 몸체 아래가 y=504에 도달하면 충돌 영역을 제거하고 낙하물 대신 `world-02-pigeon-splat`을 y=503에 300ms만 보여준다. 이 자국에는 충돌체가 없으며, 시간이 지나면 그림자와 함께 사라진다. bird 비행 완료와 splat 종료 후 패스를 `finished`로 표시한다.
  6. `resetForAttempt(respawnX)`는 비둘기·똥·그림자·자국·콜라이더를 모두 지운다. `triggerX < respawnX`인 패스는 이미 지나간 것으로 `finished`, 나머지는 `armed`로 만든다. 따라서 체크포인트 오른쪽에서 재시작하면 뒤쪽 새가 늦게 나타나지 않고, 남은 세 번째 구간은 다시 도전할 수 있다. `destroy()`도 같은 리소스를 멱등 정리한다.
- **Error & Exception Handling**: 씬 종료로 이미지가 먼저 파괴되었거나 overlap callback이 한 프레임에 여러 번 와도 예외/중복 사망이 없어야 한다. 일시정지 중에는 `update`를 호출하지 않고 물리 월드를 멈춰 타이머/낙하가 진행되지 않는다. 프레임 드롭 후 큰 `deltaMs`는 50ms로 제한해 새가 예고 위치를 건너뛰지 않는다.
- **State Transition & Return**: `armed → flying → released → finished`; 사망/재시작 시 복귀 x에 맞춰 `armed` 또는 `finished`로 재설정한다.

### I03. StageScene의 생성·일시정지·재시작·종료 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `StageScene.create`, `update`, `setPaused`, shutdown callback — 시스템 소유권 연결; modify.
  - `src/game/systems/World02ObstacleSystem.ts` :: `resetForAttempt` — 인접 장애물 재시작 패턴 참고; read-only.
  - `src/game/systems/RestartController.ts` :: `restartAtCheckpointOrSpawn` — 코기 위치를 먼저 복원한 뒤 `restart` 이벤트를 내는 순서 확인; read-only.

#### Details

- **Signatures & Types**: 필드 `private world02PigeonDrops?: World02PigeonDropSystem;`를 추가한다. 새 시스템에 `stage.id`, `WORLD02_STAGE1_PIGEON_PASSES`, 현재 체크포인트 반환 함수, `runtime.status === "play" && !stageTransitionStarted` 함수(기존 월드 2 장애물과 동일)를 넘긴다.
- **Execution Flow / Logic**:
  1. `stage.id === "world-02-stage-1" && !this.loadedMap`에서 기존 모래/장애물 옆에 시스템을 생성한다. 다른 월드와 월드 2 후속 스테이지, 또는 향후 Tiled 맵이 로드된 첫 스테이지에는 생성하지 않는다.
  2. `StageScene.update`의 `runtime.status !== "play"` 조기 반환 뒤에 `world02PigeonDrops?.update(elapsed)`를 호출한다. `setPaused`의 기존 `physics.world.pause/resume`를 재사용하므로 상점·일시정지 양쪽에서 낙하 물리가 정지한다.
  3. `gameplayEventBus.on("restart", ...)`에서는 `world02PigeonDrops?.resetForAttempt(this.player?.x ?? stage.spawn.x)`를 호출한다. `restart` 이벤트 전에 `RestartController`가 코기 위치를 복원하므로 체크포인트 x를 그대로 읽는다. `create`에서 `restoreCheckpoint(data.resumeCheckpointId)`를 호출한 직후에도 같은 reset을 해 재접속 복원에서 앞쪽 패스를 건너뛴다.
  4. `shutdown`에서 시스템 `destroy()` 후 필드를 `undefined`로 만든다. 종료 후 새 overlap/렌더 오브젝트가 남지 않는다.
- **Error & Exception Handling**: `runtime.status`가 `completed`/`paused`일 때 새로운 낙하·사망을 만들지 않는다. 새 시스템의 정리는 기존 장애물 시스템을 손상시키지 않는다.
- **State Transition & Return**: 스테이지를 떠나면 일시 패스 상태는 폐기되고 다시 들어오면 새 시도가 시작된다.

## Acceptance Criteria

- [ ] 첫 스테이지에서 정확히 세 비둘기가 차례로 날고 낙하 전 바닥 경고가 보인다.
- [ ] 낙하 중인 똥 접촉은 기존 체크포인트 사망 이벤트를 한 번만 내며, 새·착지 자국 자체는 무해하다.
- [ ] 사망·체크포인트·일시정지·상점·새로고침·장면 종료에서 오브젝트와 충돌체 수명이 맞다.
- [ ] 기존 장애물 8종, 코인, 바닥, 출구와 다른 스테이지 정의는 바뀌지 않는다.

## Validation

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/death-system.test.mjs` — 배치·비행·충돌·재시작 회귀.
- `node node_modules/typescript/bin/tsc --noEmit` — 새 Phaser/StageScene 타입 검사.
- `npm.cmd run lint` — 새 상태 및 이벤트 구독 정리 검사.
- `npm.cmd run build` — 스테이지 통합 빌드.

## Commit Message

```text
feat(world02): 비둘기 낙하 예고와 똥 접촉 사망 연결

Plan: 2026-10-21-world02-pigeon-droppings
Phase: P01-stage1-pigeon-drops
Task: T02-pigeon-drop-runtime

- 세 고정 구간에서 비둘기 비행과 똥 낙하를 실행
- 접촉 사망과 재시작·일시정지·종료 정리를 기존 흐름에 연결
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
