# Task: T01 놀이터 진입 6문장 대사와 장면 전환

## Status: done

## Goal

월드 1 클리어 뒤 자동 재생되는 `world-02-intro`에서 사용자가 쓴 여섯 문장을 정확한 화자와 이미지에 하나씩 표시하고, 긴 문장도 읽을 수 있게 한 뒤 월드 2 첫 스테이지를 시작한다.

## Decision Summary

- [확정 원고](../../../decisions/2026-10-14-world02-playground-dialogue.md)를 글자 하나까지 그대로 쓴다. 놀이터 2문장, 당황한 코기 2문장, 비장한 코기 2문장이다. 대사창 PNG와 기존 세 장의 컷신 이미지를 그대로 사용한다.
- `world-02-intro` ID, 첫 관람 건너뛰기 불가/재관람 가능, 자동 진행, 마지막 400ms 페이드와 `world-02-stage-1` 시작은 유지한다. 대본이 길어지므로 전체 길이는 약 33초로 늘린다.

## Implementation

### I01. 여섯 개 `CutsceneBeat`로 원고 교체

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD02_ENTRANCE_CUTSCENE`, `WORLD_CUTSCENES`; modify
  - `src/game/cutscenes/types.ts` :: `CutsceneScript`, `CutsceneBeat`, `DialogueLine`; read-only
  - `src/components/game/NarratorText.tsx` :: `NarratorText`의 나레이션 화자 표시; read-only
  - `src/components/game/DialogueBox.tsx` :: `DialogueBox`의 `corgi` 화자 표시; read-only
  - `src/components/game/TypewriterText.tsx` :: 글자 표시 시간(`durationMs * 0.8`); read-only

#### Signatures & Data Schema

```typescript
export const WORLD02_ENTRANCE_CUTSCENE: CutsceneScript = {
  id: "world-02-intro",
  stageId: "world-02-stage-1",
  beats: [/* 아래 표의 6개 CutsceneBeat */],
};
```

- 새 타입·필드는 없다. 각 `CutsceneBeat`는 `{ id: string, durationMs: number, narration?: string, dialogue?: readonly DialogueLine[], skipAllowedAfterSeen: boolean }`를 사용한다. 각 비트에는 `narration` 또는 `dialogue` 한 가지만 둔다. `DialogueLine`은 `{ speaker: "corgi", text: string }`다.
- `WORLD_CUTSCENES`에는 이 상수를 지금처럼 정확히 한 번 포함한다. `world-02-intro` ID를 새 이름으로 바꾸면 저장된 재시청 여부가 끊기므로 변경하지 않는다.

#### Exact Beat Data

| Index | `id` | `durationMs` | 필드·화자 | 정확한 텍스트 |
| :--- | :--- | ---: | :--- | :--- |
| 0 | `playground-narration-1` | 6500 | `narration` | 골목길의 그늘을 벗어난 코기의 눈앞에 나타난 것은... 인간 어린이들의 웃음소리가 깃들었던 평화의 땅, 놀이터. |
| 1 | `playground-narration-2` | 6500 | `narration` | 그러나 이곳은 15cm 다리를 가진 강아지에게 있어 거대한 시련의 던전이자, 고양이들이 개조한 무자비한 장소였다. |
| 2 | `corgi-nervous-line` | 4000 | `dialogue: [{ speaker: "corgi", text }]` | ...저 높이실화냐. 미끄럼틀이 아니라 까마득한 절벽이잖아. |
| 3 | `corgi-nervous-narration` | 8000 | `narration` | 슬개골이 비명을 지르고 엉덩이가 공포로 떨려왔지만, 녀석은 멈추지 않는다. 녀석의 뇌리를 스치는 단 하나의 향기... [투뿔 한우 육즙]! |
| 4 | `corgi-resolved-narration` | 4500 | `narration` | 15cm 짧은 다리가 모래사장을 힘차게 박차며 앞으로 한 걸음 내딛는다. |
| 5 | `corgi-resolved-line` | 3200 | `dialogue: [{ speaker: "corgi", text }]` | ...가자! 육즙은 기다려주지 않는다! |

- 모든 비트에 `skipAllowedAfterSeen: true`. `durationMs` 합계는 32700ms, 마지막 페이드 포함 목표 33100ms다. `TypewriterText`의 기존 80% 표시 시간을 기준으로 문장 완료 후 남는 시간을 준다. 문장 4의 `[투뿔 한우 육즙]`은 강조용 새 마크업이 아닌 화면에 보이는 원문 문자다.

#### Execution Flow / Error Handling

1. 첫 비트부터 여섯 비트를 배열 순서대로 자동 재생한다. 빠진 비트나 잘못된 `speaker`가 없도록 정확한 텍스트와 타입을 확인한다.
2. 기존 저장 데이터는 변환하지 않는다. `ProgressState.seenCutsceneIds`가 `world-02-intro`를 포함하면 재관람 건너뛰기가 허용된다.
3. 필수 이미지 누락 시 `World02EntranceScene.create`의 오류 화면이 나타나며 텍스트만 있는 빈 컷신을 성공으로 처리하지 않는다.

### I02. 6비트와 3이미지 매핑 및 이벤트

- Related Files:
  - `src/game/scenes/World02EntranceScene.ts` :: `World02EntranceScene.playBeat/showPortrait/createSkipControl/finish/cleanup`; modify
  - `src/components/game/CutsceneOverlay.tsx` :: `CutsceneOverlay`의 `cutscene-beat` 구독과 `manualAdvance` 처리; read-only
  - `src/game/stages/stageEvents.ts` :: `cutscene-beat` payload 타입; read-only
  - `src/components/game/GameShell.tsx` :: `world02EntranceActive` HUD 숨김; read-only

#### Signatures & Data Schema

- 기존 `private playBeat(index: number): void`와 `private showPortrait(assetKey: string): void` 시그니처를 유지한다.
- 각 비트에 발행할 기존 payload는 `{ cutsceneId: "world-02-intro", beat, index, totalBeats: 6, skipAllowed: this.canSkip, manualAdvance: false, captionIndex: 0, captionCount: 1 }`다. `beat`는 해당 index의 `CutsceneBeat` 참조다.
- 씬 이미지 키는 기존 그대로다: `world-02-entrance-playground`, `world-02-entrance-corgi-nervous`, `world-02-entrance-corgi-resolved`, `world-02-entrance-dialogue-frame`.

#### Execution Flow / Logic

1. `create()`의 이벤트 버스·진행 상태·4개 이미지 유효성 검사, `cutscene-started` 1회 발행, 첫 관람/재관람 판정은 유지한다.
2. index 0에서는 놀이터 전경을 1280×720으로 보여주고 느린 약 5% 줌을 첫 두 비트의 총 13000ms에 걸쳐 한 번만 시작한다. index 1은 이미지를 다시 만들거나 카메라를 초기화하지 않는다.
3. index 2에서만 `world-02-entrance-corgi-nervous`를 보여준다. index 3에서는 같은 얼굴을 유지하며 초상화 tween을 다시 시작하지 않는다.
4. index 4에서만 `world-02-entrance-corgi-resolved`로 교체한다. 이전 초상화 tween을 정리하고 교체하며 index 5는 같은 얼굴을 유지한다.
5. **모든 index 0~5**에서 `cutscene-beat`를 발행해 나레이션도 기존 이미지 대사창에 올린다. `CutsceneOverlay`가 `narration`/`dialogue`를 이미 분기 처리하므로 새 컴포넌트는 필요 없다.
6. 재관람의 Phaser `skipControl`은 이제 DOM 대사창의 건너뛰기 버튼과 중복되므로 표시하지 않거나 모든 비트에서 숨긴다. ESC와 `cutscene-skip-requested` 수신은 유지한다. 첫 관람은 `canSkip=false`로 무시한다.
7. 마지막 비트가 끝나면 기존 400ms 검은 페이드, `finish(false)`의 중복 방지·완료 ID 저장·`cutscene-finished` 1회 발행·`StageScene` 시작을 유지한다. 재관람 건너뛰기는 같은 `finish(true)`로 수렴한다. 씬 종료 시 타이머·tween·키·이벤트 구독을 정리한다.

### I03. 긴 나레이션 대사창 표시

- Related Files:
  - `src/app/globals.css` :: `.cutscene-overlay--world02 .cutscene-caption-frame`, `.cutscene-overlay--world02 .cutscene-narration`, 좁은 화면 `@media (max-width: 720px)`; modify
  - `public/assets/pixel/cutscenes/world-02/world-02-dialogue-frame.png` :: 기존 픽셀 프레임; read-only
  - `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` :: Next 16 CSS 가이드; read-only, 구현 전 확인

#### Details

- 기존 프레임 PNG URL을 유지하고 새 텍스트는 React DOM으로 그린다. `CutsceneOverlay`의 `aria-live="polite"`, 한글 픽셀 글꼴과 다른 컷신 스타일은 유지한다.
- `.cutscene-overlay--world02 .cutscene-caption-frame`은 고정 `height`나 `overflow:hidden`으로 긴 문장을 자르지 않는다. 내용에 따라 높이가 커지게 하고 기존 프레임 이미지를 `background-size: 100% 200%` / `background-position: center`로 맞춰 투명 상하 여백 때문에 어두운 면이 좁아지는 문제를 막는다.
- 720px 이하에서는 나레이션·대사 행의 기존 62px/52px 그리드 화자 열을 없애고 `display:block`으로 화자와 텍스트를 같은 흐름에 배치한다. 화자 뒤에 약 7px 간격을 두어 긴 문장의 다음 줄이 프레임 전체 너비를 사용하도록 한다. 글자는 최소 11px, 줄 간격 약 1.35를 확보하고 `padding`을 조정한다. 이로써 77자 문장이 3~4줄로 접혀도 코기 눈과 대사창 밖을 가리지 않게 한다.
- 실제 1280×720 및 약 390px 폭의 화면에서 여섯 비트 전체를 캡처하고, 4번 비트의 긴 문장과 대괄호·마지막 대사 끝이 보이는지 확인한다. 필요하면 이 월드 2 전용 선택자 안에서만 간격을 조정한다.

## Acceptance Criteria

- [x] 6문장이 위 표와 글자까지 같고, 0·1·3·4는 `나레이션`, 2·5는 `코기`로 표시된다.
- [x] 0·1 놀이터 → 2·3 당황한 얼굴 → 4·5 비장한 얼굴이며 각 두 번째 문장에서 이미지가 깜빡이지 않는다.
- [x] 첫 관람은 입력 없이 자동 완료하고 ESC 전체 건너뛰기가 막힌다. 재관람은 화면 버튼/ESC로 건너뛰며 모두 월드 2 첫 스테이지에 한 번 진입한다.
- [x] `world-02-intro` 저장 ID, 완료 이벤트 1회, 재접속 후 클리어 화면, 기존 월드 1 보스 대화가 유지된다.
- [x] 긴 원고가 1280×720과 좁은 화면의 픽셀 프레임 안에서 읽히고 HUD·초상화에 가려지지 않는다.
- [x] 기존 PNG·다른 컷신·월드 2 플레이 배경은 바뀌지 않는다.

## Validation

- `node scripts/validate-assets.mjs` — 기존 필수 컷신 PNG 경로와 키 누락 없음.
- `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs` — 자동 글자/비트 진행과 skip 회귀 없음.
- `npm.cmd run test:progression` — 월드 1 클리어 뒤 월드 2 진입 경로 회귀 없음.
- `npx.cmd tsc --noEmit` — 6비트 `CutsceneBeat`와 scene/event payload 타입 검사.
- `npm.cmd run lint` — 컷신 데이터·Phaser·CSS 연동 lint 통과.
- `npm.cmd run build` — Next/Phaser 번들 production build 통과.
- `npm.cmd run dev` — 월드 1 클리어 화면 `NEXT STAGE ->`부터 모든 문장·이미지·화자·긴 대사창을 1280×720/약 390px 폭에서 확인한다. 첫 관람 ESC 차단, 재관람 ESC/버튼 건너뛰기, 중복 클릭·새로고침 뒤 완료 ID/클리어 기록을 확인한다. 로드 오류와 브라우저 예외가 없어야 한다.

## Commit Message

```text
feat(cutscene): 월드 2 놀이터 진입 대본 여섯 문장 적용

Plan: 2026-10-14-world02-playground-dialogue
Phase: P01-entrance-dialogue
Task: T01-six-line-entrance-dialogue

- 새 나레이션과 코기 대사를 세 장면에 순서대로 표시
- 긴 대사창과 자동 진행·재관람 흐름 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
