# Task: T03 픽셀 자막·칩튠과 타이틀/이름 입력

## Status: done

## Goal

컷신의 나레이션·대사를 장면 아래 픽셀 대화창에서 한 글자씩 진행하고, 장면별 8비트 소리와 인트로 이후 타이틀/이름 입력/World 1 전환을 연결한다.

## Decision Summary

- 모든 컷신 글자는 로컬 Galmuri 폰트를 사용하며, 자막은 프레임 기반 고정 레이아웃에서 배우 동작과 동시에 표시한다.
- 배경 칩튠/효과음은 기존 브라우저 오디오 unlock 정책을 지키며 프로그래밍된 음형으로 생성한다. 외부 오디오 파일이나 자동재생 우회는 추가하지 않는다.

## Implementation

### I01. 타이프라이터 대화 UI

- Related Files:
  - src/components/game/CutsceneOverlay.tsx :: CutsceneOverlay — 비트별 픽셀 대화창 출력; modify
  - src/components/game/NarratorText.tsx :: NarratorText — 글자 단위 나레이션; modify
  - src/components/game/DialogueBox.tsx :: DialogueBox — 화자/대사 typewriter; modify
  - src/components/game/ItemCard.tsx :: ItemCard — 갈비뼈 카드 텍스트와 픽셀 장식; modify
  - src/components/game/TypewriterText.tsx :: TypewriterText — 타이머 정리 포함 글리프 reveal; new
  - src/app/globals.css :: .cutscene-overlay, .dialogue-box, .item-card, .intro-title-overlay — pixel UI style; modify

#### Details

#### Signatures & Types

    export interface TypewriterTextProps {
      readonly text: string;
      readonly durationMs: number;
      readonly resetKey: string;
      readonly className?: string;
    }

    export function TypewriterText(props: TypewriterTextProps): ReactElement;

- narration과 dialogue를 화면 하단 하나의 고정 대화 프레임에 배치하고 각 문자는 왼쪽에서 오른쪽으로 표시한다. 화자 표시는 나레이션/주인/코기/고양이 식별이 되게 하되 기존 문장을 재작성하지 않는다.
- narration과 dialogue가 같은 beat에 있으면 각 텍스트 줄을 함께 타이핑한다. 재생 중에는 씬 timeline을 기다리거나 정지하지 않는다.
- 타이핑 간격은 현재 beat.durationMs와 표시 글자 수에서 계산하고 비트 종료 전에 모든 글자가 나타나도록 보정한다. 비트 전체 시간과 11개 비트 길이 36.5초는 늘리지 않는다.
- beat가 바뀌거나 컴포넌트가 unmount되면 interval/timeout을 정리한다. 이전 비트의 늦은 글자가 다음 비트에 나타나지 않게 한다.
- 글자·버튼·입력창과 item card는 P01의 Galmuri font와 제한된 픽셀 테두리·steps 기반 전환을 쓴다. 흐릿한 drop-shadow, 둥근 현대식 카드, 비픽셀 시스템 폰트를 사용하지 않는다.
- skip 버튼은 재시청에만 노출한다. 첫 재생 중 키 입력으로 React UI가 씬을 조기 종료하지 않도록 한다.

### I02. 칩튠 cue와 오디오 정책

- Related Files:
  - src/game/audio/AudioManager.ts :: playMusic, playSfx, playTone, unlock, destroy — intro 패턴 재생/해제; modify
  - src/game/audio/audioManifest.ts :: SOUND_KEYS, MUSIC_KEYS — 필요한 cutscene cue 식별자; modify
  - src/game/data/cutscenes/intro.ts :: musicKey, soundCue — 봉지/갈비뼈/고양이/코기/탈출 cue 배치; modify

#### Details

- birthday-warm에는 따뜻한 짧은 칩튠 루프, world-01-alley에는 다음 월드 시작 직전의 다른 루프를 배정한다.
- 구분 가능한 기존/추가 cue는 bag-rustle, rib-reveal, bark, whine, cat-land, cat-taunt, slipper-scrape, escape-door로 제한해 대본 비트에 연결한다.
- 단일 비프 대신 짧은 pitch sequence와 명확한 음량 envelope를 쓴다. 봉지 바스락은 저음량 noise burst, 착지는 짧은 저음, 도발은 짧은 2~3음 motif로 구분한다.
- AudioContext는 기존 pointerdown/keydown gesture에서만 resume한다. gesture 전 cue를 큐에 쌓아 후속 장면에서 늦게 재생하지 않는다. 사용자가 소리 재생을 차단해도 영상 타임라인은 정상 진행한다.
- scene 종료/skip에서는 interval, oscillator, music loop를 모두 멈추고 이벤트 구독을 정리한다. WORLD CUTSCENES 등 비대상 음악 동작을 바꾸지 않는다.

