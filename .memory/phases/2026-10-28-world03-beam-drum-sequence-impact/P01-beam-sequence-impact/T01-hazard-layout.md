# Task: T01 드럼통 뒤 철근과 후반 장애물 배치

## Status: done

## Goal

월드 3 일반 스테이지 1~4의 철근이 드럼통을 통과한 직후 떨어지고, 출구 앞에 기존 종류의 장애물 2개가 추가되어 한 스테이지당 총 10개가 되게 한다. 전진·회피·연속 점프로 통과 가능한 지형이어야 한다.

## Decision Summary

- 낙하 지점 개수는 1/2/3/3을 유지하고 x좌표만 `[[1165], [1165, 2340], [1165, 2340, 2900], [1165, 2340, 2880]]`으로 바꾼다.
- 무예고·속도 1600px/s·철근 충돌 크기 56×20·바닥 잔상 300ms·시도당 1회·체크포인트 재무장은 유지한다. 드럼통·손수레·코인·꺼지는 바닥 자체는 이동하지 않는다.
- 기존 장애물 8자리 뒤에 x=3400, 3550 두 자리를 추가한다. 새 이미지나 새 드럼통을 만들지 않고 6종 중 고정 사물만 스테이지별로 다르게 놓는다.

## Implementation

### I01. 스테이지별 낙하 데이터

