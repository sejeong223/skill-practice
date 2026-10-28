# Task: T02 공사장 합성 효과음과 오디오 계약

## Status: done

## Goal

월드 3 인트로에서 드릴·굴착기 소리를 낮은 음량의 짧은 합성 WAV로 재생할 수 있게 한다. 기존 `world-03-factory` 음악은 유지하고, 두 효과음 때문에 음악이 크게 줄거나 다음 장면에 소리가 남지 않게 한다.

## Decision Summary

- 사용자가 직접 만든 픽셀 게임식 합성음을 선택했다. 드릴·굴착기는 두 번째 나레이션 동안 짧게 들리고 코기 대사 전에 끝난다.
- `AudioManager`의 기존 Tone 공유 오디오 경로를 재사용한다. 인트로 장면 생성·종료 시 오디오 관리자를 붙이고 해제하는 일은 T03에서 한다.

## Implementation

### I01. 재현 가능한 공사장 WAV 생성

- Related Files:
  - `scripts/generate-world03-intro-sfx.mjs` :: `renderConstructionDrillSfx`, `renderConstructionExcavatorSfx`, `writeOrCheckWorld03IntroSfx` — 독립 실행 가능한 합성·검사 도구; new
  - `public/assets/audio/world-03-construction-drill.wav` :: 짧은 드릴 진동음; new
  - `public/assets/audio/world-03-construction-excavator.wav` :: 짧은 굴착기 저음; new
  - `public/assets/audio/ATTRIBUTION.md` :: 외부 샘플을 쓰지 않은 원본 합성 사실·생성 명령 기록; modify
  - `scripts/world03-intro-audio.test.mjs` :: WAV 헤더·출력 재현성·길이 검증; new
  - `scripts/generate-bite-sfx.mjs` :: 기존 RIFF 44바이트/PCM 생성 방식 참고; read-only

#### Details

- **Signatures & Types**:
  ```javascript
  export function renderConstructionDrillSfx(); // Buffer
  export function renderConstructionExcavatorSfx(); // Buffer
  export function writeOrCheckWorld03IntroSfx(check); // void; check:boolean
  ```
- **Data & Schema Fields**:
  - 두 파일 모두 44,100Hz, 1채널, 16비트 리틀엔디언 PCM WAV(`RIFF`/`WAVEfmt `/`data`). 드릴 길이 약 0.55초, 굴착기 약 0.85초로 고정한다.
  - 드릴: 고정 시드 잡음과 빠르게 끊기는 중역대 진동, 시작·끝의 짧은 페이드. 굴착기: 고정 시드 저역 잡음과 낮은 음고가 내려가는 굉음, 시작·끝 페이드. 실제 녹음·외부 샘플은 사용하지 않는다.
- **Execution Flow / Logic**:
  1. 동일 입력이면 항상 동일한 바이트가 나오도록 난수 시드와 길이를 고정한다. WAV 데이터를 정규화하되 클리핑을 방지하고 마지막 샘플은 0으로 닫는다.
  2. 평소 실행은 두 WAV를 쓴다. `--check`는 생성 결과와 저장된 파일 바이트를 비교하고 불일치·누락 시 실패한다.
  3. 테스트는 샘플레이트·채널·비트 깊이·재생 길이·무음이 아님·두 파일이 서로 다름·`--check` 결과를 검증한다. 실제 음색과 음악 아래의 음량은 나중에 청음한다.

### I02. 오디오 키·프리로드·음악 섞기

