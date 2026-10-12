# Task: T03 체크포인트 픽셀 깃발과 띠리링 효과음

## Status: done

## Goal

월드 1 스테이지 2/4의 실제 체크포인트에 기존 테마의 픽셀 깃발을 표시하고, 처음 통과하여 저장될 때만 부드러운 ‘띠리링’ 차임을 낸다.

## Decision Summary

- 선행 T02에서 일반 구간에도 AudioManager가 생긴 상태를 전제로 한다. 저장 이벤트 하나가 효과음 한 번을 발생시키게 한다.
- 확인된 기존 `world-01-props` atlas의 `fake-checkpoint` 프레임을 시각 표현으로 재사용한다. 이 프레임명은 저장/가짜 판정을 결정하지 않는다. 새 이미지 생성은 현재 필요하지 않다.
- 기존 판정 사각형은 숨기고 깃발 이미지를 별도로 붙여 충돌/저장 위치를 보존한다.

## Implementation

### I01. 기존 깃발 프레임에 실제 체크포인트용 별칭 추가

- Related Files:
  - `public/assets/pixel/props/world-01/world-01-props.png` :: 기존 픽셀 깃발; read-only
  - `public/assets/pixel/props/world-01/world-01-props.json` :: `fake-checkpoint` frame; read-only
  - `src/game/assets/assetManifest.ts` :: `WORLD01_PROP_FRAMES`, `getAssetDefinition`, `getAssetFrameKey`; modify
  - `src/game/assets/assetManifest.json` :: 기존 world-01-props 등록; read-only

#### Details

- **Signatures & Types**: 기존 `getAssetDefinition(key: string): PixelAssetDefinition`, `getAssetFrameKey(key: string): string | undefined`를 그대로 사용한다.
- **Data & Schema Fields**: `WORLD01_PROP_FRAMES`에 `"world-01-checkpoint-flag": "fake-checkpoint"` 별칭을 추가한다. 실제 texture key=`world-01-props`, frame=`fake-checkpoint`, atlas 사각형 x=525/y=70/w=178/h=300이다. 원본 프레임 및 `world-01-prop-fake-checkpoint` 별칭은 보존한다.
- **Execution Flow / Logic**: 별칭으로 asset/frame을 얻고 Phaser Image를 만든다. 새 파일이나 atlas를 추가 로드하지 않는다. 현재 프레임에는 깃대/받침/주황색 천이 있고 글자는 없다. 빨간 반투명 사각형과 달리 명확한 깃발이다.
- **Error & Exception Handling**: 기존 필수 props atlas가 누락되면 자산 로딩 문제를 수정한다. 사각형 fallback을 정상 완료로 간주하지 않는다. 향후 원본 변경으로 재사용이 불가능하다고 실제 확인된 경우에만 `$imagegen` 스킬을 읽고 기존 atlas를 참고한 투명 배경 픽셀 깃발 PNG를 생성한다. 그때의 경로는 `public/assets/pixel/props/world-01/checkpoint-flag.png`, 키는 같은 `world-01-checkpoint-flag`, kind=image, worldId=world-01, required=true로 별도 등록하고 별칭은 제거한다. 현재 계획의 기본 경로는 기존 이미지 재사용이다.
- **State Transition & Return**: 시각 별칭만 추가하며 MapObject의 `trueCheckpoint`/`fakeCheckpoint` 속성과 ID는 바꾸지 않는다.

### I02. 판정 위치와 이미지 수명주기 보존

- Related Files:
  - `src/game/stages/StageEntityFactory.ts` :: `createCheckpoint`; modify
  - `src/game/stages/StageRuntime.ts` :: `buildFromMap`, `clearEntities`; read-only
  - `src/game/scenes/StageScene.ts` :: checkpoint overlap; read-only

#### Details

