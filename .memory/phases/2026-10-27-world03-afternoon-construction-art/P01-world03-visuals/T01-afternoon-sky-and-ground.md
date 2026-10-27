# Task: T01 오후 하늘과 공통 공사장 지면

## Status: done

## Goal

월드 3 일반 스테이지 1~4와 보스 아레나에서 공유하는 원경·전경·지면을 월드 1·2와 어울리는 상세 픽셀 아트로 교체해, 실제 화면에서 오후 3~4시의 밝은 공사장이 보이게 한다.

## Decision Summary

- 기준 이미지: `public/assets/pixel/backgrounds/world-01/world-01-far.png`, `world-01-mid.png`, `public/assets/pixel/backgrounds/world-02/world-02-far.png`, `world-02-mid.png`, `world-02-foreground.png`, `public/assets/pixel/tiles/world-02/world-02-sand-floor.png`. 이 파일들은 읽기 전용으로 비교한다.
- 월드 3은 선명한 중오후 파란 하늘·흰 구름·따뜻한 노란 햇빛을 쓴다. 석양 주황/보라 하늘, 야간, 흐린 회색 하늘로 만들지 않는다. 코기와 코인의 시인성을 우선한다.
- 현재 파일은 `world-03-far.png` 960×720, `world-03-foreground.png` 960×720, `world-03-construction-floor.png` 128×216이다. 기존 에셋 키와 URL을 유지해 다른 월드와 저장 상태에 영향을 주지 않는다.

## Implementation

### I01. 원경·전경·바닥 픽셀 이미지 교체

- Related Files:
  - `public/assets/pixel/backgrounds/world-03/world-03-far.png` :: `world-03-background-far` — 공통 원경; modify
  - `public/assets/pixel/backgrounds/world-03/world-03-foreground.png` :: `world-03-foreground` — 공통 전경; modify
  - `public/assets/pixel/tiles/world-03/world-03-construction-floor.png` :: `world-03-construction-floor` — 충돌 바닥 위 시각 레이어; modify
  - `src/game/maps/ParallaxRenderer.ts` :: `ParallaxRenderer.createLayer` — 반복·높이 스케일 계약 확인; read-only
  - `src/game/scenes/StageScene.ts` :: `createWorld03ConstructionFloor` — 바닥 좌표 계약 확인; read-only
  - `src/game/assets/assetManifest.json` :: 기존 세 에셋 키·URL·`required:true` 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 런타임 계약. 이 Task에서 시그니처나 충돌 좌표를 바꾸지 않는다.
  ParallaxRenderer.render(theme: WorldMapThemeDefinition, mapWidth: number, mapHeight: number): readonly Phaser.GameObjects.GameObject[]
  StageScene.createWorld03ConstructionFloor(stage: StageDefinition): void
  ```
- **Data & Schema Fields**:
  - `world-03-far.png`: 1672×941 PNG, 전체 불투명. 상단 0~약 55%는 밝은 파란 하늘과 작은 흰 구름, 하단은 채도·대비를 낮춘 원거리 주택·크레인 실루엣. 3~4시 햇빛은 화면 왼쪽 위에서 들어와 건물 오른쪽에 짧고 따뜻한 그림자를 만든다. 권장 색 기준: 하늘 상단 `#67AEE5`, 지평선 `#B8DDED`, 빛 `#FFE5AC`, 원거리 청회색 `#8AA8B0`.
  - `world-03-foreground.png`: 1672×941 RGBA. 상단 약 0~860px는 투명; 플레이어를 가릴 높은 전경 구조물을 넣지 않는다. 아래쪽에만 작은 안전띠·자갈·철제 가장자리로 깊이를 더한다. 마지막 열과 첫 열의 형태·색을 이어 붙일 수 있게 한다.
  - `world-03-construction-floor.png`: 기존 128×216 RGBA 유지. 충돌 바닥의 y=504에 맞춰 `StageScene`이 y=499부터 그리므로, 그림의 맨 위 표면 요철은 화면상 4px 이내다. 콘크리트 골재·시멘트 자국·줄눈을 월드 2 모래보다 촘촘하게 묘사하되 반복 좌우 경계가 끊기지 않게 한다. 위험물처럼 보이는 날카로운 장식은 넣지 않는다.
  - 제작 방식: 이미지 생성 도구로 월드 1·2 레퍼런스를 참고해 픽셀 아트 원본을 만든다. 최종 규격/알파/타일 경계는 최근접 픽셀 변환과 수동 픽셀 보정으로 맞춘다. 흐림·포토 질감·그라데이션 번짐·읽을 수 없는 글자를 금지한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 위 기준 이미지와 현재 월드 3 이미지의 색·원근·알파 분리, `ParallaxRenderer`의 높이 정규화(`720 / textureHeight`)를 확인한다. 구현 전 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`를 읽는다.
  2. Core Processing: 기존 경로에 원경·전경·바닥을 교체한다. 원경 좌우 끝은 색·지형 높이가 자연스럽게 이어져 `tileSprite` 반복 때 단절되지 않게 한다. 전경은 실제 게임 화면의 코기/장애물 위를 가리지 않게 하단부에 제한한다.
  3. Error & Exception Handling: PNG 규격 또는 알파/반복 경계가 틀리면 원본을 수정하고 파일을 다시 검사한다. 에셋 키나 URL을 바꾸지 않으므로 런타임 폴백 색 사각형이 보이면 로딩 실패로 취급한다.
  4. State Transition & Return: 월드 1·2 에셋과 월드 3 맵·충돌·게임 상태는 유지한다. 다음 Task에서 이 공통 색 기준을 중경에 사용한다.

### I02. 팔레트와 파일 검증

- Related Files:
  - `src/game/data/worldMaps.ts` :: `WORLD_MAP_THEMES`의 `world-03` 항목 — 폴백 및 테마 팔레트; modify
  - `scripts/world03-visual-assets.test.mjs` :: `world03 afternoon shared assets` 테스트 — 새 PNG 계약 확인; new

#### Details

- **Signatures & Types**:
  ```typescript
  interface WorldMapPalette {
    readonly far: string;
    readonly mid: string;
    readonly gameplay: string;
    readonly foreground: string;
    readonly accent: string;
  }
  ```
- **Data & Schema Fields**: `WORLD_MAP_THEMES`의 `world-03` 팔레트를 새 원경의 밝은 중오후 하늘·중경 콘크리트·지면 청회색·짙은 윤곽·안전 노란색에 맞춘다. 권장 시작값 `far:#67AEE5`, `mid:#B8B0A2`, `gameplay:#8F8377`, `foreground:#4A4950`, `accent:#EAB34D`; 그림과 최종 일치하도록 조정한다. 월드 1·2 팔레트는 수정하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 현재 세 manifest 엔트리가 `required:true`이고 파일 경로가 유지되는지 확인한다.
  2. Core Processing: `WORLD_MAP_THEMES`의 월드 3 필드만 교체한다. 테스트는 Sharp로 PNG 규격(1672×941, 1672×941, 128×216), 원경 전체 불투명, 전경 상단 투명, 바닥 양쪽 경계 및 필수 파일 존재를 검사한다. 미술 품질은 자동 픽셀 검사만으로 판단하지 않고 브라우저 화면으로 확인한다.
  3. Error & Exception Handling: 잘못된 크기·알파·누락 에셋은 명확한 파일명과 함께 실패시키며 임계값을 회피하도록 테스트를 완화하지 않는다.
  4. State Transition & Return: 에셋 키 계약이 유지되고 월드 3 공통 화면만 새 아트로 표시된다.

