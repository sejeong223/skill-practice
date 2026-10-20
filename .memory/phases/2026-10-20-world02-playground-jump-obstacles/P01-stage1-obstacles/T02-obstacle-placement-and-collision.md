# Task: T02 모래 위 장애물 배치와 일반 7종 접촉 사망

## Status: done

## Goal

월드 2 첫 스테이지에 T01의 사물 8종이 모두 보이게 놓는다. 고양이 외 7종은 코기가 점프로 피할 수 있으며, 접촉 시 기존 사망·체크포인트 재시작 경로가 한 번 동작한다.

## Decision Summary

- 현재 월드 2 첫 스테이지는 실제 Tiled JSON 없이 `StageRuntime.buildFromSegments()`와 단일 모래 충돌 발판을 쓴다. 따라서 전용 고정 장애물 시스템을 `!loadedMap` 경로에 붙인다.
- 스테이지 1의 기존 색 사각형 임시 함정·적은 제거한다. 다른 스테이지의 임시 요소, 코인, 체크포인트, 출구와 모래 바닥은 유지한다.

## Implementation

### I01. 8종 배치 데이터

- Related Files:
  - `src/game/data/world02Obstacles.ts` :: `World02ObstacleKind`, `World02ObstacleDefinition`, `WORLD02_STAGE1_OBSTACLES` — new.
  - `src/game/core/constants.ts` :: `DEFAULT_PLAYER_TUNING`, `NORMAL_MAP_WIDTH` — 실제 점프·맵 크기 참고; read-only.
  - `src/game/entities/Player.ts` :: 72×40 몸체와 발 기준 — 참고; read-only.

#### Details

- 정확한 타입 계약:
  ```typescript
  export type World02ObstacleKind =
    | "crushed-cola-can" | "empty-snack-bag" | "pink-sand-shovel"
    | "orange-traffic-cone" | "duck-spring" | "sleeping-fat-cat"
    | "elephant-spring" | "rabbit-spring";
  export interface World02ObstacleDefinition {
    readonly id: string;
    readonly kind: World02ObstacleKind;
    readonly x: number;                 // 이미지와 충돌체의 가로 중심, 월드 좌표
    readonly groundY: 504;             // 기존 모래 충돌 발판 윗면
    readonly textureKey: string;        // T01 manifest 키
    readonly hitbox: Readonly<{ width: number; height: number }>;
    readonly contact: "instant-death" | "cat-scratch";
  }
  export const WORLD02_STAGE1_OBSTACLES: readonly World02ObstacleDefinition[];
  ```
- 최초 배치와 충돌체 크기(px). 각 `id`는 `world-02-stage-1-obstacle-<kind>`이고 textureKey는 `world-02-obstacle-<kind>`다. 모든 `groundY`는 504다.

  | x | kind | hitbox (폭×높이) | contact |
  | :--- | :--- | :--- | :--- |
  | 420 | `crushed-cola-can` | 28×18 | `instant-death` |
  | 760 | `empty-snack-bag` | 34×22 | `instant-death` |
  | 1100 | `pink-sand-shovel` | 26×40 | `instant-death` |
  | 1460 | `orange-traffic-cone` | 34×40 | `instant-death` |
  | 1810 | `duck-spring` | 42×44 | `instant-death` |
  | 2160 | `sleeping-fat-cat` | 62×32 | `cat-scratch` |
  | 2850 | `elephant-spring` | 44×44 | `instant-death` |
  | 3220 | `rabbit-spring` | 42×44 | `instant-death` |

- 시작 안전구간 x<192, 출구 안전구간 x≥3648에는 장애물 충돌체를 놓지 않는다. 체크포인트 x=2496에서 좌우 최소 250px 이상을 비운다. 점프 초기 속도 -460px/s, 수직 가속도 약 1200px/s², 수평 속도 240px/s, 몸체 폭 72px를 기준으로 40~44px 높이의 기구를 넘을 수 있어야 한다. T04에서 실제 충돌로 최종 검증하고 필요 시 폭/높이를 줄인다. 물체 간 중심 거리는 기본 300px 이상이다.
- `contact`는 사용자 확정 결과를 인코딩한다. 고양이의 최종 `cat-scratch` 동작은 T03이 구현한다. T02에서는 잠든 고양이를 표시하고 충돌체를 준비하되 일반 즉시 사망과 구분한다.

### I02. 임시 장애물 교체와 Phaser 충돌 연결

- Related Files:
  - `src/game/data/worlds.ts` :: `createSegment()` — `world-02-stage-1`의 `traps`와 `enemies`를 `[]`로 하여 기존 색 사각형 3개와 임시 고양이 3개를 제거; modify.
  - `src/game/systems/World02ObstacleSystem.ts` :: `World02ObstacleSystem` — 8종 표시·7종 오버랩·정리; new.
  - `src/game/scenes/StageScene.ts` :: `create`, `events.once("shutdown")` — 첫 스테이지에만 시스템 생성/폐기; modify.
  - `src/game/core/events.ts` :: `GameplayEventMap["death-requested"]` — 기존 payload 스키마 참고; read-only.
  - `src/game/systems/DeathSystem.ts`, `RestartController.ts` — 기존 사망·체크포인트 복귀 경로 참고; read-only.