- **Signatures & Types**: `createCheckpoint(scene: Phaser.Scene, id: string, x: number, y: number): Phaser.GameObjects.Rectangle`를 유지한다. `StageEntityRequest`/`StageEntity` 변경은 필요 없다.
- **Data & Schema Fields**: 대상 ID는 정확히 `world-01-stage-2-checkpoint`, `world-01-stage-4-checkpoint`다. body는 기존 18×120 정적 사각형, entityId와 `stageEntityKind="checkpoint"`를 유지한다. 깃발은 `Phaser.GameObjects.Image`, 높이128/너비76, alpha=1, depth=1, origin=(0.5,1)이다.
- **Execution Flow / Logic**:
  1. 기존 사각형/body를 동일하게 생성한 뒤 대상 ID에만 `setVisible(false)`를 호출한다. `setActive(false)`, `disableBody`, body 삭제를 사용하지 않는다.
  2. `StageRuntime.buildFromMap`이 주는 x/y는 18×128 Tiled object의 중심이다. 깃발을 `(x, y + 64)`에 놓아 바닥과 맞춘다. 현재 2단계 object=(1520,352,18,128), 4단계=(2320,384,18,128)이므로 바닥은 각각 480/512다. body의 기존 4px 바닥 여유는 그대로 둔다.
  3. 깃발은 별도 충돌 body가 없는 장식이다. 확인용 data `checkpointId=id`만 둔다. 저장 판정은 원래 Rectangle의 overlap 하나로 한다.
  4. Rectangle의 destroy 이벤트에 깃발 destroy를 한 번 연결한다. Scene shutdown에서 이미 파괴됐다면 중복 destroy를 안전하게 건너뛴다. runtime 재빌드/재시작 시 이미지가 남거나 중복되지 않는다.
  5. 다른 월드 checkpoint, 가짜 함정, exits에는 적용하지 않는다. 기존 compact T03의 출구 숨김은 별도 미완료다.
- **Error & State**: 이미지 유무로 체크포인트 활성화를 결정하지 않는다. 판정 사각형을 눈에 안 보이게 해도 물리 body와 기존 스냅샷 경로는 유지되어야 한다.

### I03. 최초 활성화 차임과 자동 복원 구분

- Related Files:
  - `src/game/audio/AudioManager.ts` :: `playSfx`, 신규 `playCheckpointChime`, `trackSource`; modify
  - `src/game/systems/CheckpointSystem.ts` :: `activate`, 신규 `CheckpointActivationOptions`; modify
  - `src/game/scenes/StageScene.ts` :: `create`의 resumeCheckpointId, `activateCheckpoint`; modify
  - `src/game/core/events.ts` :: checkpoint-reached payload; read-only
  - `src/game/core/runtimeTypes.ts` :: CheckpointSnapshot; read-only

#### Details

- **Signatures & Types**:
  - `private playCheckpointChime(): void`.
  - `export interface CheckpointActivationOptions { readonly silent?: boolean; }`.
  - `CheckpointSystem.activate(checkpointId: string, x: number, y: number, facing: 1 | -1, now: number, options?: CheckpointActivationOptions): boolean`.
- **Data & Schema Fields**: `silent` 기본값=false. 영구 저장 필드는 추가하지 않는다. 기존 CheckpointSnapshot, runtime.checkpointId/Used/Seed와 mapSnapshot은 유지한다. 효과음 키는 기존 `checkpoint`를 사용한다.
- **Execution Flow / Logic**:
  1. T02의 일반 StageScene AudioManager가 `GameplayEventBus.checkpoint-reached`를 구독한다. `StageScene.activateCheckpoint`에서 직접 playSfx를 추가하지 않아 이벤트 중복을 막는다.
  2. `CheckpointSystem.activate`의 기존 snapshot 존재/가짜 체크포인트 검사에서 false이면 아무 소리도 나지 않는다. 첫 성공 시 snapshot/runtime을 기록하고 기본적으로 checkpoint-reached를 한 번 emit한다.
  3. `resumeCheckpointId`를 이용하는 보스 실패 후 4단계 자동 복원만 `{ silent: true }`를 넘긴다. 이 경우 snapshot/runtime은 동일하게 복원하되 checkpoint-reached emit만 생략한다. 기존 UI의 checkpoint-activated 알림과 `runtime.start()` 순서는 유지한다. 실제 새 활성화 호출은 기본값을 사용한다.
  4. `playSfx("checkpoint")`는 전용 차임 함수를 한 번 호출하고 return한다. 이전 `SOUND_PATTERNS.checkpoint` 사각파 패턴은 중복 재생되지 않게 제거한다.
  5. Tone 공용 raw AudioContext에서 sine 3음(E5=659.25Hz, G5=783.99Hz, C6=1046.50Hz)을 지연 0/0.095/0.19초에 합성한다. 각 peak=0.024/0.022/0.028, attack=0.005초, decay=0.14/0.17/0.30초, 마지막 decay 뒤 0.02초에 stop한다. lowpass=3800Hz를 공유하여 날카롭지 않은 상승 ‘띠리링’을 만든다.
  6. gain은 0.0001에서 시작해 attack 동안 peak로 올라갔다가 지수 감쇠한다. oscillator/gain은 기존 trackSource로 관리하고 공유 filter는 세 source가 모두 끝나면 disconnect한다. 씬 종료 시 예약된 음도 stopSources로 해제한다.
