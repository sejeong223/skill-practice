# Task: T04 일시정지 화면과 BGM 정지·재개 동기화

## Status: done

## Goal

플레이 중 일시정지를 누르면 BGM과 게임이 함께 멈추고, 화면 중앙의 ‘일시정지’와 반투명 검은 배경으로 상태가 분명하게 보인다. 재개하면 음악이 정지한 지점부터 이어진다.

## Decision Summary

- T02/T03 뒤 AudioManager는 일반/보스 Scene에 하나씩 있고 체크포인트/방어음이 Tone 공용 컨텍스트를 쓴다.
- `AudioContext.suspend()`나 Scene 전체 pause 대신 해당 음악의 transport와 출력만 제어한다. Scene update는 Escape 재개 입력을 계속 읽어야 한다.
- React의 기존 pause-state-changed만 UI 상태의 근거로 사용하고, HUD와 별도의 상위 오버레이로 모바일에서도 보이게 한다.

## Implementation

### I01. 재생 위치를 보존하는 AudioManager 정지

- Related Files:
  - `src/game/audio/AudioManager.ts` :: `setPaused`, `unlock`, `playMusic`, `startToneMusic`, `playSfx`, `stopMusic`, `destroy`, `stopToneMusic`; modify
  - `src/game/audio/musicArrangements.ts` :: T02 음색/음량; read-only

#### Details

- **Signatures & Types**: 신규 `public setPaused(paused: boolean): void`. 기존 `playMusic(key: string): void`, `stopMusic(): void`, `unlock(): void` 계약을 유지한다.
- **Data & Schema Fields**:
  - `private paused = false` — 관리자별 상태, 영구 저장 안 함.
  - `private musicGain?: Tone.Gain` — 현재 관리자가 만든 음악 합성기 3개만 통과하는 gain, 기본1.
  - `private musicSound?: Phaser.Sound.BaseSound` — cache audio 경로에서 해당 관리자가 소유한 음악 인스턴스, 기본undefined.
  - 기존 `musicKey: string | null`, `toneMusicOwner: symbol`, 전역 `activeToneMusicOwner`와 activeToneMusicNodes를 유지한다. musicGain도 dispose 목록에 포함한다.
- **Execution Flow / Logic**:
  1. 새 곡의 melody/harmony/bass를 각자 destination에 직결하지 않고 musicGain에 연결한다. 효과음은 기존 경로로 유지한다. 음악 gain은 destination으로 간다.
  2. `setPaused(true)`는 상태가 바뀌는 경우에만 처리한다. 자신의 music owner가 맞으면 Tone transport를 pause하여 position/ticks를 보존하고 gain을 0으로 짧게(약 10ms) 내려 이미 예약된 음/잔향도 들리지 않게 한다. cached music은 해당 BaseSound만 pause한다. `stopMusic`, transport.cancel/position=0은 호출하지 않는다.
  3. 정지 시작 시 이미 예약한 단발 SFX source는 stopSources로 정리한다. 정지 중 `playSfx`는 새 요청을 버린다. 재개할 때 지연된 clang/차임을 몰아서 재생하지 않는다.
  4. `setPaused(false)`는 같은 음악/소유권이 있으면 gain을 1로 짧게 올리고 transport.start로 이어간다. position을 쓰거나 Sequence를 다시 만들지 않는다. cached music은 해당 paused 인스턴스의 resume를 사용한다.
  5. 정지 중 다른 곡이 요청되면 이전 곡은 정상 stop/dispose하되 새 musicKey만 보관한다. 재개 시 새 곡을 처음부터 시작한다. 정지 전 음악이 아직 unlock되지 않았던 경우도 재개/다음 제스처에서 한 번만 시작한다. paused transport의 같은 키 요청은 조기 return해도 정지 상태를 유지한다.
  6. `unlock()`의 Tone.start Promise 완료 후와 `startToneMusic` 진입 모두 `destroyed || paused`를 검사한다. 정지 오버레이 클릭/키 입력으로 컨텍스트가 unlock되어도 음악만 재생되지 않게 한다. 공용 컨텍스트 자체는 suspend/close하지 않는다.
  7. 음악 제어는 owner 심볼이 현재 것일 때만 적용한다. 이전 Scene의 늦은 pause/destroy/unlock이 다음 Scene의 음악에 영향을 주면 안 된다. cached 경로도 key 전역 stop 대신 자신이 만든 BaseSound를 대상으로 정리한다. `stopAllSounds`가 다른 관리자의 cached BGM까지 끄지 않도록 음악 소유 범위에서 정리한다.
  8. stopMusic/destroy는 자신이 소유한 gain/sequence/cache instance를 정리하고 참조를 비운다. paused 플래그는 곡 교체 때문에 임의 false로 바꾸지 않는다. destroy 후 새 관리자의 기본값은 false다.
