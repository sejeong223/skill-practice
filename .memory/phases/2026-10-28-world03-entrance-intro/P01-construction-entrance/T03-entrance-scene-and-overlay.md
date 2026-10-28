# Task: T03 전용 인트로 장면과 자막 화면

## Status: pending

## Goal

월드 3 인트로를 전용 Phaser 장면으로 재생하고, 월드 2처럼 React 자막만 보여준다. 여섯 대사·세 그림·음악·두 효과음의 시작과 종료를 장면 수명에 묶는다.

## Decision Summary

- 첫 두 나레이션에는 공사장 전경, 세 번째 대사부터 기침 초상화, 다섯 번째 나레이션부터 결의 초상화를 보여준다. 자동 진행·완료 후 암전·본 기록·재시청 스킵은 월드 2 방식을 따른다.
- 드릴은 둘째 beat 시작과 함께, 굴착기는 그 beat 안에서 약 900ms 뒤 재생한다. 두 소리는 셋째 beat 전에 끝내고 다음 장면에 남기지 않는다.

## Implementation

### I01. `World03EntranceScene` 재생·정리

- Related Files:
  - `src/game/scenes/World03EntranceScene.ts` :: `World03EntranceScene`, `World03EntranceSceneData` — 새 장면; new
  - `src/game/scenes/World02EntranceScene.ts` :: `World02EntranceScene` — 카메라·타이머·이벤트 기준; read-only
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD03_ENTRANCE_CUTSCENE` — T01에서 추가된 대본; read-only
  - `src/game/audio/AudioManager.ts` :: `AudioManager` — T02의 효과음·기존 음악 재생; read-only
  - `src/game/config.ts` :: `createPhaserConfig` — 새 장면 import·등록; modify
  - `scripts/world03-entrance-scene.test.mjs` :: 장면 진행·스킵·정리 테스트 — 새 테스트; new

#### Details

- **Signatures & Types**:
  ```typescript
  export interface World03EntranceSceneData {
    readonly nextStageId: "world-03-stage-1";
  }
  export class World03EntranceScene extends Phaser.Scene {
    public constructor();
    public create(data?: Partial<World03EntranceSceneData>): void;
    private playBeat(index: number): void;
    private showPortrait(assetKey: string): void;
    private skip(): void;
    private finish(skipped: boolean): void;
    private cleanup(): void;
  }
  ```
- **Data & Schema Fields**:
  - 이미지 키: `world-03-entrance-construction`, `world-03-entrance-corgi-cough`, `world-03-entrance-corgi-resolved`; 셋 모두 로드되어야 진행한다.
  - 장면 상태: `progress?:ProgressState`, `eventBus?:GameEventBus`, `audioManager?:AudioManager`, `background?:Phaser.GameObjects.Image`, `portrait?:Phaser.GameObjects.Image`, `dimmer?:Phaser.GameObjects.Rectangle`, `beatTimer?:Phaser.Time.TimerEvent`, `excavatorTimer?:Phaser.Time.TimerEvent`, `removeSkipRequest?:(()=>void)`, `canSkip:boolean`, `finished:boolean`.
  - 이벤트: `cutscene-started {cutsceneId:"world-03-intro",skipAllowed}`, 각 beat에서 `cutscene-beat {cutsceneId,beat,index,totalBeats:6,skipAllowed,manualAdvance:false,captionIndex:0,captionCount:1}`, 종료 시 `cutscene-finished {cutsceneId,skipped}`. 기존 `GameEventBus` 계약을 그대로 사용한다.
- **Execution Flow / Logic**:
  1. `create`는 `finished=false`, 1280×720 카메라·오후 하늘 배경색을 세팅한다. `nextStageId`가 정확한지, registry의 `gameEventBus`가 `GameEventBus`인지, `progressState`가 있는지, 세 texture가 모두 있는지 검사한다. 실패 시 월드 2와 같은 오류 패널을 띄우고 진행 기록은 건드리지 않는다.
  2. 유효하면 `canSkip=progress.seenCutsceneIds.includes("world-03-intro")`. `cutscene-skip-requested`와 Escape를 연결하고 SHUTDOWN 정리를 등록한다. `AudioManager(this, undefined, eventBus)`를 만든 **뒤** `cutscene-started`와 첫 `cutscene-beat`를 발행한다. 첫 beat의 `musicKey:"world-03-factory"`가 음악을 시작한다.
  3. 전경을 화면 중앙에 두고 원본 비율을 보존한 채 1280×720을 덮도록 확대한다. 첫 2 beat 동안 약 5% 느리게 확대한다. index 2에서 기침 초상화를, index 4에서 결의 초상화를 220ms 정도 페이드 인한다. 기존 초상화 tween을 종료·파괴한 뒤 다음 초상화를 놓는다. 모바일(`window.innerWidth<=720`)에서는 월드 2와 같은 작은 초상화/높이, 데스크톱에서는 같은 큰 초상화/높이를 사용한다.
  4. 각 beat는 `durationMs`에 맞춰 하나씩 자동 진행한다. index 1의 `soundCue:"world-03-drill"`은 이벤트로 재생되고, `excavatorTimer`는 약 900ms 뒤 `audioManager.playSfx("world-03-excavator")`를 호출한다. 이후의 beat에는 효과음을 다시 재생하지 않는다.
  5. 여섯 beat 후 400ms 검은 화면 fade, `finish(false)` 실행. `finish`는 중복 실행 방지, `seenCutsceneIds`에 ID 한 번 추가, `cutscene-finished` 발행, `StageScene {stageId:"world-03-stage-1",playerName:progress.playerName}` 시작 순서를 지킨다. 이미 본 경우에만 `skip()`이 `finish(true)`를 호출한다. `cutscene-finished`는 기존 `AutoSaveCoordinator`의 저장 이벤트이므로 별도 저장 코드를 만들지 않는다.
  6. `cleanup`은 두 타이머, 스킵 구독·Escape 핸들러, 배경/초상화 tween과 `AudioManager`를 정리한다. 스킵 뒤 굴착기 예약음이나 이전 장면 음악이 남으면 안 된다. StageScene은 다음 음악 관리자를 생성해 월드 3 음악을 재생한다.
  7. `createPhaserConfig.scene` 배열에 `World03EntranceScene`을 등록한다. 기존 scene 키와 순서는 유지한다.

### I02. 자막·HUD를 월드 3 전용 장면에 맞추기

- Related Files:
  - `src/components/game/CutsceneOverlay.tsx` :: `CutsceneOverlay` — 월드 2와 월드 3에 동일한 전용 인트로 CSS class 적용; modify
  - `src/components/game/GameShell.tsx` :: `GameShell`의 `world02EntranceActive` 상태 및 컷신 이벤트 effect — 두 월드 공통 인트로 활성 상태로 일반 HUD 숨김; modify
  - `src/app/globals.css` :: `.cutscene-overlay--world02` 선택자 — 공통 전용 인트로 자막·모바일 스타일로 확장; modify
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` :: 이 저장소 Next 버전의 클라이언트 컴포넌트·CSS 지침 — TSX/CSS 수정 전에 읽기; read-only
  - `scripts/world03-entrance-scene.test.mjs` :: UI 연계 계약 검증 — 새 테스트; new

