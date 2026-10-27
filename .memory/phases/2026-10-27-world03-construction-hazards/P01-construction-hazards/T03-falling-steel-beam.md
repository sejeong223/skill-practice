# Task: T03 월드 3 철골 빔 낙하와 체크포인트

## Status: done

## Goal

월드 3 일반 스테이지 1~4에 지정된 고정 x좌표에서 짧은 H형 빔을 예고 없이 한 개씩 낙하시킨다. 코기가 바로 아래를 통과할 때 초당 1,600px로 떨어지고, 낙하 중 맞으면 즉시 사망한다. 착지 후 잠깐 보였다가 사라지며 사망·체크포인트 재시작과 일시정지에서 상태를 올바르게 처리한다.

## Decision Summary

- 낙하 지점 수는 스테이지별 1/2/3/3곳. 한 지점은 시도당 한 번만 작동하며, 반복·랜덤 좌표·그림자·표식·경고 문구는 없다.
- T01의 `world-03-falling-steel-beam` 이미지와 T02의 최종 장애물·코인 배치가 있어야 한다. 월드 3 보스전의 기존 벽돌 패턴은 건드리지 않는다.

## Implementation

### I01. 고정 낙하 지점과 수치 계약

- Related Files:
  - `src/game/data/world03SteelBeams.ts` :: `World03SteelBeamDefinition`, `getWorld03SteelBeamDefinitions`, 속도·치수 상수 — new
  - `src/game/data/world03Construction.ts` :: 지상 장애물·코인·구멍 최종 좌표 확인 — read-only
  - `src/game/data/worlds.ts` :: 체크포인트 x=2496·출구 x=3728 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export interface World03SteelBeamDefinition {
    readonly id: string;
    readonly x: number;
  }
  export const WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND: 1600;
  export const WORLD03_STEEL_BEAM_HITBOX_WIDTH: 56;
  export const WORLD03_STEEL_BEAM_HITBOX_HEIGHT: 20;
  export function getWorld03SteelBeamDefinitions(stageId: StageId): readonly World03SteelBeamDefinition[];
  ```
- **Data & Schema Fields**: 스테이지 1 x=`[1640]`, 2 x=`[1640, 2360]`, 3·4 x=`[1640, 2360, 3400]`. ID는 `${stageId}-steel-beam-${index + 1}`. 보스 및 잘못된 ID는 빈 배열. 이미지 64×28, 낙하 충돌 범위 56×20, 스폰 중심 y=-32, 바닥 윗면 y=504, 착지 중심 y=494, 착지 후 표시 300ms.
- **Execution Flow / Logic**:
  1. `world-03-stage-[1-4]`만 정의를 반환한다. 배열은 x 오름차순이며 고정 좌표를 재시도마다 유지한다.
  2. x=1640/2360/3400은 T02의 장애물 슬롯·드럼 이동 선분·코인 및 모든 스테이지의 128px 구멍, 체크포인트, 출구와 실제 판정 영역이 겹치지 않아야 한다. 테스트가 충돌을 발견하면 근처의 안전한 고정 x로 조정하고 네 스테이지의 검증 기대값도 일치시킨다. 스테이지별 1/2/3/3 수와 고정성은 유지한다.

### I02. 빠른 낙하용 순수 연속 충돌 판정

- Related Files:
  - `src/game/systems/world03SteelBeamCollision.ts` :: `sweptAabbOverlap` — new
  - `src/game/entities/Player.ts` :: Arcade 몸체 사각형 접근 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export interface AxisAlignedBounds {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  }
  export function sweptAabbOverlap(
    beamBefore: AxisAlignedBounds,
    beamAfter: AxisAlignedBounds,
    playerBefore: AxisAlignedBounds,
    playerAfter: AxisAlignedBounds,
  ): boolean;
  ```
- **Execution Flow / Logic**:
  1. 시작 사각형이 이미 겹치면 true를 반환한다. 각 물체가 이전→현재 프레임에 선형 이동했다고 보고 상대 x/y 속도를 계산한다.
  2. 각 축의 입장·퇴장 시간 구간을 구해 두 축의 교집합이 `[0,1]`과 겹칠 때만 true를 반환한다. 상대 속도 0인 축은 처음부터 구간이 분리돼 있으면 false, 겹쳐 있으면 모든 시간 허용으로 처리한다. 닿는 경계는 명중으로 취급한다.
  3. 낙하 폭 56px·높이 20px과 플레이어 `Arcade.Body`의 이전·현재 `left/right/top/bottom`을 쓴다. 화면에 표시한 64×28 캔버스 전체를 판정으로 취급하지 않는다. 유한하지 않은 값은 안전하게 false로 거부하고 게임 루프에서는 그런 상태에서 빔을 생성하지 않는다.
  4. 이 함수는 Phaser import 없이 순수 TypeScript로 둔다. 1프레임에 빔이 코기의 머리 위에서 발 아래로 지나가도 적중을 놓치지 않아야 하며, x축으로 비껴간 경로를 단순 외접 사각형 때문에 잘못 적중시키지 않아야 한다.

