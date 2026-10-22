# Task: T01 맵 2·3 배경과 연속 모래 바닥

## Status: done

## Goal

월드 2 맵 2·3을 첫 맵과 같은 모래 놀이터로 실제 플레이 가능하게 만들고, 맵별 놀이기구 중경을 구분한다.

## Decision Summary

- 두 맵 모두 3840px 전체에 단일 충돌 발판을 둔다. 바닥 상단 y=504, 그림 상단 약 y=499, 안전 입구/출구와 체크포인트 x=2496을 첫 맵과 동일하게 사용한다.
- 원경 하늘 `world-02-far.png`, 전경 `world-02-foreground.png`, 바닥 `world-02-sand-floor.png`는 재사용한다. 중경만 맵 2·3용으로 각각 새로 만든다.

## Implementation

### I01. 두 맵의 중경 그림과 에셋

- Related Files:
  - `public/assets/pixel/backgrounds/world-02/world-02-mid-stage-2.png` :: 맵 2 중경; new.
  - `public/assets/pixel/backgrounds/world-02/world-02-mid-stage-3.png` :: 맵 3 중경; new.
  - `src/game/assets/assetManifest.json` :: `world-02-background-mid-stage-2`, `world-02-background-mid-stage-3`; modify, 두 항목 모두 `kind:"image"`, `worldId:"world-02"`, `required:true`.
  - `src/game/data/worldMaps.ts` :: `getWorld02StageTheme(stageId: StageId, base: WorldMapThemeDefinition): WorldMapThemeDefinition`; modify.
  - `src/game/scenes/StageScene.ts` :: `StageScene.create`의 `theme` 선택; modify.
  - `src/game/data/worlds.ts` :: `createStageMap`의 `layers` 선택; modify, 맵 2·3 중경 키와 스테이지 정의가 일치하도록 함.

#### Details

- **Signatures & Types**: `getWorld02StageTheme(stageId: StageId, base: WorldMapThemeDefinition): WorldMapThemeDefinition`은 해당 두 stageId일 때만 `base.layers` 중 `kind === "background-mid"`의 `assetKey`를 각각의 새 키로 복사·교체한다. 그 외 stageId는 입력 테마를 그대로 반환한다. `MapLayerDefinition`의 `depth`, `scrollFactorX/Y`, `layerId`는 바꾸지 않는다.
- **Data & Schema Fields**: PNG 두 장 각각 RGBA 투명 배경, 1672×941px, 기존 `world-02-mid.png`와 같은 지면 접점 약 y=708. 저장 스키마 변경 없음.
- **Execution Flow / Logic**: 현재 `world-02-mid.png`를 실제 참고 이미지로 사용해 맵 2에 나선 미끄럼틀·회전 놀이기구·둥근 등반대, 맵 3에 타이어 그네·구름다리·작은 놀이 터널을 배치한다. 파랑·노랑·청록 프레임, 나무·울타리·가로등·픽셀 질감과 투명 영역의 위치를 맞춘다. `ParallaxRenderer`의 `world-02-` 크기 조정 규칙을 그대로 사용한다. 맵 1 에셋은 수정하지 않는다.
- **Error & Exception Handling**: PNG가 없거나 키가 맞지 않으면 `PreloadScene`의 필수 에셋 오류가 발생하므로 에셋 검사와 실제 장면 캡처를 통과시킨다. 이미지에 불투명한 하늘/모래를 다시 그려 원경을 가리지 않는다.

### I02. 임시 지형을 모래 바닥으로 교체

- Related Files:
  - `src/game/data/worlds.ts` :: `createSegment` — `world-02-stage-1/2/3`은 첫 segment 하나에 `x:1920,y:520,width:3840,height:32` 발판을 두고 나머지 segment 발판은 비움; 이 3개 stage의 임시 `traps`/`enemies` 비움; modify.
  - `src/game/scenes/StageScene.ts` :: `createWorld02SandFloor`, `create`, `StageRuntime` 발판 collider·가시성 조건; modify, 세 stage에서 `!loadedMap`일 때 타일 그림을 생성.
  - `src/game/stages/StageRuntime.ts` :: `addCheckpoint` — 월드 2 맵 1~3의 fallback 체크포인트 y=444; modify.
  - `scripts/world02-sand-floor.test.mjs` :: 세 stage의 단일 연속 발판/임시 위험물 없음/맵 4와 월드 1은 기존 정의; modify.
  - `scripts/world02-stage-backgrounds.test.mjs` :: 새 중경 2장 치수·투명도·필수 키·맵별 테마 선택; new.

#### Details

- **Signatures & Types**: `createSegment(stageId: StageId, segmentNumber: number, isBoss: boolean, length: number): StageSegment` 기존 시그니처 유지. 모래 적용 범위는 `stageId === "world-02-stage-1" || stageId === "world-02-stage-2" || stageId === "world-02-stage-3"`로 명시한다.
- **Data & Schema Fields**: 각 `StageDefinition.segments`는 기존 5개를 유지한다. `platforms`는 첫 segment 1개, 다음 4개는 `[]`; `traps`와 `enemies`는 각 segment `[]`; 코인·collectibles·checkpointIds는 그대로다.
- **Execution Flow / Logic**: `StageRuntime.buildFromSegments()`가 기존처럼 발판·코인·체크포인트·출구를 만든다. `StageScene.createWorld02SandFloor`가 단일 발판의 x범위와 top=504를 확인해 이미지 타일을 깔고, 실제 발판은 보이지 않게 하되 플레이어 충돌은 유지한다. 맵 2·3에는 실제 Tiled JSON을 추가하지 않는다.
- **Error & Exception Handling**: 맵 2·3의 임시 발판 여러 개를 남기면 모래 그림과 충돌 높이가 어긋나므로 단일 발판을 테스트한다. 맵 4·보스전의 현행 placeholder 데이터는 이번 Task에서 변경하지 않는다.

## Acceptance Criteria

- [ ] 맵 2·3에서 지면이 0~3840px까지 끊기지 않고 코기가 출구까지 걸을 수 있다.
- [ ] 맵 2·3의 놀이기구 그림이 맵 1과 구별되며 하늘·모래·그림 레이어가 자연스럽게 이어진다.
- [ ] 코인·체크포인트·출구가 유지되고 기존 임시 함정·적이 두 맵에 나타나지 않는다.

## Validation

- `node --test scripts/world02-sand-floor.test.mjs scripts/world02-stage-backgrounds.test.mjs scripts/world02-bone-coins.test.mjs`
- `node scripts/validate-assets.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`

## Commit Message

```text
feat(world02): 놀이터 맵 2와 3의 배경과 모래 바닥 만들기

Plan: 2026-10-21-world02-three-playground-maps
Phase: P01-three-playgrounds
Task: T01-background-and-floor

- 맵 2·3 놀이기구 중경과 에셋 등록
- 연속 모래 발판과 체크포인트 높이 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
