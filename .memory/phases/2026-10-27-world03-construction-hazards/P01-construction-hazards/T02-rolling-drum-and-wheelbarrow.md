# Task: T02 케이블 드럼·손수레 배치와 드럼 이동

## Status: done

## Goal

월드 3 일반 스테이지의 기존 장애물 8자리에서 드럼·손수레를 지정한 수만큼 보여주고, 코기가 가까워지면 드럼이 왼쪽으로 굴러와 160px 후 멈추게 한다. 두 새 장애물은 닿으면 즉시 사망하며 사망 후 재시작에서 드럼의 그림·판정·상태가 출발점으로 돌아간다.

## Decision Summary

- 손수레는 고정, 드럼은 코기가 왼쪽에서 240px 안에 오면 초당 160px로 최대 160px 이동한다. 기존 네 종류와 함께 각 스테이지 8개를 유지한다.
- 스테이지 1: 드럼 1·손수레 1, 2: 드럼 2·손수레 1, 3·4: 드럼 2·손수레 2. 월드 3 보스전은 제외한다.
- T01의 `world-03-cable-drum`·`world-03-wheelbarrow` 이미지가 manifest에 등록된 상태에서 시작한다.

## Implementation

### I01. 장애물 종류·스테이지 배치·코인 데이터

- Related Files:
  - `src/game/data/world03Construction.ts` :: `World03ObstacleKind`, `KINDS`, `HITBOX`, `getWorld03Obstacles`, `getWorld03CoinPositions` — modify
  - `src/game/stages/StageRuntime.ts` :: `buildFromSegments`의 코인 ID와 x 매핑 확인 — read-only
  - `src/game/data/worlds.ts` :: 월드 3 일반 스테이지별 코인 ID 15개 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export type World03ObstacleKind =
    | "traffic-cone" | "brick-stack" | "cement-bag" | "steel-pipe"
    | "cable-drum" | "wheelbarrow";
  export interface World03ObstaclePlacement {
    readonly id: string;
    readonly kind: World03ObstacleKind;
    readonly x: number;
    readonly width: number;
    readonly height: number;
  }
  export function getWorld03Obstacles(stageId: StageId): readonly World03ObstaclePlacement[];
  export function getWorld03CoinPositions(stageId: StageId): readonly number[];
  ```
- **Data & Schema Fields**:
  - `WORLD03_OBSTACLE_SCALE = 1.25`와 `POSITIONS = [380, 740, 1100, 1460, 1820, 2180, 2820, 3220]` 유지. 드럼의 `HITBOX` 원본 크기 42×42, 손수레 52×40이며 반환 폭·높이는 각 값에 1.25를 곱한다. 기존 네 종류의 `HITBOX`는 유지한다.
  - `KINDS`는 슬롯 x의 오름차순으로 스테이지 1 `[traffic-cone, cement-bag, cable-drum, brick-stack, wheelbarrow, steel-pipe, traffic-cone, brick-stack]`, 스테이지 2 `[cement-bag, steel-pipe, cable-drum, traffic-cone, wheelbarrow, brick-stack, cable-drum, cement-bag]`, 스테이지 3 `[steel-pipe, brick-stack, cable-drum, traffic-cone, wheelbarrow, cement-bag, cable-drum, wheelbarrow]`, 스테이지 4 `[brick-stack, traffic-cone, cable-drum, cement-bag, wheelbarrow, steel-pipe, cable-drum, wheelbarrow]`.
  - 네 스테이지 공통 `COIN_POSITIONS = [170, 250, 330, 800, 880, 1530, 1720, 2280, 2420, 2600, 3120, 3300, 3500, 3600, 3680]`. x만 조정한다. `StageRuntime.buildFromSegments`에서 기존 코인 ID 순서·뼈 그림·수집 보상은 그대로 사용한다. 보스 스테이지는 장애물·코인 모두 빈 배열이다.
- **Execution Flow / Logic**:
  1. 스테이지 ID `world-03-stage-[1-4]`만 기존 함수에서 매핑하고 잘못된 ID나 보스 ID는 빈 배열을 돌려준다.
  2. 각 드럼은 x=1100 또는 2820에서 출발해 x=940 또는 2660에서 멈춘다. 바닥 구멍을 가로지르지 않는다. 손수레는 x=1820 또는 3220에 둔다.
  3. 코인 15개의 x는 드럼 전체 이동 구간, 모든 스테이지의 꺼지는 바닥, 현재 장애물과 겹치지 않아야 한다. 코인 x만 바꾸므로 `worlds.ts`의 코인 ID와 보상은 손대지 않는다.

### I02. 보이는 이미지와 실제 판정의 동기 이동

- Related Files:
  - `src/game/systems/World03ConstructionObstacles.ts` :: `World03ConstructionObstacles` 생성자, `update`, `resetForAttempt`, `destroy` — modify
  - `src/game/scenes/StageScene.ts` :: `StageScene.update` — modify
  - `src/game/entities/Player.ts` :: `Player` 몸체·x 접근법 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type DrumPhase = "idle" | "rolling" | "stopped";
  interface DrumRuntime {
    readonly originX: number;
    readonly radius: number;
    readonly image: Phaser.GameObjects.Image;
    readonly zone: Phaser.GameObjects.Zone;
    phase: DrumPhase;
    traveled: number;
  }
  class World03ConstructionObstacles {
    public update(deltaMs: number): void;
    public resetForAttempt(): void;
    public destroy(): void;
  }
  ```
