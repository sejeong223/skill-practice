# Task: T04 데이터 기반 스테이지 런타임·카메라·시드 랜덤

## Status: done

## Goal

StageDefinition을 읽어 플랫폼·함정·적·코인·수집품·체크포인트를 생성하고, 코기를 따라가는 부드러운 횡스크롤 카메라와 일부 시드 기반 랜덤 함정을 포함한 공통 스테이지 실행기를 만든다.

## Decision Summary

- 25개 스테이지는 Scene 코드를 복사하지 않고 데이터로 생성한다.
- 카메라는 코기를 따라가지만 화면 밖 공격·함정은 허용한다. 카메라 연출과 physics trigger를 분리한다.

## Implementation

### I01. StageBuilder와 StageScene

- Related Files:
  - src/game/scenes/StageScene.ts :: StageScene — new
  - src/game/stages/StageBuilder.ts :: StageBuilder — new
  - src/game/stages/StageRuntime.ts :: StageRuntime — new
  - src/game/stages/StageEntityFactory.ts :: StageEntityFactory — new

#### Details

- **Signatures & Types**:
  ~~~typescript
  export class StageBuilder {
    build(scene: Phaser.Scene, definition: StageDefinition, seed: number): StageRuntime;
  }

  export class StageRuntime {
    readonly definition: StageDefinition;
    readonly runtimeState: RuntimeStageState;
    start(): void;
    restart(): void;
    complete(): void;
    destroy(): void;
  }
  ~~~
- StageEntityFactory는 platform/trap/enemy/coin/collectible/checkpoint 종류를 discriminated union으로 switch하고, 알 수 없는 kind는 즉시 오류로 처리한다.
- StageScene은 stage enter, play, paused, cutscene, dying, completed 상태를 명시적으로 관리한다.
- 플레이어가 출구 trigger에 도달하면 current-stage coins를 banked coins로 commit하고 다음 linear stage로 이동한다.

### I02. 카메라와 시드 랜덤

- Related Files:
  - src/game/camera/CameraDirector.ts :: CameraDirector — new
  - src/game/random/StageRandom.ts :: StageRandom — new

#### Details

- 카메라는 startFollow(player, true, 0.08, 0.08) 수준의 lerp를 사용하고, stage bounds를 definition의 mapWidth/mapHeight로 설정한다.
- intro/cutscene에서는 follow를 일시 해제하고 pan, zoom, fade, shake를 timeline이 제어한다.
- StageRandom은 hash(stageId + ":" + attempt)로 seed를 만든다. 고정 trap은 RNG를 읽지 않으며, randomized trap만 pick, chance, delay를 사용한다.

### I03. 스테이지 이벤트 경계

- Related Files:
  - src/game/stages/stageEvents.ts :: stage event names — new
  - src/game/bridge/GameEventBus.ts :: GameEventBus — new

#### Details

- Phaser runtime이 React UI에 직접 setState하지 않도록 GameEventBus에서 stage-started, coin-changed, death, checkpoint-activated, stage-completed, cutscene-requested, shop-requested 이벤트를 발행한다.
- 이벤트 payload는 domain types를 사용하고, component unmount 시 listener를 해제한다.

## Acceptance Criteria

- [ ] 하나의 StageDefinition으로 플레이어·지형·함정·적·코인·수집품·출구가 생성된다.
- [ ] 카메라가 코기를 부드럽게 따라가고 stage bounds를 벗어나지 않는다.
- [ ] 고정 함정과 랜덤 함정이 seed 규칙대로 동작한다.
- [ ] StageScene이 enter/play/pause/cutscene/death/complete 상태를 잘못 전이하지 않는다.
- [ ] Phaser와 React 사이의 게임 이벤트가 typed event bus를 통해 전달된다.

## Validation

## Acceptance Verification

- [x] One StageDefinition builds platforms, traps, enemies, coins, collectibles, checkpoint, and exit entities.
- [x] CameraDirector follows the player with lerp and stage bounds.
- [x] Fixed traps skip RNG; randomized traps use StageRandom for attempt-seeded offsets.
- [x] StageRuntime guards enter/play/pause/cutscene/dying/completed status transitions.
- [x] GameEventBus exposes typed stage lifecycle, coin, death, checkpoint, cutscene, and shop events.

- npm run lint — StageScene/Factory/EventBus 타입 통과
- npm run build — StageScene production build 통과
- npm run dev — 샘플 stage를 로드해 camera follow·seed retry·stage complete 확인

## Commit Message

~~~text
feat(stage): add data-driven stage runtime and camera director

Plan: 2026-09-21-legendary-rib-corgi
Phase: P02-core-gameplay
Task: T04-stage-runtime

- Build stages from typed definitions and seeded hazards
- Add camera follow, cutscene control and game event bridge
~~~

## Progress

- [x] 구현 완료
- [x] 검증 통과: lint, build, dev server HTTP 200
- commit: pending

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