### I03. 타이틀과 이름 입력으로 진행 게이트

- Related Files:
  - src/components/game/GameShell.tsx :: introGateStep, cutscene-finished listener, handleNameConfirm — existing post-intro flow; modify
  - src/components/game/IntroTitleOverlay.tsx :: title/name form — 로컬 픽셀 UI 및 이름 확인; modify
  - src/game/scenes/IntroScene.ts :: player-name-confirmed listener — StageScene 전환; modify
  - src/game/scenes/StageScene.ts :: StageSceneData.playerName — 기존 시작 계약; read-only

#### Details

- 마지막 intro-home beat 완료 직후 GameShell의 기존 introGateStep을 title로 전환한다. 타이틀 화면을 약 2.2초 보여준 후 이름 단계로 넘어가는 현재 순서를 보존하고 사용자가 시작 버튼으로 즉시 이름 단계로 이동할 수 있게 한다.
- 이름은 trim 후 <> 문자를 제거하고 길이를 20자로 제한하며, 비어 있으면 코기를 사용한다.
- 이름 확인 시 player-name-confirmed 이벤트를 한 번 보낸다. IntroScene은 이벤트를 한 번만 처리하고 progress state의 이름으로 StageScene(world-01-stage-1)을 시작한다.
- 타이틀/이름 UI가 보이는 동안 인트로 배경은 전체 화면 뒤에 유지하되 게임 HUD/상태창/디버그 테스트 문구는 표시하지 않는다.
- GameShell의 진행 toast는 intro/title/name 단계 동안 숨기고 ready(실제 게임 진입) 이후에만 표시한다. 기본값인 진행 준비 문구가 첫 프레임부터 시네마틱에 겹치면 안 된다.

## Acceptance Criteria

- [x] 나레이션과 대사가 하단 픽셀 대화창에서 한 글자씩 진행되며 Phaser 애니메이션 타임라인과 분리되어 있다.
- [x] 텍스트 reveal은 비트 시간의 80% 안에 끝나고, 전체 길이는 36.5초다.
- [x] 생일/골목 음악과 봉지·갈비뼈·고양이·슬리퍼·탈출 효과음을 구분했으며 사용자 입력 전 오디오는 재생/대기열에 쌓지 않는다.
- [x] 컷신 뒤 타이틀 → 이름 입력/정제/저장 → StageScene(world-01-stage-1) 전환을 연결했다.
- [x] 제목/이름 화면에서 HUD와 준비 토스트를 숨기고 body에 로컬 Galmuri 픽셀 글꼴을 적용한다.

## Validation

- npm.cmd run lint — component hook timer 및 오디오 cue key 타입 검증.
- npm.cmd run build — local font, React UI, scene event typing 검증.
- npm.cmd run dev — narration, 대사 동시 표시, item card, title/name, 코기 이름 사용을 브라우저에서 확인한다.
- 첫 사용자 gesture 전후 오디오 정책을 확인하고 차단/음소거 환경에서도 11개 beat가 정상 완료되는지 확인한다.

## Validation Notes

- `npm.cmd run lint`와 `npm.cmd run build` 통과. 로컬 페이지와 Galmuri 폰트 URL은 HTTP 200이다.
- 11개 컷신 비트가 36,500ms이며 intro sound cue 8개 모두 `SOUND_KEYS`에 등록된 것을 검산했다. Typewriter RAF와 audio source/timer는 beat 교체·skip·scene shutdown에서 취소한다.
- 브라우저 자동화 실행 제한으로 실제 화면 타이핑 속도와 사용자 입력 전후의 물리 오디오 출력을 직접 확인하지 못했다. autoplay guard, 이벤트, scene transition은 코드/빌드로 검증했다.

## Commit Message

    feat(intro): 픽셀 대사와 칩튠 이름 입력 흐름 연결

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P02-cinematic-home-scene
    Task: T03-pixel-dialogue-audio-and-gate

    - 타이프라이터 픽셀 대화창과 장면별 8비트 패턴 적용
    - 타이틀·코기 이름 입력에서 World 1 시작까지 연결

## Progress

- [x] 하단 대화창과 glyph reveal 구현
- [x] 컷신 음악/효과음과 사용자 gesture autoplay 정책 연결
- [x] 타이틀·이름 게이트 및 StageScene 전환 연결
- commit: `feat(intro): 픽셀 대사와 칩튠 이름 입력 흐름 연결`
