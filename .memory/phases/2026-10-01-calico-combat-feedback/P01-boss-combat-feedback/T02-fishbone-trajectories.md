# Task: T02 생선 가시 크기와 세 궤적

## Status: pending

## Goal
생선 가시를 알아볼 수 있게 키우고 낮은 수평·중간 포물선·높은 포물선을 반복한다.

## Decision Summary
- 한 번에 최대 한 발, 700ms 예고, 2600ms 다음 투척 간격을 유지한다.
- 정해진 패턴 순환으로 세 궤적이 전투 중 확실히 나타나게 한다.

## Implementation

### I01. 순수 궤적 계산
- Related Files:
  - `src/game/systems/fishboneTrajectory.ts` :: `createFishboneTrajectory`, `fishbonePositionAt` — new
  - `scripts/fishbone-trajectory.test.mjs` :: 세 경로/좌우 발사 검사 — new

#### Details
- **Signatures & Types**:
  ```typescript
  export type FishbonePattern = "low" | "mid" | "high";
  export interface FishboneTrajectory {
    readonly pattern: FishbonePattern;
    readonly startX: number; readonly startY: number;
    readonly velocityX: number; readonly velocityY: number; readonly gravityY: number;
    readonly targetX: number; readonly targetY: number; readonly durationSeconds: number;
  }
  export function createFishboneTrajectory(startX: number, playerX: number, playerCenterY: number, throwIndex: number): FishboneTrajectory;
  export function fishbonePositionAt(trajectory: FishboneTrajectory, elapsedSeconds: number): { x: number; y: number };
  ```
- **Data & Schema Fields**:
  - 순서 `low`, `mid`, `high`, `(throwIndex - 1) % 3`.
  - low: 시작/목표 y=498, 호 높이 0. mid: 시작 y=472, 목표 y=`clamp(playerCenterY - 8, 450, 505)`, 호 높이 50. high: 시작 y=444, 목표 y=`clamp(playerCenterY - 18, 435, 495)`, 호 높이 95.
  - 비행시간 `clamp(abs(playerX-startX)/220, 0.85, 4.5)`초. `velocityX=(targetX-startX)/duration`, `velocityY=(targetY-startY-4*arcHeight)/duration`, `gravityY=8*arcHeight/duration²`.
- **Execution Flow / Logic**:
  1. 발사 순간 코기 좌표로 세 패턴 중 하나를 만들며 중간/높은 경로는 시작과 정점 높이가 다르다.
  2. `fishbonePositionAt`은 `x=startX+velocityX*t`, `y=startY+velocityY*t+0.5*gravityY*t²`를 반환한다.
  3. 테스트는 세 패턴의 시작/목표/중간 위치와 좌우 발사를 검사한다.

### I02. 보스 투사체 적용
- Related Files:
  - `src/game/systems/World01CalicoBoss.ts` :: `Fishbone`, `releaseFishbone`, `updateFishbone` — modify

#### Details
- **Data & Schema Fields**:
  - `Fishbone`: `id: string`, `image: Phaser.GameObjects.Image`, `trajectory: FishboneTrajectory`, `elapsedSeconds: number`.
  - 표시 크기 48×24, 중심 판정 40×18.
- **Execution Flow / Logic**:
  1. 증가한 `serial`을 궤적 인덱스로 사용한다. 고정 y 대신 궤적 시작 y를 쓰고 48×24로 그린다.
  2. 프레임 `delta` 최대 50ms를 경과 시각에 더한다. 이전/현재 위치를 감싸는 40×18 충돌 사각형으로 통과를 검사한다.
  3. x가 0~1920 또는 y가 -40~560을 벗어나면 제거한다. 방패, 900ms 무적, 하트/사망 흐름은 유지한다.
  4. 700ms 예고 문구에 다음 낮은/중간/높은 궤적을 표시한다.

## Acceptance Criteria
- [ ] 가시가 48×24로 표시되고 판정이 40×18로 그림과 일치한다.
- [ ] 세 높이가 순서대로 나타나며 중간/높은 경로는 실제 포물선이다.
- [ ] 점프, 방패, 한 발당 최대 한 하트 감소, 승리 후 투척 중지가 유지된다.

## Validation
- `node --experimental-strip-types --test scripts/fishbone-trajectory.test.mjs` — 궤적 계산 통과.
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint -- src/game/systems/World01CalicoBoss.ts src/game/systems/fishboneTrajectory.ts` — 변경 파일 lint 통과.
- `npm.cmd run build` — 게임 빌드 통과.

## Commit Message
```text
feat(world01): vary and enlarge calico fishbone throws

Plan: 2026-10-01-calico-combat-feedback
Phase: P01-boss-combat-feedback
Task: T02-fishbone-trajectories

- Cycle low, mid, and high fishbone paths with visible warnings
- Enlarge the projectile and align collision with its rendered size
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