- Related Files:
  - `src/game/data/world03SteelBeams.ts` :: `DROP_POSITIONS`, `getWorld03SteelBeamDefinitions`, `World03SteelBeamDefinition` — 고정 좌표만 교체; modify
  - `src/game/data/world03Construction.ts` :: `POSITIONS`, `KINDS`, `getWorld03Obstacles` — 기존 8개 뒤의 두 위치와 종류 추가; modify
  - `src/game/data/world03Construction.ts` :: `HITBOX`, `COIN_POSITIONS`, `COLLAPSE_CENTERS` — 기존 크기·코인·꺼지는 바닥 계약 확인, 변경 금지; read-only
  - `src/game/systems/World03SteelBeamDropSystem.ts` :: `World03SteelBeamDropSystem.update`, `resetForAttempt` — 같은 발동·회피·재시작 흐름을 재사용; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface World03SteelBeamDefinition { readonly id: string; readonly x: number }
  function getWorld03SteelBeamDefinitions(stageId: StageId): readonly World03SteelBeamDefinition[];
  const DROP_POSITIONS: readonly (readonly number[])[];
  type World03ObstacleKind = "traffic-cone" | "brick-stack" | "cement-bag" | "steel-pipe" | "drum-barrel" | "wheelbarrow";
  function getWorld03Obstacles(stageId: StageId): readonly World03ObstaclePlacement[];
  ```
- **Data & Schema Fields**:
  - `DROP_POSITIONS[0..3]`: 스테이지 1 `[1165]`, 2 `[1165, 2340]`, 3 `[1165, 2340, 2900]`, 4 `[1165, 2340, 2880]` (단위 px, 순서 오름차순, null 없음).
  - 반환 `id`는 기존 `${stageId}-steel-beam-${index + 1}`을 유지하며 x만 교체한다.
  - `POSITIONS`: 기존 `[380, 740, 1100, 1460, 1820, 2180, 2820, 3220]` 뒤에 `3400, 3550` 추가. `KINDS` 각 행에도 정확히 두 종류를 더한다: 1 `brick-stack, traffic-cone`; 2 `steel-pipe, cement-bag`; 3 `traffic-cone, brick-stack`; 4 `cement-bag, steel-pipe`. 기존 8개 종류와 순서는 그대로다.
  - 추가 장애물 ID는 기존 `getWorld03Obstacles`의 규칙에 따라 `${stageId}-construction-9`, `${stageId}-construction-10`; 크기는 현재 `HITBOX[kind] * WORLD03_OBSTACLE_SCALE(1.25)`를 재사용한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 정규식 `/^world-03-stage-([1-4])$/`과 보스/타 월드에서 `[]`를 반환하는 규칙을 유지한다.
  2. Core Processing: `DROP_POSITIONS` 네 행을 위 값으로 변경하고 `POSITIONS`/`KINDS`를 10칸으로 확장한다. 첫 드럼 원점 1100, 뒤쪽 드럼 원점 2180/2820보다 오른쪽에 각 철근을 둔다. 드럼은 플레이어 쪽으로 160px 굴러오기 때문에 코기가 원래 자리를 넘어설 때 철근이 이어진다. 새 두 사물은 고정이며 기존 `World03ConstructionObstacles` 생성·접촉 사망 경로를 그대로 쓴다.
  3. Error & Exception Handling: 철근 새 좌표가 코인 중심에서 `45px` 이내, 꺼지는 바닥의 좌우 경계와 철근 반폭 `28px`이 겹치거나, 지상 장애물(드럼의 160px 이동 경로 포함)과 겹치면 데이터 검사를 실패시킨다. 새 장애물도 코인 반폭 17px+여유 8px, 구덩이 좌우 40px, 철근 반폭 28px과 겹치지 않아야 한다. 체크포인트 2496과 출구 3728은 기존 안전 거리를 유지한다.
  4. State Transition & Return: 1/2/3/3개 철근 정의와 기존 ID가 그대로 반환된다. 장애물은 스테이지마다 정확히 10개가 오름차순으로 반환되고, 접촉 사망·재시작 초기화는 기존 시스템을 따른다. 철근 런타임의 `armed → falling → landed → finished`, 재시작 시 앞쪽만 `armed` 규칙은 바뀌지 않는다.

### I02. 좌표와 파훼 회귀 검사

- Related Files:
  - `scripts/world03-steel-beams.test.mjs` :: `fixed beam sites grow...`, `a direct hit...`, `landing is harmless...`, `running forward...`, `a fast backward turn...` — 기존 1640/2360/3400 가정을 교체; modify
  - `scripts/world03-construction-stages.test.mjs` :: `four construction stages each have eight stable obstacles`, `construction stages use bone coin positions...` — 10개·후반 간격·겹침 검사로 갱신; modify
  - `scripts/world03-construction-obstacles.test.mjs` :: 장애물 생성·접촉·재시작 — 새 두 위치도 기존 동작을 쓰는지 검증; modify
  - `.memory/test-plans/2026-10-28-world03-beam-drum-sequence-impact.md` :: `T01 수동 확인` — 실제 플레이 기록; new

#### Details

- **Signatures & Types**:
  ```javascript
  const expectedSites = [[1165], [1165, 2340], [1165, 2340, 2900], [1165, 2340, 2880]];
  const expectedTailKinds = [["brick-stack", "traffic-cone"], ["steel-pipe", "cement-bag"], ["traffic-cone", "brick-stack"], ["cement-bag", "steel-pipe"]];
  // 테스트 harness: setPlayerCenter(x: number), setBackpedaling(value: boolean)
  ```
- **Data & Schema Fields**:
  - 각 행은 철근 x좌표 배열이고, 순서와 개수 모두 명시적으로 비교한다.
  - 기존 `getWorld03CoinPositions`, `getWorld03CollapseZones`, `getWorld03Obstacles` 기반 겹침 검사를 유지한다. 모든 철근은 손수레 중심에서 300px 초과 떨어져 있는지도 검증한다.
  - 각 스테이지 장애물은 10개, 전체 고유 ID는 40개다. 첫 8개는 원래 종류·좌표를 유지하고 9/10번째는 위 x와 종류다. 기존 드럼통 1/2/2/2개, 손수레 1/1/2/2개와 총 종류 6종은 유지한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND === 1600`, `WORLD03_STEEL_BEAM_HITBOX_WIDTH === 56`, 보스전 빈 배열을 유지한다.
  2. Core Processing: 하드코딩된 첫 발동 테스트 좌표를 첫 철근 x에 대해 `x-90`(미발동), `x-64`(발동)으로 옮긴다. 첫 발동 x=1165, 세 번째 x=2900, 체크포인트=2496을 확인한다. 전진 시 50ms당 12px, 뒷걸음질 시 -12px로 기존 검사를 같은 상대 좌표에서 반복한다. `world03-construction-stages.test.mjs`의 8개/전체 ID32개 기대값은 10개/40개로, `world03-construction-obstacles.test.mjs`의 `images.length === 8` 세 곳은 10으로 갱신한다. 앞쪽 기존 간격 `>=300px`, 마지막 두 구간 `180px,150px`을 구분해 검사한다. 마지막 두 고정 장애물에 대한 접촉 즉사·재시작도 확인한다.
  3. Error & Exception Handling: 새 배치에서 드럼 원점보다 오른쪽이라는 조건과 겹침 금지 검사가 하나라도 실패하면 Task를 완료하지 않는다. 특히 스테이지 2 첫 철근과 구덩이 사이 7px, 스테이지 4 세 번째 철근과 구덩이 사이 4px은 **판정 영역만** 분리된 상태라 실제 조작으로 뒷걸음질과 다음 점프가 가능한지 확인한다. 후반 x3220→3400→3550의 간격에서도 몸통 72px과 각 히트박스를 고려해 두 번 점프할 착지 공간이 있는지 확인한다.
  4. State Transition & Return: 직접 명중은 사망 1회, 바닥에 떨어진 후 300ms 안에는 추가 사망 0회, 체크포인트에서 지난 철근은 건너뛰고 남은 철근은 재무장한다. 새 고정 장애물도 한 시도당 접촉 사망 1회이며 재시작 후 다시 나타난다.
