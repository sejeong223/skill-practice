# Task: T02 월드 2 진입 컷신과 자동 전환

## Status: pending

## Goal

월드 1 클리어 화면의 다음 단계 선택 뒤 새 놀이터 전경, 긴장한 코기 얼굴, `....가자!` 대사창을 약 7초 동안 자동으로 보여준 후 월드 2 첫 스테이지를 시작한다. 재접속·재시청 건너뛰기·HUD 표시·진행 저장까지 검증한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-14-world02-playground-entrance.md): `NEXT STAGE ->` 뒤 세 장면을 자동 재생한다. 첫 재생은 끝까지, 재시청은 건너뛰기 가능하다.
- T01의 신규 7개 이미지 키를 사용한다. 기존 얼굴 시트나 단색 직사각형으로 새 장면을 대체하지 않는다.
- 기존 `world-02-intro`는 데이터에만 있고 현재 플레이 경로에서는 실행되지 않는다. 전용 씬을 만들고 이 ID를 저장 키로 재사용한다.

## Implementation

### I01. 세 비트 대본과 씬 생명주기

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD02_ENTRANCE_CUTSCENE`, `WORLD_CUTSCENES`; modify
  - `src/game/cutscenes/types.ts` :: `CutsceneScript`, `CutsceneBeat`, `DialogueLine`; read-only
  - `src/game/scenes/World02EntranceScene.ts` :: `World02EntranceSceneData`, `World02EntranceScene.create/playBeat/finish/cleanup`; new
  - `src/game/bridge/GameEventBus.ts` :: `GameEventBus.emit/on`; read-only
  - `src/game/stages/stageEvents.ts` :: 기존 `cutscene-started`/`cutscene-beat`/`cutscene-finished` payload; read-only
  - `src/game/persistence/AutoSaveCoordinator.ts` :: `cutscene-finished` 저장 트리거; read-only

#### Signatures & Types

- `WORLD02_ENTRANCE_CUTSCENE: CutsceneScript`는 `{ id: "world-02-intro", stageId: "world-02-stage-1", beats: readonly CutsceneBeat[] }`로 선언하고 `WORLD_CUTSCENES`에 정확히 한 번 넣는다. 기존 한 줄짜리 `world-02-intro` 항목을 이 상수로 교체한다.
- 비트 필드는 기존 스키마를 쓴다: `{ id: string, durationMs: number, dialogue?: readonly DialogueLine[], skipAllowedAfterSeen: boolean }`. 새 데이터 타입이나 저장 버전은 필요 없다.
- 비트 순서와 값:
  1. `playground-reveal`: `durationMs: 2500`, 텍스트 없음. `world-02-entrance-playground` 전체 화면, 낮은 코기 시점. 약 5%의 느린 카메라 전진.
  2. `corgi-nervous`: `durationMs: 1700`, 텍스트 없음. `world-02-entrance-corgi-nervous` 얼굴을 중앙 가까이에 놓고 2~3px의 작고 느린 숨/떨림.
  3. `corgi-resolve`: `durationMs: 2300`, `dialogue: [{ speaker: "corgi", text: "....가자!" }]`. 동일한 얼굴 기준점에서 `world-02-entrance-corgi-resolved`로 전환하고 새 프레임 이미지 위에 대사를 한 글자씩 표시.
- 세 비트 모두 `skipAllowedAfterSeen: true`다. 마지막 비트 종료 후 약 400ms 검은 페이드를 거쳐 `StageScene`으로 이동한다. 총 목표 시간은 약 6.9초이며, 페이드는 대사 읽을 시간을 깎지 않는다.
- `World02EntranceSceneData`의 `nextStageId`는 리터럴 타입 `"world-02-stage-1"`이다. 플레이어 이름은 registry의 `ProgressState.playerName`을 읽는다. 필드가 누락되거나 에셋이 없으면 오류를 보이는 화면으로 멈추고, 빈/단색 컷신을 성공으로 간주하지 않는다.

#### Execution Flow / Error Handling

1. `create()`에서 공유 `GameEventBus`와 `ProgressState`, T01 이미지 키를 확인한다. `seenCutsceneIds.includes("world-02-intro")`를 시작 시 `canSkip`으로 저장한다. `cutscene-started`를 한 번 발행하고 첫 장면을 그린다.
2. Phaser 이미지·카메라/tween으로만 컷과 작은 움직임을 만든다. 장면 하나의 타이머가 끝나면 다음 비트로 간다. 첫 두 비트에는 `cutscene-beat`를 발행하지 않아 텍스트 없는 React 풋터가 화면에 나타나지 않는다.
3. 세 번째 비트에 `cutscene-beat`를 `{ cutsceneId: "world-02-intro", beat, index: 2, totalBeats: 3, skipAllowed: canSkip, manualAdvance: false, captionIndex: 0, captionCount: 1 }`로 발행한다. 대사 글자는 이미지에 굽지 않는다.
4. `finish(skipped: boolean)`는 중복 호출 방지 플래그를 먼저 세우고, 진행 기록에 ID를 중복 없이 넣는다. `cutscene-finished`를 한 번 발행해 기존 저장 경로를 태운 뒤 `StageScene`을 `{ stageId: "world-02-stage-1", playerName: progress.playerName }`로 시작한다. 완료/건너뛰기 모두 같은 함수로 수렴한다.
5. 첫 재생에서는 건너뛰기 요청과 ESC를 무시한다. 재시청에서는 ESC와 화면의 건너뛰기 선택, 기존 `cutscene-skip-requested`를 받는다. 씬 종료 때 타이머·tween·키/이벤트 구독을 정리해 늦은 콜백이 중복 진입하지 못하게 한다.

### I02. 월드 1 클리어 버튼과 Phaser 씬 등록

- Related Files:
  - `src/game/scenes/World01StageClearScene.ts` :: `World01StageClearScene.continueToNextStage`; modify
  - `src/game/config.ts` :: `createPhaserConfig`의 `scene` 배열; modify
  - `src/game/scenes/PreloadScene.ts` :: `PreloadScene.create`의 월드 1 완료 후 재접속 경로; read-only
  - `src/game/scenes/StageScene.ts` :: `StageScene.create`, `StageRuntime.start`; read-only

#### Details

- `World01StageClearScene.continueToNextStage()`의 현재 직접 `StageScene` 호출을 `World02EntranceScene` 시작으로 바꾼다. 기존 `canContinue`/`transitioning` 중복 클릭 가드, 클리어 화면 문구, 보상과 보스 승리 대사는 그대로 사용한다.
- `createPhaserConfig`에 `World02EntranceScene`을 등록한다. `PreloadScene`은 현재처럼 월드 1 완료 후 재접속 시 클리어 화면을 열어야 하며, 그 버튼 다음에 새 씬이 나온다.
- 마지막 페이드가 끝나면 `StageScene`을 시작한다. 이때 `stage-started`는 기존 런타임이 발행하므로 컷신 코드가 별도로 발행하지 않는다. 월드 2의 음악·진행 저장·스테이지 클리어 정책은 기존 런타임을 따른다.

### I03. 새 이미지 대사창과 HUD 표시

- Related Files:
  - `src/components/game/CutsceneOverlay.tsx` :: `CutsceneOverlayState`, `CutsceneOverlay`; modify
  - `src/components/game/GameShell.tsx` :: 컷신 이벤트 상태와 HUD/코인/토스트 표시 조건; modify
  - `src/app/globals.css` :: 월드 2 진입 컷신 전용 `.cutscene-overlay--world02` 프레임 스타일; modify
  - `src/components/game/DialogueBox.tsx` :: `DialogueBox`의 코기 화자와 타입라이터; read-only

#### Signatures & Types

- `CutsceneOverlayState`에 `readonly cutsceneId: string`을 추가한다. 기존 `cutscene-beat`의 `payload.cutsceneId`를 저장하고 ID가 `world-02-intro`일 때만 전용 CSS 클래스를 적용한다. 다른 컷신의 레이아웃/버튼 정책은 그대로 사용한다.
- `GameShell`에 `world02EntranceActive: boolean` 상태를 둔다. 해당 ID의 `cutscene-started`에서 true, `cutscene-finished` 또는 이후 `stage-started`에서 false로 하여 이 씬의 세 비트 동안 `GameOverlay`, `SnackCoinCounter`, 토스트가 새 이미지 위에 남지 않게 한다.

#### Details

- 전용 CSS는 `.cutscene-caption-frame`의 배경 이미지에 `/assets/pixel/cutscenes/world-02/world-02-dialogue-frame.png`를 사용한다. 기존 테두리/상자색을 제거하고 이미지 중앙의 어두운 면 안에 `DialogueBox`의 `코기`와 `....가자!`가 들어가게 패딩한다. `image-rendering: pixelated`와 좁은 화면의 글자 줄바꿈/패딩을 점검한다.
- 첫 두 비트에는 React 대사 UI가 없고, 세 번째에만 프레임과 대사가 나온다. `DialogueBox`와 `TypewriterText`는 현재 자동 표시 시간을 사용한다. 이미지를 글자와 합성하여 새 픽셀 대사창처럼 보이게 하되 텍스트는 접근 가능한 DOM으로 둔다.
- React/Next 파일을 수정하기 전에 저장소 `AGENTS.md`가 요구하는 `node_modules/next/dist/docs/`의 관련 App Router/CSS 가이드를 읽는다.

## Acceptance Criteria

- [ ] `NEXT STAGE ->` 뒤 놀이터 전경 → 긴장한 코기 → 결심한 코기와 `....가자!` 순서가 자동 재생된다.
- [ ] 장면에 사용된 놀이터·코기 두 표정·대사창은 모두 T01의 새 이미지이며, 대사는 한글 픽셀 글꼴의 실제 DOM 텍스트다.
- [ ] 첫 재생에 추가 조작 없이 월드 2 첫 스테이지가 한 번만 시작된다. 첫 재생 건너뛰기는 막히고, 재시청 건너뛰기는 동작한다.
- [ ] 재접속으로 클리어 화면을 다시 열어도 동일한 흐름이 이어진다. 컷신 완료 ID와 월드 1 보상·클리어 기록이 보존된다.
- [ ] 컷신 중 플레이 HUD가 이미지/대사를 가리지 않는다. 데스크톱과 좁은 화면에서 얼굴과 대사창이 잘리지 않는다.

## Validation

- `node scripts/validate-assets.mjs` — 컷신/배경 필수 에셋 누락과 중복 키 확인.
- `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs` — 기존 자동 대사 시간 회귀 확인.
- `npm.cmd run test:progression` — 스테이지 순서/저장 진행 회귀 확인.
- `npx.cmd tsc --noEmit` — 씬 데이터·비트·React 상태 타입 검사.
- `npm.cmd run lint` — 프로젝트 lint 검사.
- `npm.cmd run build` — Next/Phaser 번들 빌드 검사.
- `npm.cmd run dev` — 실제 화면에서 월드 1 보스 승리 → 클리어 버튼 → 세 비트 자동 재생 → `world-02-stage-1`, 재접속 뒤 재시청 ESC/화면 건너뛰기, 빠른 중복 클릭, 1280×720과 좁은 화면의 이미지/대사/HUD/배경 표시를 확인한다. 개발자 콘솔과 Phaser 로드 오류가 없어야 한다.

## Commit Message

```text
feat(cutscene): 월드 2 놀이터 진입 연출 연결

Plan: 2026-10-14-world02-playground-entrance
Phase: P01-entrance-and-background
Task: T02-entrance-cutscene-and-transition

- 새 놀이터 컷신과 코기 대사를 자동 재생
- 월드 1 클리어 선택부터 월드 2 시작까지 전환·저장 검증
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