- **Error & Exception Handling**: destroy/중복 정지/중복 재개는 no-op이다. NoAudio 환경에서는 상태만 맞추고 throw하지 않는다. 잠긴 브라우저의 start 실패는 기존 catch 방식을 유지하며 다음 입력에서 재시도한다.
- **State Transition & Return**: playing→paused는 같은 key와 transport position을 보존한다. paused→playing은 이어 재생, paused 상태의 곡 교체는 요청만 보류한다. stopped/destroyed는 재시작하지 않는다.

### I02. 게임의 실제 정지 상태에 오디오 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `setPaused`, `update`, `create`, shutdown; modify
  - `src/game/stages/StageRuntime.ts` :: `pause`, `resume`, `getStatus`; read-only
  - `src/game/bridge/GameEventBus.ts` :: pause-requested/pause-state-changed; read-only

#### Details

- **Signatures & Types**: 기존 `private setPaused(paused: boolean): void` 유지. 브리지 payload는 기존 `{ paused: boolean }` 그대로다.
- **Flow**: status=play에서 true를 받으면 runtime.pause→physics.world.pause→audioManager.setPaused(true)를 실행한다. status=paused에서 false를 받으면 반대로 resume 후 setPaused(false)를 실행한다. 실제 전이가 없는 cutscene/dying/completed 입력은 음악 상태를 바꾸지 않는다.
- 이후 실제 runtime 상태 기준으로 pause-state-changed를 emit한다. create/shutdown에는 false 상태를 알려 새 장면에 오버레이가 남지 않게 한다. shutdown에서 false 이벤트를 낼 때 죽은 AudioManager를 재생시키지 않는다.
- 기존 update의 pausePressed 검사 위치를 play 상태 검사 앞으로 유지한다. `this.scene.pause()`는 사용하지 않는다. 물리/이동/전투의 기존 pause guard도 유지한다.
- 현재 작업 트리의 `createBossGround`와 bowl-clang 개선, T02의 새 음악 키, T03의 silent checkpoint 복원을 모두 보존한다.

### I03. 중앙 일시정지 오버레이

- Related Files:
  - `src/components/game/PauseOverlay.tsx` :: `PauseOverlay`; new
  - `src/components/game/GameShell.tsx` :: paused state, stage-started, 게임 프레임 JSX; modify
  - `src/app/globals.css` :: `.pause-overlay`, `.pause-overlay-content`, `.pause-overlay-title`, `.pause-resume-button`; modify
  - `src/components/game/GameOverlay.tsx` :: 정지 중 배경 HUD에 inert 적용; modify
  - `src/components/game/Hud.tsx` :: 기존 정지 버튼; read-only

#### Details

- **Signatures & Types**: `interface PauseOverlayProps { readonly onResume: () => void; }`; `export function PauseOverlay({ onResume }: PauseOverlayProps)`는 React JSX를 반환한다. 표시 여부는 GameShell이 조건부 렌더링한다. 오버레이 자체가 별도 paused 상태를 가지지 않는다.
- **Data & Schema Fields**: GameShell의 기존 `paused: boolean` 기본값false, `pause-state-changed` 구독은 유지한다. stage-started에서 setPaused(false)도 수행한다. URL/저장 모델 변경은 없다.
- **Flow/표현**:
  1. `.game-content-frame`의 직접 자식으로 추가한다. `paused && introGateStep === "ready"`일 때 표시하되 시작 화면/컷신/사망/클리어에서 실제 paused가 남지 않도록 위 상태 초기화를 적용한다.
  2. 루트는 absolute/inset0/z-index15/display:grid/place-items:center/background `rgb(0 0 0 / 60%)`/pointer-events:auto다. 프레임 밖 전체 페이지가 아니라 실제 게임 화면을 덮는다.
  3. 콘텐츠는 position:relative/z-index1/text-align:center. 제목은 정확히 ‘일시정지’, 흰색 계열 `#fff8e5`, 기존 Galmuri11Pixel, 크기 `clamp(28px, 5vw, 56px)`, 충분한 행간/그림자로 대비를 확보한다.
  4. 제목 아래 ‘계속하기’ 버튼을 두어 가려진 기존 pause 버튼 대신 클릭/터치로 재개할 수 있게 한다. 버튼은 최소44px 높이, 기존 픽셀 버튼 스타일과 focus-visible 테두리를 사용한다. onResume은 `eventBus.emit("pause-requested", { paused: false })`만 요청한다.
  5. 제목에 `role="status"`/`aria-live="polite"`를 사용한다. mount 시 재개 버튼에 focus하고 unmount 시 연결된 기존 focus 대상으로 복구한다. 입력/효과 부작용을 React render 중 실행하지 않는다. Escape는 기존 게임 입력을 통해 재개한다.
  6. 게임 HUD는 z3, 코인 카운터4, 컷신8, 사망10, 초기화 대화상자20이므로 오버레이15는 일반 게임 표시보다 위, 초기화 확인창보다 아래다. 모바일에서 감춰지는 `.hud-stats` 안에 넣지 않는다. 반투명 배경이 underlying UI 클릭을 가로막고 재개 버튼은 동작한다.
  7. GameOverlay 루트에 `inert={paused}`를 적용해 가려진 HUD가 Tab/Enter로 조작되지 않게 한다. 재개 시 자동 해제한다. 이는 중앙 오버레이의 입력 차단을 완성하는 구현 보완이다.
