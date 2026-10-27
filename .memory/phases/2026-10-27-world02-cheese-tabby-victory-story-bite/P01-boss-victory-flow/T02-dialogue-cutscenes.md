# Task: T02 치즈 태비 전후 대화

## Status: done

## Goal

첫 월드 2 보스 대결 전에 사용자 지정 7줄, 승리 후에 8줄을 삼색이 전투와 같은 대화 상자와 진행 방식으로 빠짐없이 재생한다.

## Decision Summary

- 기존 `world-02-boss-intro`와 `world-02-boss-clear` ID를 유지해 저장된 `seenCutsceneIds`와 컷신 연결을 보존한다. 한 줄짜리 narration/reward beat만 교체한다.
- 화자는 `cheese-tabby`와 `corgi`로 구분하고 화면 표시명은 각각 `치즈 태비`, `코기`다. 월드 1처럼 자동 진행과 클릭/Enter/Space 대사 넘기기를 함께 제공한다.

## Implementation

### I01. 대사 데이터와 화자 타입

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD02_BOSS_INTRO_LINES`, `WORLD02_BOSS_CLEAR_LINES`, `WORLD_CUTSCENES` — 아래 순서 그대로 대사 beat로 교체; modify
  - `src/game/cutscenes/types.ts` :: `CutsceneSpeaker`, `DialogueLine` — `"cheese-tabby"` 화자 추가; modify
  - `src/components/game/DialogueBox.tsx` :: `SPEAKER_LABELS` — `"cheese-tabby": "치즈 태비"` 추가; modify
  - `src/app/globals.css` :: `.speaker-cheese-tabby .dialogue-speaker` — 치즈 태비 화자 색을 기존 팔레트 안에서 분명하게 표시; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export type CutsceneSpeaker = "narrator" | "owner" | "corgi" | "cat" | "calico" | "cheese-tabby";
  export interface DialogueLine { readonly speaker: CutsceneSpeaker; readonly text: string; }
  export interface CutsceneBeat {
    readonly id: string; readonly durationMs: number;
    readonly dialogue?: readonly DialogueLine[];
    readonly skipAllowedAfterSeen: boolean;
    // 기존 narration/camera/actors/soundCue/musicKey/itemCard 필드는 보존
  }
  ```
- **Data & Schema Fields**:
  - intro: `id="world-02-boss-intro"`, `stageId="world-02-stage-boss"`, beat IDs `cheese-intro-1`…`cheese-intro-7`, `durationMs=3000`, `skipAllowedAfterSeen=true`.
  - clear: `id="world-02-boss-clear"`, 같은 stageId, beat IDs `cheese-clear-1`…`cheese-clear-8`, 같은 duration/skip 설정. 마지막 기절 문장도 `dialogue`에 둔다.
  - 전투 전 정확한 `(화자, text)` 배열:
    1. `cheese-tabby` — `뭐냥? 이 잘 구워진 인절미 같은 녀석은?`
    2. `corgi` — `네 녀석이 치즈 태비냐? 턱시도는 어디로 갔어!`
    3. `cheese-tabby` — `턱시도 형님? 이미 왕갈비뼈를 물고 '공사장'으로 가셨다냥!`
    4. `cheese-tabby` — `하지만 넌 절대 여기서 못 나간다냥!`
    5. `corgi` — `당장 길을 비키지 않으면 네 귀여운 노란 털을 몽땅 뽑아버리겠다!`
    6. `cheese-tabby` — `지옥의 놀이터에 온 걸 환영한다냥!`
    7. `cheese-tabby` — `내 얌체 탱탱볼에 머리통 깨져서 집으로 돌아가라냥! 자, 난사 개시다냥!`
  - 전투 후 정확한 `(화자, text)` 배열:
    1. `cheese-tabby` — `냥?! 내 무적의 탱탱볼 계산법이 틀렸단 말이냐냥...?!`
    2. `corgi` — `공놀이는 내가 너보다 백배는 더 많이 해봤다 멍! 이제 턱시도가 간 곳을 불어라!`
    3. `cheese-tabby` — `크윽... 억울하다냥! 어차피 넌 다음 구역에서 바비큐가 될 거다냥!`
    4. `cheese-tabby` — `턱시도 형님은 '위험천만한 공사장' 구역으로 넘어가셨다냥!`
    5. `corgi` — `공사장? 철근과 시멘트 가루가 날리는 그 위험한 곳 말이냐?`
    6. `cheese-tabby` — `그래냥! 그곳을 지키는 베테랑 간부 '고등어 태비' 형님이 널 시멘트에 반죽해 버릴 거다냥!`
    7. `cheese-tabby` — `네 짧은 다리로는 굳지 않은 시멘트에 발이 묶여서 평생 공사장 마스코트나 될 거다냥!`
    8. `cheese-tabby` — `눈이 골뱅이가 된 채 핑글핑글 돌며 기절한다.`
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 ID가 `CUTSCENE_SCRIPTS`에 각 1개씩 존재하게 유지하고 `skipAllowedAfterSeen`를 보존한다.
  2. Core Processing: 각 배열을 한 beat/한 dialogue line으로 map한다. 기존 단발 narration과 `bite-reward` 안내 beat는 제거한다. 보상 안내는 T03의 해금 화면에서 보여준다.
  3. Error & Exception Handling: 미등록 화자 key로 `SPEAKER_LABELS`가 `undefined`가 되지 않도록 `Record<DialogueLine["speaker"], string>`를 완전하게 채운다.
  4. State Transition & Return: `CutsceneDirector.play("world-02-boss-intro")`와 clear가 각각 7/8 beat를 재생하고 완료 시 기존 `seenCutsceneIds`에 한 번만 기록한다.

