# Task: T02 삼색이 보스전 전체 화면과 타일 지형

## Status: pending

> 2026-10-12 별도 요청으로 기존 일반 맵 타일을 보스전 바닥에 적용했다. `StageScene.createBossGround`가 현재 아레나1920px/발판 윗면y504를 유지하며 런타임 타일 지형을 만든다. [검증 기록](../../../test-plans/2026-10-12-boss-ground-and-audio.md) 참조. 이 청사진의 1280px 아레나·배경 단일화·전용 Tiled 파일은 아직 미완료이므로 Task는 pending을 유지한다. 이후 전용 맵을 연결할 때 기존 런타임 지형과 충돌체를 중복 생성하지 않는다.

## Goal

삼색이 전투의 맵 너비를 게임 화면과 같은 1280px로 맞추고, 보스전에서 배경 이미지는 한 장만 그린다. 전용 Tiled 맵의 픽셀 타일 지형으로 기존 단색 직사각형 발판을 대체한다.

## Decision Summary

- 적용 범위는 `world-01-stage-boss` 하나다. 일반 맵의 원근 배경과 다른 월드의 보스 맵은 유지한다.
- 보스 월드·카메라 경계 1280×720, 바닥 윗면 y512, 코기 x208/발 y512, 삼색이 중심 x944/y464를 기준으로 한다.
- 기존 보스 공격·승리·패배 로직과 `world-01-stage-4-checkpoint` 재시도 ID는 유지한다.

## Implementation

### I01. 보스 메타데이터와 필수 맵 등록

- Related Files:
  - `src/game/core/constants.ts` :: `WORLD01_BOSS_MAP_WIDTH`; modify
  - `src/game/data/world01Maps.ts` :: `WORLD01_BOSS_MAP: StageMapDefinition`; modify
  - `src/game/data/worlds.ts` :: `createBossStage`, `createStageMap`; modify
  - `src/game/assets/assetManifest.json` :: `world-01-stage-boss-map` 필수 tilemap 항목; modify

#### Details

- **Signatures & Types**: `WORLD01_BOSS_MAP_WIDTH: number = 1280`; `WORLD01_BOSS_MAP: StageMapDefinition`. 일반 보스 상수 `BOSS_MAP_WIDTH=1920`은 월드 2~5를 위해 유지한다.
- **Data & Schema Fields**: `WORLD01_BOSS_MAP`은 `mapKey="world-01-stage-boss-map"`, `mapFile="/assets/pixel/maps/world-01/world-01-stage-boss.json"`, `tileWidth=tileHeight=16`, `mapWidth=1280`, `mapHeight=720`, `sections=[]`, `layers=월드 1 테마 layers`, `gimmicks=[]`, `chainRules=[]`. `objectDefinitions`에는 ID `world-01-stage-boss-exit`, kind `exit`, x1168/y384/width32/height128, `layerId="world-01-gameplay"`, `collision=false` 한 개만 둔다. 보스 맵 검증은 출구 정확히 한 개, 체크포인트 0개를 요구한다.
- **Execution Flow / Logic**:
  1. `createBossStage`는 월드 1일 때만 새 맵을 사용해 `StageDefinition.mapWidth=1280`, `spawn={x:208,y:512}`, 보스 세그먼트 길이 1280을 설정한다. 다른 월드의 mapWidth/spawn/맵 파일 경로는 그대로 둔다.
  2. `assetManifest.json`에 `kind="tilemap"`, `key="world-01-stage-boss-map"`, URL 위 경로, tile 16×16, `worldId="world-01"`, `required=true`를 등록한다.
  3. `StageScene`에서 월드 1 보스 맵의 `TiledMapLoader.load`가 `null`이면 명시적인 오류를 내어 단색 플랫폼 fallback이 다시 보이지 않게 한다. 나머지 스테이지의 기존 fallback 정책은 유지한다.
- **Failure/State**: 일반 월드에서 공유 `createStageMap`의 `BOSS_MAP_WIDTH` 값을 통째로 1280으로 바꾸지 않는다. 보스 출구의 겹침은 기존 `StageScene`에서 무시하므로 승리는 삼색이 체력 0을 통해서만 발생한다.

### I02. 바닥 전체를 채우는 보스 Tiled 파일