#### Details

- **Signatures & Types**:
  ```typescript
  // GameShell 상태: const [worldEntranceActive, setWorldEntranceActive] = useState(false);
  // 전용 인트로 ID 집합: "world-02-intro" | "world-03-intro".
  ```
- **Data & Schema Fields**:
  - `CutsceneOverlay` class는 두 ID에서 `cutscene-overlay--world-entrance`로 한다. 나머지 컷신의 class와 수동 진행 버튼 처리는 기존대로 둔다.
  - `globals.css`의 데스크톱 `.cutscene-footer`와 `@media (max-width:720px)`의 `.cutscene-caption-frame`, `.cutscene-narration`, `.dialogue-line`, `.cutscene-speaker-label` 선택자에 공통 class를 사용한다.
- **Execution Flow / Logic**:
  1. 위 저장소 내 Next 문서의 클라이언트 컴포넌트·CSS 지침을 확인한다. `GameShell`의 현재 `world02EntranceActive`를 두 월드에 적용할 수 있는 `worldEntranceActive`로 바꾼다. `cutscene-started`의 ID가 월드 2 또는 3이면 true, 두 ID의 `cutscene-finished` 또는 `stage-started`면 false로 한다.
  2. 코인 표시, `GameOverlay`, 보스 오버레이, 토스트, 나가기 버튼의 기존 `!world02EntranceActive` 조건을 새 상태로 갱신한다. 월드 2에서 숨겨지던 항목을 누락하거나 일반 컷신까지 숨기지 않는다.
  3. 월드 3의 긴 네 번째 나레이션이 모바일 자막 프레임 안에 온전히 보이는지 확인한다. 필요하면 공통 class의 모바일 폰트·패딩만 조정하고 월드 2 화면도 함께 확인한다.
  4. 장면 테스트는 각 beat 이벤트·화자 순서, 미시청 Escape 무효, 시청 후 Escape·UI 스킵, 1회 finish·seen 기록, 굴착기 예약음 취소·오디오 destroy, scene 등록과 공통 자막 class 적용을 검증한다. 표시 위치와 표정은 브라우저로 직접 확인한다.

## Acceptance Criteria

- [ ] 장면이 여섯 자막을 순서대로 보여주고 기침/결의 초상화를 지정 지점에서 바꾼다.
- [ ] 월드 3 인트로 중 일반 HUD·코인·나가기 버튼이 숨겨지고, 모바일에서도 긴 대사가 잘리지 않는다.
- [ ] 첫 시청은 건너뛰지 못하고 재시청은 건너뛸 수 있으며 종료·스킵 후 음악·효과음·타이머가 남지 않는다.
- [ ] 월드 2 인트로의 자막과 숨김 동작이 유지된다.

## Validation

- `node --experimental-strip-types --test scripts/world03-entrance-scene.test.mjs scripts/world03-entrance-content.test.mjs scripts/audio-pause.test.mjs` — 장면·자막 계약·오디오 회귀 통과.
- `npx tsc --noEmit` — 장면 데이터와 UI 상태 타입 통과.
- `npx eslint src/game/scenes/World03EntranceScene.ts src/game/config.ts src/components/game/CutsceneOverlay.tsx src/components/game/GameShell.tsx` — 새 장면·UI lint 통과.
- 개발 화면에서 데스크톱·720px 이하 너비의 첫/세 번째/다섯 번째 beat와 스킵 후 화면을 확인한다. 실제 청음은 도구로 가능할 때 별도 기록한다.

## Commit Message

```text
feat(cutscene): 월드 3 공사장 인트로 장면 구현

Plan: 2026-10-28-world03-entrance-intro
Phase: P01-construction-entrance
Task: T03-entrance-scene-and-overlay

- 전용 장면의 그림·대사·음악·효과음 재생 연결
- 두 월드 인트로의 자막과 HUD 표시 규칙 통일
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
