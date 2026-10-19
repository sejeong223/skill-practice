# Task: T01 반복 가능한 모래 바닥 PNG 제작 및 등록

## Status: done

## Goal

월드 2 첫 스테이지의 걸을 수 있는 바닥에 사용할 새 모래 PNG 한 장을 제작해 필수 에셋으로 로드한다. T02가 이 키를 바로 렌더링할 수 있어야 한다.

## Decision Summary

- 코기와 장애물은 이미지에 넣지 않는다. 이미지 한 장은 좌우 반복되는 모래 표면만 담는다.
- 사용자가 제공한 놀이터 화면의 옅은 노랑과 가는 자갈 무늬를 따른다. 충돌 면은 T02에서 평평한 y=504로 유지한다.

## Implementation

### I01. 모래 PNG 한 장

- Related Files:
  - `public/assets/pixel/tiles/world-02/world-02-sand-floor.png` :: 새 반복용 모래 바닥 이미지; new.
  - `public/assets/pixel/cutscenes/world-02/world-02-playground-pov.png` :: 노란 모래와 픽셀 질감 참고; read-only.
  - `public/assets/pixel/backgrounds/world-02/world-02-mid.png` :: 놀이터 놀이기구 아래 지면 색·명도 참고; read-only.

#### Signatures & Types

- 코드 심볼 없음. 출력물은 최종 512×216px RGBA PNG 한 파일이다. 512px은 좌우 반복 주기, 216px은 게임 화면 y=504~720의 모래 단면 높이와 일치한다.

#### Data & Schema Fields

- PNG: 폭 `512`, 높이 `216`, alpha 채널 있음. 좌우 첫/끝 열의 모래 색과 표면 높이가 이어져야 한다. 위쪽 0~4px의 투명/모래 경계만 최대 ±3px 정도 자연스럽게 굴곡지고, 아래쪽은 밝은 노란 모래와 작은 자갈 무늬로 채운다.
- 저장 파일명과 manifest URL은 정확히 `world-02-sand-floor.png`를 사용한다.

#### Execution Flow / Logic

1. `imagegen` 스킬의 기본 내장 이미지 생성 도구로 위 두 이미지를 미술 레퍼런스로 사용해 **한 장**을 생성한다. 프롬프트에는 '2D 픽셀 아트, 수평 반복 가능한 낮 놀이터 모래 바닥, 작은 자갈/입자, 살짝 불규칙한 윗면, 투명한 윗면 바깥쪽, 장애물·글자·놀이기구 없음'을 명시한다.
2. 생성 결과가 목표 크기와 다르면 픽셀 아트의 계단형 가장자리를 보존하는 최근접 리샘플링/크롭으로 512×216 최종 산출물을 만든다. 좌우 경계가 이어지지 않거나 모래가 흐려지면 원본을 다시 생성·수정하고 이음새를 육안 검토한다.
3. 최종 PNG를 위 workspace 경로에 저장한다. 이미지의 윗면이 y=504 충돌면과 거의 맞도록 이미지 상단 몇 픽셀 안에서 시작해야 한다.

### I02. 필수 에셋 manifest

- Related Files:
  - `src/game/assets/assetManifest.json` :: 월드 2 이미지 항목 뒤에 `world-02-sand-floor` 추가; modify.
  - `src/game/assets/assetTypes.ts` :: `PixelAssetDefinition` 계약 확인; read-only.
  - `src/game/scenes/PreloadScene.ts` :: `required: true` 이미지 자동 로드 경로 확인; read-only.

#### Signatures & Types

```typescript
interface PixelAssetDefinition {
  readonly key: string;
  readonly kind: "image" | "spritesheet" | "atlas" | "audio" | "tilemap";
  readonly url: string;
  readonly worldId?: string;
  readonly required: boolean;
}
```

#### Data & Schema Fields

- 새 JSON 항목: `{ "key": "world-02-sand-floor", "kind": "image", "url": "/assets/pixel/tiles/world-02/world-02-sand-floor.png", "worldId": "world-02", "required": true }`. `tileWidth`/`tileHeight`는 일반 이미지이므로 넣지 않는다.

#### Execution Flow / Logic

1. manifest의 키 중복과 파일 경로를 확인한다.
2. `PreloadScene.preload()`의 기존 `required` 이미지 로더가 PNG를 읽는다. 파일 누락 시 기존 `FILE_LOAD_ERROR`가 키/URL을 표시한다.
3. 이번 Task에서는 아직 `StageScene`에 이미지를 배치하지 않는다. T02가 키를 사용한다.

## Acceptance Criteria

- [x] 새 모래 바닥 이미지가 정확히 한 장 있고 512×216 RGBA이며 좌우 반복 경계와 표면이 자연스럽다.
- [x] `world-02-sand-floor`가 필수 이미지로 등록되어 로드 실패를 숨기지 않는다.
- [x] 기존 월드 2 배경 세 장과 코기·컷신 파일은 그대로다.

## Validation

- `node scripts/validate-assets.mjs` — 필수 파일 존재 및 키 중복 검사 통과.
- `node -e "const s=require('sharp');s('public/assets/pixel/tiles/world-02/world-02-sand-floor.png').metadata().then(m=>{if(m.width!==512||m.height!==216||!m.hasAlpha)process.exit(1)})"` — 정확한 크기와 alpha 확인.
- `npx.cmd tsc --noEmit` — manifest import 타입 검사 통과.
- 이미지를 두 장 연속으로 붙여 좌우 이음새·색·윗면을 육안 확인한다.

## Commit Message

```text
feat(world02): 반복 가능한 모래 바닥 이미지 추가

Plan: 2026-10-14-world02-sand-floor-and-stage-title
Phase: P01-sand-floor-and-title
Task: T01-sand-floor-asset

- 놀이터 색감의 모래 바닥 PNG 한 장 제작
- 필수 Phaser 이미지 키 등록
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 에셋 검증 60항목, PNG 크기·alpha, 타입 검사 및 시각 점검.
- commit: pending