- **Error & State**: 브리지의 실제 응답 없이 클릭만으로 React paused를 먼저 해제하지 않는다. 반복 클릭/빠른 Escape에도 runtime/audio/overlay 상태가 일치해야 한다. game component unmount 시 listener/focus 처리를 해제한다.

### I04. 음악 위치/출력과 UI 행동 검증

- Related Files:
  - `scripts/audio-pause.test.mjs` :: AudioManager 정지 수명주기 회귀; new
  - `scripts/bowl-defense.test.mjs` :: TS 테스트 로더 참고; read-only

#### Details

- 프로젝트에 새 테스트 프레임워크를 추가하지 않고 node:test를 사용한다. AudioManager 모듈에 주입되는 Tone/Phaser 테스트 대역은 public API 효과를 관찰하는 최소 범위로 구성한다. private 구현 문자열을 검사하거나 동일 알고리즘을 테스트 안에 복사하지 않는다.
- 검증: 정지 시 현재 키/진행 위치 보존, 재개 시 처음으로 reset 안 함, 10회 연속 정지/재개에서 중복 시퀀스 없음, 다른 owner를 정지하지 않음, 정지 중 늦은 unlock 완료가 음악을 시작하지 않음, 정지 중 곡 변경은 재개 때 한 번 시작, cached audio도 pause/resume, destroy 후 재생 없음.
- 실제 브라우저 검증도 필수다. Tone transport ticks/position이 정지 5초 동안 유지되고 음악 출력이 mute ramp 종료 뒤 무음인지 확인한다. mock 통과만으로 음소거를 검증했다고 하지 않는다. 재개 직후 position이 처음부터 시작하지 않고 진행하는지 확인한다.
- 일반 구간/보스 각각 Escape와 클릭/터치 재개, 1280×720/390×844 프레임에서 중앙 제목과 검은 배경, 초기화 확인창과의 z-index를 확인한다. 방어음/체크포인트 차임도 재개 후 정상이다.

## Acceptance Criteria

- [x] 게임과 BGM이 함께 정지하고 소리/transport 위치가 멈춘다. 재개는 같은 지점에서 이어진다.
- [x] 중앙의 ‘일시정지’와 검은 반투명 배경이 게임/HUD 위에 선명하다.
- [x] Escape 및 계속하기 버튼으로 재개할 수 있고 모바일에서도 보인다.
- [x] unlock/반복 토글/장면 종료 때문에 음악만 켜지거나 다음 장면까지 오버레이가 남지 않는다.
- [x] 공용 Tone context와 기존 clang/체크포인트 효과음의 정상 재생이 유지된다.

## Validation

- `node --test scripts/audio-pause.test.mjs scripts/stage-music.test.mjs scripts/checkpoint-feedback.test.mjs scripts/bowl-defense.test.mjs` — 수명주기와 오디오 이벤트 회귀 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 변경된 React/Phaser/Tone 연결 통과. Next 관련 코드 작성 전 설치된 `node_modules/next/dist/docs/` 관련 가이드를 확인한다.
- 개발 서버에서 실제 음악 출력/transport/오버레이 검증을 수행한다. 화면 캡처와 정지/재개 타임라인은 T05 기록에 남긴다.

## Commit Message

```text
feat(pause): 중앙 일시정지 표시와 배경음 정지를 동기화한다

Plan: 2026-10-12-world01-pause-music-checkpoints
Phase: P01-feedback-and-audio
Task: T04-pause-overlay-audio

- 일시정지 시 음악 위치를 보존하고 재개 시 이어서 재생
- 게임 위에 반투명 검은 배경과 일시정지 및 계속하기 버튼 표시
- 잠금 해제와 장면 전환 중 음악 소유권 및 효과음 회귀 방지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

관련 자동13건, 타입·lint·프로덕션 빌드 통과. 실제 브라우저 일반/보스 각각5초 정지 ticks580/1032 유지 및 peak0, 재개 ticks840/1320과 출력복귀 확인. 각10회 Escape 토글, 클릭 재개, 정지중 unlock, 초기화창 z20, 장면변경 초기화, 모바일390×844 프레임/이미지 확인. GameOverlay inert로 가려진 HUD의 키보드 조작도 차단.
