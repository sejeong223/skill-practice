# Task: T02 Tiled 맵 로더와 패럴랙스 렌더링

## Status: pending

## Goal

Tiled JSON 맵과 월드별 16px 타일셋을 Phaser에서 로드하고, 먼 배경·중경·게임플레이·전경의 4개 레이어를 실제 StageScene에 그린다. 정적 타일과 상호작용 오브젝트의 위치를 런타임 스키마로 변환하되, 아직 맵 에셋이 없는 스테이지는 P01-T01 호환 데이터를 사용할 수 있게 한다.

## Decision Summary

- 월드별 공용 타일셋 1개와 스테이지별 Tiled 맵 파일을 사용한다.
- 전경은 플레이어와 함정을 가릴 수 있지만 충돌 판정은 렌더링과 분리한다.
- 16×16 타일을 기준으로 하고, 픽셀 아트 렌더링과 roundPixels를 유지한다.

## Implementation

### I01. 타일맵 에셋 매니페스트 확장

- Related Files:
  - src/game/assets/assetTypes.ts :: AssetKind, PixelAssetDefinition; modify
  - src/game/assets/assetManifest.json :: world tilesets, backgrounds, map JSON entries; modify
  - src/game/assets/assetManifest.ts :: PIXEL_ASSETS; modify
  - src/game/scenes/PreloadScene.ts :: loadAsset; modify

#### Details

- AssetKind에 tilemap과 tileset image를 구분할 수 있는 값 또는 tilemap metadata 필드를 추가한다.
- 필수 에셋과 월드 맵 에셋을 분리한다. 초기 로딩 실패 시 필수 캐릭터 에셋 실패만 기존 loadError로 처리하고, 선택 맵 에셋 오류는 stage map error event로 전달한다.
- 파일 경로 규칙은 다음을 사용한다.
  - public/assets/pixel/tiles/world-01/world-01-tileset.png
  - public/assets/pixel/maps/world-01/world-01-stage-1.json
  - public/assets/pixel/backgrounds/world-01/world-01-far.png
- map manifest entry는 key, kind, url, worldId, required, tileWidth=16, tileHeight=16을 가진다.

### I02. Tiled 맵 로더

- Related Files:
  - src/game/maps/TiledMapLoader.ts :: TiledMapLoader; new
  - src/game/maps/mapTypes.ts :: LoadedMap, LoadedMapObject; new
  - src/game/stages/StageBuilder.ts :: build; modify
  - src/game/stages/StageRuntime.ts :: map load hook; modify

#### Details

- TiledMapLoader.load(scene, definition, theme) 시그니처는 LoadedMap을 반환한다.
- Phaser의 tilemap layer 이름과 Tiled custom properties를 다음 규칙으로 해석한다.
  - background-far, background-mid, gameplay, foreground는 MapLayerKind와 매핑
  - Object layer의 x, y, width, height는 16px grid 기준을 유지
  - boolean, number, string 속성은 MapObjectDefinition.properties로 보존
  - trapId, variant, chainId, seedGroup, visualKey, collision, verticalFollow를 예약 속성으로 처리
- gameplay 타일 레이어만 플랫폼 충돌에 등록한다. foreground와 background는 충돌을 만들지 않는다.
- mapFile이 없거나 로드되지 않은 경우 기존 StageSegment 생성기를 사용하고 stage-map-fallback 이벤트를 emit한다.

### I03. 패럴랙스 레이어 렌더러

- Related Files:
  - src/game/maps/ParallaxRenderer.ts :: ParallaxRenderer; new
  - src/game/scenes/StageScene.ts :: create and shutdown; modify
  - src/game/config.ts :: pixel rendering constants; read-only unless required

#### Details

- 레이어별 scrollFactor는 worldMaps.ts 정의를 사용한다.
  - background-far: 0.15
  - background-mid: 0.35
  - gameplay: 1
  - foreground: 1.05
- foreground는 gameplay보다 높은 depth에 그리며, object collision body를 생성하지 않는다.
- 렌더러는 stage shutdown 시 모든 tilemap layer와 texture reference를 정리한다.
- 전경 가림은 허용하되 player와 trap의 physics body를 별도 표시할 수 있는 debug flag를 제공한다.

## Acceptance Criteria

- [ ] 16px 타일셋과 Tiled JSON이 PreloadScene에서 로드된다.
- [ ] 네 레이어가 지정된 scrollFactor와 depth로 렌더링된다.
- [ ] gameplay 레이어만 플랫폼 충돌을 만들고 foreground는 시각적 가림만 수행한다.
- [ ] Tiled object properties가 LoadedMapObject로 보존된다.
- [ ] 맵 에셋이 없는 기존 스테이지는 fallback으로 실행된다.

## Validation

- npm run lint
- npm run build
- 개발 서버에서 샘플 Tiled 맵을 StageScene으로 실행해 네 레이어의 이동 속도와 전경 가림 확인

## Commit Message

feat(map): load tiled maps and parallax layers

Plan: 2026-09-21-world-map-design
Phase: P01-map-foundation-runtime
Task: T02-tiled-map-rendering

- Load shared world tilesets and stage map JSON
- Render four parallax layers with separate collision ownership

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
