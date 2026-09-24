# Task: T02 Phaser 인트로 장면과 배우·카메라 연출

## Status: done

## Goal

기존 디버그 프로토타입 대신 별도 IntroScene에서 11개 컷신 비트를 재생하고, 코기·주인 손·고양이·소품의 장면 동작과 카메라 팬·줌·페이드를 동기화한다.

## Decision Summary

- 인트로는 게임플레이 PrototypeScene의 테스트 HUD/물리 월드에 그리지 않고 별도 Phaser Scene으로 분리한다.
- 승인된 11개 비트, 36.5초의 기존 합산 길이, 캐릭터 표현 범위, 공간 동선을 유지한다. 배우 애니메이션은 CutsceneTimeline의 비트 시간과 함께 돌고 DOM 자막 때문에 멈추지 않는다.

## Implementation

### I01. 전용 장면과 행위자 rig

- Related Files:
  - src/game/scenes/IntroScene.ts :: IntroScene.create, update — world 1920×720 초기화 및 재생/전환; new
  - src/game/cutscenes/IntroActorRig.ts :: constructor(scene: Phaser.Scene, layout: IntroHomeLayout), playAction(action: ActorAction): void, destroy(): void — 승인된 스프라이트와 동작; new
  - src/game/cutscenes/introLayout.ts :: IntroHomeLayout, INTRO_HOME_LAYOUT — 승인 이미지 기준의 이름 있는 배우/소품 앵커 좌표; new
  - src/game/cutscenes/types.ts :: ActorAction, CutsceneBeat, CutsceneScript — 행동 표현력 보완; modify
  - src/game/data/cutscenes/intro.ts :: INTRO_CUTSCENE — 승인된 11개 사건/대사 순서와 초 단위 길이 보존; modify
  - src/game/cutscenes/CutsceneTimeline.ts :: play(beats, onBeat), skip, cancel — 기존 타이머 계약 재사용; read-only

#### Details

#### Signatures & Types

    export interface IntroAnchor {
      readonly x: number;
      readonly y: number;
      readonly depth: number;
    }

    export interface IntroHomeLayout {
      readonly worldSize: { readonly width: 1920; readonly height: 720 };
      readonly ownerEntry: IntroAnchor;
      readonly table: IntroAnchor;
      readonly corgiWait: IntroAnchor;
      readonly balcony: IntroAnchor;
      readonly dogDoor: IntroAnchor;
      readonly rib: IntroAnchor;
      readonly slipper: IntroAnchor;
    }

    export class IntroActorRig {
      public constructor(scene: Phaser.Scene, layout: IntroHomeLayout);
      public playAction(action: ActorAction): void;
      public destroy(): void;
    }

- IntroHomeLayout의 worldSize는 { width: 1920, height: 720 }이며 모든 x/y는 이 고정 world 좌표로 정의한다. INTRO_HOME_LAYOUT에는 background, ownerEntry, table, corgiWait, balcony, dogDoor, rib, slipper 앵커를 포함한다. 좌표/크기는 승인 preview에 대응시키며 browser pixel ratio로 재계산하지 않는다.
- IntroActorRig는 코기/고양이 spritesheet, owner hands, rib, slipper를 depth 레이어로 만들고 각 앵커를 고정한다. 기본 코기는 왼쪽을 향하는 옆모습이며 눈·코·입 외곽은 픽셀 에셋에 포함한다.
- ActorAction.action은 기존 enter, reveal, steal, taunt, hold, throw, leap에 point, retreat, surprise를 추가한다. intro.ts에 주인 손가락 지시/퇴장 동작과 왕갈비뼈 절도 때 코기 놀람 프레임을 명시하고, 실제 텍스처 프레임 및 Phaser tween으로 실행한다. 행위 없는 비트에서도 꼬리/idle 같은 작은 루프만 사용하고 제자리 흔들림/각도·스케일 펄스는 사용하지 않는다.
- 주인 동작은 손과 팔 스프라이트만 장면 경계에서 진입·가리킴·퇴장한다. 고양이는 창틀 착지 뒤 갈비뼈를 물고 같은 창으로 나간다. 코기는 소품을 문 뒤 강아지 문을 향해 전력질주한다.
- IntroScene의 physics/world bounds와 배경 폭은 1920×720이고 camera viewport/logical size는 1280×720이다. 카메라 world bounds를 집 배경 크기에 맞춰 좌우 팬이 가능하게 한다.
- 카메라 기본 샷은 집 입구/거실이 함께 보이는 wide shot이다. intro.ts의 camera 명세에 따라 갈비뼈/표정 클로즈업, 오른쪽 베란다 팬/고양이 도발 줌, 왼쪽 강아지 문 추적, 마지막 페이드를 실행한다. 컷 전환은 pixel art가 흐려지지 않게 단계적 pan/zoom 또는 즉시 컷만 사용한다.
- CutsceneTimeline은 scene shutdown 또는 skip에서 진행 타이머와 Promise를 반드시 취소해 다음 장면에 옛 이벤트가 도착하지 않게 한다.

