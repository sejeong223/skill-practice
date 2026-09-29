# Task: T02 일반 4개 스테이지를 쉬운 고정 경로로 재배치

## Status: pending

## Goal
월드 1 일반 스테이지의 돌발 기믹 66개를 처음부터 보이는 정적 장애물 24개와 선택적인 가짜 간식 코인 6개로 교체한다. 네 맵의 바닥을 평평하게 하고 Tiled JSON까지 동기화한다.

## Decision Summary
- T01의 `static-ant`, `static-white-spike`, `static-seagull`, `static-box`를 각 6개 사용한다. 기존 돌발 종류는 월드 1 카탈로그에서 0개로 만든다.
- 가짜 코인 3종은 각 2개 유지하되, 공중 그림의 실제 영역에 점프해서 닿을 때만 발동한다. 기존 결과와 월드 2 이후 데이터 타입은 유지한다.

## Implementation

### I01. 기믹 카탈로그와 고정 배치
- Related Files:
  - `src/game/data/world01Gimmicks.ts` :: `getWorld01FloorY`, `makeGimmick`, `WORLD01_GIMMICKS`, `WORLD01_GIMMICK_COUNT`, `WORLD01_GIMMICK_MINIMUMS`, `getWorld01GimmicksForStage` — 30개 고정 배치; modify
  - `src/game/core/contentTypes.ts` :: `WorldGimmickDefinition`, `GimmickCounterplay`, `GimmickOutcome` — 기존 타입 계약 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  function makeGimmick(
    stageNumber: 1 | 2 | 3 | 4,
    sectionIndex: 2 | 3 | 4,
    serial: number,
    kind: GimmickKind,
    trigger: GimmickTrigger,
    x: number,
    visualKey: string,
    counterplay: GimmickCounterplay,
    outcome: GimmickOutcome,
    variantKey?: string,
  ): WorldGimmickDefinition;
  export function getWorld01FloorY(stageNumber: 1 | 2 | 3 | 4, x: number): number;
  ```
- **Data & Schema Fields**:
  - 정적 기믹: `trigger: "walk-enter"`, `counterplay: { action: "jump-before-zone", notes: "보이는 장애물을 미리 점프해 넘는다." }`, `outcome: { kind: "instant-death", deathCause: "trap" }`, `visualKey`: `ant`/`white-spike`/`seagull`/`cat-box`.
  - 가짜 코인: `trigger: "collect"`, `visualKey: "bone-coin"`, `counterplay.action: "do-not-collect"`, `variantKey`: 초록 `green-body`, 후진 `reverse-control`, 불꽃 `fire-launch`.
  - 초록 `outcome`: `{ kind: "instant-death", deathCause: "trap" }` (`createChainRules`의 기존 450ms 지연 유지). 후진 `outcome`: `{ kind: "forced-control-death", deathCause: "scripted", controlOverride: "drift-backward", durationMs: 1800 }`. 불꽃 `outcome`: `{ kind: "launch-death", deathCause: "scripted", controlOverride: "launch-up", durationMs: 1700 }`.
  - `makeGimmick`의 `id`/`objectId`/`chainIds`/`seedGroup` 규칙과 `width: 64`, `height: 96`은 유지. 신규 `serial`은 아래 101~130을 사용하여 옛 체크포인트 스냅샷의 기믹 ID와 충돌하지 않는다.
  - `WORLD01_GIMMICK_MINIMUMS`: `{ "static-ant": 6, "static-white-spike": 6, "static-seagull": 6, "static-box": 6, "fake-bone-green": 2, "fake-bone-reverse": 2, "fake-bone-fire": 2 }`. 총 30개.
- **Execution Flow / Logic**:
  1. 기존 `coreLayout`, `coreGimmicks`, `specialGimmicks`, `recurringPositions`, `recurringGimmicks`, `coreXOverrides`를 아래 명시 배치로 대체한다. `WORLD01_GIMMICKS`는 각 행에 대해 `makeGimmick`을 호출한 순서의 배열이다.
  2. 모든 x는 맵 오브젝트의 왼쪽 좌표(px)이고 바닥은 `getWorld01FloorY(...) === 512`. section 2는 x 192~1343, section 3은 1344~2495, section 4는 2496~3647이다. 아래 section 값은 오브젝트 중심 x+32도 같은 section에 들어간다.

| serial | stage | section | x | kind | visualKey |
| ---: | ---: | ---: | ---: | :--- | :--- |
| 101 | 1 | 2 | 320 | static-ant | ant |
| 102 | 1 | 2 | 760 | static-white-spike | white-spike |
| 103 | 1 | 2 | 1200 | static-seagull | seagull |
| 104 | 1 | 3 | 1700 | static-box | cat-box |
| 105 | 1 | 4 | 2800 | static-white-spike | white-spike |
| 106 | 1 | 4 | 3320 | static-seagull | seagull |
| 107 | 1 | 3 | 2250 | fake-bone-green | bone-coin |
| 108 | 2 | 2 | 400 | static-ant | ant |
| 109 | 2 | 2 | 900 | static-box | cat-box |
| 110 | 2 | 2 | 1260 | static-white-spike | white-spike |
| 111 | 2 | 3 | 1720 | static-seagull | seagull |
| 112 | 2 | 4 | 2800 | static-box | cat-box |
| 113 | 2 | 4 | 3300 | static-ant | ant |
| 114 | 2 | 3 | 2200 | fake-bone-reverse | bone-coin |
| 115 | 2 | 4 | 3560 | fake-bone-green | bone-coin |
| 116 | 3 | 2 | 340 | static-box | cat-box |
| 117 | 3 | 2 | 820 | static-seagull | seagull |
| 118 | 3 | 2 | 1280 | static-ant | ant |
| 119 | 3 | 3 | 1740 | static-white-spike | white-spike |
| 120 | 3 | 4 | 2800 | static-box | cat-box |
| 121 | 3 | 4 | 3340 | static-white-spike | white-spike |
| 122 | 3 | 3 | 2250 | fake-bone-fire | bone-coin |
| 123 | 4 | 2 | 340 | static-ant | ant |
| 124 | 4 | 2 | 900 | static-seagull | seagull |
| 125 | 4 | 2 | 1270 | static-box | cat-box |
| 126 | 4 | 3 | 1750 | static-white-spike | white-spike |
| 127 | 4 | 4 | 2820 | static-ant | ant |
| 128 | 4 | 4 | 3360 | static-seagull | seagull |
| 129 | 4 | 3 | 2190 | fake-bone-reverse | bone-coin |
| 130 | 4 | 4 | 3540 | fake-bone-fire | bone-coin |

  3. `getWorld01FloorY`는 기존 매개변수 타입을 유지하고 항상 `512`를 반환한다. 사용하지 않는 매개변수는 lint/TS 설정에 맞게 `_stageNumber`, `_x`로 이름을 바꾼다.
  4. stage 1~4별 정적 장애물 6개를 유지하고, 각 가짜 코인은 가장 가까운 정적 장애물과 x 기준 180px 이상 떨어뜨린다. 안전 구간 x<192 및 x>=3648에는 기믹을 두지 않는다.

### I02. 맵·체인·코인 판정 동기화
- Related Files:
  - `src/game/data/world01Maps.ts` :: `createChainRules`, `createStageMap` — 고양이 기습 체인 제거, 4개 맵 높이 720; modify
  - `src/game/data/worlds.ts` :: `createNormalStage` — 월드 1 세그먼트 대체 경로의 돌발 `traps`·`enemies` 제거; modify
  - `src/game/systems/MapGimmickSystem.ts` :: `overlapsGimmick`, `getVisualFrame`, `reset` — 가짜 코인 접촉 영역과 미리 보이는 변형 프레임; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-1.json` ~ `world-01-stage-4.json` — 생성된 Tiled 맵; modify (수동 JSON 편집 금지)