- **Data & Schema Fields**: 드럼 활성 거리 240px, 굴러오는 속도 160px/s, 최대 이동 160px. `DrumRuntime`는 이미지·정적 판정 Zone의 짝과 원래 x, 표시 반지름(`obstacle.height/2`), 진행 상태·누적 이동을 갖는다. 기존 `contactPending`·`destroyed` 가드는 유지한다. 생성자의 `player`와 `canHandleContact` 매개변수는 `update`에서도 읽을 수 있도록 `private readonly` 프로퍼티로 승격한다.
- **Execution Flow / Logic**:
  1. 기존 일반 장애물은 계속 바닥 y=504에 붙인다. 손수레는 기존처럼 `.setOrigin(0.5, 1)`, 드럼만 회전 중심이 필요한 `.setOrigin(0.5, 0.5)` 및 중심 y=`504 - obstacle.height/2`를 쓴다. 두 새 이미지는 1.25배, depth 2. Zone은 `obstacle.width × obstacle.height`로 이미지의 실루엣 중심에 둔다.
  2. `update(deltaMs)`는 `destroyed`, `contactPending`, `!canHandleContact()`이면 중단한다. `deltaMs`는 유한값의 0~50ms로 제한한다. 플레이어가 드럼의 왼쪽에 있고 `0 <= originX - player.x <= 240`이면 `idle → rolling`으로 바꾼다. 이미 지나간 드럼은 새로 활성화하지 않는다.
  3. 굴러가는 동안 `min(160 - traveled, 160 * elapsed/1000)`만큼 x를 줄인다. 이미지 x와 Zone x를 함께 바꾸고 `Phaser.Physics.Arcade.StaticBody.updateFromGameObject()`를 호출해 실제 정적 바디 공간 색인을 갱신한다. 이미지 각도는 왼쪽 이동에 맞춰 `-traveled / radius` 라디안으로 계산해 회전시키고 정지 후 고정한다. 160px에 도달하면 `stopped`로 바꾸고 다시 움직이지 않는다.
  4. 기존 `scene.physics.add.overlap(player, zone, ...)`의 `death-requested` (`cause: "trap"`, 현재 `checkpointId`)를 모든 여섯 종류에 사용한다. 접촉 즉시 `contactPending = true`로 중복 발행을 막는다.
  5. `resetForAttempt`는 `contactPending`을 지우고 모든 드럼의 x·각도·Zone x·정적 바디 색인·`traveled`·`phase`를 초기 상태로 되돌린다. `destroy`는 기존 Collider·Zone·이미지를 한 번만 정리하고 이후 update를 무시한다.
  6. `StageScene.update`의 `runtime.getStatus() !== "play"` 조기 반환 다음, 월드 3 바닥 갱신과 기존 장애물 갱신 근처에서 `this.world03Obstacles?.update(elapsed)`를 호출한다. 기존 restart/shutdown의 `resetForAttempt`·`destroy` 연결을 보존한다. 일시정지·죽는 동안에는 이동하지 않는다.