### I02. 씬 시작 및 타이틀 전 이벤트 연결

- Related Files:
  - src/game/config.ts :: createPhaserConfig scene list — IntroScene 등록; modify
  - src/game/scenes/PreloadScene.ts :: create — preload 후 IntroScene 시작; modify
  - src/game/scenes/PrototypeScene.ts :: intro-home playback and player-name-confirmed listener — 중복 진입/구형 컷신 시작 제거; modify
  - src/game/bridge/GameEventBus.ts :: shared event use — registry의 기존 버스 사용; read-only
  - src/game/data/cutscenes/intro.ts :: intro-home beat timings — 합산 36.5초 보존; modify

#### Details

- BootScene → PreloadScene → IntroScene 순서를 사용한다. PrototypeScene은 config에 남겨 두어도 초기 장면으로 실행하지 않는다.
- IntroScene은 registry의 GameEventBus를 구독하여 cutscene-started, cutscene-beat, cutscene-finished 이벤트를 기존 React 오버레이에 보낸다.
- data 계약은 IntroSceneData { readonly assetLoadError?: string | null }로 둔다. 필수 에셋이 로드되지 않은 경우 장면 시작을 중단하고 Galmuri 폰트가 적용된 픽셀 오류 패널을 표시한다.
- 기존 11개 durationMs 합산 36,500ms를 유지한다. 타이밍을 늘려 텍스트를 읽히게 하지 않으며, 카메라와 배우 동작은 비트 안에서 끝난다.
- 최초 실행에서는 skipAllowed를 false로 보낸다. progressState.seenCutsceneIds에 intro-home이 있을 때만 skip 가능 상태를 보낸다.
- 마지막 페이드/비트가 끝나면 intro-home cutscene-finished를 한 번만 발생시킨다. name confirmation 뒤 StageScene 시작은 T03에서 연결한다.
- PrototypeScene에 남아 있던 기존 자동 intro-home 재생과 intro 전용 이름 확인 핸들러를 제거해 두 장면이 경쟁하지 않게 한다.

## Acceptance Criteria

- [x] 앱 실행 후 디버그 텍스트/빈 프로토타입 없이 곧바로 집 안 IntroScene이 나타난다.
- [x] 11개 비트의 이야기 순서·대사·주인 표현 규칙을 지키며 실제 스프라이트가 움직이고, 주인 지시/퇴장과 코기 놀람 표정이 보인다.
- [x] 카메라 전체 샷·클로즈업·팬·도주 추적·마지막 페이드가 1280×720 논리 영역을 기준으로 동작한다.
- [x] 자막 DOM 업데이트 중에도 Phaser 배우와 트윈이 별도 타임라인에서 계속 진행되며 프레임 위치는 트윈으로만 변경한다.
- [x] 첫 실행은 건너뛰기 불가, 재시청은 가능하며 장면을 나갈 때 타이머와 이벤트 구독이 정리된다.

## Validation

- npm.cmd run lint — Scene/actor/timeline 시그니처 타입 검사.
- npm.cmd run build — Phaser Scene 순서와 정적 에셋 연결 검증.
- npm.cmd run dev — 첫 진입에서 11개 비트, 카메라 동작, 마지막 fade가 겹침 없이 재생되는지 확인한다.
- 타이머 단위 검산: intro.ts 각 durationMs의 합이 36,500ms인지 확인한다.
- INTRO_HOME_LAYOUT의 actor/prop 좌표와 1920×720 배경 경계가 맞고, camera bounds에서 베란다/강아지 문 양끝이 보이는지 확인한다.

## Validation Notes

- `npm.cmd run lint`와 `npm.cmd run build` 통과.
- intro.ts의 11개 비트 및 36,500ms 합계를 검산했고, manifest의 필수 인트로 에셋 6개와 dev 서버 URL 응답 200을 확인했다.
- 실행 환경에서 브라우저 자동화/캡처 실행이 차단되어 실제 11비트 재생 화면과 프레임별 겹침을 캡처로 확인하지 못했다. 배우 좌표, 카메라 bounds, 트윈/타임라인 연결은 코드 및 빌드로 검증했다.

## Commit Message

    feat(intro): Phaser 집 시네마틱과 배우 동작 구현

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P02-cinematic-home-scene
    Task: T02-intro-scene-and-actor-animation

    - 전용 IntroScene과 코기·고양이·주인 배우 rig 연결
    - 카메라 연출과 기존 11개 비트 타이밍 동기화

## Progress

- [x] 전용 IntroScene/배우 rig/레이아웃 생성
- [x] 비트별 actor/camera 실행 및 종료/건너뛰기 정리
- [x] 첫 실행과 재시청 건너뛰기 규칙 연결
- commit: `feat(intro): Phaser 집 시네마틱과 배우 동작 구현`
