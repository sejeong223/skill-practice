# Task: T01 긴장한 코기 내레이션 분리

## Status: done

## Goal
월드 2 인트로의 “녀석의 뇌리를...” 문장이 별도 대사창으로 표시되고, 비장한 코기 이미지는 그다음 내레이션에서 처음 표시된다.

## Decision Summary
- [결정 기록](../../../decisions/2026-10-19-world02-intro-narration-split.md)에 따라 기존 8000ms를 4000ms + 4000ms로 나눈다.
- 두 내레이션 모두 긴장한 코기 화면을 사용한다.

## Implementation

### I01. 대본 비트 분리
- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD02_ENTRANCE_CUTSCENE.beats` — modify
- **Signatures & Types**:
  ```typescript
  interface CutsceneBeat {
    readonly id: string;
    readonly durationMs: number;
    readonly narration?: string;
    readonly skipAllowedAfterSeen: boolean;
  }
  ```
- **Data & Schema Fields**: 기존 `corgi-nervous-narration`의 `durationMs`는 `4000`, `narration`은 `슬개골이 비명을 지르고 엉덩이가 공포로 떨려왔지만, 녀석은 멈추지 않는다.`로 설정한다. 바로 뒤에 ID `corgi-nervous-narration-2`, `durationMs: 4000`, `narration: 녀석의 뇌리를 스치는 단 하나의 향기... [투뿔 한우 육즙]!`, `skipAllowedAfterSeen: true`인 비트를 추가한다.
- **Execution Flow / Logic**: 비트 배열 순서를 유지하며 총 비트 수만 6에서 7로 늘린다. 다른 대사와 스킵 설정을 바꾸지 않는다.

### I02. 이미지 전환 시점
- Related Files:
  - `src/game/scenes/World02EntranceScene.ts` :: `World02EntranceScene.playBeat` — modify
- **Execution Flow / Logic**: `index === 4`인 비장한 코기 이미지 전환 조건을 `beat.id === "corgi-resolved-narration"`으로 바꾼다. 2번 비트의 긴장한 코기 전환과 첫 배경 확대는 유지한다. 새 4번 비트는 기존 긴장한 코기 이미지를 계속 쓴다.
- **Error & State Handling**: 마지막 비트 이후 기존 `finish()`와 저장된 컷신 재관람 동작을 유지한다.

## Acceptance Criteria
- [x] “녀석의 뇌리를...”가 별도 내레이션 비트로 표시된다.
- [x] 긴장한 코기 이미지는 두 비트 동안 유지되며, 비장한 코기 이미지는 다음 비트에서 전환된다.
- [x] 전체 컷신 자동 진행 길이는 변하지 않는다.

## Validation
- `node --test scripts/cutscene-auto-advance.test.mjs` — 컷신 자동 진행 회귀 확인
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사
- `npm.cmd run build` — 빌드

## Commit Message
```text
fix(cutscene): 월드 2 인트로 내레이션 분리

Plan: 2026-10-19-world02-intro-narration-split
Phase: P01-beat-split
Task: T01-split-nervous-narration

- 긴장한 코기의 긴 내레이션을 두 장면으로 분리
- 비장한 코기 표정 전환을 대본 비트 ID에 연결
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (컷신 테스트 5개, 타입 검사, 빌드)
- commit: 이번 Task 커밋