- **Error & Exception Handling**: 잘못된 delta(NaN/음수/무한대)는 0ms로 처리한다. 씬이 destroy된 뒤 update·reset이 호출되어도 객체에 접근하지 않는다. `canHandleContact`가 false일 때 죽음 이벤트가 다시 나가면 안 된다.

### I03. 배치·이동 회귀 검사

- Related Files:
  - `scripts/world03-construction-stages.test.mjs` :: 스테이지별 장애물·코인·장면 배선 검증 — modify
  - `scripts/world03-collapsing-floor.test.mjs` :: 구멍과 장애물·코인 간격 검사 — modify only if the new dimensions require it
  - `scripts/world03-construction-obstacles.test.mjs` :: 드럼 상태·동기 이동·리셋·죽음 이벤트 테스트 — new

#### Details

- 스테이지별 8개 ID와 종류별 정확한 개수, 새 최대 치수(드럼 52.5×52.5, 손수레 65×50), 체크포인트 x=2496·출구 x=3728의 이격, 보스 빈 배열을 검사한다. 기존 `width<=47 && height<=43`은 새 치수에 맞게 갱신한다.
- 코인 15개와 80px 최소 순서 간격, 구멍 이격, 새 장애물 실루엣 이격을 검사한다. 기존 검사에서 모든 장애물 주위에 기계적으로 추가한 `+40px` 여백은 이동 구간까지 검사하는 실제 충돌 경계 기준으로 교체한다. 각 드럼의 160px 선분 전체가 코인·구멍·다른 장애물과 겹치지 않는지 확인한다.
- 실제 또는 최소 Phaser mock으로 `idle` 상태에서 240px 경계, 뒤에서 접근한 경우 미발동, 시간 누적 후 160px 정지, 이미지·Zone·정적 바디 동기, 재시작 시 원위치와 재발동, 접촉 사망 1회, pause/status false일 때 정지, destroy 후 무동작을 검사한다.
- 기존 `StageRuntime`의 15개 코인 ID와 뼈 코인 보상이 그대로인지 확인한다. 검증을 위해 `StageRuntime.ts`를 수정하지 않는다.

## Acceptance Criteria

- [x] 스테이지별 장애물 8개 안에서 드럼·손수레 개수가 결정과 일치하며 여섯 종류가 등장한다.
- [x] 드럼이 거리 240px에서만 시작해 초당 160px로 160px 이동하고, 그림과 판정이 같은 위치에 있다.
- [x] 두 새 종류의 접촉이 한 번의 즉시 사망을 일으키며 재시작 시 드럼 원위치·대기 상태가 복원된다.
- [x] 코인 15개의 기존 ID·보상, 꺼지는 바닥, 체크포인트·출구, 보스 제외가 유지된다.

## Validation

- `node --experimental-strip-types --test scripts/world03-construction-stages.test.mjs scripts/world03-collapsing-floor.test.mjs scripts/world03-construction-obstacles.test.mjs` — 배치·간격·상태·재시작 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/data/world03Construction.ts src/game/systems/World03ConstructionObstacles.ts src/game/scenes/StageScene.ts scripts/world03-construction-stages.test.mjs scripts/world03-construction-obstacles.test.mjs` — 수정한 코드 lint 통과.
- `git diff --cached --check` 및 `git diff --cached` — 기존 미커밋 변경을 섞지 않고 이 Task의 변경 부분만 스테이징.

## Commit Message

```text
feat(월드3): 굴러오는 드럼과 손수레 장애물 배치

Plan: 2026-10-27-world03-construction-hazards
Phase: P01-construction-hazards
Task: T02-rolling-drum-and-wheelbarrow

- 기존 8자리에서 새 장애물 수를 단계적으로 늘리고 코인 위치 조정
- 드럼 이동·충돌 판정·재시작 상태 복원 구현
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 한국어 커밋에 포함
