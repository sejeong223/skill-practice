# Task: T03 짖는 코기 이미지·효과음과 장애물 구간 사용

## Status: done

## Goal
해금된 짖기를 보스전과 일반 장애물 구간에서 사용하면 기존 플레이 코기가 입을 크게 벌리고 짧은 ‘멍!’ 소리를 한 번 낸다. 사용 후 기존 이동 동작으로 돌아오고, 실제 10초 쿨타임·일시정지·재도전 동작과 일치한다.

## Decision Summary
- 기존 코기의 외형을 유지한 단일 투명 PNG를 제작한다. 실제 게임 프레임은 112×128이며 발 기준은 99px다. 인트로용 앉은 정면 포즈가 아니라 오른쪽을 보는 플레이 코기를 기준으로 한다.
- 짖는 표시 450ms는 시각 상태만 바꾼다. 이동·점프·충돌·보스 경직·공통 쿨타임을 변경하지 않는다. 일반 구간 사용은 이미지·소리와 쿨타임으로 확인할 수 있다.
- 사용자 선택으로 확정한 사레는 시각 효과만이다. 3회 경고·흔들림은 기존 보스전 범위, 일반 장애물 구간에는 공통 이미지·소리·쿨타임 표시를 적용한다.
- 아직 해금되지 않는 후속 네 스킬이나 일반 적에 대한 새 경직/파괴 규칙을 추가하지 않는다. 월드 1 클리어 후 해금·월드 1 재도전 및 월드 2 사용을 검증한다.

## Prerequisite contract
- T01: `SKILL_DEFINITIONS`의 bark 쿨타임 10000ms. `SkillSystem.use(skillId, now)`는 `{skillId, accepted, reason, remainingCooldownMs}` 반환. 성공 시에만 GameplayEventBus의 `skill-used: { skillId: SkillId; now: number }`를 발행한다.
- StageScene은 플레이 중에만 `skillElapsedMs`를 누적해 use/getRemainingCooldown에 쓴다. 보스 경직에는 기존 Phaser `time`을 쓴다. 일반 구간에도 쿨타임 snapshot을 발행한다.
- T02: `BossCombatOverlay` 이름의 컴포넌트가 normal/boss 모두에서 해금한 짖기 쿨타임을 왼쪽 아래 표시한다. 경고는 보스전에서 발생한다. UI 별도 타이머는 없다.
- 현재 Animator는 run만 처리하고 PlayerController가 매 프레임 애니메이션 상태를 run/idle/jump/fall로 바꾼다. `setAnimationState("bark")`만 추가해서는 지속 표시가 되지 않는다.

## Implementation

### I01. 기존 플레이 코기 기반 짖기 에셋

- Related Files:
  - `public/assets/pixel/characters/corgi/corgi-run.png` — reference, read-only
  - `public/assets/pixel/characters/corgi/corgi-bark.png` — new
  - `src/game/assets/assetManifest.json` :: `corgi-bark` — modify
  - `src/game/scenes/PreloadScene.ts` :: `loadAsset`, required asset error — read-only existing load path
  - `.memory/test-plans/2026-10-19-boss-bark-cooldown-and-warnings.md` — asset provenance and visual evidence; new/append