- **Error & Exception Handling**: NoAudio/잠긴 context이면 예외나 나중 몰아치기 없이 효과음 요청을 버린다. 지속 gesture unlock은 기존 방식대로 유지한다. snapshot이 이미 있는 재접촉/매 프레임 overlap은 새 효과음을 예약하지 않는다.
- **State Transition & Return**: 활성화 성공 true, 중복/가짜 false를 유지한다. resetForStage 뒤 실제 새 활성화는 다시 한 번 차임을 낼 수 있다. 같은 스냅샷 복원만으로 재생하지 않는다.

### I04. 활성화 의미와 시각/소리 검증

- Related Files:
  - `scripts/checkpoint-feedback.test.mjs` :: 최초/중복/가짜/자동복원 이벤트 회귀; new
  - `scripts/bowl-defense.test.mjs` :: TS 테스트 로더 참고; read-only

#### Details

- 기존 transpileModule 훅으로 CheckpointSystem/GameplayEventBus를 로드한다. 생성자에 테스트용 player 참조와 필수 RuntimeStageState를 주고, 실제 checkpoint-reached 이벤트 횟수 및 스냅샷 값을 검사한다. 시각 factory를 그대로 흉내 낸 mock 테스트는 추가하지 않는다.
- 실제 최초 활성화=true/이벤트1, 재접촉=false/계속1, fake=true 대상=false/0, resetForStage 후 새 활성화=이벤트1 추가, silent 복원=true/이벤트0/정상 snapshot을 각각 확인한다.
- 브라우저에서 2/4단계 깃발 바닥 정렬과 원래 overlap 위치를 확인한다. 일반 이동으로 통과 시 차임, 머무르기/재통과 시 추가 소리 없음, 보스 실패 후 복원 시 추가 소리 없음을 확인한다.
- 같은 구간을 여러 번 재시작해 깃발 수가 늘지 않는지 검사한다. 차임의 실제 출력/음량과 BGM 공존은 T05에서도 확인한다.

## Acceptance Criteria

- [x] 2/4단계 실제 체크포인트의 반투명 사각형 대신 기존 픽셀 깃발이 보인다.
- [x] 체크포인트 ID·판정·저장·재시작 동작과 다른 월드 표현은 유지된다.
- [x] 최초 실제 활성화마다 차임 한 번, 재접촉/자동 복원에서는 0번이다.
- [x] BGM과 같은 context에서 부드러운 차임이 출력되며 이미지/source가 씬 종료 후 남지 않는다.

## Validation

- `node --test scripts/checkpoint-feedback.test.mjs scripts/stage-music.test.mjs` — 이벤트/복원과 선행 음악 데이터 통과.
- `npm.cmd run world01:maps:check` — 체크포인트 배치/맵 원본 유지 확인.
- `npx.cmd tsc --noEmit` 및 `npm.cmd run lint` — 타입/정적 검사 통과.
- 개발 서버의 2/4단계 접근·재접촉·재시작·보스 복귀를 확인한다. 실제 청음 여부는 따로 기록한다.

## Commit Message

```text
feat(checkpoint): 픽셀 깃발과 최초 통과 차임을 연결한다

Plan: 2026-10-12-world01-pause-music-checkpoints
Phase: P01-feedback-and-audio
Task: T03-checkpoint-flag-chime

- 기존 테마의 깃발을 재사용하고 저장 판정 위치를 유지
- 첫 체크포인트 활성화에 부드러운 띠리링 효과음을 재생
- 재접촉과 보스 복귀의 자동 복원에서는 소리를 중복하지 않음
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

체크포인트/음악 자동5건, 맵, 타입, lint 통과. 브라우저 실제 이동으로 2/4단계 차임 각1회, peak0.01948/0.02555, sources0 정리 확인. 재접촉/자동복원 추가0회, 깃발 각1개·바닥480/512 정렬 및 이미지 확인. 실제 스피커 청음 미실시.