- Related Files:
  - `scripts/world01-maps.mjs` :: 보스 맵 생성 및 `--check` 경로; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-boss.json` :: 신규 Tiled 맵; new
  - `public/assets/pixel/tiles/world-01/world-01-tileset.svg` :: 기존 타일의 gid 확인; read-only

#### Details

- **Data & Schema Fields**: 보스 JSON은 `width=80`, `height=45`, 타일 크기 16. 네 tilelayer 이름·ID는 `world-01-background-far`(1), `world-01-background-mid`(2), `world-01-gameplay`(3), `world-01-foreground`(4). 두 objectgroup 이름·ID는 `gimmicks`(5, 빈 배열), `entities`(6, 출구 한 개). 기존 월드 1 tileset 설정(12열, 108타일, SVG 경로)을 사용한다.
- **Tile layout**: gameplay 행 0~31은 0(빈 공간). 행 32는 열 전체를 포장 윗면 gid11/12 교대로 채운다. 행 33은 벽돌 gid37/49를 2열마다 교대해 테두리 층을 만든다. 행 34~44는 gid13/37/49를 행·열마다 반복해 깊이가 있는 포장/벽돌 단면을 표현한다. 전체 80열이 이어지고 구멍이나 가장자리 16px 누락이 없어야 한다. gid11/12는 기존 SVG 윗줄의 일반 포장 타일이며 gid1은 맨홀 그림이라 윗면에 사용하지 않는다.
- **Execution Flow / Logic**: 스크립트의 TypeScript 로드 지점에서 `WORLD01_BOSS_MAP`을 함께 가져온다. 기존 `makeMap(stageNumber, definition)`은 일반 스테이지 4개에 유지하고, 별도 `makeBossMap(definition: StageMapDefinition)`/`verifyBossMap(definition, tiledMap)`에 해당하는 보스 생성·검사 경로를 추가한다. `run()`은 일반 맵 4개 뒤에 `world-01-stage-boss.json`을 생성하거나 `--check`에서 읽는다. 검사 항목은 JSON 크기, 레이어, 바닥의 모든 열·행 32~44, 출구 object ID/위치/속성, 실제 생성 결과와의 일치다. 맵 생성 명령 한 번으로 일반 4개와 보스 1개가 준비되게 한다.
- **Failure/State**: gameplay의 빈 행에는 충돌 타일을 놓지 않는다. Phaser `TiledMapLoader`는 gameplay의 모든 비어 있지 않은 타일에 충돌을 설정하므로 장식 타일을 머리 위에 놓으면 이동이 막힌다. 지형 위 장식이 필요하면 충돌하지 않는 레이어에서만 사용한다.

### I03. 보스 배경·카메라·전투 경계 정렬

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`의 배경 분기, 보스 스프라이트 위치, 인트로 줌, shutdown; modify
  - `src/game/systems/World01CalicoBoss.ts` :: `updateFishbone` 맵 경계 검사; modify
  - `src/game/maps/ParallaxRenderer.ts` :: 기존 일반맵 렌더러 동작 확인; read-only
  - `src/game/camera/CameraDirector.ts` :: 카메라 bounds와 컷신 줌 동작 확인; read-only

#### Details

- **Signatures & Types**: `StageScene`에 보스용 `Phaser.GameObjects.TileSprite | undefined` 필드를 둘 수 있다. 보스가 아닌 장면은 기존 `ParallaxRenderer.render(theme,stage.mapWidth,stage.mapHeight)` 경로를 따른다.
- **Execution Flow / Logic**:
  1. `stageBackdrop`의 월드 크기는 stageWidth ×720으로 유지한다. 보스 분기에서는 `ParallaxRenderer.render`를 호출하지 않고 `world-01-background-far` 이미지만 사용한다. 2172×724 원본에서 1280×720 중앙 영역을 잘라 쓰도록 1280×720 `TileSprite`를 원점(0,0), depth -30, scroll factor 0, `tilePositionX=446`으로 설정한다. 다른 배경 이미지/원근 레이어의 보스 렌더링은 없다.
  2. 삼색이 스프라이트를 `(944,464)`로 옮겨 바닥 y512에 맞춘다. 인트로에서 수동 `setZoom(0.8)`을 제거한다. 카메라 1280×720과 맵 bounds가 같으므로 일반 플레이에서 scroll x=0, zoom=1이다. 컷신의 기존 확대(zoom≥1)는 배경 밖을 보이지 않게 한다.
  3. `World01CalicoBoss.updateFishbone`의 `current.x > 1920` 고정값을 `scene.physics.world.bounds.right` 또는 동일한 stage width로 바꾼다. 좌우 화면 밖 발사체 정리와 피격 판정이 새 arena에 맞는다.
  4. 씬 종료 시 보스 배경 객체를 파괴한다. 기존 일반맵 renderer와 loadedMap 정리 순서에 중복 생성·잔존 이미지가 없어야 한다.
- **Failure/State**: 전용 맵이 로드되지 않으면 이미지를 그려 겉으로만 정상처럼 보이게 하지 않는다. 보스 스프라이트와 체력바/예고 문구 위치는 모두 새 x에 따라 화면 안에 있어야 한다.

## Acceptance Criteria

- [ ] 보스 전용 Tiled 맵이 필수 에셋으로 로드되고 gameplay 바닥이 y512부터 화면 아래까지 전 폭을 채운다.
- [ ] 게임의 16:9 화면 안에 배경의 빈 띠·중복 건물·잘린 지형이 없고 코기와 삼색이가 동시에 보인다. 인트로·재시도·승리 화면 전환에도 유지된다.
- [ ] 월드 1 보스에만 완성된 낮 배경 한 장이 보이고, 일반 월드 1 맵의 여러 배경 및 월드 2~5 보스 설정은 유지된다.
- [ ] 발사체가 1280px arena 밖에서 정리되고 J 공격·피격·재시도·승리 흐름이 계속 동작한다.

## Validation

- `npm run world01:maps` → 보스 JSON 포함 5개 Tiled 파일 생성.
- `npm run world01:maps:check` → 보스맵 크기·타일·오브젝트 검사 통과.
- `npx tsc --noEmit` → 타입 오류 없음.
- `npm run lint` → 린트 오류 없음.
- `npm run build` → 필수 에셋 경로와 번들 확인.
- `npm run dev` → 데스크톱 16:9 및 모바일 게임 프레임에서 보스 최초 인트로, 재도전, 삼색이 피격, 승리 수동 확인. 바닥 좌우 끝·하단 및 배경의 반복/겹침을 직접 확인.

## Commit Message

```text
feat(world01): build full-frame calico arena with tiled ground

Plan: 2026-10-01-world01-compact-scenes
Phase: P01-world01-map-and-hud
Task: T02-boss-arena-and-background

- Add a required 1280 by 720 boss tilemap and full-depth ground
- Render one centered day backdrop and align the camera, actors, and projectiles
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
