# Task: T01 월드 1 일반 맵 2560px 압축

## Status: superseded

2026-10-12 요청에 따라 [새 T01](../../2026-10-12-world01-gameplay-refinement/P01-gameplay-refinement/T01-compact-motion.md)과 [새 T02](../../2026-10-12-world01-gameplay-refinement/P01-gameplay-refinement/T02-snacks-obstacles.md)가 이 청사진을 대체한다. 아래 본문은 이전 계획 이력으로 보존한다. 이 Task를 구현 완료로 센 것은 아니며 새 계획의 최종 기믹32개·진짜간식20개·위장·이미지 자르기 최후 원칙이 우선한다.

## Goal

월드 1 일반 스테이지 1~4를 각각 3840px에서 2560px로 줄이고, 24개 기믹·두 체크포인트·출구·Tiled 지형을 새 길이에 맞춰 한 번에 정렬한다. 다른 월드의 3840px 맵과 저장된 스테이지/체크포인트 ID는 유지한다.

## Decision Summary

- 일반 맵마다 5구간 길이 `[192, 720, 736, 720, 192]`; 경계 `[0, 192, 912, 1648, 2368, 2560]`.
- 실제 체크포인트는 스테이지 2 x1520, 스테이지 4 x2320. ID는 `world-01-stage-2-checkpoint` / `world-01-stage-4-checkpoint` 그대로 둔다.
- 물리 위험은 기존 종류·개수를 유지하고 이 맵에서만 인접 x 간격 448~640px을 허용한다. 월드 2~5의 폭·검증 기준은 변경하지 않는다.

## Implementation

### I01. 월드 1 전용 길이와 맵 메타데이터

- Related Files:
  - `src/game/core/constants.ts` :: `WORLD01_NORMAL_MAP_WIDTH` / 월드 1 전용 2560 상수 추가; modify
  - `src/game/data/world01Maps.ts` :: `world01Checkpoint`, `sectionIndex`, `createStageMap`, `WORLD01_STAGE_MAPS`; modify
  - `src/game/data/worlds.ts` :: `createNormalStage`; modify

#### Details

- **Signatures & Types**: `WORLD01_NORMAL_MAP_WIDTH: number = 2560`; `world01Checkpoint(stageNumber: 1 | 2 | 3 | 4): { id: string; x: number; sectionIndex: 3 | 4 } | null`; `createStageMap(stageNumber): StageMapDefinition`. `NORMAL_MAP_WIDTH = 3840`은 다른 월드용으로 그대로 둔다.
- **Data & Schema Fields**: 모든 월드 1 일반 `StageDefinition.mapWidth`와 `StageMapDefinition.mapWidth`는 2560. `StageDefinition.segments[].length`는 `[192,720,736,720,192]`. `MapSectionDefinition`의 `x`, `width`, `index`, `role`, `checkpointId`, `mapObjectIds`를 새 경계에 맞춘다. 5구간 `safe-entry/gauntlet/gauntlet/gauntlet/safe-exit` 및 스테이지 2·4의 `checkpoint-gauntlet` 역할은 유지한다.
- **Execution Flow / Logic**:
  1. `world01Checkpoint`에서 스테이지 2는 x1520/section3, 스테이지 4는 x2320/section4, 나머지는 `null`을 반환한다.
  2. `sectionIndex(x)`는 192, 912, 1648, 2368 경계로 1~5를 반환한다. `createStageMap`의 종료 오브젝트는 `x = 2560 - 192 + 48 = 2416`, `width=32`; 맵의 `getWorld01FloorY(stage, 2416)-128` 위에 둔다. 출구 ID `world-01-stage-{n}-exit`는 유지한다.
  3. `createNormalStage`는 월드 1일 때만 `mapWidth=2560`과 새 세그먼트를 사용한다. 다른 월드는 기존 3840px, 기존 세그먼트 배열을 사용한다. `mapKey`, 맵 파일 경로, 스폰 x96, 체크포인트 ID는 유지한다.
- **Failure/State**: 체크포인트 없는 스테이지 1·3에 새 체크포인트를 만들지 않는다. 저장 데이터의 stage ID 및 checkpoint ID가 바뀌면 재시도와 저장 복원이 깨지므로 ID 변경은 금지한다.

### I02. 기믹 좌표와 바닥 높이 재배치

- Related Files:
  - `src/game/data/world01Gimmicks.ts` :: `dangers`, `coins`, `section`, `getWorld01FloorY`; modify

#### Details

- **Signatures & Types**: `dangers: Readonly<Record<Stage, readonly [DangerKind, number][]>>`; `coins: Readonly<Record<Stage, readonly [CoinKind, number][]>>`; `getWorld01FloorY(stage: Stage, x: number): number`. 기믹의 `x`, `y`, `width`, `height`, `sectionIndex`, `objectId` 타입은 유지한다.
- **Exact danger coordinates**:

  | Stage | Kind → x (px) |
  | :--- | :--- |
  | 1 | ant-static 336; white-spike-static 944; box-static 1552; pigeon-static 2160 |
  | 2 | ant-static 320; open-manhole 800; pigeon-static 1280; white-spike-static 1760; box-static 2240 |
  | 3 | ant-static 352; box-static 960; white-spike-static 1568; pigeon-static 2176 |
  | 4 | pigeon-static 288; open-manhole 736; box-static 1184; white-spike-static 1664; ant-static 2112 |

