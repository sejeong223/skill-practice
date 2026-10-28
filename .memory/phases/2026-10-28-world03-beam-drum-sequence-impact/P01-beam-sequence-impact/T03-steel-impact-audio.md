# Task: T03 철근 충돌 `꽝!` 효과음 제작

## Status: done

## Goal

월드 3 철근이 무거운 금속 구조물처럼 바닥에 부딪히는 0.85초 이내의 짧은 효과음을 제작하고, 게임의 기존 PCM 효과음 재생 경로에 등록한다.

## Decision Summary

- 외부 로그인·샘플 파일에 의존하지 않는 재현 가능한 원본을 만든다. 실제 [콘크리트 위 금속 낙하 녹음](https://freesound.org/people/SamsterBirdies/sounds/581596/)은 음색 비교 자료로만 사용한다. 게임식 음계·비프음 대신 저역 충격과 불규칙한 금속 공명·잔진동을 겹친다.
- 충돌음은 바닥·코기 명중 공용 1개 WAV로 만들며, T04에서 사건별로 한 번만 재생한다.

## Implementation

### I01. 원본 충돌음 생성

- Related Files:
  - `scripts/generate-world03-steel-impact.mjs` :: `renderWorld03SteelImpactSfx`, `writeOrCheckWorld03SteelImpactSfx` — 결정적 PCM 생성기; new
  - `public/assets/audio/world-03-steel-impact.wav` :: `RIFF/WAVE` — 게임 재생 파일; new
  - `scripts/generate-world03-intro-sfx.mjs` :: `wave`, `nextNoise`, `--check` 처리 — 기존 생성기 패턴 참고만 하고 파일 수정 금지; read-only
  - `public/assets/audio/ATTRIBUTION.md` :: `world-03-steel-impact.wav` 항목 — 자체 제작 및 참고 녹음 출처 기록; modify

#### Details

- **Signatures & Types**:
  ```javascript
  export function renderWorld03SteelImpactSfx(): Buffer;
  export function writeOrCheckWorld03SteelImpactSfx(check: boolean): void;
  const SAMPLE_RATE = 44_100;
  const DURATION_SECONDS = 0.85;
  ```
- **Data & Schema Fields**:
  - WAV: RIFF/WAVE, PCM format 1, mono 1채널, 44,100Hz, 16비트 정수, 데이터 길이 `Math.round(44_100 * 0.85) * 2`바이트. 마지막 샘플 0, 피크 0.8 이하, 클리핑 없음.
  - 음향 레이어: 0~35ms의 강한 광대역 금속 타격 노이즈, 118→72Hz로 떨어지는 약 220ms 저역 충격, 서로 정수배가 아닌 313/521/997/1678Hz 금속 공명(각각 0.28/0.44/0.63/0.40초 지수 감쇠), 95ms·180ms의 약한 두 차례 잔진동. 고정 시드 `0x5e31b00f`의 xorshift32 노이즈를 사용한다.
  - 출력은 피크를 0.78로 정규화하고 첫 1ms와 마지막 20ms를 부드럽게 감쇠시킨다. 직전 `world-03-drill`/`world-03-excavator`의 파일이나 음색은 수정하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 새 파일 경로는 `scripts/` 기준 `../public/assets/audio/world-03-steel-impact.wav`로 고정하고, CLI 인자는 없음 또는 `--check`만 허용한다.
  2. Core Processing: 고정 시드로 동일 PCM 버퍼를 생성하고 `node scripts/generate-world03-steel-impact.mjs`에서는 WAV를 쓴다. `--check`에서는 디스크 바이트와 생성 바이트를 비교만 한다. 광대역 첫 타격은 짧게, 저역 무게감은 그 뒤에, 금속 공명은 꼬리로 남도록 레이어를 배치한다. 실제 샘플을 사용하지 않는다.
  3. Error & Exception Handling: `--check`에서 파일이 없거나 다르면 실패시키고, 다른 CLI 인자는 사용법 오류로 종료한다. 무음·NaN·클리핑·끝부분 클릭은 테스트에서 실패시킨다.
  4. State Transition & Return: 생성/검사 완료 후 버퍼 또는 void를 반환한다. WAV의 내용은 실행마다 동일하다.

### I02. 오디오 등록과 음색·파일 검증

- Related Files:
  - `src/game/audio/audioManifest.ts` :: `SOUND_KEYS`, `FeedbackSoundKey`, `FEEDBACK_AUDIO` — 새 효과음 키·캐시 키·파일 경로·음량 등록; modify
  - `src/game/audio/AudioManager.ts` :: `AudioManager.constructor` — 기존 `prepareFeedbackSound` 호출 목록에 새 키 추가; modify
  - `src/game/scenes/PreloadScene.ts` :: `PreloadScene.preload` — `FEEDBACK_AUDIO` 전체를 바이너리로 로드하는 현행 경로 확인만; read-only
  - `scripts/world03-steel-impact-audio.test.mjs` :: `철근 충돌 WAV 자산 검사` — 파일과 등록 정보 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  type FeedbackSoundKey = /* existing keys */ | "world-03-steel-impact";
  // FEEDBACK_AUDIO["world-03-steel-impact"] = {
  //   cacheKey: "feedback-world-03-steel-impact",
  //   url: "/assets/audio/world-03-steel-impact.wav",
  //   gain: 0.52,
  //   duckMusic: true
  // }
  ```
- **Data & Schema Fields**:
  - `SOUND_KEYS`에 `"world-03-steel-impact"`를 넣고 `FeedbackSoundKey` 합집합과 `FEEDBACK_AUDIO`에 위 필드를 모두 등록한다. `gain`은 0.52, `duckMusic`은 true(재생 중 BGM 0.38배)다.
  - `ATTRIBUTION.md`에 자체 합성·외부 샘플 미사용, 위 CC0 현장 녹음은 청감 참고만 했다는 사실과 생성/검사 명령을 명시한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `PreloadScene`이 `Object.values(FEEDBACK_AUDIO)`를 읽어 모든 파일을 캐시하므로 별도 `assetManifest.json` 항목을 추가하지 않는다.
  2. Core Processing: 새 키를 AudioManager 시작 시 미리 해독하게 등록한다. 실제 이벤트 연결은 T04에서 한다. 생성 파일을 단독 청취하고 저역 충격·금속 공명·짧은 잔진동이 들리는지 확인한다.
  3. Error & Exception Handling: WAV 메타데이터(PCM/mono/44.1kHz/16bit/0.85초), 피크와 비무음, 시작과 끝의 클릭 방지, 결정적 `--check`, 매니페스트 URL, 출처 기록 중 하나라도 틀리면 실패시킨다.
  4. State Transition & Return: 등록된 키로 `AudioManager.playSfx("world-03-steel-impact")` 호출 시 기존 Web Audio 효과음 경로에서 재생 가능해진다. T04 전에는 게임플레이 이벤트가 이 키를 호출하지 않는다.

## Acceptance Criteria

- [ ] 실제 금속 낙하처럼 짧은 무거운 `꽝!`과 금속 꼬리가 들리며 코믹한 전자음이 아니다. 헤드폰/스피커로 직접 청취한 결과를 검증 기록에 남긴다.
- [ ] WAV가 결정적으로 재생성되고 파일·형식·출처·매니페스트 검사를 통과한다.
- [ ] 기존 인트로 드릴·굴착기 효과음과 사망 효과음은 이 Task에서 변하지 않는다.

## Validation

- `node scripts/generate-world03-steel-impact.mjs --check` — 생성 원본과 WAV 바이트 일치.
- `node --test scripts/world03-steel-impact-audio.test.mjs scripts/world03-intro-audio.test.mjs` — 새 금속 효과음 및 기존 인트로 자산 통과.
- `node scripts/validate-assets.mjs` — 오디오 파일 경로 누락 없음.
- `npx.cmd tsc --noEmit` — 오디오 키 타입 오류 없음.
- `npm.cmd run lint` — 오류 없음.

## Commit Message

```text
feat(audio): 월드 3 철근 충돌음을 제작하고 등록

Plan: 2026-10-28-world03-beam-drum-sequence-impact
Phase: P01-beam-sequence-impact
Task: T03-steel-impact-audio

- 무거운 금속 타격과 잔진동 WAV를 결정적으로 생성
- 효과음 키와 음량 및 제작 출처를 등록
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (청감 확인 한계는 검증 기록 참조)
- commit: Task 커밋에 포함