- `npm.cmd run dev`로 월드 3 스테이지 1~4에서 드럼통 직후 전진 명중/빠른 왼쪽 전환 회피/다음 꺼지는 바닥 점프와 출구 전 x3400·3550 장애물 연속 점프를 각각 수동 확인하고 검증 기록에 남긴다. 이전 브라우저처럼 인트로가 멈추면 원래 저장이 없는 격리된 테스트 브라우저 프로필에서 저장 키 `legendary-rib-corgi:progress:v1`의 `progress.seenCutsceneIds`에 `"world-03-intro"`를 추가하고 새로고침하여 현행 개발 모드의 `StageScene` 직접 시작 경로를 쓴다(`src/game/systems/developmentWorld03Start.ts::getDevelopmentWorld03Entry`). 이 테스트 저장은 검증 뒤 제거한다. 실패한 구간은 더 안전한 x좌표가 있는지 지형 검사를 다시 수행한 뒤 결정 문서와 청사진을 함께 수정한다. 꺼지는 바닥이나 코인을 임의로 옮겨서 통과시키지 않는다.

## Acceptance Criteria

- [ ] 철근 좌표가 명시한 네 배열과 일치하고 기존 1/2/3/3개·보스전 제외 규칙이 유지된다.
- [ ] 드럼통 뒤 첫 철근과 뒤쪽 철근이 손수레에서 떨어져 있으며 코인·장애물·구덩이·체크포인트·출구 영역과 겹치지 않는다.
- [ ] 실제 플레이에서 빠른 왼쪽 전환으로 피하고 다음 구덩이를 넘을 수 있다. 전진 시 맞고, 재시작 후 철근이 알맞게 초기화된다.
- [ ] 각 스테이지에 기존 8개와 후반 2개를 합한 10개가 보이고, x3400·3550 연속 점프로 출구까지 갈 수 있다.

## Validation

- `node --test scripts/world03-steel-beams.test.mjs scripts/world03-construction-stages.test.mjs scripts/world03-construction-obstacles.test.mjs scripts/world03-collapsing-floor.test.mjs` — 배치·회피·재시작·인접 기믹 통과.
- `npx.cmd tsc --noEmit` — 타입 오류 없음.
- `npm.cmd run lint` — 오류 없음.
- `npm.cmd run dev` — 월드 3 일반 스테이지 1~4를 직접 플레이하고 `.memory/test-plans/2026-10-28-world03-beam-drum-sequence-impact.md`에 전진/회피/구덩이·후반 장애물 점프 결과 기록.

## Commit Message

```text
feat(world03): 드럼통 뒤 철근과 후반 장애물 배치

Plan: 2026-10-28-world03-beam-drum-sequence-impact
Phase: P01-beam-sequence-impact
Task: T01-hazard-layout

- 손수레 곁 낙하 지점을 드럼통 이후 고정 위치로 옮김
- 출구 앞 장애물을 스테이지마다 2개씩 늘리고 점프·겹침을 검증
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (수동 플레이 한계는 검증 기록 참조)
- commit: Task 커밋에 포함
