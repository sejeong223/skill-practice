# Task: T02 오프닝 문장별 자동 진행

## Status: done

## Goal

별도 `IntroScene`에서 실행되는 오프닝 11개 비트의 나레이션과 대사를 각각 읽을 시간만큼 보여준 뒤 자동으로 다음 문장으로 진행시킨다. 마지막 문장 이후 타이틀/이름 입력 화면까지 키 입력 없이 도달한다.

## Decision Summary

- 오프닝은 공용 `CutsceneDirector`가 아니라 `IntroScene`의 `playBeat`→`emitCurrentCaption`→`advance` 경로를 쓴다.
- 나레이션과 대사가 함께 있는 비트는 현재처럼 나레이션을 먼저, 대사를 다음 캡션으로 보여준다. 배우·카메라 동작은 비트 시작에 한 번만 실행한다.
- T01의 `getCaptionPlaybackMs`로 각 캡션 시간을 계산한다. 기존 35~40초 길이 목표는 새 가독성 결정으로 갱신됐다.

## Implementation

### I01. 문장 타이머와 표시 시간

- Related Files:
  - `src/game/scenes/IntroScene.ts` :: `IntroScene.captionTimer`, `lastCaptionAt`, `playBeat`, `emitCurrentCaption`, `advance`, 신규 `clearCaptionTimer`; modify
  - `src/game/cutscenes/cutsceneTiming.ts` :: `getCaptionPlaybackMs`; read-only (T01에서 생성)
  - `src/game/data/cutscenes/intro.ts` :: 11개 비트의 대사 순서와 기본 `durationMs`; read-only
  - `src/game/stages/stageEvents.ts` :: `cutscene-beat`의 `manualAdvance`, `captionIndex`, `captionCount`; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  private captionTimer?: Phaser.Time.TimerEvent;
  private lastCaptionAt = 0;
  private clearCaptionTimer(): void;
  private emitCurrentCaption(): void;
  private advance(): void;
  ```
- **Data & Schema Fields**: `currentCaptions: Array<{ readonly narration?: string; readonly dialogue?: DialogueLine }>`와 `beatIndex`, `captionIndex`, `active`, `skipAllowed`, `skipped`의 기존 상태를 유지한다. 저장 스키마와 `CutsceneBeat` 자체는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. `playBeat()`는 기존처럼 비트의 나레이션과 대사를 캡션 배열에 순서대로 넣고 비트의 배우·카메라 동작을 한 번 실행한다.
  2. `emitCurrentCaption()`은 현재 캡션의 문장(`narration` 또는 `dialogue.text`)을 가져온다. 첫 캡션에 `itemCard`가 있으면 그 `title`과 `description`도 공백으로 이어 읽기 시간에 포함한다. 텍스트가 없는 캡션은 `beat.durationMs`를 유지한다.
  3. `getCaptionPlaybackMs(beat.durationMs, 합친 문구)`로 계산한 값을 `visibleBeat.durationMs`에 넣어 `cutscene-beat`를 한 번 발행한다. `captionIndex`와 `captionCount`는 현재 값, `manualAdvance: true`는 선택적 빠른 넘김 표시를 위해 유지한다.
  4. 현재 캡션을 발행할 때 `lastCaptionAt = Date.now()`를 기록하고, 같은 시간으로 `this.time.delayedCall(durationMs, () => this.advance())`를 등록한다. 오프닝의 다음 캡션/비트와 마지막 `finishCutscene()` 진입은 모두 기존 `advance()` 한 경로로 처리한다. 입력으로 먼저 넘어갈 때 `advance()`가 이전 타이머를 제거한다.
- **Failure/State**: 텍스트 표시 시간과 타이머 시간이 달라 글자가 완성되기 전에 전환되지 않아야 한다. 새 비트의 배우·카메라 동작은 나레이션→대사 캡션 전환에서 반복하지 않는다.

### I02. 타이머 정리와 한 번만 종료

- Related Files:
  - `src/game/scenes/IntroScene.ts` :: `startCutscene`, `advance`, `skip`, `finishCutscene`, `cleanup`, `clearCaptionTimer`; modify
  - `src/components/game/GameShell.tsx` :: `cutscene-finished`에 따른 `introGateStep` 전환; read-only
  - `src/components/game/IntroTitleOverlay.tsx` :: 타이틀·이름 입력; read-only

#### Details

- **Execution Flow / Logic**:
  1. `clearCaptionTimer()`는 저장된 `Phaser.Time.TimerEvent`에 `remove(false)`를 호출하고 필드를 `undefined`로 만든다. `emitCurrentCaption()`에서 새 타이머를 만들기 전에도 기존 타이머를 정리한다.
  2. `advance()`는 `active`와 `Date.now() - lastCaptionAt >= 120`을 확인하고 타이머를 먼저 제거한 뒤 캡션 또는 비트 인덱스를 한 번만 전진시킨다. 자동 타이머 직후 들어온 오래된 클릭·키 입력이 새 캡션을 즉시 다시 넘기지 않도록 한다. 마지막 비트 이후에는 비활성화된 컷신으로 재진입하지 않는다.
  3. `skip()`, `finishCutscene()`, `cleanup()`에서 타이머를 정리한다. 재시청 건너뛰기는 기존의 `skipAllowed` 조건을 지키고 `cutscene-finished`는 한 번만 발행한다.
  4. 오프닝 종료 후 `GameShell`의 `introGateStep="title"`과 `IntroTitleOverlay`를 그대로 사용한다. 이름 확인 전에는 `StageScene`을 시작하지 않는다.
- **Failure/State**: 씬 종료·리셋·건너뛰기 뒤 늦은 타이머가 새로운 화면의 캡션을 바꾸거나 저장된 `seenCutsceneIds`를 중복 갱신해서는 안 된다.

## Acceptance Criteria

- [x] 오프닝 첫 재생에서 Enter 없이 모든 나레이션과 대사가 원래 순서로 나와 타이틀 화면까지 간다.
- [x] `wait-command`, `owner-phone`, `command-break`처럼 나레이션+대사가 있는 비트에서 각각 두 문장을 모두 보여준다.
- [x] 긴 문장은 T01의 글자 수 기반 시간 동안 표시되며 글자 출력이 끝나기 전에 넘어가지 않는다.
- [x] 수동 빠른 넘김, 재시청 건너뛰기, 씬 종료 시 기존 타이머가 정리된다. 이름 입력은 계속 사용자 선택을 기다린다.

## Validation

- `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs` → T01의 공유 시간/타임라인 회귀 유지.
- `npx.cmd tsc --noEmit` → `Phaser.Time.TimerEvent`와 컷신 이벤트 타입 오류 없음.
- `npm.cmd run lint` → 타이머 정리와 새 import의 린트 오류 없음.
- `npm.cmd run build` → 인트로 씬·React 컷신 번들 빌드 통과.
- `npm.cmd run dev` → 새 저장 데이터에서 오프닝을 키 입력 없이 재생하여 11개 비트와 나레이션/대사 순서, 타이틀 도착, 이름 입력 대기를 브라우저에서 확인. 이미 본 컷신 재시청에서는 건너뛰기와 빠른 넘김을 확인.

## Commit Message

```text
feat(intro): auto advance every opening caption

Plan: 2026-10-06-cutscene-auto-advance
Phase: P01-cutscene-playback
Task: T02-intro-caption-autoplay

- Schedule readable timers for opening narration and dialogue
- Clear timers on manual advance, skip, finish, and scene shutdown
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 자동 테스트 5개, `tsc`, `lint`, `build`. 실제 Chrome에서 입력 없이 11개 장면과 분리된 대사, 약 85초 뒤 타이틀 화면 도달 확인. 빠른 넘김·건너뛰기의 화면 확인은 T03에서 진행.
- commit: `1b2f230` (`feat(intro): 오프닝 문장별 자동 진행 적용`)
