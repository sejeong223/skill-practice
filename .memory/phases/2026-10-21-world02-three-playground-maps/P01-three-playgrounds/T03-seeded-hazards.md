# Task: T03 맵 2·3 시드 장애물과 비둘기 배치

## Status: pending

## Goal

월드 2 맵 2·3에 새·기존 장애물 8개와 비둘기 구간 3개씩을 재현 가능한 무작위 배치로 연결한다.

## Decision Summary

- 맵 1의 고정 장애물 8개와 고정 비둘기 3구간은 보존한다. 맵 2·3만 시드 기반으로 종류·후보 좌표를 섞고, 같은 시드로 돌아오거나 죽으면 같은 배치를 만든다.
- 캔·봉지·고양이는 외형만 다르다. 사망·고양이 하악질/할퀴기·비둘기 한 마리당 세 번 배설과 3초 등장 주기는 기존과 동일하다.

## Implementation

### I01. 장애물 종류와 여러 고양이 연출

- Related Files:
  - `src/game/data/world02Obstacles.ts` :: `World02ObstacleKind`, `World02ObstacleDefinition`, `WORLD02_STAGE1_OBSTACLES`; modify, 맵 1 배열은 순서·좌표 그대로 둔다.
  - `src/game/systems/World02ObstacleSystem.ts` :: constructor, `resetForAttempt`, `handleCatContact`, `destroy`; modify.
  - `scripts/world02-cat-attack.test.mjs` :: 기존 회색 고양이와 새 고양이 두 마리 이상이 있을 때 각 그림·접촉·초기화 검사; modify.

#### Details

- **Signatures & Types**: `World02ObstacleKind`에 `crushed-cider-can`, `crushed-fanta-can`, `empty-cheetos-bag`, `sleeping-orange-cat`, `sleeping-tuxedo-cat`을 추가한다. `World02ObstacleDefinition`에 `readonly scratchTextureKey?: string`과 `readonly originY?: number`를 추가한다. `contact === "cat-scratch"`인 세 고양이는 `scratchTextureKey`를 반드시 채우고 시스템 생성 시 누락을 검증한다.
- **Data & Schema Fields**: 캔 변형은 기존 콜라와 `displaySize:{width:72,height:50}`, `hitbox:{width:36,height:22}`; 두 봉지는 `displaySize:{width:175,height:95}`, `hitbox:{width:42,height:18}`, `originY:0.88`; 세 고양이는 `displaySize:{width:100,height:60}`, `hitbox:{width:40,height:26}`, `contact:"cat-scratch"`.
- **Execution Flow / Logic**: `World02ObstacleSystem`의 단일 `catSprite`를 고양이 sprite 목록으로 바꾸어 재시작 때 각 `definition.textureKey`로 모두 되돌린다. 접촉한 개체만 해당 `scratchTextureKey`로 바꾸고 기존 360ms 하악질/할퀴기/사망 경로와 동시 중복 사망 방지를 유지한다. `originY`가 없으면 1을 사용한다.
- **Error & Exception Handling**: 새 고양이가 둘 이상이어도 마지막 개체만 초기화되는 현행 한계를 제거한다. 사망 연출 중 다른 고양이 접촉은 현재 `attackPending`으로 무시하고, 모든 collider·이미지를 장면 종료 때 정리한다.

### I02. 맵별 안전한 무작위 배치

- Related Files:
  - `src/game/data/world02StageHazards.ts` :: `getWorld02StageHazards`와 안전성 검사; new.
  - `src/game/data/world02PigeonDrops.ts` :: 기존 세 구간 상수·3초 등장·세 배설 오프셋은 유지하고 맵 2·3에서 재사용할 타입/기본값을 제공; modify only if helper export is needed.
  - `src/game/scenes/StageScene.ts` :: `StageScene.create`의 seed 결정과 세 stage의 `World02ObstacleSystem`/`World02PigeonDropSystem` 생성; modify.
  - `scripts/world02-stage-hazards.test.mjs` :: 여러 seed에서 배치 다양성·재현성·안전 간격·출현 보장; new.
  - `scripts/world02-obstacles.test.mjs`, `scripts/world02-pigeon-drops.test.mjs` :: 맵 1 회귀 및 맵 2·3 공통 동작; modify as needed.

#### Details

- **Signatures & Types**:
  ```typescript
  export type World02PlaygroundStageId =
    | "world-02-stage-1" | "world-02-stage-2" | "world-02-stage-3";
  export interface World02StageHazards {
    readonly obstacles: readonly World02ObstacleDefinition[];
    readonly pigeonPasses: readonly World02PigeonPassDefinition[];
  }
  export function getWorld02StageHazards(
    stageId: World02PlaygroundStageId, seed: number,
  ): World02StageHazards;
  ```
