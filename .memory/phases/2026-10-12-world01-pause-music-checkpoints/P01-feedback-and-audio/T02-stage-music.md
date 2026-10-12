# Task: T02 월드 1 일반 구간과 삼색이 전투 BGM 제작

## Status: done

## Goal

오프닝과 다른 귀엽고 평화로운 월드 1 BGM, 긴박감이 아주 조금 있는 삼색이 전투 BGM을 기존 Tone.js/Web Audio 도구로 제작하여 장면에 맞게 재생한다.

## Decision Summary

- 월드 1 일반 스테이지 1~4는 새 곡 하나를 공유하고 보스는 별도 새 곡을 사용한다. 오프닝의 기존 두 곡은 보존한다.
- 일반 구간에도 AudioManager를 생성한다. 이후 체크포인트 차임과 BGM 일시정지가 이 수명주기를 이용한다.
- 작업 트리의 공용 Tone 컨텍스트, 재잠금 해제, 밥그릇 clang 수정은 이미 있는 기준이다. HEAD로 되돌리지 않는다.

## Implementation

### I01. 음악 키와 장면별 선택

- Related Files:
  - `src/game/audio/audioManifest.ts` :: `MUSIC_KEYS`, `MusicKey`; modify
  - `src/game/audio/stageMusic.ts` :: `STAGE_MUSIC_BY_WORLD`, `getStageMusicKey`; new
  - `src/game/audio/AudioManager.ts` :: `musicForStage`, stage-started listener; modify
  - `src/game/core/types.ts` :: `StageId`, `WorldId`; read-only

#### Details

- **Signatures & Types**: `getStageMusicKey(stageId: StageId): MusicKey`; `STAGE_MUSIC_BY_WORLD: Readonly<Record<WorldId, { readonly normal: MusicKey; readonly boss: MusicKey }>>`。
- **Data & Schema Fields**:
  - `MUSIC_KEYS` 기존 8개에 `"world-01-peaceful"`, `"world-01-calico"`를 추가한다.
  - world-01: normal=`world-01-peaceful`, boss=`world-01-calico`.
  - world-02/03/04/05: 기존 normal=`world-02-amusement`/`world-03-factory`/`world-04-rooftop`/`world-05-kingdom`, boss=`boss`를 명시한다. 미래 월드 보스 곡은 각 항목만 교체할 수 있다. 이번 신규 작곡 범위는 월드 1 두 곡이다.
- **Execution Flow / Logic**: 유효한 StageId의 world prefix와 `-boss` suffix로 매핑한다. 기존 `AudioManager.musicForStage` 분기를 이 순수 함수로 통합한다. 기존 외부 `playMusic(key: string): void`의 키 검증은 유지한다.
- **Error & State**: 알 수 없는 문자열이 playMusic에 오면 현재와 같이 무시한다. 내부 StageId 매핑이 빠진 경우 타입/테스트에서 발견되게 한다. 오프닝 키를 신규 일반 구간 키로 덮어쓰지 않는다.

### I02. 기존 합성기로 두 곡 작곡

- Related Files:
  - `src/game/audio/musicArrangements.ts` :: `MusicArrangement`, `CHORD_VOICINGS`, `MUSIC_ARRANGEMENTS`; new
  - `src/game/audio/AudioManager.ts` :: `startToneMusic`; modify
  - `src/game/data/cutscenes/intro.ts` :: 오프닝 musicKey; read-only

#### Details

