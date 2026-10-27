# Task: T01 공사장 위험물 픽셀 이미지와 에셋 등록

## Status: pending

## Goal

월드 3 오후 공사장 스타일의 케이블 드럼, 손수레, 짧은 H형 철골 빔을 각각 별도 투명 PNG로 만들고, 일반 스테이지가 세 이미지를 필수 에셋으로 로드할 수 있게 한다.

## Decision Summary

- 드럼은 둥근 나무 케이블 릴, 손수레는 바퀴와 손잡이가 보이는 고정 물체, 빔은 바닥 파이프·보스 벽돌과 다른 짧은 H형 강재 실루엣이다.
- 이 Task에서는 그림·에셋 계약만 구현한다. 배치·이동·낙하 코드는 T02·T03에서 완성한다.

## Implementation

### I01. 투명 픽셀 PNG 세 개

- Related Files:
  - `public/assets/pixel/objects/world-03/cable-drum.png` :: 48×48 RGBA 이미지 — new
  - `public/assets/pixel/objects/world-03/wheelbarrow.png` :: 56×44 RGBA 이미지 — new
  - `public/assets/pixel/objects/world-03/falling-steel-beam.png` :: 64×28 RGBA 이미지 — new
  - `public/assets/pixel/objects/world-03/{traffic-cone,brick-stack,cement-bag,steel-pipe}.png` :: 기존 팔레트·픽셀 크기 참조 — read-only

#### Details

- **Signatures & Types**: PNG는 RGBA, 투명 배경, 정수 좌표의 선명한 픽셀 에지로 저장한다. 드럼·손수레 이미지는 런타임에서 `WORLD03_OBSTACLE_SCALE = 1.25`를 적용한다. 빔 이미지는 원본 크기로 표시한다. 드럼은 한 장의 이미지를 중심점에서 회전시키며 별도 스프라이트 시트는 사용하지 않는다.
- **Data & Schema Fields**:
  - `cable-drum.png`: 캔버스 48×48, 불투명 실루엣 최대 42×42, 중심을 캔버스 중앙에 둔다. 나무 릴의 원형 테두리와 감긴 케이블을 구분한다. 회전해도 모서리가 잘리지 않을 여백을 둔다.
  - `wheelbarrow.png`: 캔버스 56×44, 불투명 실루엣 최대 52×40, 바퀴 최하단을 마지막 2개 행 안에 둔다. 손잡이·적재함·바퀴를 구분한다.
  - `falling-steel-beam.png`: 캔버스 64×28, 불투명 실루엣 최대 56×20, 수평의 짧은 H형 강재 단면과 오후 햇빛 하이라이트를 표현한다.
- **Execution Flow / Logic**:
  1. 기존 네 이미지의 명암·윤곽선·채도와 월드 3 배경을 참고해 동일한 스타일로 제작한다. 글자, 배경, 그림자 경고 표식은 넣지 않는다.
  2. RGBA 투명도가 살아 있고 지정한 캔버스·불투명 범위를 지키는지 확인한다. 드럼 회전 시 48×48 테두리에 그림이 잘리지 않아야 한다.
  3. 이미지 생성 결과가 치수·실루엣을 만족하지 않으면 투명 캔버스에 맞게 다시 생성·조정한다. 자산 생성 실패를 빈 PNG로 대체하지 않는다.

### I02. 로드 목록과 월드 3 미술 카탈로그

- Related Files:
  - `src/game/assets/assetManifest.json` :: 에셋 엔트리 — modify
  - `src/game/data/worldMaps.ts` :: `WORLD_THEMES`의 `createTheme("world-03", ...)` 호출 — modify
  - `src/game/scenes/PreloadScene.ts` :: `loadAsset` 사용 방식 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 assetManifest.json의 엔트리 형태를 그대로 사용한다.
  interface AssetManifestEntry {
    key: string;
    kind: "image";
    url: string;
    worldId: "world-03";
    required: true;
  }
  ```
- **Data & Schema Fields**: 키와 URL은 각각 `world-03-cable-drum` → `/assets/pixel/objects/world-03/cable-drum.png`, `world-03-wheelbarrow` → `/assets/pixel/objects/world-03/wheelbarrow.png`, `world-03-falling-steel-beam` → `/assets/pixel/objects/world-03/falling-steel-beam.png`. 세 항목 모두 `kind: "image"`, `worldId: "world-03"`, `required: true`.
- **Execution Flow / Logic**:
  1. 기존 네 장애물 이미지 항목 옆에 세 항목을 추가하고 키 중복을 확인한다.
  2. `createTheme("world-03", ...)`의 `hazardCatalog`에는 **지상 장애물** 드럼·손수레의 두 키만 추가한다. 철골 빔은 런타임 낙하물이므로 manifest에서 로드하되 지상 장애물 카탈로그에는 넣지 않는다.
  3. 기존 배경·바닥·장애물 키 및 `PreloadScene` 동작을 보존한다. 자산 검증에서 파일 누락·잘못된 키가 있으면 Task를 완료하지 않는다.

### I03. 그림·manifest 회귀 검사

- Related Files:
  - `scripts/world03-visual-assets.test.mjs` :: `imageData`, PNG 픽셀 검사, manifest 검사 — modify

#### Details

- 기존 네 장애물 검사와 공통 배경 검사를 보존하고 새 이미지 세 종류의 정확한 캔버스 크기, 투명 모서리, 실제 불투명 픽셀 존재, 각 불투명 범위의 최대 크기, 드럼·손수레 색상 상세, 손수레 바닥 접점을 검사한다.
- 기존 manifest 검사에 세 키의 URL, `kind: "image"`, `worldId`, `required`를 추가한다. `worldMaps.ts`의 월드 3 지상 카탈로그에 드럼·손수레가 있으며 철골 빔이 포함되지 않음을 확인한다.
- 검사 실패 시 문제 그림·manifest만 수정한다. 오래된 `scripts/world03-construction-assets.test.mjs`의 배경 크기 기대값 수정은 사용자 추가 요청에 따라 T04에서 처리한다.

## Acceptance Criteria

- [ ] 세 PNG가 지정 치수·투명 범위·시각적 실루엣을 만족한다.
- [ ] 세 이미지가 월드 3 필수 에셋으로 로드되고 지상 카탈로그에는 새 지상 장애물 두 종류만 들어간다.
- [ ] 기존 월드 3 네 장애물과 배경 이미지 계약이 유지된다.

## Validation

- `node --test scripts/world03-visual-assets.test.mjs` — 기존 검사와 새 위험물 그림·manifest 검사가 모두 통과.
- `node scripts/validate-assets.mjs` — 새 이미지 경로와 manifest 유효성 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/data/worldMaps.ts scripts/world03-visual-assets.test.mjs` — 수정한 코드 lint 통과.
- `git diff --cached --check` 및 `git diff --cached --stat` — 해당 Task 파일만 스테이징하고 다른 미커밋 작업이 포함되지 않음.

## Commit Message

```text
feat(월드3): 공사장 위험물 픽셀 이미지 추가

Plan: 2026-10-27-world03-construction-hazards
Phase: P01-construction-hazards
Task: T01-hazard-art-and-assets

- 드럼·손수레·철골 빔 이미지와 필수 로드 키 등록
- 월드 3 시각 자산 계약 검증
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
