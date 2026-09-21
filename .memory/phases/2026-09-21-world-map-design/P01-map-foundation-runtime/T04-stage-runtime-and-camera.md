# Task: T04 5구간 StageRuntime과 왼쪽 편향 카메라

## Status: pending

## Goal

StageScene이 신규 StageMapDefinition을 우선 사용하도록 이행하고, 일반 스테이지의 5개 구간·체크포인트·출구·보스 아레나를 런타임에 정확히 배치한다. 플레이어는 화면 왼쪽 25%에 머물고 수직 구간에서만 상하 추적이 활성화되도록 CameraDirector를 확장한다.

## Decision Summary

- 일반 맵은 3,840×720을 기본으로 하고 수직 세트피스가 있는 맵은 높이 1,152까지 허용한다.
- 일반 구간은 192 / 1152 / 1152 / 1152 / 192px이며 checkpoint는 section 3과 4 사이에 있다.
- 보스 맵은 1,920px 전용 아레나이며 checkpoint가 없다.
- 기본 진행은 좌→우 단방향이고 선택형 수집품 루트에서만 짧은 되돌아가기를 허용한다.

## Implementation

### I01. StageRuntime 맵 이행

- Related Files:
  - src/game/stages/StageRuntime.ts :: build, restart, complete; modify
  - src/game/stages/StageBuilder.ts :: build; modify
  - src/game/scenes/StageScene.ts :: create, update; modify
  - src/game/stages/StageEntityFactory.ts :: tilemap collision and exit registration; modify

#### Details

- StageRuntime.build()는 definition.map이 있으면 Tiled loaded map과 sections를 사용하고, 없을 때만 기존 segments fallback을 사용한다.
- 일반 맵의 section roles와 x/width는 StageMapDefinition에서 읽고, trap과 enemy spawn은 section offset을 중복 적용하지 않도록 한 번만 월드 좌표로 변환한다.
- checkpoint entity는 section-4 시작 경계 x=2496 부근에 한 개만 만든다. exit entity는 mapWidth-96으로 만들고 safe-exit 구간에 배치한다.
- boss stage에는 checkpoint entity를 만들지 않고, 세 구역 진입·전투·마무리 object layer를 유지한다.
- StageScene은 map runtime, collision layer, map interaction system, existing PlayerController를 같은 scene lifecycle에 연결한다.

### I02. 카메라 위치·수직 추적

- Related Files:
  - src/game/camera/CameraDirector.ts :: followPlayer, setSectionMode; modify
  - src/game/scenes/StageScene.ts :: section transition hook; modify
  - src/game/config.ts :: GAME_WIDTH, GAME_HEIGHT; read-only

#### Details

- zoom 1 기준 player의 화면 x를 320px, 즉 1280 화면의 왼쪽 25%에 두도록 follow offset을 설정한다.
- 수평 구간에서는 horizontal follow만 활성화하고, mapHeight가 GAME_HEIGHT보다 클 때 section.vertical=true인 구간에서만 vertical follow를 활성화한다.
- camera bounds는 mapWidth와 mapHeight를 사용하며 시작·끝 경계에서 플레이어가 화면 밖으로 밀리지 않는다.
- 대형 함정·보스 등장·환경 붕괴 이벤트는 CameraDirector.shake, playCutscene 또는 zoom API를 통해 제한적으로 호출한다.
- foreground 렌더링은 camera follow와 독립적으로 동작하며, debug mode에서 player screen x와 current section을 표시한다.

### I03. 단방향 진행과 안전 구간 보호

- Related Files:
  - src/game/systems/RestartController.ts :: stage movement reset; modify
  - src/game/data/validateMaps.ts :: safe section checks; created in T05
  - src/game/stages/StageRuntime.ts :: exit and section state; modify

#### Details

- stage runtime은 기본적으로 exit를 향한 진행을 기준으로 하되 좌우 입력 자체를 금지하지 않는다.
- 수집품용 보조 루트는 optional object group으로 표시하고 main exit path에는 영향을 주지 않는다.
- safe-entry와 safe-exit 구간에는 lethal trap, forced movement, blocking chain을 등록하지 못하도록 런타임과 validator 양쪽에서 검사한다.

## Acceptance Criteria

- [ ] 신규 map metadata가 있는 일반 스테이지는 5개 구간과 한 개 checkpoint로 생성된다.
- [ ] 일반 mapWidth는 3,840, 보스 mapWidth는 1,920이고 exit가 올바른 구간에 생성된다.
- [ ] 플레이어가 화면 x 약 320px에 유지되고 vertical section에서만 y follow가 움직인다.
- [ ] checkpoint restart와 stage restart가 T03의 seed·snapshot 계약을 따른다.
- [ ] 기존 fallback stage도 StageScene에서 계속 실행된다.

## Validation

- npm run lint
- npm run build
- 샘플 3,840px 맵에서 카메라 경계·checkpoint·exit까지 이동
- 높이 1,152px 수직 샘플에서 vertical follow와 foreground layer를 확인

## Commit Message

feat(map): integrate five-section stage runtime and camera

Plan: 2026-09-21-world-map-design
Phase: P01-map-foundation-runtime
Task: T04-stage-runtime-and-camera

- Run Tiled section maps with checkpoint and exit placement
- Add left-biased camera following and vertical set-piece tracking

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