- **Signatures & Types**: `MusicArrangement` 필드는 `readonly bpm: number`, `readonly melody: readonly (string | null)[]`, `readonly chords: readonly string[]`, `readonly bass: readonly string[]`, 선택 필드 `readonly leadWave?: "sine" | "triangle"`, `readonly leadVolumeDb?: number`, `readonly harmonyVolumeDb?: number`, `readonly bassVolumeDb?: number`, `readonly leadGate?: "8n" | "16n"`이다. 선택 필드의 기본값은 각각 triangle, -10, -17, -19, 8n이다. `MUSIC_ARRANGEMENTS`는 `Readonly<Record<MusicKey, MusicArrangement>>`이다.
- 기존 AudioManager 내부의 8곡과 코드 보이싱을 별도 순수 데이터 모듈로 옮기되 음표/템포/음량을 보존한다. 기존 `birthday-warm` 및 오프닝 cat-entry가 쓰는 `world-01-alley`는 그대로 둔다.
- 신규 두 곡은 4/4, 16마디 루프다. melody는 8분음표 단위 128칸, chords는 2분음표 단위 32칸, bass는 4분음표 단위 64칸으로 루프 길이를 맞춘다. `_`는 쉼표(null)이며 랜덤 음표 생성은 하지 않는다.
- 초기 작곡안은 아래와 같다. 각 행이 한 마디이며 화음은 해당 마디의 두 칸에 반복한다. 베이스는 마디마다 root2, fifth2, root2, fifth2 네 음을 사용한다(C=C2/G2, D=D2/A2, Em=E2/B2, F=F2/C3, G=G2/D3, Am=A2/E3, Dm=D2/A2, Bm=B2/F#3). 이 기준을 구현하고 청음으로 음량/게이트를 조정할 수 있으나 다른 곡의 템포만 바꾼 재사용으로 대체하지 않는다.

| 마디 | 평화로운 곡 melody (8칸) | 화음 | 삼색이 곡 melody (8칸) | 화음 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | C5 _ E5 G5 E5 _ D5 _ | C | G4 D5 G5 _ B5 A5 G5 _ | G |
| 2 | A5 G5 F5 _ A5 _ G5 _ | F | F#5 A5 D5 _ F#5 E5 D5 _ | D |
| 3 | B4 D5 G5 A5 G5 _ D5 _ | G | E5 G5 B5 _ A5 G5 E5 _ | Em |
| 4 | E5 D5 C5 _ _ _ G4 _ | C | E5 G5 C5 _ D5 E5 G5 _ | C |
| 5 | E5 A5 C6 _ B5 A5 E5 _ | Am | B4 D5 G5 B5 A5 G5 D5 _ | G |
| 6 | F5 A5 G5 _ F5 E5 F5 _ | F | A4 D5 F#5 A5 G5 F#5 E5 _ | D |
| 7 | D5 F5 A5 _ G5 F5 E5 _ | Dm | C5 E5 G5 E5 D5 C5 E5 _ | C |
| 8 | D5 G5 B5 A5 G5 _ _ _ | G | D5 F#5 A5 _ G5 F#5 D5 _ | D |
| 9 | G5 _ E5 G5 C6 B5 G5 _ | C | E5 B4 E5 G5 B5 _ G5 E5 | Em |
| 10 | G5 B5 E5 _ D5 E5 G5 _ | Em | F#5 B4 D5 F#5 A5 _ F#5 D5 | Bm |
| 11 | A5 _ C6 A5 G5 F5 E5 _ | F | E5 C5 E5 G5 A5 _ G5 E5 | C |
| 12 | D5 G5 A5 B5 A5 _ G5 _ | G | F#5 D5 F#5 A5 G5 F#5 E5 _ | D |
| 13 | A5 C6 B5 A5 E5 _ C5 _ | Am | G5 B5 A5 G5 D5 _ B4 D5 | G |
| 14 | F5 A5 G5 F5 D5 _ E5 _ | Dm | E5 G5 E5 C5 D5 E5 G5 _ | C |
| 15 | D5 G5 B5 A5 G5 D5 B4 _ | G | A5 G5 F#5 E5 D5 _ F#5 A5 | D |
| 16 | E5 G5 C5 _ _ _ _ _ | C | G5 D5 B4 G4 _ _ _ _ | G |

- **평화로운 곡**: BPM 100, leadWave=sine, leadVolumeDb=-14, harmony=-23, bass=-24, leadGate=8n. 장조의 둥근 벨/가벼운 반주, 큰 타격음 없음.
- **삼색이 곡**: BPM 114, leadWave=triangle, leadVolumeDb=-15, harmony=-23, bass=-24, leadGate=16n. 낮은 음역의 짧은 음과 약간 빠른 리듬으로만 긴박감을 준다. 강한 드럼/왜곡/공포 음색은 넣지 않는다.
- 기존 Synth/PolySynth/MonoSynth envelope와 시퀀스를 재사용하고 선택 필드를 적용한다. 새 외부 음원 서비스나 패키지는 추가하지 않는다.
- **Error & State**: 브라우저 잠금 중에는 원하는 musicKey만 보관하고 다음 사용자 제스처의 `Tone.start()` 이후 한 번 시작한다. NoAudio 환경에서는 예외 없이 조용히 진행한다. 루프 종료 때 transport를 재생성하지 않는다.

### I03. 일반 구간과 보스 장면의 소유권 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`, 보스 intro 완료 처리, shutdown; modify
  - `src/game/audio/AudioManager.ts` :: constructor, `playMusic`, `unlock`, `stopMusic`, `destroy`; modify
  - `src/game/data/cutscenes/worlds.ts` :: `world-01-intro`; modify
  - `src/game/scenes/IntroScene.ts` :: 오프닝 정리; read-only, 필요한 경우 소유권 회귀 수정

#### Details

- 기존 `if (stage.id === "world-01-stage-boss")` 생성 제한을 제거하고 StageScene당 AudioManager 한 개를 생성한다. GameplayEventBus 생성 이후, 체크포인트 복원/`runtime.start()` 이전 위치를 유지한다.
- `stage-started`에서 새 라우팅을 선택한다. 월드 1 보스 첫 도입 컷신 완료 콜백의 `playMusic("boss")`도 `getStageMusicKey(stage.id)`로 바꾼다. 이미 본 도입/재시작/스킵에서도 같은 보스 키를 유지한다.
- `WORLD_CUTSCENES`의 `world-01-intro` beat는 `world-01-peaceful`로 바꾼다. 오프닝 `intro.ts`의 `world-01-alley`는 변경하지 않는다. 보스 대사/자동 진행 시간은 그대로 둔다.
- Tone 전역 transport 소유자 심볼을 유지한다. 새 Scene이 음악을 시작한 뒤 이전 관리자 shutdown이 와도 새 소유자의 음악을 정지/폐기하면 안 된다. 각 관리자 구독/gesture/source는 destroy에서 해제한다. 같은 키를 중복 요청하면 겹쳐 재생하지 않는다.
- 현재 작업 트리의 `Tone.getContext().rawContext` 공유 효과음, persistent unlock 제스처, 720/1190/1820Hz bowl-clang을 보존한다. Phaser의 별도 context를 다시 SFX 기준으로 사용하지 않는다.
- 저장 스키마 변경은 없다. 새 음악 상태는 Scene/AudioManager의 일시 상태다.

### I04. 음악 데이터와 장면별 검증

- Related Files:
  - `scripts/stage-music.test.mjs` :: 장면 라우팅/루프 검증; new
  - `scripts/bowl-defense.test.mjs` :: TS 로딩 훅 참고; read-only

#### Details

- 순수 `stageMusic.ts`/`musicArrangements.ts`를 기존 transpileModule 방식으로 로드한다. 25개 StageId의 반환 키가 MUSIC_KEYS에 있으며 월드 1 일반/보스/오프닝 키가 구분되는지 검사한다.
- 새 두 곡 각각 melody=128, chords=32, bass=64인지, 코드명이 보이싱에 있는지, 루프 시간(각 음표 단위 기준)이 같은지 확인한다. 두 곡 melody가 오프닝/서로와 동일하지 않고 쉬는 칸을 포함하는지 검사한다.
- 브라우저에서 오프닝→일반 구간→보스 첫 도입/재도입→보스 실패 후 4단계 복귀를 확인한다. 현재 곡/소유자와 실제 출력이 바뀌는지 확인하고 음악이 두 겹으로 겹치지 않는지 기록한다.
- 두 곡의 1루프 이상을 녹음하거나 청음한다. 파형만 확인한 경우 분위기/주관적 음량 청음은 미실시로 기록한다. 새 BGM 아래 방어음이 들리는지도 기존 방어 3회 시나리오로 확인한다.

## Acceptance Criteria

- [x] 기존 Tone.js 방식으로 새 음악 두 곡이 구현되어 일반 구간/보스에 각각 연결된다.
- [x] 오프닝 음악은 그대로이고 월드 1 진입 후 남거나 새 곡과 겹치지 않는다.
- [x] 보스 컷신 완료·재도입·4단계 복귀에서 올바른 곡이 선택된다.
- [x] 곡과 효과음이 공용 Tone context를 사용하며 최근 방어음 수정이 보존된다.

## Validation

- `node --test scripts/stage-music.test.mjs scripts/bowl-defense.test.mjs` — 음악 데이터/기존 방어 이벤트 통과.
- `npx.cmd tsc --noEmit` 및 `npm.cmd run lint` — 타입과 정적 검사 통과.
- 개발 서버에서 위 장면 전환과 각 곡의 1루프를 확인한다. 구현 과정에서 이미 수행한 통과 검사를 변경 없이 반복하지 않는다.

## Commit Message

```text
feat(audio): 월드 1 산책과 삼색이 전투 음악을 추가한다

Plan: 2026-10-12-world01-pause-music-checkpoints
Phase: P01-feedback-and-audio
Task: T02-stage-music

- 기존 Tone.js로 평화로운 일반 구간과 살짝 긴박한 보스 곡을 제작
- 일반 구간에도 오디오 수명주기를 연결하고 장면별 음악을 선택
- 오프닝과 기존 밥그릇 방어음 및 공용 컨텍스트 수정을 보존
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

음악/방어 자동4건, 타입, lint 통과. 오프닝 이름 입력→일반곡 전환과 이전 관리자 폐기 확인. 일반곡40초 peak0.13535, 보스곡36초 peak0.19004 녹음. 첫 보스 대사 종료·재입장·4단계 복귀 키 확인, 브라우저 오류0. 실제 스피커 청음은 미실시. 시작 전 승인된 보스 타일 바닥과 공용 Tone 컨텍스트/clang 수정도 보존하여 포함.
