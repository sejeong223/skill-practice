# Task: T04 짖기와 구별되는 전용 물기 효과음

## Status: done

## Goal

E 물기가 승인될 때마다 짖기 WAV 대신 짧은 물기 소리를 정확히 한 번 재생한다. 물기 공격의 명중·피해·쿨타임과 기존 오디오 잠금·일시정지·종료 동작은 유지한다.

## Decision Summary

- `StageScene`과 `PrototypeScene`은 `SkillSystem.use("bite", …).accepted` 뒤 `bite-hit`를 각각 한 번 발행한다. 기존 이벤트를 재사용하고 발행 코드나 적 명중 판정은 수정하지 않는다. 이 이벤트명은 실제 명중 여부와 관계없이 스킬 승인 시 발행되는 현행 계약이다.
- 기존 `AudioManager`의 `bite-hit → bark` 매핑을 `bite-hit → bite`로 바꾼다. 파일은 원본 짖기 음원과 다른 짧은 자체 제작 PCM WAV로 두고 `FEEDBACK_AUDIO` 경로를 사용한다. 사용자 확인 범위는 전신 이미지·의상 유지와 전용 물기 효과음이다.

## Implementation

### I01. 재현 가능한 물기 WAV 만들기

- Related Files:
  - `scripts/generate-bite-sfx.mjs` :: `renderBiteSfx`, `writeOrCheckBiteSfx` — 동일한 바이트를 재생성하는 Node 스크립트; new
  - `public/assets/audio/corgi-bite.wav` :: `feedback-bite` 원본 WAV — 스크립트 산출물; new
  - `public/assets/audio/ATTRIBUTION.md` :: 자체 제작 음원 출처와 생성 방식 — 한 항목 추가; modify
  - `scripts/bite-audio-assets.test.mjs` :: WAV 구조·독립성 검사 — new

#### Details

- **Signatures & Types**:
  ```javascript
  export function renderBiteSfx() /* Buffer */;
  export function writeOrCheckBiteSfx(check /* boolean */) /* void */;
  // node scripts/generate-bite-sfx.mjs         → 파일 생성
  // node scripts/generate-bite-sfx.mjs --check → 기존 파일과 바이트 비교, 다르면 실패
  ```
- **Data & Schema Fields**: 파일은 `RIFF/WAVE`, PCM format 1, 단일 채널, 44,100 Hz, 16-bit signed little endian, `data` 8,820 샘플(0.20초), 표준 44바이트 헤더를 사용한다. `SoundKey`는 `"bite"`, `FeedbackSoundKey`도 `"bite"`를 포함한다. 저장 진행 데이터나 에셋 manifest에는 필드를 추가하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 스크립트 경로 기준 `../public/assets/audio/corgi-bite.wav`를 사용한다. `--check` 이외 인수는 오류로 종료한다. 출력 디렉터리는 이미 존재한다.
  2. Core Processing: 시드 `0xC0B61`의 xorshift32 난수를 `[-1,1]`로 바꾸고, `low += 0.25 * (noise-low)`의 필터된 잡음을 사용한다. 0ms와 75ms에 각각 감쇠하는 짧은 잡음 버스트를 만들고, 180Hz에서 110Hz로 내려가는 사인파를 약하게 섞어 턱이 닫히는 느낌을 준다. 각 버스트는 시작 2ms에 선형 상승하고 이후 `exp(-40 * elapsedSeconds)`로 감쇠하며 100ms 뒤 0으로 자른다. 첫 버스트 계수는 0.75, 두 번째는 0.40, 저음 계수는 0.18이다. 전체 파형을 최대 절댓값 0.82로 정규화하고 처음·끝 3ms를 선형 fade한 뒤 `round(clamp(sample,-1,1)*32767)`로 PCM16을 쓴다. 모든 버퍼와 결과는 seed가 같으면 동일해야 한다.
  3. State Transition & Return: 일반 실행은 파일을 쓰고, `--check`는 파일을 수정하지 않고 `Buffer.equals`로 비교해 불일치 시 비정상 종료한다. `ATTRIBUTION.md`에는 외부 샘플 없이 로컬 스크립트로 생성했다고 적고 파일 경로와 0.20초 규격을 기록한다.
  4. Error & Exception Handling: 파일 쓰기/읽기 실패는 비정상 종료한다. 유효하지 않은 WAV를 음소거로 대체하지 않는다. 브라우저 청음에서 짖기와 혼동되거나 과도하게 큰 경우 생성 파라미터와 테스트 기대치를 함께 조정한다.