#### Details
- **Signatures & Types**:
  ```typescript
  function createChainRules(stageNumber: 1 | 2 | 3 | 4, gimmicks: ReturnType<typeof getWorld01GimmicksForStage>): readonly MapChainRule[];
  function createStageMap(stageNumber: 1 | 2 | 3 | 4): StageMapDefinition;
  private overlapsGimmick(gimmick: WorldGimmickDefinition): boolean;
  private getVisualFrame(gimmick: WorldGimmickDefinition, revealed: boolean): string | undefined;
  ```
- **Data & Schema Fields**:
  - `StageMapDefinition.mapHeight: 720` for all 4 stages; `MapSectionDefinition.vertical: false` for all sections.
  - 체크포인트 ID (`world-01-stage-N-checkpoint`)와 출구 ID (`world-01-stage-N-exit`)는 그대로 둔다. 새 기믹 ID를 사용하는 이전 스냅샷의 옛 기믹 상태는 매칭되지 않으므로 기본 `armed`로 시작한다.
- **Execution Flow / Logic**:
  1. `world01Maps.ts`에서 `stageNumber === 1 || 3`일 때의 `world01-cat-chain-*` rule과 `chainObjects` 생성/주입을 제거한다. `createChainRules`는 기믹별 규칙만 반환한다. 미사용 `stageNumber`는 시그니처를 유지하며 `_stageNumber`로 바꾼다. 기존 코인 3종의 `set-player-tint`/`force-control`/`request-death` 결과는 유지한다.
  2. `createStageMap`에서 맵 높이를 항상 `720`으로, section 3의 `vertical`을 항상 `false`로 한다. 가짜 체크포인트가 없어 `checkpointSpikeObjects`는 빈 배열이 되며 새 객체를 만들지 않는다.
  3. `createNormalStage`에서 `blueprint.id === "world-01"`인 경우에만 각 `createSegment(...)` 결과의 `traps`와 `enemies`를 빈 배열로 만든다. Tiled 맵 로딩 실패 시에도 옛 무힌트 함정·고양이가 되살아나지 않게 한다.
  4. 가짜 코인 `overlapsGimmick` 분기는 `getVisualY`의 `floorY - 58`을 중심으로 `getVisualSize`의 `[34,26]`을 사용해 가로 34px·세로 26px 사각형을 만든다. 플레이어가 땅에서 걷는 몸통 높이 40px과 5px 간격을 확보하여 자동 수집되지 않게 한다.
  5. `getVisualFrame(gimmick, false)`는 가짜 코인마다 `bone-coin-green`/`bone-coin-reverse`/`bone-coin-fire`를 반환한다. `reset`도 같은 변형 프레임으로 복원한다. 기존 수집 결과는 유지한다.
  6. `npm.cmd run world01:maps`로 Tiled JSON 4개를 재생성한다. 직접 문자열을 편집하지 않는다.

