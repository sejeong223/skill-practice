# Task: T02 구역별 중경과 고등어 보스 배경

## Status: pending

## Goal

월드 3의 네 일반 스테이지가 각각 다른 공사장 시설을 보여 주고, 고등어 보스 아레나도 정상적인 오후 하늘·중경·바닥을 갖도록 이미지와 레이어 선택을 연결한다.

## Decision Summary

- T01 완료 후 `world-03-far.png`·`world-03-foreground.png`는 1672×941, 바닥은 128×216이며 오후 3~4시의 파란 하늘·따뜻한 햇빛 팔레트가 기준이다. 월드 1·2 이미지는 참고만 한다.
- 기존 `getWorld03StageTheme`는 stage 1~4에만 `world-03-background-mid-{1..4}`를 고른다. 보스는 manifest에 없는 기본 `world-03-background-mid`로 폴백해 단색 사각형이 보이는 문제가 있다. 보스 중경 키를 별도 추가한다.
- `src/game/data/worlds.ts::createStageMap`은 현재 월드 2 테마 변환만 호출한다. 런타임 `StageScene.create`의 월드 3 중경 선택과 맵 정의의 레이어 키를 일치시킨다. 지형·충돌·보스 AI는 수정하지 않는다.

## Implementation

### I01. 스테이지별 공사장 중경 4장과 보스 중경 1장 제작

- Related Files:
  - `public/assets/pixel/backgrounds/world-03/world-03-mid-1.png` :: `world-03-background-mid-1` — 진입로; modify
  - `public/assets/pixel/backgrounds/world-03/world-03-mid-2.png` :: `world-03-background-mid-2` — 레미콘 구역; modify
  - `public/assets/pixel/backgrounds/world-03/world-03-mid-3.png` :: `world-03-background-mid-3` — 비계 통로; modify
  - `public/assets/pixel/backgrounds/world-03/world-03-mid-4.png` :: `world-03-background-mid-4` — 자재 야적장; modify
  - `public/assets/pixel/backgrounds/world-03/world-03-mid-boss.png` :: `world-03-background-mid-boss` — 감독실 보스 아레나; new
  - `public/assets/pixel/backgrounds/world-01/world-01-mid.png`, `public/assets/pixel/backgrounds/world-02/world-02-mid.png`, `world-02-mid-stage-2.png`, `world-02-mid-stage-3.png` — 색·디테일·무대별 랜드마크 비교; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type World03MidAssetKey =
    | "world-03-background-mid-1"
    | "world-03-background-mid-2"
    | "world-03-background-mid-3"
    | "world-03-background-mid-4"
    | "world-03-background-mid-boss";
  ```
- **Data & Schema Fields**:
  - 다섯 장 모두 1672×941 RGBA 투명 PNG. 하늘 영역은 투명해 T01 원경이 보인다. 구조물은 주로 소스 y≈390~610(화면 y≈298~467)에 놓고, 코기 머리와 코인·장애물이 있는 화면 y≈370~505에 닿는 요소는 저채도/낮은 대비로 처리한다. 화면 기준 지면 접점은 y≈450~475에 맞추고 T01의 충돌 바닥 상단 y=504를 넘는 가짜 보행면을 그리지 않는다.
  - stage 1 `공사장 진입로`: 현장 출입 펜스, 멀리 선 타워크레인, 표지와 진입 도로. 기존처럼 단순 T자 크레인 두 개만 반복하지 않는다.
  - stage 2 `레미콘 구역`: 레미콘 차 실루엣, 배합 설비, 굳지 않은 콘크리트 작업 구획. 실제 점프 장애물과 혼동되는 전경 콘/시멘트 포대를 배경에 크게 그리지 않는다.
  - stage 3 `비계 통로`: 높이 차 있는 비계, 안전망, 사다리·철골이 보이되 배경 구조물은 플레이 가능한 플랫폼처럼 읽히지 않게 낮은 대비·깊이 처리한다.
  - stage 4 `자재 야적장`: 철근 묶음, 자재 팔레트, 운반 장비, 보스 구역 방향의 감독실 실루엣. 네 구역의 물체 배치와 실루엣을 분명히 구별한다.
  - boss `공사장 감독실`: 닫힌 작업장/감독실과 멀리 보이는 크레인으로 장소를 이어 주되 플레이어 x≈160와 보스 x≈1280 주변은 복잡한 색 면과 고대비 철골로 채우지 않는다. 월드 3의 같은 오후 하늘·빛 방향 유지.
  - 그림은 월드 1·2처럼 두께가 일정한 픽셀 윤곽, 넓은 색 면, 세부 구조와 그림자 레이어를 가진다. 사진 질감·흐린 확대·읽기 어려운 글자·해질녘 오렌지 하늘을 금지한다. 좌우 반복 경계는 수동 보정한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01 공통 원경·바닥을 기준으로 한 장씩 겹쳐 1280×720 화면 구도를 검토한다. 이미지 생성 도구로 각 구역을 별도로 만든 뒤 픽셀 정확한 크기·알파·좌우 경계를 정리한다. 구현 전 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`를 읽는다.
  2. Core Processing: 기존 네 파일을 교체하고 보스 파일을 새로 저장한다. 동일한 하늘 투명 영역·조명 방향·바닥 접점을 사용한다.
  3. Error & Exception Handling: PNG에 불투명 검은 하늘이 남거나 반복 경계가 벌어지면 배경 전체를 깔지 말고 알파와 좌우 가장자리만 수정해 원경을 유지한다.
  4. State Transition & Return: 다섯 무대가 서로 구별되고 원경과 접합된다.

### I02. 중경 라우팅·보스 지면 연결

