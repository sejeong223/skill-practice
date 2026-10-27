# Task: T01 월드 3의 숨은 꺼지는 바닥과 낙사

## Status: done

## Goal

월드 3 일반 스테이지의 바닥 네 곳이 평소에는 표시·판정 모두 온전하고, 코기가 지면에서 가장자리에 거의 닿을 때만 갑자기 아래로 떨어지도록 한다. 구멍으로 낙사하면 기존 죽음·체크포인트 재시작으로 되돌아가며 바닥은 복구된다.

## Decision Summary

- 사용자가 지정한 선행 작업이다. 월드 1의 과거 바닥 붕괴 기획에는 타일맵 구멍을 관통시킨다는 선례가 있으나, 월드 3의 바닥은 연속 충돌 바닥과 공사장 타일 스프라이트라 구현 경로가 다르다.
- 월드 3 구멍은 각 스테이지 4곳, 너비 128px. 코기 몸체의 앞끝이 구멍에서 12px 이내이며 지면에서 해당 방향으로 달릴 때만 발동한다. 원거리 예고는 없다.

## Implementation

### I01. 구멍 정의와 연속 바닥

- Related Files:
  - `src/game/data/world03Construction.ts` :: `WORLD03_COLLAPSE_WIDTH`, `World03CollapseZone`, `getWorld03CollapseZones`, `getWorld03CoinPositions` — modify
  - `src/game/data/worlds.ts` :: `createSegment`의 기존 월드 3 연속 바닥 확인 — read-only
  - `src/game/stages/StageRuntime.ts` :: `buildFromSegments`에서 구멍과 겹치지 않는 코인 x 적용 — modify
  - `src/game/stages/segmentCoinPresentation.ts` :: 월드 3 코인 뼈 그림·높이 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  export const WORLD03_COLLAPSE_WIDTH = 128;
  export interface World03CollapseZone {
    readonly id: string;
    readonly x: number;
    readonly width: number;
  }
  export function getWorld03CollapseZones(stageId: StageId): readonly World03CollapseZone[];
  ```
- **Data & Schema Fields**: 중심 x는 스테이지 1 `[560,1280,2000,3000]`, 2 `[576,1264,1984,2992]`, 3 `[544,1296,2016,3008]`, 4 `[560,1280,2000,2976]`. 반환 x는 `center - 64`; ID는 `${stageId}-collapse-${index + 1}`. 보스와 다른 스테이지는 빈 배열. 월드 3 일반 스테이지의 기존 x=0~3840, y=520, 높이32 연속 platform을 사용한다. 초기 코인 x는 `[180,260,830,920,1010,1550,1640,1730,2290,2380,2590,2700,3350,3450,3550]`로 구멍을 피한다.
- **Execution Flow / Logic**: 네 구멍은 고정 장애물 8자리, 코인 15개, x=2496 체크포인트, 출구 x=3728과 겹치지 않는다. 월드 2 연속 바닥·월드 3 보스의 기존 플랫폼 구조는 유지한다. 코인의 기존 ID·보상은 `StageRuntime`에서 유지하면서 x만 조정하고 월드 3 일반 스테이지 코인의 뼈 모양을 적용한다. 장애물 확대 배율 및 월드 2 보스의 다른 미커밋 변경은 이번 Task에 섞지 않는다.

### I02. 앞끝이 닿을 때만 숨은 바닥 붕괴

- Related Files:
  - `src/game/systems/world03CollapseTrigger.ts` :: `shouldCollapseWorld03Floor` — new
  - `src/game/systems/World03CollapsingFloor.ts` :: 생성자, `update`, `resetForAttempt`, `destroy` — new
  - `src/game/scenes/StageScene.ts` :: 월드 3 생성·restart·update·shutdown 연결 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  export interface World03CollapseApproach {
    readonly left: number;
    readonly right: number;
    readonly velocityX: number;
    readonly velocityY: number;
    readonly grounded: boolean;
  }
  export function shouldCollapseWorld03Floor(
    zone: World03CollapseZone, approach: World03CollapseApproach,
  ): boolean;
  class World03CollapsingFloor {
    public update(deltaMs?: number): void;
    public resetForAttempt(): void;
    public destroy(): void;
  }
  ```
