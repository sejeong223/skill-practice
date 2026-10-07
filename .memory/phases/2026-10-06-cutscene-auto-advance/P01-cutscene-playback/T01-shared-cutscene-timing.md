# Task: T01 공용 컷신 시간과 자동 전환

## Status: done

## Goal

모든 컷신의 글자를 읽을 수 있는 최소 표시 시간을 계산하고, 월드 1 보스 등장·승리 컷신도 키 입력 없이 마지막 비트까지 진행시킨다. 기존 선택적 빠른 넘김과 재시청 건너뛰기는 유지한다.

## Decision Summary

- 사용자 결정: 문장 길이에 따른 가독성을 인트로 35~40초 목표보다 우선한다.
- `durationMs`는 연출의 최소 시간이다. 텍스트가 길면 공용 계산 함수가 그보다 긴 시간을 돌려준다.
- 월드 1 보스 등장·승리는 `CutsceneDirector`가 `CutsceneTimeline.play(..., true)`로 실행해 현재 타이머를 생략한다. 이 `true`는 이후 선택적 수동 넘김 허용만 의미한다.

## Implementation

### I01. 문장/비트 표시 시간 계산

- Related Files:
  - `src/game/cutscenes/cutsceneTiming.ts` :: `getCaptionPlaybackMs`, `getBeatPlaybackMs`; new
  - `src/game/cutscenes/types.ts` :: `CutsceneBeat`, `DialogueLine`, `ItemCardData` 타입 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export function getCaptionPlaybackMs(baseDurationMs: number, text: string): number;
  export function getBeatPlaybackMs(beat: CutsceneBeat): number;
  ```
- **Data & Schema Fields**: `CutsceneBeat.durationMs: number`와 `narration?: string`, `dialogue?: readonly DialogueLine[]`, `itemCard?: { title: string; description: string }`의 기존 형태를 변경하지 않는다. 저장 데이터나 새 이벤트 필드도 필요 없다.
- **Execution Flow / Logic**:
  1. 텍스트를 `Array.from(text)`로 문자 단위 계수한다. 텍스트가 비었으면 `baseDurationMs`를 그대로 반환한다.
  2. 텍스트가 있으면 `Math.max(baseDurationMs, 1200 + 문자 수 * 65)` 밀리초를 반환한다. 이 값은 화면에 문장을 출력하는 시간의 80%와 완성된 문장을 보는 나머지 20%를 함께 포함한다. 상한을 두어 긴 설명을 다시 자르지 않는다.
  3. `getBeatPlaybackMs`는 나레이션, 모든 `dialogue[].text`, `itemCard.title`, `itemCard.description`을 이 순서로 공백 하나로 연결한다. 없는 값은 제외한다. 합친 문자열과 `beat.durationMs`를 `getCaptionPlaybackMs`에 전달한다. 빈 비트는 원래 연출 시간을 유지한다.
- **Failure/State**: `durationMs`가 이미 긴 장면은 단축하지 않는다. 여러 대사가 한 비트에서 함께 나타나도 모든 문구를 읽을 시간을 합산한다.

### I02. 공용 타임라인과 연출자

- Related Files:
  - `src/game/cutscenes/CutsceneTimeline.ts` :: `play`, `advance`, `skip`, `cancel`, `finish`; modify
  - `src/game/cutscenes/CutsceneDirector.ts` :: `play`, `handleBeat`; modify
  - `src/game/data/cutscenes/worlds.ts` :: 보스 등장/승리 각 8줄 및 기존 `durationMs`; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  public play(beats: readonly CutsceneBeat[], onBeat: CutsceneBeatHandler, allowManualAdvance?: boolean): Promise<void>;
  public advance(): void;
  ```
