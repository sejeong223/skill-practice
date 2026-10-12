# Task: T03 새 효과음 제작과 실제 출력 검증

## Status: done

## Goal

간식을 실제로 먹으면 새 동전 소리, 체크포인트를 최초 통과하면 새 띠리링 소리가 BGM과 함께 출력된다.

## Decision Summary

- 신규 PCM WAV 2개를 직접 합성하고 저장한다. 기존 checkpoint 사인파 기본 패턴과 coin 사각파 패턴을 재사용하지 않는다.
- Phaser 별도 audio context 상태에 의존하지 않고 BGM과 같은 Tone rawContext에 AudioBufferSourceNode로 연결한다.

## Implementation

### I01. 새 음원과 재생 경로

- Related Files: `scripts/generate-feedback-audio.mjs` new, `public/assets/audio/coin-pickup.wav`/`checkpoint-chime.wav` new, `src/game/audio/audioManifest.ts`/`AudioManager.ts`/`src/game/scenes/PreloadScene.ts` modify.
- **Signatures & Types**: `FEEDBACK_AUDIO: Readonly<Record<"coin" | "checkpoint", {cacheKey: string; url: string; gain: number}>>`; preload binary WAV bytes, AudioManager 공용 context.decodeAudioData 결과 캐시 Promise/AudioBuffer. `playFeedbackSound(key: "coin" | "checkpoint"): void`는 매번 새 buffer source와 gain 생성.
- **Data & Schema Fields**: WAV mono/44100Hz/16bit PCM. coin은 짧은 반짝이는 동전2음(약0.35초), checkpoint는 구별되는 상승4음과 잔향(약0.9초), hard clipping 금지. source는 기존 trackSource로 종료/정지/폐기 cleanup.
- **Execution Flow / Logic**: 미리 bytes load, 관리자 생성 시 decode 시작, 재생 요청은 decode 후에도 destroyed/paused 및 scene 소유권 검사. context suspended이면 unlock 후 요청한 효과음을 한 번 재생, 재개 실패/폐기면 지연 효과음 버림. 일반 재생에서는 즉시 버퍼를 사용한다. 체크포인트 gameplay event 기존연결 유지, 작은 기존 전용 메서드 제거. SFX 재생 시 BGM을 일시적으로 약하게 줄였다가 복구하여 짧은 소리를 구별할 수 있게 하고, pause gain0과 충돌하지 않게 복구 예약을 취소한다.
- **Error & Exception Handling**: 필수 음원 로드 실패는 preload 오류에 파일명 표시. 실패를 기본음으로 숨기지 않는다. 실제 청음/실기기는 미실시일 때 명시한다.
- **State Transition & Return**: 최초 unlock·씬 재입장·정지 후에도 중복 재생 없이 출력. 공유 context는 suspend/close하지 않는다.

### I02. 누락된 획득 이벤트

- Related Files: `src/game/stages/stageEvents.ts`, `StageRuntime.ts`, `src/game/audio/AudioManager.ts` modify.
- **Signatures & Types**: GameEventMap의 `coin-collected: {stageId: StageId; coinId: string}` 추가. collectCoin 성공 후에만 emit, AudioManager 구독해 새 coin 재생. `coin-changed`는 저장/UI용이므로 소리를 연결하지 않는다.
- **Execution Flow / Logic**: 실제 overlap→collectCoin 성공→지갑 저장→coin-collected→새 sound source. 같은 inactive 코인은 이벤트0, resetCoins/restore는0. 가짜 간식은 적립되지 않으므로 coin-collected0 유지.

### I03. 통합 검증과 완료

- Related Files: `scripts/audio-pause.test.mjs` 및 새 WAV/이벤트 회귀 테스트; `.memory/test-plans/2026-10-12-world01-camera-exit-sfx.md`, 증거 파일 new; current/plan/phase/tasks modify.
- 원래 BGM/방어음/일시정지/코인 정책 회귀 포함. 실제 키보드 이동으로 coin과 checkpoint를 통과하여 source 시작/출력 파형/저장 횟수 확인. 생성 WAV의 길이·peak·hash 기록, 원음 재생 파일과 녹음 링크 제공. 맵1/3 및2/4 유사성 원인을 파일/지형 근거로 기록.
- 옛 compact T03은 이번 출구 완료를 연결하고 남은 요구를 확인한 뒤 상태를 정리한다. 다른 옛 Task와 상점 정책은 보존한다.

## Acceptance Criteria

- [x] 새 음원2개가 실제 파일로 존재하며 실제 획득/깃발 통과에서 들릴 출력이 발생한다.
- [x] 일시정지/잠금 해제/씬 종료에서 뒤늦거나 중복된 효과음이 없다.
- [x] 타입·lint·빌드·테스트·브라우저 결과를 기록하고 한국어 커밋/포인터를 완료한다.

## Validation

- `node scripts/generate-feedback-audio.mjs --check`
- `$files = @(rg --files scripts -g '*.test.mjs'); node --experimental-strip-types --test $files`
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`
- 브라우저 coin/깃발/방어 출력 및 정지5초/씬 교체 확인, `git diff --check`.

## Commit Message

```text
feat(audio): 간식 획득음과 체크포인트 차임을 새로 제작해 연결한다

Plan: 2026-10-12-world01-camera-exit-sfx
Phase: P01-player-feedback
Task: T03-new-feedback-audio
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

신규 WAV2개 제작/해시·PCM 검사 통과. 실제 간식 획득 peak0.23337/차임0.27295, BGM감쇠0.38 후 복원1, 재접촉·저장복원 소리0. 자동38건·타입·lint·빌드·맵검사 통과. 최종 카메라·끝 전환·깃발 부활·방어·일시정지 브라우저 검증 오류0. 실기기/실제 청음 미실시는 검증 기록에 명시.