- Related Files:
  - `src/game/audio/audioManifest.ts` :: `SOUND_KEYS`, `FeedbackSoundKey`, `FEEDBACK_AUDIO` — 두 효과음 키·경로·gain 등록; modify
  - `src/game/audio/AudioManager.ts` :: `AudioManager.playSfx`, `prepareFeedbackSound`, `playFeedbackSound` — 새 효과음 재생과 음악 duck 예외; modify
  - `src/game/scenes/PreloadScene.ts` :: `preload` — `FEEDBACK_AUDIO` 전부를 이미 binary로 필수 로드하므로 기존 흐름 확인; read-only
  - `scripts/audio-pause.test.mjs` :: `harness`·오디오 재생 테스트 — 새 키, 낮은 음량, 정리 동작 검증; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export type FeedbackSoundKey = "coin" | "checkpoint" | "bark" | "cat-hiss" | "bite"
    | "world-03-drill" | "world-03-excavator";
  export const FEEDBACK_AUDIO: Readonly<Record<FeedbackSoundKey, {
    cacheKey: string; url: string; gain: number; duckMusic?: boolean;
  }>>;
  public playSfx(key: string): void;
  ```
- **Data & Schema Fields**:
  - `SOUND_KEYS`에 `world-03-drill`, `world-03-excavator` 추가한다.
  - `FEEDBACK_AUDIO["world-03-drill"]`: `{cacheKey:"feedback-world-03-drill",url:"/assets/audio/world-03-construction-drill.wav",gain:0.13,duckMusic:false}`.
  - `FEEDBACK_AUDIO["world-03-excavator"]`: `{cacheKey:"feedback-world-03-excavator",url:"/assets/audio/world-03-construction-excavator.wav",gain:0.12,duckMusic:false}`.
  - 기존 5개 피드백음은 `duckMusic` 생략 시 현재처럼 음악 gain 0.38로 낮추는 동작을 유지한다.
- **Execution Flow / Logic**:
  1. `AudioManager` 생성 시 기존 효과음과 두 새 효과음의 decode를 준비한다. `playSfx`가 새 키를 `playFeedbackSound`로 보내도록 분기한다.
  2. `playFeedbackSound`에서 `duckMusic === false`면 재생 source는 평소처럼 추적·중지하지만 `feedbackVoices`를 증가시키거나 음악 gain을 변경하지 않는다. 기존 소리의 duck 카운트는 유지한다.
  3. `stopEffects()`·`destroy()`·일시정지 시 지연 decode가 뒤늦게 재생되지 않도록 `effectsGeneration` 검사를 유지한다. `PreloadScene`의 필수 효과음 로딩 실패 메시지는 신규 `FEEDBACK_AUDIO` 항목에도 자동 적용된다.
  4. `audio-pause.test.mjs` mock binary cache에 두 cacheKey를 추가하고, 새 효과음을 음악과 함께 재생해 음악 gain이 1을 유지하며 정리 후 source가 중지되는지 확인한다. 기존 코인·짖기 duck 테스트가 그대로 통과해야 한다.

## Acceptance Criteria

- [ ] 드릴·굴착기 WAV가 서로 다른 짧은 소리로 재현 가능하게 생성되고 출처 기록에 외부 샘플 없음이 명시된다.
- [ ] 두 키를 재생하면 음악 볼륨을 강제로 낮추지 않으며 기존 코인·짖기 등은 원래의 duck 동작을 유지한다.
- [ ] 오디오 잠금·일시정지·장면 종료 뒤 두 새 효과음의 지연 재생이 없다.

## Validation

- `node scripts/generate-world03-intro-sfx.mjs --check` — 저장 WAV와 재생성 바이트 일치.
- `node --experimental-strip-types --test scripts/world03-intro-audio.test.mjs scripts/audio-pause.test.mjs` — WAV 및 오디오 수명 회귀 통과.
- `npx tsc --noEmit` — 새 사운드 키와 옵션 타입 통과.
- 실제 청음에서 드릴·굴착기가 서로 구분되고 배경음악 아래에서 대사 집중을 방해하지 않는지 확인한다.

## Commit Message

```text
feat(audio): 월드 3 인트로 공사장 효과음 추가

Plan: 2026-10-28-world03-entrance-intro
Phase: P01-construction-entrance
Task: T02-construction-audio

- 재현 가능한 드릴·굴착기 합성 WAV 생성
- 음악 볼륨을 유지하는 낮은 음량 재생 경로 등록
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