## Acceptance Criteria

- [ ] 월드 3 stage 1 실제 1280×720 화면이 밝은 파란 3~4시 하늘과 입체적인 원경을 보여준다. 일몰·회색 안개처럼 보이지 않는다.
- [ ] 바닥은 y=504 충돌선과 시각적으로 맞고, 가로 스크롤에서 원경·전경·바닥 반복 이음새가 눈에 띄지 않는다.
- [ ] 코기, 노란 코인, HUD, 장애물은 전경과 분리되어 읽힌다. 월드 1·2 이미지·테마·게임플레이 수치는 바뀌지 않는다.

## Validation

- `node --test scripts/world03-visual-assets.test.mjs` — 세 PNG 크기·알파·반복 경계 계약 통과.
- `node scripts/validate-assets.mjs` — 필수 에셋 누락 없음.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/data/worldMaps.ts scripts/world03-visual-assets.test.mjs` — 린트 오류 없음.
- 개발 서버의 `world-03-stage-1`에서 1280×720 화면과 x≈0/1280/2560 스크롤 지점을 확인해 원경/바닥 이음새와 가독성을 기록.

## Commit Message

```text
feat(월드3): 오후 공사장 하늘과 공통 지면 개선

Plan: 2026-10-27-world03-afternoon-construction-art
Phase: P01-world03-visuals
Task: T01-afternoon-sky-and-ground

- 밝은 오후 원경과 낮은 전경, 반복 공사장 바닥 제작
- 월드 3 팔레트와 PNG 계약 검증 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 완료 (Plan/Phase/Task footer로 추적)

## Validation Results

- 내장 이미지 생성 도구로 기존 월드 3 파일을 편집하고 월드 2 완성 배경을 스타일 참조로 사용했다. 원경 1672×941, 전경 1672×941, 바닥 128×216으로 정규화했다.
- 생성 프롬프트 핵심: “3–4 PM vivid blue construction skyline with warm sunlight, crisp detailed pixel art, seamless far parallax”; “only bottom 8% transparent construction curb overlay”; “seamless warm-gray concrete aggregate floor”. 전경 투명 상단과 원경/전경/바닥 좌우 첫·마지막 열을 보정했다.
- `node --test scripts/world03-visual-assets.test.mjs`: 4/4 통과. `node scripts/validate-assets.mjs`: 135개 엔트리/116개 필수 파일 통과. TypeScript와 지정 ESLint 통과.
- 1280×720 브라우저에서 `world-03-stage-1`의 밝은 파란 하늘, 건설 중인 건물·크레인 원경, y=504 바닥 접점, 코기·코인 가독성을 확인했다. 원경의 도시가 기존 중경에 가려지지 않도록 세로 구도를 조정했다.
