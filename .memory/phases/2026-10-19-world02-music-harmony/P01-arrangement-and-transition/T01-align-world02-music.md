# Task: T01 월드 2 음악 화음 정렬

## Status: done

## Goal
`world-02-amusement`의 동시 재생 음을 `F → C → Dm → Bb` 화음 진행에 맞추고, 월드 1에서 월드 2로 넘어가도 이전 곡의 Tone 시퀀스가 남지 않음을 검증한다.

## Decision Summary
- [결정 기록](../../../decisions/2026-10-19-world02-music-harmony.md)에 따라 월드 2 일반 곡만 수정한다.
- 편곡 데이터는 2마디 반복이며, 화음마다 멜로디 4개·베이스 2개가 대응한다.

## Implementation

### I01. 월드 2 편곡
- Related Files:
  - `src/game/audio/musicArrangements.ts` :: `MUSIC_ARRANGEMENTS["world-02-amusement"]` — modify
  - `src/game/audio/AudioManager.ts` :: `startToneMusic`, `stopToneMusic` — read-only
  - `src/game/audio/stageMusic.ts` :: `STAGE_MUSIC_BY_WORLD` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  interface MusicArrangement {
    readonly bpm: number;
    readonly melody: readonly (string | null)[];
    readonly chords: readonly string[];
    readonly bass: readonly string[];
  }
  const MUSIC_ARRANGEMENTS: Readonly<Record<MusicKey, MusicArrangement>>;
  ```
- **Data & Schema Fields**: `world-02-amusement.bpm`은 `120`, `chords`는 `["F", "C", "Dm", "Bb"]`로 유지한다. `melody`는 16개의 8분음표, `bass`는 8개의 4분음표 문자열로 둔다. 각 화음의 4개 멜로디 음과 2개 베이스 음이 해당 화음 구성음에 맞게 정렬되도록 수정한다.
- **Execution Flow / Logic**:
  1. 화음은 Tone `Sequence`에서 2분음표 간격으로 2박마다 진행한다.
  2. 그 2박에 대응하는 멜로디 4개와 베이스 2개를 F, C, Dm, Bb 순서로 배치한다.
  3. 기존 `AudioManager`의 음악 전환 로직, 다른 곡 데이터, 곡 선택 키는 변경하지 않는다.
  4. 배열 길이와 반복 시점은 유지하여 기존 재생 흐름을 보존한다.

### I02. 회귀 검증
- Related Files:
  - `scripts/stage-music.test.mjs` :: 월드 2 편곡 테스트 — modify
  - `scripts/audio-pause.test.mjs` :: 이전/새 AudioManager 소유권 테스트 — modify

#### Details
- 월드 2 편곡의 화음별 베이스 첫 음은 루트, 두 번째 음은 화음 구성음이고 멜로디 강박 첫 음도 화음 구성음임을 검증한다. 배열 길이 비율도 검증한다.
- 기존 이전/새 AudioManager 소유권 시나리오를 월드 1 기본 곡 → 월드 2 기본 곡으로 바꿔 활성 시퀀스가 세 개뿐이며 이전 관리자 종료가 새 곡을 멈추지 않음을 검증한다.

## Acceptance Criteria
- [x] 월드 2의 각 2박 구간에서 베이스와 멜로디 강박이 현재 화음에 맞는다.
- [x] 월드 1 → 월드 2 전환 후 활성 Tone 시퀀스는 새 곡의 세 개뿐이다.
- [x] 타입 검사, 음악 단위 테스트, 빌드가 통과한다.

## Validation
- `node --test scripts/stage-music.test.mjs scripts/audio-pause.test.mjs` — 화음·전환 테스트 통과
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사 통과 (PowerShell의 npx.ps1 실행 제한 우회)
- `npm.cmd run build` — 빌드 통과 (PowerShell의 npm.ps1 실행 제한 우회)

## Commit Message
```text
fix(audio): 월드 2 음악의 화음과 베이스 정렬

Plan: 2026-10-19-world02-music-harmony
Phase: P01-arrangement-and-transition
Task: T01-align-world02-music

- 월드 2 멜로디와 베이스를 화음 진행에 맞춤
- 월드 1에서 월드 2로 전환할 때 음악 겹침 회귀 검증
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (음악 테스트 12개, 타입 검사, 빌드)
- commit: 이번 Task 커밋
