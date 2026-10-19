# Task: T01 월드 2 변경 전 음표 복원

## Status: done

## Goal
월드 2 일반 스테이지에서 `af78163` 이전의 멜로디와 베이스를 다시 재생한다.

## Decision Summary
- 사용자 선호에 따라 [원래 음악 복원 결정](../../../decisions/2026-10-19-world02-original-music-restore.md)을 따른다.
- 월드 전환 소유권 검사와 다른 월드의 편곡은 유지한다.

## Implementation

### I01. 편곡 데이터 복원
- Related Files:
  - `src/game/audio/musicArrangements.ts` :: `MUSIC_ARRANGEMENTS["world-02-amusement"]` — modify
- **Signatures & Types**:
  ```typescript
  interface MusicArrangement {
    readonly bpm: number;
    readonly melody: readonly (string | null)[];
    readonly chords: readonly string[];
    readonly bass: readonly string[];
  }
  ```
- **Data & Schema Fields**: `bpm: 120`, `chords: ["F", "C", "Dm", "Bb"]` 유지. `melody`는 `["A5", "C6", "A5", "G5", "F5", "G5", "A5", null, "C6", "A5", "G5", "F5", "A5", "C6", "D6", "C6"]`, `bass`는 `["F2", "C3", "D2", "A2", "Bb2", "F2", "C3", "C3"]`로 복원한다.
- **Execution Flow / Logic**: 음표 배열만 바꾼다. `AudioManager`의 곡 선택·중복 재생 방지·일시정지 로직은 수정하지 않는다.

### I02. 변경된 편곡에 묶인 검사 제거
- Related Files:
  - `scripts/stage-music.test.mjs` :: `월드 2 음악의 베이스와 멜로디 강박이 현재 화음에 맞는다` — modify
  - `scripts/audio-pause.test.mjs` :: 월드 1→2 소유권 검사 — read-only
- **Execution Flow / Logic**: 새 편곡의 화음 일치만 요구하는 테스트 블록을 제거한다. 전환 테스트는 보존한다.

## Acceptance Criteria
- [x] 월드 2 멜로디와 베이스가 `af78163^`의 배열과 정확히 같다.
- [x] 월드 1→2 전환 검사와 나머지 음악 테스트가 통과한다.
- [x] 타입 검사와 빌드가 통과한다.

## Validation
- `node --test scripts/stage-music.test.mjs scripts/audio-pause.test.mjs` — 음악·전환 테스트
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사
- `npm.cmd run build` — 빌드

## Commit Message
```text
fix(audio): 월드 2 기존 음악 복원

Plan: 2026-10-19-world02-original-music-restore
Phase: P01-restore-arrangement
Task: T01-restore-world02-notes

- 사용자가 선호한 월드 2 멜로디와 베이스 복원
- 새 편곡만 강제하던 검사 제거, 월드 전환 검사 유지
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (원본 배열 일치, 음악 테스트 11개, 타입 검사, 빌드)
- commit: 이번 Task 커밋