### I02. 대사 진행과 카메라

- Related Files:
  - `src/game/cutscenes/CutsceneDirector.ts` :: `play`, `handleBeat` — 월드 2 보스 intro/clear를 월드 1처럼 manual advance 허용 목록에 추가; modify
  - `src/game/scenes/StageScene.ts` :: 월드 2 후속 보스의 `cutscene-beat` 구독 — `cheese-tabby` 화자이면 `laterBossSprite`, `corgi`면 `player`로 `cameraDirector.focusDialogue` 호출; modify
  - `src/components/game/CutsceneOverlay.tsx` :: `manualAdvance` 소비 — 현재 클릭/키 동작 확인만; read-only
  - `scripts/world02-boss-dialogue.test.mjs` :: 새 대사·화자·순서 테스트; new
  - `scripts/cutscene-auto-advance.test.mjs` :: 기존 자동/수동 컷신 회귀; read-only
  - `scripts/stage-progression.test.mjs` :: 단발 narration에 의존하던 기존 월드 2 보스 intro 검사 갱신; modify

#### Details

- **Signatures & Types**:
  ```typescript
  public play(id: string): Promise<void>;
  private handleBeat(script: CutsceneScript, beat: CutsceneBeat, index: number): void;
  // GameEventBus의 기존 "cutscene-beat" payload: {cutsceneId, beat, index, totalBeats, skipAllowed, manualAdvance}
  ```
- **Data & Schema Fields**: 새 저장 필드는 없다. `seenCutsceneIds: string[]`에 기존 `world-02-boss-intro/clear`를 재사용한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 첫 방문에서 intro 재생, 이미 본 전투에서는 기존 재대결 cue가 뜨는 `StageScene` 분기를 유지한다. 개발용 `skipBossIntro`는 그대로 둔다.
  2. Core Processing: `CutsceneDirector`의 자동 진행을 유지하면서 UI의 명시적 넘기기도 가능하게 한다. 월드 2 컷신 beat마다 화자에 맞춰 카메라를 이동한다. 승리 대화 동안 HP 0/패배 자세가 유지된다.
  3. Error & Exception Handling: `laterBossSprite` 또는 `player`가 없으면 카메라 이동만 건너뛰고 대사 진행은 멈추지 않는다. 컷신 재생 도중 stage 종료 시 기존 `destroy()` 취소를 따른다.
  4. State Transition & Return: clear의 마지막 beat가 완료된 뒤에만 `handleLaterBossDefeat`의 `await` 다음 코드가 실행된다. T03의 모달 순서가 이를 전제로 한다.

## Acceptance Criteria

- [ ] 화면에 지정한 전투 전 7줄과 전투 후 8줄이 빠짐없이 정확한 화자 이름으로 나온다.
- [ ] 재대결/건너뛰기/자동 진행과 월드 1 컷신 동작이 유지된다.
- [ ] 마지막 대사가 끝나기 전에는 클리어 화면이 나타나지 않는다.

## Validation

- `node --test scripts/world02-boss-dialogue.test.mjs scripts/cutscene-auto-advance.test.mjs scripts/stage-progression.test.mjs` — 대사 배열·ID·진행 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 화자 타입 및 구독 타입 검사 통과.
- `node node_modules/eslint/bin/eslint.js src/game/data/cutscenes/worlds.ts src/game/cutscenes/types.ts src/game/cutscenes/CutsceneDirector.ts src/game/scenes/StageScene.ts src/components/game/DialogueBox.tsx scripts/world02-boss-dialogue.test.mjs` — lint 오류 0개.
- 브라우저에서 첫 진입 7줄, 승리 후 8줄, 클릭/Enter/Space/자동 진행과 화자 카메라를 확인한다.

## Commit Message

```text
feat(world02): 치즈 태비 전후 대사를 컷신으로 연결하기

Plan: 2026-10-27-world02-cheese-tabby-victory-story-bite
Phase: P01-boss-victory-flow
Task: T02-dialogue-cutscenes

- 사용자 제공 전투 전후 대사 15줄과 치즈 태비 화자 추가
- 월드 1 방식의 대사 진행과 보스·코기 카메라 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: T02-dialogue-cutscenes
