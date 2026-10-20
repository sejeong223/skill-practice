# Task: T03 잠자는 고양이의 캬아악·할퀴기·사망 연출

## Status: done

## Goal

월드 2 첫 스테이지의 통통한 고양이가 잠든 채 있다가 코기가 닿으면 실제 고양이 하악질을 한 번 내고 앞발로 할퀸 뒤 코기를 사망시킨다. 재시작하면 다시 잠든 모습이어야 한다.

## Decision Summary

- T01의 동일 고양이 두 포즈, T02의 `contact: "cat-scratch"`와 고정 Zone을 사용한다.
- `DeathSystem`을 우회하지 않는다. 소리·할퀴기 연출을 짧게 보여준 다음 기존 `death-requested` 이벤트를 정확히 한 번 보낸다.

## Implementation

### I01. 실제 고양이 하악질 PCM 음원

- Related Files:
  - `public/assets/audio/world-02-cat-hiss.wav` — 단발 `캬아악!`에 가까운 실제 녹음 발췌; new.
  - `public/assets/audio/ATTRIBUTION.md` — 원본 저작자·페이지·CC BY-SA 4.0·트림/변환 내역·파생 음원 라이선스; new.
  - `src/game/audio/audioManifest.ts` :: `SOUND_KEYS`, `FeedbackSoundKey`, `FEEDBACK_AUDIO` — `cat-hiss` 추가; modify.
  - `src/game/audio/AudioManager.ts` :: constructor, `playSfx`, gameplayBus subscriptions — 기존 Tone 공용 Web Audio 컨텍스트에서 새 WAV 재생; modify.
  - `src/game/scenes/PreloadScene.ts` :: `Object.values(FEEDBACK_AUDIO)` — 새 필수 바이너리가 자동 로드되는 기존 경로; read-only.

#### Details