- **Exact fake coin coordinates**: 스테이지 1 green 1360; 스테이지 2 reverse 600, green 2016; 스테이지 3 fire 1344; 스테이지 4 reverse 1056, fire 1952. 종류별 기존 효과와 총 개수 6은 그대로 유지한다.
- **Floor profile**: 스테이지 1·3은 전 구간 `y=512`. 스테이지 2는 x<1024 →512, x<1280 →496, x<1792 →480, x<2048 →496, 그 뒤 512. 스테이지 4는 x<896 →512, x<1152 →496, x<1664 →480, x<1920 →496, 그 뒤 512. 높이 변화는 16px씩이며 맨홀 x800/736은 512px 평지에 있다.
- **Execution Flow / Logic**: `section(x)`는 위험/코인 중앙 좌표를 경계 912와 1648에 따라 2·3·4로 분류한다. 기믹 ID에는 새 x가 들어가지만 실제 저장·재시도 기준인 스테이지 ID와 체크포인트 ID는 유지한다. `makeDanger`·`makeCoin`은 새 바닥 높이로 y를 계산한다.
- **Failure/State**: 위험은 안전 시작/종료 구간에 두지 않는다. 가짜 코인은 바닥에서 최소 80px 높이 위에 유지하며, 열린 맨홀 폭 80px은 타일 충돌이 없는 구멍으로 남긴다.

### I03. 생성 스크립트와 데이터 검증 정렬

- Related Files:
  - `scripts/world01-maps.mjs` :: `makeMap`, `verifyMap`, `run`; modify
  - `src/game/data/validateMaps.ts` :: `validateAllMaps` 안 월드 1 위험 간격 검사; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-{1,2,3,4}.json` :: 생성된 네 파일; regenerate

#### Details

- **Data & Schema Fields**: Tiled `width=160` 타일, `height=45` 타일, `tilewidth=tileheight=16`; 기존 4개 tilelayer 이름/ID, 기믹·엔티티 objectgroup, tileset key를 유지한다. 체크포인트 object `x`는 1520/2320이고 `trueCheckpoint=true`; 출구 object `x=2416`.
- **Execution Flow / Logic**:
  1. `makeMap`은 변경된 `StageMapDefinition`과 `getWorld01FloorY`를 사용해 전체 160열을 생성한다. 열이 맨홀 범위 안이면 바닥 타일을 비운다.
  2. `verifyMap`의 3840px 고정 검사와 1920/3488 체크포인트 기대값을 각각 2560px, 1520/2320으로 바꾼다. 위험 간격 최소 656 검사를 월드 1만 최소 448, 최대 640으로 갱신한다. `validateMaps.ts`에도 같은 최소/최대 기준을 적용한다.
  3. `npm run world01:maps`로 네 JSON을 재생성한 뒤 `npm run world01:maps:check`로 생성 데이터와 정의를 비교한다. 현재 스크립트는 폭/오브젝트 위주로 검사하므로 체크 모드에서 레이어 타일 데이터·오브젝트 좌표도 새 정의와 일치하는지 비교하도록 강화한다.
- **Failure/State**: 스크립트와 앱 검증의 상수가 다르면 하나가 통과하고 다른 하나가 실패할 수 있다. 두 경로 모두 같은 2560px/448~640px 기준을 검증한다. 총 24개 기믹·스테이지별 정적 위험 4개·스테이지 2/4 맨홀 각 1개·실제 체크포인트 총 2개를 유지한다.

## Acceptance Criteria

- [ ] 네 일반 `StageDefinition`·`StageMapDefinition`·Tiled JSON의 폭이 모두 2560px이다. 월드 2~5는 3840px로 남는다.
- [ ] 구간 경계가 0/192/912/1648/2368/2560이고 스테이지 2/4 체크포인트가 x1520/x2320이다.
- [ ] 월드 1의 24개 기믹, 두 맨홀, 두 실제 체크포인트가 유지되고 출구가 각 맵의 안전 종료 구간에 있다.
- [ ] `world-01-stage-4-checkpoint`를 통한 보스전 세 번째 피격 후 재시도 경로가 유효하다.

## Validation

- `npm run world01:maps` → 네 Tiled 파일 재생성.
- `npm run world01:maps:check` → 너비·좌표·타일 레이어·기믹 개수·구간 검사 통과.
- `npx tsc --noEmit` → 타입 오류 없음.
- `npm run test:progression` → 기존 진행 ID와 다음 스테이지 연결 회귀 통과.
- `npm run lint` → 수정한 TS·스크립트 린트 오류 없음.

## Commit Message

```text
feat(world01): shorten four normal maps to 2560 pixels

Plan: 2026-10-01-world01-compact-scenes
Phase: P01-world01-map-and-hud
Task: T01-compact-normal-maps

- Reposition hazards, coins, checkpoints, and exits within the shorter route
- Regenerate and validate all four World 1 Tiled maps
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
