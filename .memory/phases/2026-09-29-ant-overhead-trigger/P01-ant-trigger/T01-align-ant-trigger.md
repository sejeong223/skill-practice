# Task: T01 개미 감지 영역을 그림에 맞추기

## Status: done

## Goal
World 1의 두 개미 위쪽에 있는 보이지 않는 감지 영역을 제거하여 점프 경로를 확보하고, 개미 그림에 닿았을 때의 기존 함정 결과를 유지한다.

## Decision Summary
- `ant-trip`의 감지 영역만 조정한다. 별개 `forward-jump-wall` 기믹과 맵 카탈로그는 변경하지 않는다.
- 개미 그림은 바닥선 `(gimmick.y + gimmick.height)`을 중심으로 30×20px 표시된다. 감지 영역은 바닥선 위에 보이는 절반인 30×10px로 만든다.

## Implementation

### I01. 개미 감지 영역 수정
- Related Files:
  - `src/game/systems/MapGimmickSystem.ts` :: `MapGimmickSystem.overlapsGimmick`, `MapGimmickSystem.getVisualSize` — 그림과 감지 영역의 좌표 일치; modify

#### Details
- **Signatures & Types**:
  ```typescript
  private overlapsGimmick(gimmick: WorldGimmickDefinition): boolean;
  private getVisualSize(gimmick: WorldGimmickDefinition): [number, number];
  ```
- **Data & Schema Fields**:
  - `WorldGimmickDefinition`: 기존 `x: number`, `y: number`, `width: number`, `height: number`, `kind: GimmickKind`를 읽기만 한다. 필드 추가나 스키마 변경 없음.
  - `ant-trip` 시각 크기: 기존 `getVisualSize(gimmick)`의 `[30, 20]`을 사용한다.
- **Execution Flow / Logic**:
  1. `overlapsGimmick`의 `ant-trip` 분기에서 `[visualWidth, visualHeight] = this.getVisualSize(gimmick)`을 얻는다.
  2. 개미 그림의 중심 X는 `gimmick.x + gimmick.width / 2`, 중심 Y는 `floorY = gimmick.y + gimmick.height`이다. `Phaser.Geom.Rectangle`을 `x = gimmick.x + (gimmick.width - visualWidth) / 2`, `y = floorY - visualHeight / 2`, `width = visualWidth`, `height = visualHeight / 2`로 만든다.
  3. 기존 `Phaser.Geom.Rectangle.Overlaps(this.getPlayerBounds(), zone)` 결과를 그대로 반환한다. `handleAnt`의 후진 회피와 사망 흐름은 유지한다.
  4. 개미 프레임이 없을 때도 기존 `[30, 20]` 크기가 사용된다. 다른 기믹 분기는 바꾸지 않는다.

## Acceptance Criteria
- [x] 두 `ant-trip`에 공통으로 적용되는 감지 영역의 바닥선 위 범위가 30×10px이다.
- [x] 개미 위쪽 빈 공간을 지나는 플레이어는 개미 판정에 걸리지 않는다.
- [x] 개미 그림과 겹치며 전진할 때의 기존 함정 결과가 유지된다.
- [x] 월드 1 맵 및 별개 투명 벽 기믹 데이터가 바뀌지 않는다.

## Validation
- `npx.cmd eslint src/game/systems/MapGimmickSystem.ts` — 해당 파일 린트 통과
- `npx.cmd tsc --noEmit` — 타입 검사 통과
- `npm.cmd run world01:maps:check` — 기존 월드 1 맵 검증 통과

## Commit Message
```text
fix(game): align ant trigger with visible sprite

Plan: 2026-09-29-ant-overhead-trigger
Phase: P01-ant-trigger
Task: T01-align-ant-trigger

- Limit the ant trigger to its visible area above the floor
- Preserve the existing ant and invisible wall gimmicks
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `3b048be`