#### Details
- **Asset schema**: manifest의 기존 optional bark 항목을 `{ key: "corgi-bark", kind: "image", url: "/assets/pixel/characters/corgi/corgi-bark.png", required: true }`로 바꾼다. 오래된 frameWidth32/frameHeight48/frameCount4 필드는 제거한다. 별도 spritesheet 애니메이션은 등록하지 않는다.
- **Generation**: 실행 시 imagegen 스킬을 읽고 사용을 안내한다. `view_image`로 run 원본을 확인한 뒤 내장 image_gen에 실제 원본 경로를 참고 이미지로 전달하고 `transparent_background: true`로 생성한다. 계획 단계에서는 생성하지 않는다.
- **Prompt contract**: 동일한 황갈색·흰색 털, 뾰족한 귀, 검은 코와 눈, 짧은 다리, 긴 몸통, 기존과 동일한 픽셀 윤곽과 음영. 오른쪽을 향한 네 발 자세, 몸통은 기준 프레임과 비슷한 위치. 주둥이를 약간 들어 입을 명확히 크게 벌리고 어두운 입 안과 작은 혀를 보이게 하여 ‘짖는 순간’으로 보인다. 웃으며 헐떡이는 표정으로 만들지 않는다. 배경·글자·말풍선·바닥 그림자·두 번째 코기 없음. 한 포즈만 제작한다.
- **Export constraints**: 최종 PNG는 RGBA 112×128, 발의 가장 아래 불투명 행은 기준 y=99에 맞춘다. 기존 run frame0와 나란히 비교하여 몸통 길이·머리 크기·중심 위치가 갑자기 바뀌지 않도록 한다. 생성 원본을 보존하고 필요 시 설치된 sharp의 nearest-neighbor 크기 조정과 투명 캔버스 패딩으로 게임 규격을 맞춘다. 입을 코드로 덧그리는 대체 제작은 하지 않는다. 생성 도구가 실패하면 실패 사실을 보고하고 승인 없이 API/CLI 경로로 바꾸지 않는다.
- **Validation/Errors**: 새 이미지가 작게 표시된 실제 게임 크기에서도 열린 입이 구별되어야 한다. 배경이 구워진 이미지, 흐릿한 확대, 바뀐 털색·다리 길이·누락된 발은 재생성/수정한다. 파일 누락은 기존 필수 에셋 실패 경로로 표시한다. 원래 run 및 인트로 표정 파일은 보존한다.

