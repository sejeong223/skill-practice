# Task: T01 긴장·비장 코기의 공통 표시 위치 내리기

## Status: done

## Goal

월드 2 진입 컷신의 두 코기를 현재보다 조금 내려 노란 미끄럼틀 끝부분에 더 가깝게 표시한다.

## Decision Summary

- 데스크톱: 중심 y 310→342, 작은 화면(폭 720px 이하): 중심 y 225→237.
- 이미지 크기·x좌표·앉은 정지 자세·대사창 위치·비트 진행은 변경하지 않는다.

## Implementation

### I01. 공통 초상화 위치

- Related Files:
  - `src/game/scenes/World02EntranceScene.ts` :: `World02EntranceScene.showPortrait(assetKey: string): void` — `.add.image(640, compact ? 225 : 310, assetKey)`의 y값을 `compact ? 237 : 342`로 변경한다; modify.
  - `public/assets/pixel/cutscenes/world-02/world-02-playground-pov.png` — 노란 미끄럼틀 끝부분의 시각 기준; read-only.
  - `public/assets/pixel/cutscenes/world-02/world-02-corgi-nervous.png`, `world-02-corgi-resolved.png` — 두 이미지의 전신 여백을 확인한다; read-only.

#### Signatures & Types

```typescript
private showPortrait(assetKey: string): void
```

#### Data & Schema Fields

- 신규 모델·필드·저장 데이터 없음. `assetKey: string`, `portraitSize: number`, `compact: boolean` 유지.

#### Execution Flow / Logic

1. 비트 2와 4가 기존과 같이 `showPortrait`에 서로 다른 이미지 키를 전달한다.
2. 같은 `compact` 조건으로 두 이미지의 y위치만 12px 또는 32px 내린다.
3. 기존 360/480px 크기, x=640, alpha 진입 효과, 정지 자세와 대사창 표시를 유지한다.

## Acceptance Criteria

- [ ] 두 코기가 같은 양만큼 내려간다.
- [ ] 데스크톱은 미끄럼틀 끝부분에 더 가깝게 보이고 작은 화면에서는 대사창과 크게 겹치지 않는다.
- [ ] 대본·전환·건너뛰기·이미지 자산은 유지된다.

## Validation

- `npx.cmd eslint src/game/scenes/World02EntranceScene.ts` — 린트 통과.
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- 코드에서 `compact ? 237 : 342`와 기존 크기·x좌표를 확인한다.

## Commit Message

```text
fix(world02): 코기 초상화 위치를 조금 아래로 조정

Plan: 2026-10-14-world02-corgi-position
Phase: P01-portrait-placement
Task: T01-lower-corgi-portraits

- 긴장·비장 코기의 공통 y좌표를 조정
- 작은 화면은 대사창 간격을 고려해 이동 폭 제한
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task와 소스 변경을 함께 커밋함
