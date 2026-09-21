# Task: T01 맵 도메인 스키마와 레지스트리

## Status: done

## Goal

기존 StageDefinition의 generic segment 데이터가 월드 테마, 16px Tiled 맵, 5개 구간, 오브젝트 속성, 연쇄 기믹을 표현할 수 있도록 타입과 콘텐츠 레지스트리를 확장한다. 이 Task에서는 실제 월드 맵 파일을 렌더링하지 않고, 이후 Task가 사용할 컴파일 가능한 계약과 검증 규칙을 만든다.

## Decision Summary

- 일반 스테이지는 3,840px, 5개 구간이며 진입·탈출은 각각 5%인 192px이다.
- 기본 타일은 16×16px이고 월드별 공용 타일셋과 스테이지별 Tiled 맵을 사용한다.
- 함정과 오브젝트는 Tiled 속성에서 trapId, variant, chainId, seedGroup을 읽는다.
- 기존 segments 필드는 후속 이행이 끝날 때까지 호환용으로 남기고, 신규 map 메타데이터를 우선 사용한다.

## Implementation

### I01. 맵 도메인 타입 정의

- Related Files:
  - src/game/core/contentTypes.ts :: StageDefinition 주변의 콘텐츠 타입; modify
  - src/game/core/types.ts :: StageDefinition과 RuntimeStageState; modify
  - src/game/core/runtimeTypes.ts :: CheckpointSnapshot; modify
  - src/game/data/worldMaps.ts :: 월드 테마 레지스트리; new

#### Details

- 다음 유니온을 추가한다.
  - MapSectionRole: safe-entry, gauntlet, checkpoint-gauntlet, safe-exit
  - MapLayerKind: background-far, background-mid, gameplay, foreground
  - MapObjectKind: decoration, interactive, trap, enemy-spawn, checkpoint, collectible, exit
  - MapChainTrigger: object-enter, object-hit, trap-triggered, enemy-defeated, checkpoint-reached, timer, chain-fired
  - MapChainAction: activate-object, deactivate-object, move-object, spawn-enemy, set-collision, emit-event, camera-effect

- MapSectionDefinition 필드는 다음을 사용한다.
  - id: string
  - index: 1 | 2 | 3 | 4 | 5
  - role: MapSectionRole
  - x: number
  - width: number
  - safe: boolean
  - vertical: boolean
  - checkpointId?: string
  - mapObjectIds: readonly string[]

- MapLayerDefinition 필드는 layerId, kind, depth, scrollFactorX, scrollFactorY, assetKey를 가진다.
- MapObjectDefinition 필드는 id, kind, x, y, width, height, visualKey, layerId, collision, triggerId?, variantPool?, chainId?, seedGroup?, properties를 가진다. properties 값은 string, number, boolean의 Record만 허용한다.
- MapChainRule 필드는 id, trigger, sourceId?, condition?, actions, randomized를 가진다. actions는 순서가 있는 MapChainActionDefinition 배열이며 각 action은 targetId?, value?, delayMs?를 가진다.
- WorldMapThemeDefinition 필드는 id, worldId, tilesetKey, palette, layers, objectVisualKeys, hazardCatalog를 가진다.
- StageMapDefinition 필드는 mapKey, mapFile, tileWidth, tileHeight, mapWidth, mapHeight, sections, layers, objectDefinitions를 가진다.

- StageDefinition에 themeId, mapKey, map, checkpointSectionIndex 필드를 추가한다. map은 Tiled 맵이 아직 없는 기존 월드 데이터와의 이행을 위해 초기에는 nullable로 둘 수 있지만, P01-T05 완료 시 모든 캠페인 스테이지에서 필수로 검증한다.
- RuntimeStageState에 checkpointSeed와 mapSnapshotVersion을 추가한다. checkpointSeed는 체크포인트 재시작 때 유지할 현재 도전의 시드를 표현한다.

### I02. 월드 테마 레지스트리와 상수

- Related Files:
  - src/game/data/worldMaps.ts :: WORLD_MAP_THEMES, DEFAULT_STAGE_SECTIONS; new
  - src/game/core/constants.ts :: MAP_TILE_SIZE, NORMAL_MAP_WIDTH, BOSS_MAP_WIDTH; modify
  - src/game/data/index.ts :: CONTENT_REGISTRY와 getter export; modify

#### Details

- MAP_TILE_SIZE는 16, NORMAL_MAP_WIDTH는 3840, NORMAL_MAP_SAFE_LENGTH는 192, BOSS_MAP_WIDTH는 1920으로 정의한다.
- 기본 일반 스테이지 구간은 다음 좌표를 사용한다.
  - section-1: x 0, width 192, role safe-entry, safe true
  - section-2: x 192, width 1152, role gauntlet, safe false
  - section-3: x 1344, width 1152, role gauntlet, safe false
  - section-4: x 2496, width 1152, role checkpoint-gauntlet, safe false, checkpointId 지정
  - section-5: x 3648, width 192, role safe-exit, safe true
- world-01부터 world-05까지의 theme id, 타일셋 키, 4개 레이어 정의, palette 토큰을 등록한다. World 1은 주거지, World 2는 놀이터, World 3은 뒷산, World 4는 고철 아지트, World 5는 캣타워 공성전으로 명시한다.

### I03. 콘텐츠 검증 계약 확장

- Related Files:
  - src/game/data/validateContent.ts :: validateContentRegistry; modify

#### Details

- 월드별 stageIds가 4개 일반 + 1개 보스인지 기존 검증을 유지한다.
- map이 존재하는 StageDefinition은 tileWidth와 tileHeight가 16인지, mapWidth가 일반 3840 또는 보스 1920인지, sections가 5개 일반 또는 보스 전용 아레나 구조인지 검증한다.
- 일반 맵 sections는 정확히 5개이며 첫 구간과 마지막 구간만 safe=true, 중앙 3개는 safe=false여야 한다.
- checkpointSectionIndex는 일반 맵에서 4를 가리키고 checkpointId가 section-4에만 있어야 한다. 보스 맵에는 checkpoint가 없어야 한다.
- section의 x와 width 합이 mapWidth를 이루는지, 겹침·공백·음수 크기가 없는지 검증한다.

## Acceptance Criteria

- [ ] 신규 맵 타입과 StageDefinition 확장이 strict TypeScript에서 컴파일된다.
- [ ] World 1~5 테마와 16px·3,840px·192px 상수가 레지스트리에서 조회된다.
- [ ] 일반 스테이지의 5개 기본 구간 좌표와 보스 checkpoint 없음 규칙이 검증된다.
- [ ] 기존 generic segments를 아직 사용하는 데이터도 P01-T02 이전까지 깨지지 않는다.

## Validation

- npm run lint
- npm run build
- 데이터 레지스트리 import 시 validateContentRegistry가 예외 없이 통과하는지 확인

## Commit Message

feat(map): define world map domain schema

Plan: 2026-09-21-world-map-design
Phase: P01-map-foundation-runtime
Task: T01-map-domain-schema

- Add map sections, themes, layers, objects, and chain rule types
- Register 16px world map constants and validate section contracts

## Progress

- [x] 구현 완료
- [x] 검증 통과: npm.cmd run lint, npm.cmd run build
- commit: pending