- **Execution Flow / Logic**:
  1. 기본 연속 platform 충돌 바디를 끄고, 같은 바닥 y=504에 구멍 밖 고정 Zone 5개와 구멍 안 별도 충돌 Zone 4개를 만든다. 구멍 안 Zone은 발동 전까지 켜 둔다. 시각적인 공사장 바닥도 발동 전에는 온전하게 유지한다.
  2. 오른쪽 이동 `velocityX > 24`이면 `body.right >= zone.x - 12`와 `body.left < zone.x`, 왼쪽 이동 `velocityX < -24`이면 대응하는 반대쪽 조건에서만 발동한다. `grounded=true`이고 상승 중이 아닐 때만 판정한다. 몸체 앞끝이 13px 이상 떨어져 있거나 점프 중이면 붕괴시키지 않는다.
  3. 발동한 구간만 바닥 충돌을 즉시 끄고, 원래 바닥 그림 위에 깊은 구멍을 드러내며 같은 공사장 텍스처의 슬랩을 아래로 180ms 떨어뜨린다. 애니메이션 시간은 `update(deltaMs)`에서만 진행해 일시정지 중 멈춘다. 발동 전 그림자·틈·경고를 표시하지 않는다. 플레이어가 구멍에 들어가 바닥 아래로 떨어지면 기존 `MapGimmickSystem.checkWorldBounds`의 fall death 요청과 `RestartController`가 처리할 수 있어야 한다.
  4. `StageScene`에서 월드 3 일반 스테이지이며 Tiled 맵을 로드하지 않은 경우 생성한다. `play` 상태에서만 업데이트하고, restart에서 바닥 충돌과 그림을 원래 상태로 복원하며, shutdown에서 Zone·Collider·슬랩을 정리한다. 생성 시 platform이 없으면 명시적 오류를 낸다.
- **Error & Exception Handling**: 보스·다른 월드에서는 생성하지 않는다. 발동한 구간을 중복 발동시키지 않는다. pause/사망/장면 종료 중 잔여 애니메이션이나 죽음 이벤트가 나가지 않도록 한다.

### I03. 경계·구멍·재시작 검사

- Related Files:
  - `scripts/world03-collapsing-floor.test.mjs` :: 배치·트리거·런타임 mock — new
  - `scripts/world03-construction-stages.test.mjs` :: 기존 8개 장애물·15개 코인 확인 — read-only

#### Details

- 네 스테이지 각각 4개 구멍의 ID·범위·순서, 장애물/코인/체크포인트/출구 이격, 보스 제외를 확인한다.
- 오른쪽·왼쪽 접근 경계에서 13px 전 미발동/12px 발동, 공중·상승·정지 시 미발동을 확인한다.
- mock scene에서 발동 전 그림/충돌, 발동 후 해당 Zone 충돌 해제, 재시작 시 복원, destroy 시 원래 바닥 바디 복원을 확인한다. 죽음 경로는 실제 바닥 아래로 내려간 경우 `MapGimmickSystem`의 낙사 경계에 닿는지 코드 및 플레이로 확인한다.

## Acceptance Criteria

- [x] 코기가 아직 멀리 있을 때 구멍은 보이지 않고 충돌도 유지된다.
- [x] 가장자리 바로 앞에 지상 접근했을 때 해당 바닥만 꺼지고 코기가 아래로 떨어져 죽는다.
- [x] 사망·체크포인트 재시작에서 구멍이 다시 숨겨지고 바닥 충돌이 복구된다.
- [x] 보스전·다른 월드의 바닥과 기존 장애물·코인 배치를 건드리지 않는다.

## Validation

- `node --experimental-strip-types --test scripts/world03-collapsing-floor.test.mjs scripts/world03-construction-stages.test.mjs` — 구멍·경계·재시작과 기존 배치 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/data/world03Construction.ts src/game/data/worlds.ts src/game/scenes/StageScene.ts src/game/systems/World03CollapsingFloor.ts src/game/systems/world03CollapseTrigger.ts scripts/world03-collapsing-floor.test.mjs` — 관련 파일 lint 통과.
- `npm run build` — 스테이지 전체 빌드 통과.
- `git diff --cached --check` 및 `git diff --cached` — 이번 바닥 붕괴 변경만 스테이징.

## Commit Message

```text
feat(월드3): 가까이 가면 꺼지는 공사장 바닥 완성

Plan: 2026-10-27-world03-construction-hazards
Phase: P00-collapsing-floor
Task: T01-hidden-collapse-and-fall

- 구멍 바로 앞에서만 바닥 충돌과 그림을 제거
- 낙사 후 재시작 시 숨은 바닥 복원
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 한국어 커밋에 포함