### I02. 물기 이벤트를 전용 피드백 버퍼에 연결

- Related Files:
  - `src/game/audio/audioManifest.ts` :: `SOUND_KEYS`, `FeedbackSoundKey`, `FEEDBACK_AUDIO` — `bite` 음원 등록; modify
  - `src/game/audio/AudioManager.ts` :: constructor, `playSfx`, `prepareFeedbackSound`, `playFeedbackSound` — 선해독과 `bite-hit` 매핑; modify (후자 두 함수의 내부 계약은 재사용)
  - `src/game/scenes/PreloadScene.ts` :: `Object.values(FEEDBACK_AUDIO)`의 binary 로드 및 필수 파일 오류 처리 — read-only
  - `src/game/scenes/StageScene.ts` :: `bite-hit` 승인 직후 1회 발행 — read-only
  - `src/game/scenes/PrototypeScene.ts` :: `bite-hit` 승인 직후 1회 발행 — read-only
  - `scripts/audio-pause.test.mjs` :: 피드백 버퍼/이벤트 하네스 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  export type SoundKey = (typeof SOUND_KEYS)[number]; // "bite" 포함
  export type FeedbackSoundKey = "coin" | "checkpoint" | "bark" | "cat-hiss" | "bite";
  export const FEEDBACK_AUDIO: Readonly<Record<FeedbackSoundKey, {
    cacheKey: string; url: string; gain: number;
  }>>;
  public playSfx(key: string): void;
  ```
- **Data & Schema Fields**: `FEEDBACK_AUDIO.bite = {cacheKey:"feedback-bite",url:"/assets/audio/corgi-bite.wav",gain:0.50}`. `SOUND_KEYS`에도 `"bite"` 하나만 추가한다. `MUSIC_KEYS`, 진행 저장 필드, skill ID, HUD 키는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `PreloadScene`의 기존 `FEEDBACK_AUDIO` 순회가 새 WAV를 필수 binary로 로드한다. manifest 항목이 누락되면 로드 오류 화면이 표시되므로 URL과 실제 파일 이름을 일치시킨다.
  2. Core Processing: 생성자에서 `prepareFeedbackSound("bite")`를 기존 4개 피드백과 함께 호출한다. `gameplayBus.on("bite-hit", …)`는 `playSfx("bite")`를 한 번 호출한다. `playSfx`의 피드백 분기에 `bite`를 포함해 `playFeedbackSound`가 공유 Tone AudioContext에서 버퍼를 재생하도록 한다. `skill-used`의 짖기 처리와 일반 SFX 합성 경로는 그대로 둔다.
  3. State Transition & Return: 승인된 E 물기(명중/빗나감)에 전용 소리 1개, 거절된 입력/미해금/쿨타임에는 0개가 재생된다. 오디오 잠금 해제, 일시정지, 장면 파괴, 1초 지난 지연 디코딩은 기존 피드백 경로의 취소 규칙을 따른다. 짖기는 `bark`를 유지한다.
  4. Error & Exception Handling: 음원 로드 오류는 `PreloadScene`의 필수 피드백 오류로 드러나고, 디코딩 실패는 기존 `prepareFeedbackSound`의 null 처리와 콘솔 오류를 따른다. 사운드 실패가 스킬 사용이나 보스 HP 감소를 막지 않는다.

### I03. 재생·회귀 검증

- Related Files:
  - `scripts/bite-audio-assets.test.mjs` :: `corgi-bite.wav` 구조와 짖기 WAV 비동일 검사 — new
  - `scripts/audio-pause.test.mjs` :: `bite-hit`와 `bark`의 서로 다른 버퍼 선택, 정지·잠금·파괴 검증 — modify
  - `scripts/bite-skill.test.mjs` :: 승인·쿨타임·피해 2 회귀 — read-only
  - `.memory/test-plans/2026-10-28-corgi-bite-full-body-review.md` :: 실제 브라우저 청음 결과 — T03에서 만든 문서에 T04 결과 추가; modify during execution

#### Details

- WAV 테스트는 RIFF/WAVE/PCM16/mono/44.1 kHz/0.20초, 길이·샘플 범위·peak 0.75~0.86·시작/끝 fade·무음 아님을 확인한다. `corgi-bark.wav`와 해시/바이트가 같지 않아야 한다. 생성 스크립트 `--check`로 결과 바이트의 재현성을 검사한다.
- `audio-pause.test.mjs` 하네스는 `binary.get(key)`에 키별 구별되는 바이트를 돌려주고 `decodeAudioData` 결과에 key 식별자를 넣어 소스의 `buffer`를 확인한다. `bite-hit` 1회는 `feedback-bite` 소스 1개, 짖기 `skill-used`는 `feedback-bark` 소스 1개여야 한다. 승인되지 않은 스킬은 `bite-hit`를 내지 않는 Stage/Prototype 계약을 별도로 확인하고, 일시정지/잠금 해제 전/파괴 뒤 지연 디코딩은 재생하지 않아야 한다.
- 브라우저에서 E를 눌러 명중/빗나감의 소리가 짖기 W와 명확히 다른지 청음하고, 연속 E 쿨타임 거절과 일시정지·재개·장면 전환 시 중복 재생/잔향이 없는지 확인한다. 수동 확인 전에는 통과로 기록하지 않는다.

## Acceptance Criteria

- [ ] 물기 WAV가 자체 제작 0.20초 PCM 파일로 추가되고 원본을 재생성·검사할 수 있다.
- [ ] 승인된 물기는 전용 소리를 정확히 한 번 재생하며 W 짖기는 기존 소리를 유지한다.
- [ ] 거절된 E 입력은 소리를 내지 않고 일시정지·잠금·장면 종료 안전성이 유지된다.
- [ ] 스킬 피해 2, 6초 쿨타임, 물기 시각 320ms, 명중 판정은 변경되지 않는다.

## Validation

- `node scripts/generate-bite-sfx.mjs --check` — 커밋된 WAV가 생성식과 일치.
- `node --test scripts/bite-audio-assets.test.mjs scripts/audio-pause.test.mjs scripts/bite-skill.test.mjs scripts/bark-audio-assets.test.mjs scripts/bite-presentation.test.mjs` — 오디오·스킬·시각 회귀 통과.
- `node scripts/validate-assets.mjs` — 이미지 에셋 검증 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/audio/audioManifest.ts src/game/audio/AudioManager.ts scripts/generate-bite-sfx.mjs scripts/bite-audio-assets.test.mjs scripts/audio-pause.test.mjs` — 변경 파일 lint 통과.
- `npm.cmd run build` — 정적 WAV 경로와 게임 번들 빌드 성공.
- 브라우저 청음과 일시정지·재개·장면 전환 결과를 `.memory/test-plans/2026-10-28-corgi-bite-full-body-review.md`에 기록한다.
- `git diff --cached --check` 및 `git diff --cached` — 기존 미커밋 보스·UI 작업이 섞이지 않았는지 확인.

## Commit Message

```text
fix(오디오): 물기 전용 효과음을 추가하고 짖기 음원 재사용 제거

Plan: 2026-10-28-corgi-bite-full-body
Phase: P01-bite-sprite
Task: T04-dedicated-bite-audio

- 자체 제작 물기 WAV를 필수 피드백 에셋으로 등록
- 물기 승인·일시정지·잠금·종료 재생 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (오디오·스킬·연출 자동 24건, 에셋·타입·lint·빌드, 브라우저 오류 로그 0건; 직접 청음 미실시)
- commit: 이 Task의 Git 커밋