### I02. 짖기 표시와 사용 성공 연결

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `triggerBark`, `stopBark`, `update`, `destroy` — modify
  - `src/game/scenes/StageScene.ts` :: `update`, death/restart, victory/shutdown — modify
  - `src/game/scenes/PrototypeScene.ts` :: `update`, death/restart/shutdown — modify for shared animator compatibility
  - `src/game/entities/Player.ts` :: `alignFeetToFrame`, body size — read-only
  - `src/game/systems/SkillSystem.ts`, `PlayerController.ts` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // PlayerAnimator.ts
  export const BARK_PRESENTATION_MS = 450;
  const BARK_TEXTURE_KEY = "corgi-bark";
  const BARK_FOOT_ANCHOR = 99;
  private barkRemainingMs = 0;
  public triggerBark(): void;
  public stopBark(): void;
  public update(now?: number, deltaMs?: number): void;
  ```
- **Clock**: 기존 update의 now 기본값은 `this.player.scene.time.now`를 유지하고 slipper는 계속 now를 사용한다. deltaMs 기본값은 0으로 두며 StageScene·PrototypeScene의 플레이 update에서 `update(time, delta)`로 명시한다. 짖기 남은 시간은 별도 delta로 감소시켜 일시정지 중 절대 now가 변해도 건너뛰지 않게 한다. 승리 대사 직전 `update(this.time.now)` 호출은 타이머를 진행하지 않는다.
- **Start**: `triggerBark()`는 texture 존재를 검사하고 450ms를 설정한 뒤 기존 run 애니메이션을 멈추고 timeScale=1, activeAnimationKey=null로 만든다. bark texture, foot anchor99를 적용한다. Texture가 없으면 크래시 대신 기존 run 상태를 유지하고 표시 타이머는 시작하지 않는다(필수 preload 검증이 정상 경로에서 누락을 잡는다).
- **Priority**: `update()`에서 slipper 업데이트는 유지한다. barkRemainingMs>0이면 유한하고 양수인 delta만 빼고 남은 동안 bark texture·발 기준을 유지한 뒤 return한다. PlayerController가 상태를 바꾸더라도 barkRemainingMs를 별도 판단하므로 한 프레임 만에 사라지지 않는다. 이동·점프·중력·velocity·controlLocks·flipX를 수정하지 않는다.
- **Return**: 만료 또는 `stopBark()` 시 타이머0, bark texture를 쓰고 있으면 run frame0으로 복원하고 foot anchor99·timeScale1·activeAnimationKey=null로 정리한다. 그 뒤 update는 현재 Player animationState에 따라 run 재생 또는 idle/jump/fall 기본 프레임으로 진행한다. 기존 `activeAnimationKey !== null` 조건에만 복원을 맡기지 않는다(단일 bark image는 animationKey가 null일 수 있다).
- **Stage input**: T01의 `skillSystem.use("bark", skillElapsedMs)` 결과 accepted일 때 `playerAnimator.triggerBark()`를 정확히 한 번 호출한다. `calicoBoss?.tryBarkStun(time)`와 보스전 카운트 로직은 유지한다. 이미지 시작에는 보스 존재 조건을 붙이지 않는다. 실패한 입력은 그림·타이머·효과음을 재시작하지 않는다.
- **Prototype input**: 기존 `use("bark", time)` 결과 accepted일 때 같은 trigger 호출, `playerAnimator.update(time, delta)`로 갱신한다. 별도 쿨타임 HUD나 새 전투 규칙은 만들지 않는다.
- **Lifecycle**: StageScene pause에서는 animator.update를 호출하지 않고 bark 시간은 보존한다. paused 이외의 non-play 진입은 stopBark를 호출한다. death/restart, handleCalicoDefeat의 victory pose 갱신 전, 월드 전환/shutdown에 stopBark 또는 destroy로 정리한다. StageScene 기존 shutdown의 destroy는 유지한다. Prototype의 기존 death/restart 리스너에서도 stopBark, shutdown에서 playerAnimator.destroy를 호출해 같은 수명을 보장한다. destroy는 stopBark 및 기존 animationupdate 구독·slipper 정리를 함께 수행한다.
- **Physics contract**: 새 PNG 크기를 run 프레임과 맞춰 Player의 고정 bodyWidth(월드 1=48, 기본72)/height40 및 bodyOffsetX가 달라지지 않게 한다. foot anchor를 전환해 발을 맞추며 body 크기나 좌표를 임의 재설정하지 않는다.

### I03. 알아들을 수 있는 짖기 WAV 제작

- Related Files:
  - `scripts/generate-bark-audio.mjs` :: `renderBarkAudio`, CLI — new
  - `public/assets/audio/corgi-bark.wav` — new
  - `src/game/audio/audioManifest.ts` :: `FeedbackSoundKey`, `FEEDBACK_AUDIO` — modify
  - `src/game/audio/AudioManager.ts` :: constructor, `playSfx`, `SOUND_PATTERNS` — modify
  - `src/game/scenes/PreloadScene.ts` :: `Object.values(FEEDBACK_AUDIO)` preload/error — read-only
  - `scripts/generate-feedback-audio.mjs` — read-only PCM writer reference

#### Details
- **Signatures & Types**:
  ```typescript
  // audioManifest.ts
  export type FeedbackSoundKey = "coin" | "checkpoint" | "bark";
  // FEEDBACK_AUDIO.bark
  { cacheKey: "feedback-bark", url: "/assets/audio/corgi-bark.wav", gain: 0.55 }
  // generate-bark-audio.mjs (JavaScript export)
  // renderBarkAudio(): { file: string; wav: Buffer; duration: number }
  ```
- **WAV contract**: 44100Hz/mono/PCM16, duration0.40s(17640 samples), RIFF/WAVE header44 bytes. 외부 샘플 없이 직접 합성한다. 출력 peak는0.65 이하, DC offset 제거, 끝20ms fade로 클릭과 클리핑을 방지한다.
- **Synthesis starting design**: 시간t초, 0~0.30초의 성대 펄스 한 번. 기본 주파수는300Hz에서105Hz로 약55ms 시정수의 지수 곡선으로 내려간다. 위상을 샘플마다 적분하고1~18차 배음을 더한다. 900Hz/대역폭350Hz와1800Hz/대역폭550Hz 공명을 강조하여 낮은 으르렁거림만 남지 않게 한다. 진폭은3ms attack과 약65ms decay, 여기에8ms에 걸쳐 시작하는 작은 숨소리를 섞는다. 숨소리는 고정seed 잡음을300~4500Hz로 제한하고 약45ms에 걸쳐 감쇠한다. 시작의 파열감·짧은 성대음·숨소리 꼬리로 ‘멍!’을 만든다. 긴 으르렁거림·사이렌·두 음 비프는 합격으로 처리하지 않는다. 이는 초기 설계값이며 실제 소리 확인 후0.4초 안에서 음색을 조정하고 최종값을 기록한다.
- **Determinism/CLI**: 고정seed로 재현하며 import 때 쓰지 않는다. 직접 실행은 새 WAV만 생성하고 `--check`는 재생성 바이트와 저장된 WAV를 비교해 불일치 시 비0 종료한다. 기존coin/checkpoint generator와 음원은 유지한다.
- **Playback flow**: AudioManager constructor에서bark도 prepareFeedbackSound한다. gameplayBus의 `skill-used` 구독을 기존unsubscribers에 추가하고 payload.skillId가bark이면 `playSfx("bark")`를 한 번 호출한다. StageScene에서 소리를 추가 호출하지 않는다. playSfx의coin/checkpoint 전용 분기를bark에도 확장해 기존playFeedbackSound를 사용한다. SOUND_PATTERNS의bark 두 음은 제거한다.
- **Shared references**: 기존cutscene soundCue와bite-hit의bark 호출도 새 음원을 쓴다. bite-hit 구독은 유지하고 skill-used 중bark 이외에는 반응하지 않는다. 일반bark 입력은bite-hit를 발생시키지 않아 중복 재생되지 않는지 확인한다.
- **Lifecycle/Error handling**: Tone 공용context, 기존binary preload, decode 캐시, effectsGeneration, 1000ms 만료, pause/destroy의source 정지, BGM gain 복귀를 재사용한다. 로드 실패는PreloadScene의 필수 효과음 오류, decode 실패는 기존 로그와null 처리로 연결한다. 독립AudioContext·HTMLAudioElement·실행 중 음원 다운로드는 추가하지 않는다.
- **BGM**: 효과음 중 기존duck만 사용한다. 복원한world-02-amusement의 악보·악기·BPM은 유지한다. 실제 출력에서 효과음이 약하면bark gain만 조정하고 최종값을 기록한다.

### I04. 회귀 방지와 실제 게임 통합 검증

- Related Files:
  - `scripts/bark-presentation.test.mjs` — new Animator regression
  - `scripts/audio-pause.test.mjs` — modify audio harness/regressions
  - `scripts/bark-audio-assets.test.mjs` — new WAV/PNG metadata validation
  - `.memory/test-plans/2026-10-19-boss-bark-cooldown-and-warnings.md` — append final report

#### Details
- Animator test는 기존TypeScript CommonJS require hook을 이용해Player의texture/anims/alignFeetToFrame을 기록하는stub으로 실제 클래스를 실행한다. trigger 후Player 상태가run으로 바뀌어도449ms까지bark, 450ms에run 복귀, idle 복귀, flipX 유지, update를 멈춘pause 기간 보존, stop/destroy 후 복원을 확인한다. velocity/body 크기 변경 메서드를 호출하지 않는지도 검사한다.
- Audio test는 실제SkillSystem과GameplayEventBus로 성공bark→1source, 재사용 거절→추가0, 다른skill→추가0을 검증한다. 새 사전decode로 기존harness의 배열 인덱스가 어긋나면cache key로 구분하여 해결하도록 수정한다. decode 미완료 중pause/destroy→늦은 재생 없음, resume 후 새 사용, 이전manager 폐기→새BGM 유지도 확인한다.
- Asset test는WAV header/형식/길이/무음 여부/peak/DC/재생성 일치, PNG112×128/alpha/manifest image-required 일치를 검사한다. 합성 파라미터를 그대로 복제한 구현 동치 테스트는 만들지 않는다. 외형과 ‘개 짖는 소리로 들리는지’는 메타데이터 검사만으로 합격시키지 않는다.
- 별도 브라우저 프로필로 기존 사용자 저장을 보존한다. T02와 같은 진행 데이터(schemaVersion2, key `legendary-rib-corgi:progress:v1`, world1 cleared/unlocked bark)에서 월드 선택으로world1 일반/world2 일반/world1 보스에 진입한다. 실제 설정 키로bark를 사용해 열린 입·소리 한 번·10초 표시·재사용 거절·복귀를 확인한다.
- 좌우·정지·이동·점프 중 발 위치의 튐·배율·충돌 너비 변화가 없는지 비교한다. 0.45초 도중pause/resume, 사망/재시도, 월드 이동, 이동 후 한 번만 나는 소리를 확인한다. 보스3회 경고와 기존1.2초stun, 일반 맵3회 사용에는 보스 경고가 없는 것도 확인한다.
- 월드2 입장cutscene 중bark 불가와 기존 음악·대사를 유지한다. 첫world1 미해금 저장에서는bark 이미지/소리/쿨타임을 표시하지 않는다. 후속 스킬을 강제 해금해 검증 범위를 늘리지 않는다.
- 1280×720/390px에서 이미지와HUD를 기록한다. 브라우저 오디오 출력capture 또는 실제 청음으로bark 출력과BGM에 묻히는지 확인한다. 녹음RMS만으로 개 짖는 소리라고 판정하지 않는다. 듣지 못하는 환경이면 음원 품질 미확인을 보고서에 명시하고 들었다고 기록하지 않는다.

## Acceptance Criteria
- [x] 실제 플레이 코기와 색·비율을 맞춘 새 투명PNG 한 장으로 입을 벌려 짖는 모습이 보인다.
- [x] normal/boss 모두 해금된bark 성공 시450ms 이미지와 소리 한 번이 나오고 원래 동작으로 돌아온다.
- [x] 실패 입력·연타·쿨타임 중 이미지나 소리를 다시 시작하지 않고 이동/점프/충돌/flipX를 유지한다.
- [x] 일반 구간10초HUD, 보스3번째 경고와 기존stun, 옅은 빨간 배경이 설계대로 동작한다.
- [x] pause/death/retry/transition에서 시간·이미지·음원 잔류나 중복 구독이 없다.
- [x] WAV 실제 출력·PNG 실제 표시, 기존BGM/intro, 타입·빌드·관련 테스트를 검증하고 결과를 기록했다.

## Validation
- `node scripts/generate-bark-audio.mjs --check`
- `node scripts/validate-assets.mjs`
- `node --test scripts/bark-presentation.test.mjs scripts/bark-audio-assets.test.mjs scripts/audio-pause.test.mjs scripts/feedback-audio-assets.test.mjs scripts/boss-feedback.test.mjs scripts/bark-boss-stun.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js src/game/entities/PlayerAnimator.ts src/game/scenes/StageScene.ts src/game/scenes/PrototypeScene.ts src/game/audio/AudioManager.ts src/game/audio/audioManifest.ts scripts/generate-bark-audio.mjs scripts/bark-presentation.test.mjs scripts/bark-audio-assets.test.mjs scripts/audio-pause.test.mjs`
- `npm.cmd run build`
- `npm.cmd run dev -- --port 3000` — 기존 서버가 있으면 재사용하고 위 브라우저 시나리오를 수행한다.

## Commit Message
```text
feat(game): 짖는 코기 이미지와 효과음 및 일반 구간 사용 완성

Plan: 2026-10-19-boss-bark-cooldown-and-warnings
Phase: P01-boss-feedback
Task: T03-bark-presentation-and-audio

- 기존 플레이 코기 기반 짖기 이미지와 짧은 멍 효과음 추가
- 성공한 짖기에만 이미지·소리 연결하고 장애물 구간 사용 검증
- 이동·발 위치·일시정지·재도전과 기존 음악 유지
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in git history