### I03. 빔 낙하 시스템과 장면 연결

- Related Files:
  - `src/game/systems/World03SteelBeamDropSystem.ts` :: `World03SteelBeamDropSystem` — new
  - `src/game/scenes/StageScene.ts` :: import, 필드, `create`, restart/restore, `update`, shutdown — modify
  - `src/game/systems/World02PigeonDropSystem.ts` :: death 이벤트·재시작 처리 참조 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type BeamStatus = "armed" | "falling" | "landed" | "finished" | "skipped";
  interface BeamRuntime {
    readonly definition: World03SteelBeamDefinition;
    status: BeamStatus;
    sprite?: Phaser.GameObjects.Image;
    previousY: number;
    landedRemainingMs: number;
  }
  class World03SteelBeamDropSystem {
    public constructor(
      scene: Phaser.Scene,
      player: Player,
      eventBus: GameplayEventBus,
      stageId: StageId,
      definitions: readonly World03SteelBeamDefinition[],
      getCheckpointId: () => string | null,
      canHandleContact: () => boolean,
    );
    public update(deltaMs: number): void;
    public resetForAttempt(respawnX: number): void;
    public destroy(): void;
  }
  ```
- **Data & Schema Fields**: 각 정의는 `armed`에서 시작한다. `deathPending`·`destroyed` 가드를 둔다. 빔 이미지 키는 `world-03-falling-steel-beam`, 중심 원점 `(0.5, 0.5)`, 고정 x, 표시 depth는 플레이어와 같은 전경에 보이도록 기존 투사체와 비교해 지정한다. `previousPlayerBounds`는 직전 프레임의 `Arcade.Body` 경계이며 reset 때 현재 경계로 초기화한다.
- **Execution Flow / Logic**:
  1. `StageScene`은 `getWorld03SteelBeamDefinitions(stage.id).length > 0 && !this.loadedMap`일 때만 생성한다. 기존 장애물과 같은 `getCheckpointId`/`canHandleContact` 콜백을 전달한다. 초기 생성 후와 `restoreCheckpoint` 직후 `resetForAttempt(this.player.x)`를 호출해 체크포인트 앞 정의를 `skipped`로 설정한다.
  2. `StageScene.update`에서 `play` 상태일 때만 `this.world03SteelBeamDrops?.update(elapsed)`를 호출한다. 기존 플레이어 컨트롤러 갱신 뒤에 호출하고, 기존 restart 이벤트에서 플레이어의 재시작 x로 `resetForAttempt(...)`, shutdown에서 `destroy()`를 호출한다. 보스전·로드된 맵에는 생성하지 않는다.
  3. 매 프레임 유한한 delta를 0~50ms로 제한한다. `armed` 정의의 x선을 코기 몸체 중심이 **왼쪽에서 오른쪽으로 통과**했거나 현재 중심이 그 선 바로 위에 있을 때, 해당 정의만 이미지 중심 y=-32에서 `falling`으로 바꾼다. x를 플레이어에 맞춰 이동시키지 않는다. 가로 이동 중 한 프레임에 x선을 건너뛰어도 발동해야 한다. 코기가 멀리 있을 때 먼저 발동시키지 않는다.
  4. `falling`의 새 y는 `min(494, previousY + 1600 * elapsed/1000)`이다. 이전·현재 빔 사각형과 이전·현재 플레이어 몸체를 `sweptAabbOverlap`으로 검사한다. 충돌하면 `deathPending=true`를 먼저 설정하고 `eventBus.emit("death-requested", { stageId, cause: "trap", checkpointId: getCheckpointId(), now: scene.time.now })`를 한 번 보낸다. 같은 프레임의 다른 빔은 더 처리하지 않는다.
  5. 바닥 중심 y=494에 도달하면 `landed`로 바꾸고 충돌 판정을 즉시 끈다. 경고/충격 표식 없이 빔 그림만 300ms 유지한 뒤 제거하고 `finished`로 만든다. `finished`는 그 시도에서 다시 작동하지 않는다.
  6. `resetForAttempt(respawnX)`는 남은 빔 이미지를 모두 제거하고 death 가드·이전 플레이어 경계를 초기화한다. `definition.x < respawnX`는 `skipped`, 이후는 `armed`로 다시 준비한다. 시작 지점에서 재시작하면 전체가 다시 무장하고, x=2496 체크포인트 재시작이면 x=1640·2360을 건너뛰고 x=3400만 재무장한다. `destroy`는 이미지를 한 번만 정리하고 이후 호출을 무시한다.
- **Error & Exception Handling**: player body가 없거나 숫자가 유한하지 않으면 생성·충돌 판정을 건너뛰고 상태를 깨지 않는다. `canHandleContact()`가 false이거나 장면이 일시정지·사망 상태이면 발동과 이동이 멈춘다. 장면 종료 뒤 남은 이미지·타이머·죽음 이벤트가 없어야 한다.

### I04. 데이터·연속 판정·장면 연결 검증 및 플레이 QA

- Related Files:
  - `scripts/world03-steel-beams.test.mjs` :: 배치·스윕·생명주기·장면 배선 — new
  - `scripts/world03-construction-stages.test.mjs` :: 기존 8 장애물·15 코인 회귀 — read-only
  - `scripts/world03-collapsing-floor.test.mjs` :: 구멍과 장애물·코인 회귀 — read-only
  - `scripts/world03-visual-assets.test.mjs` :: H형 빔 이미지 계약 — read-only

#### Details

- 데이터 테스트: 스테이지별 1/2/3/3, 서로 다른 ID와 고정 x, 보스 빈 배열, 전체 낙하 판정 폭이 구멍·지상 장애물(드럼 전체 160px 경로 포함)·코인 판정·체크포인트·출구와 겹치지 않는지 검사한다.
- 충돌 테스트: 시작부터 겹침, 한 프레임에 플레이어 높이 전체 통과, 경계 접촉, 양축으로 비껴간 경로, 상대 속도 0, 유한하지 않은 좌표를 구분한다. 50ms에 빔이 80px 이동해도 판정이 빠지지 않아야 한다.
- 시스템 테스트: 직접 아래를 지날 때 한 개 생성, 먼 곳에서 미발동, 시도당 한 번, 착지 후 300ms 제거와 충돌 해제, 한 번의 죽음 이벤트, pause/status false 정지, 시작점/체크포인트 재시작의 재무장·건너뜀, destroy 후 무동작을 검증한다. Phaser mock이 어려우면 순수 상태 전이 부분을 분리해 동일 계약을 테스트한다.
- 수동 QA: 일반 스테이지 1~4에서 빔 자체가 보이되 떨어지기 전 표식·그림자·문구가 없는지 확인한다. 처음 진입한 코기가 계속 달리면 낙하를 피할 수 있는지, 가만히 있으면 명중하는지, 낙하 중 사망 후 재시작·체크포인트 재개·일시정지·스테이지 전환에서 잔상이 없는지 실제 플레이로 확인한다. 보스전 기존 벽돌 패턴을 확인한다.

## Acceptance Criteria

- [x] 스테이지별 고정 낙하 지점이 1/2/3/3이며 한 지점은 시도당 한 번만 작동한다.
- [x] 코기가 바로 아래에 있을 때 예고 없이 빔 한 개가 초당 1,600px로 떨어지고, 프레임 사이 경로를 통과한 접촉도 즉시 사망시킨다.
- [x] 착지 후 300ms만 보이고 제거되며 지상 장애물로 남지 않는다.
- [x] 사망 후 재시작 시 재무장하고 체크포인트 뒤 재시작 시 지난 좌표를 건너뛴다. 일시정지·장면 종료·보스전과 충돌하지 않는다.
- [x] 연속 전진 시 첫 낙하를 피하는 시나리오를 게임 루프 시스템 테스트로 검증한다.

수동 브라우저 플레이 확인은 별도로 수행하지 못했다. 연속 전진·정지·재시작 시나리오는 시스템 테스트로 확인했다.

## Validation

- `node --experimental-strip-types --test scripts/world03-steel-beams.test.mjs scripts/world03-construction-stages.test.mjs scripts/world03-collapsing-floor.test.mjs scripts/world03-visual-assets.test.mjs` — 배치·연속 판정·재시작·기존 계약 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/data/world03SteelBeams.ts src/game/systems/world03SteelBeamCollision.ts src/game/systems/World03SteelBeamDropSystem.ts src/game/scenes/StageScene.ts scripts/world03-steel-beams.test.mjs` — 수정한 코드 lint 통과.
- `npm run build` — 월드 3 일반 스테이지와 보스전을 포함한 빌드 성공.
- `git diff --cached --check` 및 `git diff --cached` — 기존 미커밋 변경을 섞지 않고 이 Task의 변경 부분만 스테이징.

## Commit Message

```text
feat(월드3): 철골 빔 기습 낙하 추가

Plan: 2026-10-27-world03-construction-hazards
Phase: P01-construction-hazards
Task: T03-falling-steel-beam

- 고정 지점 빔 낙하와 프레임 사이 충돌 판정 구현
- 체크포인트·재시작·착지 수명과 스테이지 검증 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 한국어 커밋에 포함