### I03. 새 난이도 검증 기준
- Related Files:
  - `src/game/data/validateMaps.ts` :: `validateCampaignMaps`, `validateGimmicks` — 월드 1 30개·허용 종류 검증; modify
  - `scripts/world01-maps.mjs` :: `verifyMap`, `run` — 생성 JSON과 원본 일치, 30개 검증; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function validateCampaignMaps(registry: Pick<ContentRegistry, "stages" | "worldMaps">): CampaignMapValidationReport;
  function verifyMap(stageNumber: number, definition: StageMapDefinition, tiledMap: unknown): string[];
  ```
- **Data & Schema Fields**:
  - 허용 `GimmickKind` 집합은 정적 4종과 가짜 코인 3종이다. 각 종류의 최소 수량은 I01의 `WORLD01_GIMMICK_MINIMUMS`와 정확히 일치한다.
- **Execution Flow / Logic**:
  1. `validateCampaignMaps`의 World 1 `length < 66` 조건을 `length !== 30`으로 바꾼다. 다른 월드의 `count < 30` 규칙은 그대로 둔다.
  2. `validateGimmicks`의 `expectedCounterplay`에 정적 4종의 `"jump-before-zone"`을 추가한다. World 1 일반 4개 맵에는 허용 집합 밖 종류가 한 개라도 있으면 오류를 낸다.
  3. `scripts/world01-maps.mjs`의 전체 `66` 하한을 정확히 `30`으로 교체하고, `--check`에서 생성 예정 JSON과 저장된 JSON을 비교해 좌표·종류·층 높이 불일치를 실패로 잡는다. 기존 1:1 오브젝트 ID·안전 구간·8초 간격 검사는 유지한다.
  4. 새 맵 파일의 object layer에서 구 `world01-cat-chain-*`, `forward-jump-wall`, `ground-collapse`, `ground-rise`, `jump-pigeon`, `box-cat-arm`, `revealed-white-spike` 종류가 0개인지 검사한다.

## Acceptance Criteria
- [ ] 월드 1 일반 스테이지의 총 기믹은 정확히 30개이며 정적 4종 각 6개·가짜 코인 3종 각 2개다.
- [ ] 모든 일반 맵은 3840×720이고 평평한 512px 바닥을 가진다.
- [ ] 보이지 않는 벽, 출현 새·팔, 바닥 변화, 기습 고양이, 가짜 체크포인트, 강제 말풍선이 없다.
- [ ] 가짜 코인은 서서 지나가면 수집되지 않고, 점프해 선택적으로 닿을 수 있다.
- [ ] 체크포인트와 출구 ID가 유지되어 진행 데이터 연결이 끊기지 않는다.

## Validation
- `npm.cmd run world01:maps` — 4개 Tiled JSON 재생성
- `npm.cmd run world01:maps:check` — 30개 배치·맵 동기화·기존 공간 검증 통과
- `npx.cmd tsc --noEmit` — 타입 검사 통과
- `npm.cmd run lint` — 전체 린트 통과
- `npm.cmd run build` — 프로덕션 빌드 통과

## Commit Message
```text
feat(game): rebuild world one as a visible obstacle route

Plan: 2026-09-29-world01-easy-pass
Phase: P01-easy-route
Task: T02-rebuild-normal-stages

- Replace 66 surprise gimmicks with 24 static hazards and six optional fake treats
- Regenerate flat World 1 maps and align validation
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