#### Details

- `World02ObstacleSystem` 생성자 계약:
  ```typescript
  constructor(
    scene: Phaser.Scene,
    player: Player,
    eventBus: GameplayEventBus,
    stageId: StageId,
    definitions: readonly World02ObstacleDefinition[],
    getCheckpointId: () => string | null,
    canHandleContact: () => boolean,
  );
  public destroy(): void;
  ```
- 각 정의마다 `scene.add.image(x, groundY, textureKey).setOrigin(0.5, 1).setDepth(2)`로 이미지를, `scene.add.zone(x, groundY - hitbox.height / 2, hitbox.width, hitbox.height)`로 보이지 않는 충돌체를 만들고 정적 Arcade Body를 붙인다. `scene.physics.add.overlap(player, zone, callback)`의 `Collider` 참조를 보관한다. 이미지 자체의 투명 여백이나 장식(동물 귀/삽 손잡이)은 치명 판정에서 제외한다. 발판 Collider와 별개의 **overlap**이므로 코기는 기구를 밟고 서지 않는다.
- 일반 7종은 `canHandleContact()`가 true일 때 한 번의 접촉 콜백에서 `eventBus.emit("death-requested", { stageId, cause: "trap", checkpointId: getCheckpointId(), now: scene.time.now })`를 보낸다. `DeathSystem`의 동기 재시작·중복 방지 가드를 재사용한다. 일시정지/컷신/클리어 때는 `canHandleContact`가 false라 아무것도 일어나지 않는다.
- 고양이 레코드는 T03이 추가할 특수 처리를 위해 `contact === "cat-scratch"`로 구분한다. T02 단계에서는 시각/Zone만 준비하고 즉시 사망 오버랩을 등록하지 않는다.
- `StageScene.create()`에서는 `stage.id === "world-02-stage-1" && !this.loadedMap`일 때만 `World02ObstacleSystem`을 만든다. 같은 조건에서 이미 `createWorld02SandFloor()`가 실행된다. `runtime`, `gameplayEventBus`, `checkpointSystem`이 준비된 뒤 생성하며 `getCheckpointId`는 `runtime.runtimeState.checkpointId`를 사용한다. shutdown에서 콜라이더·Zone·이미지·트윈을 모두 폐기한다. 미래 실제 Tiled 맵이 들어오면 이 임시 시스템을 중복 생성하지 않는다.
- 필요하다면 스프링 **이미지만** ±2° 이내로 천천히 흔든다. 충돌 Zone은 움직이지 않는다. 충돌 영역의 시각적 어긋남이 커지면 흔들림은 생략한다.

### I03. 회귀 검증

- Related Files:
  - `scripts/world02-obstacles.test.mjs` — 목록·안전구간·간격·충돌 스키마 검증; new.
  - `scripts/world02-sand-floor.test.mjs` — 기존 `traps.length > 0`/`enemies.length > 0` 기대를 새 8종 데이터와 임시 요소 제거 기대에 맞게 갱신; modify.

#### Details

- 8종의 `id`, `textureKey`, `contact`, 좌표, 각 충돌체의 바닥 정렬, 시작/출구 안전구간, 체크포인트 좌우 250px, 이웃 간 최소 300px을 검사한다. 7종 즉시 사망, 고양이 1종 특수 접촉 구분을 확인한다.
- `world02-sand-floor.test.mjs`의 단일 플랫폼(0..3840, top504) 검사는 유지한다. 첫 스테이지의 임시 traps/enemies가 비워졌는지만 바꾸고 다른 스테이지의 fallback을 계속 확인한다.
- 일반 장애물 하나에 실제 Arcade 충돌을 넣어 `death-requested`가 정확히 한 번 발생하고 체크포인트로 복귀하는지는 T04의 브라우저 검증으로 확인한다. 단순 데이터 테스트만으로 충돌 성공으로 간주하지 않는다.

## Acceptance Criteria

- [x] 모래 위에 8종이 각각 배치되고 기존 색 사각형·임시 적이 첫 스테이지에서 사라진다.
- [x] 일반 7종의 접촉 사망 이벤트를 기존 사망·체크포인트 재시작 경로에 연결했다. 실제 Arcade 접촉은 T04에서 확인한다.
- [x] 장애물 간 점프 간격과 연속 바닥·코인·체크포인트·출구 데이터가 유지된다. 실제 회피 가능성은 T04에서 확인한다.

## Validation

- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-sand-floor.test.mjs` — 에셋/배치/기존 바닥 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint` — 새 시스템과 정의 lint 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.

## Commit Message

```text
feat(world02): 모래 놀이터에 점프 장애물 배치

Plan: 2026-10-20-world02-playground-jump-obstacles
Phase: P01-stage1-obstacles
Task: T02-obstacle-placement-and-collision

- 첫 스테이지 임시 함정과 적을 실제 사물 이미지로 교체
- 일곱 일반 장애물의 충돌 사망과 체크포인트 복귀 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 테스트 16건, 린트, 빌드, 타입 검사
- commit: 이 Task의 한국어 커밋