- 후보 원본: [Wikimedia Commons `Gruñido gato (Chacha).ogg`](https://commons.wikimedia.org/wiki/File:Gru%C3%B1ido_gato_(Chacha).ogg), 저작자 Luisalvaz, CC BY-SA 4.0, 실제 고양이 하악질/으르렁 녹음. 직접 파일을 받아 청취하고 분명한 단발 하악질 0.5~1.0초를 선택한다. 목소리·긴 침묵·다른 소리가 섞인 부분을 쓰지 않는다. 적합한 구간이 없으면 비슷하게 접근 가능한 실제 고양이 녹음으로 교체하고 출처·라이선스·이유를 기록한다. 기존 `cat-taunt`의 합성 음형을 이름만 바꾸어 재사용하지 않는다.
- 실행 시 위 후보 원본 서버가 HTTP 429로 다운로드를 제한했다. [Zabuhailo의 실제 고양이 하악질 WAV](https://www.marefa.org/%D9%85%D9%84%D9%81:Cat_hissing_-_Zabuhailo.wav) 0.98~1.93초를 대체 소스로 사용했다. 원본은 CC0이고 가공·해시·링크를 `ATTRIBUTION.md`에 기록했다. 도구에서 직접 청음은 지원되지 않아 음색 자체는 소스 분류·파형과 Chrome 재생 요청으로 확인했다.
- 브라우저/도구로 디코딩 후 44100Hz mono PCM16 WAV로 저장하고 정규화·앞뒤 5~10ms 페이드를 적용해 재생 시작/끝 클릭과 클리핑을 피한다. `ATTRIBUTION.md`에 원본 페이지 URL, 저작자, CC BY-SA 4.0 URL, 선택 구간, mono/PCM 변환, 출력 파일의 라이선스와 SHA-256을 남긴다. [CC BY-SA 4.0 약관](https://creativecommons.org/licenses/by-sa/4.0/)에 맞춰 출처가 추적 가능하게 한다.
- 타입 계약:
  ```typescript
  export type FeedbackSoundKey = "coin" | "checkpoint" | "bark" | "cat-hiss";
  // FEEDBACK_AUDIO["cat-hiss"] = {
  //   cacheKey: "feedback-cat-hiss",
  //   url: "/assets/audio/world-02-cat-hiss.wav",
  //   gain: 0.55,
  // }
  ```
- `SOUND_KEYS`와 `AudioManager.playSfx`의 피드백 분기에도 `cat-hiss`를 추가한다. constructor에서 `prepareFeedbackSound("cat-hiss")`, gameplayBus의 `world02-cat-scratch` 이벤트에서 `playSfx("cat-hiss")` 한 번 호출한다. 기존 일시정지/종료 시 source 정지, BGM duck 및 복원, 오디오 잠금 해제 경로를 재사용한다. 별도 HTMLAudioElement/AudioContext를 만들지 않는다.

### I02. 고양이 충돌 상태와 발톱 연출

- Related Files:
  - `src/game/core/events.ts` :: `GameplayEventMap` — `"world02-cat-scratch": { obstacleId: string; now: number }` 추가; modify.
  - `src/game/systems/World02ObstacleSystem.ts` :: `handleCatContact`, `update`, `resetForAttempt`, `destroy` — T02의 고양이 Zone을 활성화하고 연출 상태 관리; modify.
  - `src/game/scenes/StageScene.ts` :: `update`, gameplayBus `restart` 구독, shutdown — 플레이 중 delta 기반 업데이트와 정리; modify.
  - `src/game/systems/DeathSystem.ts`, `RestartController.ts` — 기존 중복 사망 방지·체크포인트 처리 참고; read-only.

#### Details

- 최초 `cat-scratch` 오버랩에서만 `canHandleContact()`를 검사한다. `attackPending: boolean`을 true로, `attackRemainingMs = 360`으로 설정한다. `player.lockControl("world02-cat-scratch")`, `player.setVelocity(0, 0)`으로 잠깐 멈추고 고양이 이미지를 `world-02-obstacle-scratching-fat-cat`으로 전환한다. 발톱 세 줄을 코기와 고양이 사이에 픽셀풍 `Phaser.GameObjects.Graphics`로 180ms 이내 표시한다. `world02-cat-scratch` 이벤트를 한 번 발행해 소리를 시작한다.
- `StageScene.update`의 `runtime.getStatus() === "play"` 분기에서만 `obstacleSystem.update(elapsed)`를 호출한다. 이 업데이트에서 `attackRemainingMs`를 줄이고 0이 되면 플레이어 잠금을 푼 뒤 `death-requested`에 `{ stageId: "world-02-stage-1", cause: "trap", checkpointId: getCheckpointId(), now: scene.time.now }`를 한 번 보낸다. `scene.time.delayedCall`은 `StageScene`의 일시정지가 Phaser 시계를 멈추지 않으므로 사용하지 않는다.
- 연출 중 겹친 오버랩/다른 입력은 다시 소리·발톱·사망을 만들지 않는다. `restart` 수신 시 고양이를 잠든 texture/원위치로 복구하고 발톱 그래픽/타이머/플레이어 잠금을 정리한다. `destroy()`에서도 같은 정리를 하고 구독·콜라이더·트윈을 해제한다. 다른 장애물 사망으로 재시작한 때도 고양이가 기본 포즈인지 확인한다.
- 일시정지 동안 `StageScene.update`가 조기 반환하므로 공격 남은 시간은 보존된다. 정지 시 기존 AudioManager가 재생 중인 소리를 멈추는 정책은 따른다. 재개할 때 공격을 재생성하거나 소리를 중복 재생하지 않는다. 월드 전환/클리어/scene shutdown 뒤 지연된 사망을 발행하지 않는다.

### I03. 고양이 회귀 검증

- Related Files:
  - `scripts/world02-cat-attack.test.mjs` — 첫 접촉/중복/정지/재시작/종료 상태 전이; new.
  - `scripts/audio-pause.test.mjs` — `world02-cat-scratch` 1회에 실제 샘플 source 1개, pause/destroy 후 추가 재생 없음; modify.
  - `.memory/test-plans/2026-10-20-world02-playground-jump-obstacles.md` — 청음·라이선스·브라우저 실제 출력 근거; modify.

#### Details

- 마찰 없이 점프해 고양이 Zone 위를 지나면 이벤트 0건, 걸어서 닿으면 소리/공격 이벤트 1건과 360ms 뒤 사망 1건, 같은 프레임 중복 오버랩 0건을 검증한다. 정지 1초 동안 남은 360ms가 줄지 않는지, 재시작/종료 후 고양이가 잠든 포즈이고 남은 예약 사망이 없는지 확인한다.
- WAV의 RIFF/PCM16/mono/44100Hz, 0.5~1.0초, peak<1, 무음 아님, 출처 문서 존재를 확인한다. 이 기계적 검사는 사람이 듣는 `캬아악`의 음색 판단을 대신하지 않으므로 실제 Chrome 오디오 출력으로도 확인한다.

## Acceptance Criteria

- [x] 닿기 전 고양이는 잠들어 있고 비접촉 상태에서는 반응하지 않는다. 실제 점프 회피는 T04에서 확인한다.
- [x] 접촉 후 고양이가 앞발을 뻗고 발톱 자국·실제 녹음 버퍼를 한 번 재생한 뒤 코기가 한 번 사망한다. 실제 청음은 도구에서 지원되지 않는다.
- [x] 재시작·일시정지·종료에 대한 상태와 오디오 수명 검증을 통과했다. 월드 전환 실제 입력은 T04에서 확인한다.

## Validation

- `node --test scripts/world02-cat-attack.test.mjs scripts/audio-pause.test.mjs scripts/world02-obstacles.test.mjs` — 상태·오디오 회귀 통과.
- `node scripts/validate-assets.mjs` — 필수 고양이 이미지 manifest와 파일 존재. WAV는 위의 고양이 테스트와 실제 브라우저 프리로드로 확인한다.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint` — 이벤트·시스템 lint 통과.
- `npm.cmd run build` — 빌드 통과.
- 실제 Chrome에서 충돌 직후 포즈·음원·사망 순서를 확인한다.

## Commit Message

```text
feat(world02): 잠자는 고양이 하악질과 할퀴기 연출 추가

Plan: 2026-10-20-world02-playground-jump-obstacles
Phase: P01-stage1-obstacles
Task: T03-sleeping-cat-attack

- 실제 고양이 소리와 출처·라이선스를 기록해 게임 효과음에 연결
- 접촉 시 할퀴기 포즈 뒤 기존 체크포인트 사망 경로 실행
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 테스트 17건, 에셋 검사, 린트, 빌드, 타입 검사, Chrome 실제 접촉
- commit: 이 Task의 한국어 커밋