- **Data & Schema Fields**: `CutsceneTimeline.timer: ReturnType<typeof setTimeout> | undefined`, `nextBeat?: () => void`, `lastBeatAt: number`, `token: number`의 상태 역할은 유지한다. 기존 `manualAdvance` 내부 필드는 `allowManualAdvance`로 이름을 맞춘다. `cutscene-beat.manualAdvance` 이벤트 필드는 대화창의 선택적 빠른 넘김 표시 용도로 유지한다.
- **Execution Flow / Logic**:
  1. `CutsceneTimeline.play`는 `allowManualAdvance` 값과 무관하게 매 비트에서 `setTimeout(next, beat.durationMs)`를 등록한다. `allowManualAdvance=true`이면 기존처럼 `advance()`도 허용한다.
  2. `advance()`는 기존 120ms 연속 입력 방지, 현재 타이머 취소, 정확히 한 번의 `nextBeat()` 호출을 지킨다. 자동 타이머가 먼저 실행됐거나 `skip()`으로 완료됐다면 지난 비트를 다시 진행하지 않는다.
  3. `CutsceneDirector.play`는 원본 `script.beats`를 변경하지 않고 각각 `{ ...beat, durationMs: getBeatPlaybackMs(beat) }`로 만든 재생용 배열을 타임라인에 전달한다. `handleBeat`가 받는 비트도 이 표시 시간으로 `cutscene-beat`에 발행되어 `TypewriterText`의 80% 출력 속도와 자동 타이머가 일치한다.
  4. `world-01-boss-intro`와 `world-01-boss-clear`는 `allowManualAdvance=true`로 유지해 클릭·Space·Enter 빠른 넘김을 제공한다. 나머지 컷신도 자동 타이머를 사용한다.
- **Failure/State**: `skip()`·`cancel()`·마지막 비트 완료 시 타이머를 정리한다. `cutscene-finished`가 한 번만 나와 `StageScene`의 전투 해제 및 승리 화면 전환이 중복되지 않아야 한다.

### I03. 시간과 타임라인 회귀 테스트

- Related Files:
  - `scripts/cutscene-auto-advance.test.mjs` :: 시간 계산·타임라인 Node 테스트; new

#### Details

- **Test runtime**: 내장 `node:test`와 `node:assert/strict`를 사용하고 `CutsceneTimeline.ts` 및 `cutsceneTiming.ts`를 상대 경로로 가져온다. 실행 명령은 `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs`이다. 브라우저나 Phaser 객체는 필요 없다.
- **Exact cases**:
  1. 빈 텍스트는 기본 시간을 유지한다. 짧은 텍스트는 `Math.max`로 기본 시간을 지킨다. 긴 텍스트는 `1200 + 65 * Array.from(text).length`가 된다.
  2. 나레이션·대사·아이템 카드가 함께 있는 비트는 네 종류의 실제 문구를 합산한다. `getBeatPlaybackMs`의 결과가 `beat.durationMs`보다 짧아지지 않는다.
  3. `allowManualAdvance=true`인 두 비트가 별도 입력 없이 설정한 짧은 타이머를 통해 순서대로 실행되고 Promise가 완료된다.
  4. 수동 `advance()`가 타이머보다 먼저 실행될 때 해당 비트가 중복되지 않는다. `skip()` 후에는 예약된 다음 비트가 실행되지 않는다.
- **Failure/State**: 120ms 입력 방지 조건 때문에 수동 테스트에서는 첫 비트의 `advance()`를 120ms 뒤에 호출하고, 자동 타이머는 그보다 길게 잡는다. 실행 중 남는 타이머 없이 테스트가 종료되어야 한다.

## Acceptance Criteria

- [x] 월드 1 보스 등장·승리의 대사가 Enter 없이 각각 마지막 줄까지 순서대로 진행되도록 타임라인을 연결했다. 실제 화면 검증은 T03에서 한다.
- [x] 모든 `CutsceneDirector` 컷신에서 텍스트 길이가 긴 비트는 원래 `durationMs`보다 오래 표시되고, 타입라이터는 비트 종료 전에 전체 문구를 보여준다.
- [x] 클릭·Space·Enter 수동 넘김과 재시청 건너뛰기가 자동 타이머와 중복 진행을 만들지 않는다.

## Validation

- `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs` → 시간 계산과 자동/수동/건너뛰기 회귀 테스트 통과.
- `npx.cmd tsc --noEmit` → TypeScript 오류 없음.
- `npm.cmd run lint` → 수정한 TS와 새 테스트의 린트 오류 없음.
- `npm.cmd run build` → 컷신 클라이언트 번들 빌드 통과.

## Commit Message

```text
feat(cutscene): auto advance shared dialogue timeline

Plan: 2026-10-06-cutscene-auto-advance
Phase: P01-cutscene-playback
Task: T01-shared-cutscene-timing

- Calculate readable caption durations from displayed text
- Run boss dialogue timers while preserving optional manual advance
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 자동 테스트 5개, `tsc`, `lint`, `build`
- commit: pending