- Related Files:
  - `src/game/data/worldMaps.ts` :: `getWorld03StageTheme` — 보스 중경 분기; modify
  - `src/game/data/worlds.ts` :: `createStageMap` — 정의의 레이어 키에 월드 3 변환 적용; modify
  - `src/game/assets/assetManifest.json` :: `world-03-background-mid-boss` 엔트리; modify
  - `src/game/scenes/StageScene.ts` :: `create`, `createWorld03ConstructionFloor` — 보스 지면 시각화·기존 미커밋 변경 보존; modify
  - `src/game/maps/ParallaxRenderer.ts` :: `render`, `createLayer` — 기존 깊이/타일 스케일 확인; read-only
  - `src/game/data/world03Construction.ts` :: `getWorld03Obstacles` — 좌표·충돌 불변 확인; read-only
  - `scripts/world03-background-routing.test.mjs` :: stage/boss 레이어 경로와 지면 조건; new
  - `scripts/world03-visual-assets.test.mjs` :: T01 PNG 계약에 중경 다섯 장 추가; modify

#### Details

- **Signatures & Types**:
  ```typescript
  getWorld03StageTheme(stageId: StageId, base: WorldMapThemeDefinition): WorldMapThemeDefinition
  createStageMap(stageId: StageId, worldId: WorldId, isBoss: boolean): StageMapDefinition
  StageScene.createWorld03ConstructionFloor(stage: StageDefinition): void
  ```
- **Data & Schema Fields**:
  - manifest 신규 항목: `{ key: "world-03-background-mid-boss", kind: "image", url: "/assets/pixel/backgrounds/world-03/world-03-mid-boss.png", worldId: "world-03", required: true }`.
  - `getWorld03StageTheme`: stage 1~4는 같은 번호 키, `world-03-stage-boss`는 boss 키, 그 외 월드는 `base`를 그대로 반환. 기존 `WorldMapThemeDefinition.layers`의 `kind === "background-mid"` 요소만 복사해 `assetKey`를 바꾸고 다른 레이어/팔레트는 보존한다.
  - `createStageMap`: 현재 `getWorld02StageTheme(stageId, theme).layers` 호출 결과에 `getWorld03StageTheme(stageId, ...)`를 적용한다. 실제 Tiled 맵이 없어도 정의·런타임의 중경 키가 같도록 한다.
  - 바닥: 일반 스테이지는 플랫폼 1개 `left=0,right=3840,top=504`; 보스는 `left=16,right=1904,top=504`다. `StageScene.create`에서 월드 3 stage 1~4 또는 boss이고 `!loadedMap`일 때 `createWorld03ConstructionFloor(stage)` 호출. 메서드는 stage 종류별 예상 bounds를 검증하고, `tileSprite`를 실제 플랫폼 bounds의 `left`~`right`에만 두며 화면 y=499부터 그린다. 충돌 본체나 플레이어/보스 위치는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `StageScene.ts`와 `worlds.ts`는 미커밋 변경이 있으므로 대상 함수 주변 diff를 먼저 확인한다. 현재 boss의 기본 중경 키가 manifest에 없는 점과 플랫폼 bounds를 확인한다.
  2. Core Processing: 다섯 에셋과 manifest를 연결하고 중경 분기를 확장한다. 기존 월드 3 일반 스테이지 색/경로를 보존하면서 boss의 폴백 사각형을 제거한다. 보스 바닥은 기존 일반 바닥 이미지를 재사용한다.
  3. Error & Exception Handling: manifest 누락·오타로 텍스처가 없으면 검증 실패. bounds가 위 값과 다르면 기존 예외가 유지되어 시각 바닥과 충돌 불일치를 조용히 넘기지 않는다.
  4. State Transition & Return: 네 일반 스테이지와 보스가 올바른 레이어 키를 사용한다. 월드 2 라우팅과 보스 패턴은 유지한다.

## Acceptance Criteria

- [ ] 진입로/레미콘/비계/야적장 스크린샷의 주요 랜드마크가 다르며, 다섯 무대 모두 T01의 밝은 오후 하늘이 보인다.
- [ ] 고등어 보스 아레나에 단색 중경 폴백이 없고, 감독실 배경과 플랫폼에 맞는 콘크리트 지면이 보인다.
- [ ] `world-03-stage-1..4`의 장애물·체크포인트·출구와 `world-03-stage-boss`의 플레이어/보스 좌표·패턴은 유지된다.

## Validation

- `node --test scripts/world03-visual-assets.test.mjs scripts/world03-background-routing.test.mjs scripts/world03-construction-stages.test.mjs` — PNG 5장·레이어 키·기존 지형 계약 통과.
- `node scripts/validate-assets.mjs` — 새 boss mid가 `required:true`로 로드 가능.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 통과.
- `node node_modules/eslint/bin/eslint.js src/game/data/worldMaps.ts src/game/data/worlds.ts src/game/scenes/StageScene.ts scripts/world03-background-routing.test.mjs scripts/world03-visual-assets.test.mjs` — 린트 통과.
- `npm.cmd run build` — Next 프로덕션 빌드 통과.
- 실제 1280×720 화면에서 일반 stage 1~4의 시작/중간/출구와 boss 시작/전투 지점을 확인하고 반복 이음새·높은 구조물 가림을 기록.

## Commit Message

```text
feat(월드3): 네 구역과 고등어 보스 공사장 배경 개선

Plan: 2026-10-27-world03-afternoon-construction-art
Phase: P01-world03-visuals
Task: T02-stage-and-boss-backgrounds

- 진입로부터 야적장까지 구분되는 중경과 보스 감독실 아트 제작
- 테마 라우팅과 보스 지면을 연결해 폴백 사각형 제거
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