- **Data & Schema Fields**: 맵 1은 `WORLD02_STAGE1_OBSTACLES`와 `WORLD02_STAGE1_PIGEON_PASSES`를 그대로 반환한다. 맵 2·3은 각 8개 장애물과 3개 비둘기 구간을 반환한다. 장애물 ID는 `${stageId}-obstacle-${slotIndex+1}`, 비둘기 ID는 `${stageId}-pigeon-${passIndex+1}`로 stage별 고유하다. 세 구간은 `dropX` 오름차순이다.
- **Execution Flow / Logic**:
  1. `StageRandom.hash(`${seed}:${stageId}`)`에서 맵별 PRNG를 만들어 맵 2·3의 후보 슬롯 중심 `[420,760,1100,1460,1810,2160,2850,3220]`과 각 좌표 편차 `[-16,0,16]`, 종류 순서를 섞는다. **두 맵 각각** 사이다 캔·환타 캔·치토스 봉지·주황 고양이·턱시도 고양이를 한 번씩 넣는다. 나머지 3칸에는 기존 콜라 캔/포카칩/회색 고양이 중 무작위 1종, 스프링 기구 3종 중 맵별로 다른 1종, 삽/라바콘 중 1종을 뽑는다. 8개 순서를 섞어 새 그림의 위치를 고정하지 않는다.
  2. 비둘기는 세 기초 `dropX` 1280/1980/3040 각각에서 `[-16,0,16]` 후보를 고르고 `triggerX=dropX-450`, `flightY=190`, `birdSpeedX=102`, `droppingSpeedY=770`으로 정의한다. 한 새의 낙하 좌표는 각 `dropX+[84,0,-84]`다. 현재 `World02PigeonDropSystem`의 등장 주기 3000ms를 그대로 쓴다.
  3. 각 후보 전체에 대해 장애물 간 중심 거리 ≥300px, 각 충돌체가 안전 입구 x<192와 출구 x≥3648 밖, 체크포인트 x=2496에서 충돌체 가장자리까지 ≥250px를 확인한다. 모든 배설 좌표는 `[192,3648)` 안이고 체크포인트에서 ≥250px 떨어져야 한다. 배설 지점과 장애물의 수평 여유 `abs(dropX-obstacle.x) - obstacle.hitbox.width/2 - 7 - 36`은 ≥20px여야 한다. 최대 64번 후보를 뽑고 실패하면 기준 슬롯·기초 비둘기 좌표로 되돌리되 무작위 종류 순서는 유지한다.
  4. `StageScene.create`가 월드 2 시작 시 `data.seed ?? registry.get("world02RunSeed") ?? Phaser.Math.Between(1, 0x7fffffff)`로 숫자 seed를 정해 registry의 `world02RunSeed`에 기록하고 다음 stage에 전달한다. 같은 stage의 `getWorld02StageHazards(stage.id, seed)` 결과를 두 시스템에 한 번씩 전달한다. 새 배치를 죽을 때마다 재생성하지 않는다. T04의 역방향 방문도 같은 seed를 전달하고, 월드 선택에서 새 월드 2 플레이를 시작할 때만 registry 값을 지운다.
- **Error & Exception Handling**: 임의 좌표가 좁은 점프 구간·비둘기 낙하와 겹칠 때 게임이 불가능해질 수 있으므로 생성 후 안전성을 검증하고 확정 가능한 기준 배치로 fallback한다. 맵 2·3을 단순히 동일한 `stage-1` ID 배열로 재사용하지 않아 사망·체크포인트 이벤트의 stageId가 정확히 전달되게 한다.

## Acceptance Criteria

- [ ] 맵 2·3에서 새 장애물과 비둘기가 나타나고, 맵 1의 기존 위치는 달라지지 않는다.
- [ ] 맵 2와 맵 3 각각에서 사이다·환타·치토스·새 고양이 2종이 보이고, 나머지 칸에 기존 변형이 섞인다.
- [ ] 같은 시드의 좌표·종류는 같고 다른 시드에서는 달라진다. 200개 시드에서 안전 간격과 기본 점프 통과 가능성을 만족한다.
- [ ] 모든 고양이는 자기 할퀴기 그림으로 바뀌고 죽은 뒤 자기 잠든 그림으로 복원된다.

## Validation

- `node --test scripts/world02-stage-hazards.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs`
- `node scripts/validate-assets.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`

## Commit Message

```text
feat(world02): 맵 2와 3에 장애물과 비둘기 무작위 배치하기

Plan: 2026-10-21-world02-three-playground-maps
Phase: P01-three-playgrounds
Task: T03-seeded-hazards

- 맵마다 안전한 시드 배치와 3초 비둘기 시스템 연결
- 여러 고양이의 고유 할퀴기 그림과 재시작 복원
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
