# Task: T01 살짝 픽셀 아트풍 스타일 가이드와 생성형 에셋 계약

## Status: done

## Goal

코기 게임 전체가 같은 작품처럼 보이도록 픽셀 그리드·팔레트·실루엣·애니메이션 프레임 규칙을 문서화하고, 생성형 이미지 도구로 만든 캐릭터·도구·배경 에셋을 Phaser가 로드할 수 있는 고정 경로와 manifest로 정리한다.

## Decision Summary

- 밝은 2D 카툰에 살짝 픽셀 아트 감성을 섞고, 16px 논리 타일·정수 배율·nearest-neighbor 렌더링을 사용한다.
- 사용자가 직접 그림을 만들지 않는다. 기준 디자인과 참조 이미지는 생성형 이미지 도구로 만들고, 투명 배경·프레임 정렬·파일명·충돌 기준은 작업에서 정리한다.

## Implementation

### I01. 픽셀풍 아트 스타일 가이드

- Related Files:
  - `docs/art-style.md` :: `PixelArtStyleGuide` — 전체 시각 규칙; new

#### Details

- **Style fields**:
  - `logicalTileSize`: `16`
  - `displayScale`: 정수 배율만 허용
  - `filter`: nearest-neighbor
  - `palette`: 따뜻한 크림 배경, 코기 오렌지, 짙은 턱시도 블랙, 육즙 레드/골드, 위험 경고 마젠타
  - `outline`: 캐릭터 외곽선은 1~2 논리 픽셀, 배경은 외곽선 대비를 낮춤
  - `lighting`: 월드별 주조색은 바꾸되 캐릭터 하이라이트 방향은 유지
- **Character contract**:
  - 코기 기준 크기: 논리 32×48px, idle·run·jump·fall·attack·hurt·death 프레임을 같은 기준선에 정렬
  - 턱시도 고양이 기준 크기: 논리 32×48px, 일반형과 보스형의 실루엣이 즉시 구분되어야 함
  - 슬리퍼·밥그릇·왕갈비뼈는 코기 스프라이트와 같은 픽셀 팔레트를 사용
- **Generated asset workflow**:
  1. 코기 기준 시트와 턱시도 고양이 기준 시트를 먼저 생성한다.
  2. 기준 시트를 참조해 포즈·표정·도구·월드 배경을 확장한다.
  3. 모든 결과는 투명 배경, 일관된 캔버스 크기, 동일한 광원 방향으로 정리한다.
  4. 애니메이션 프레임은 동일한 발 위치와 중심점을 갖도록 정렬한다.
  5. 생성 이미지 안에 읽을 수 있는 텍스트나 UI 문구를 넣지 않는다. 텍스트는 React/Phaser UI로 렌더링한다.

### I02. 에셋 파일과 manifest

- Related Files:
  - `public/assets/pixel/characters/corgi/` — 코기 PNG/SVG 스프라이트와 프레임; new
  - `public/assets/pixel/characters/cats/` — 고양이·보스 스프라이트; new
  - `public/assets/pixel/items/` — 왕갈비뼈·토끼 슬리퍼·밥그릇·상점 아이콘; new
  - `public/assets/pixel/worlds/world-01/` through `world-05/` — 월드별 패럴랙스 배경·타일·함정 이미지; new
  - `public/assets/pixel/ui/` — 픽셀풍 패널·아이콘·컷신 프레임; new
  - `src/game/assets/assetTypes.ts` :: `AssetKind`, `PixelAssetDefinition`; new
  - `src/game/assets/assetManifest.ts` :: `PIXEL_ASSETS`, `getAssetDefinition`; new

#### Details

- **Signatures & Types**:
  ```typescript
  export type AssetKind = "image" | "spritesheet" | "atlas" | "audio";

  export interface PixelAssetDefinition {
    readonly key: string;
    readonly kind: AssetKind;
    readonly url: string;
    readonly frameWidth?: number;
    readonly frameHeight?: number;
    readonly frameCount?: number;
    readonly worldId?: string;
    readonly required: boolean;
  }

  export const PIXEL_ASSETS: readonly PixelAssetDefinition[];
  export function getAssetDefinition(key: string): PixelAssetDefinition;
  ```
- `PIXEL_ASSETS`에는 최소한 `corgi-idle`, `corgi-run`, `corgi-jump`, `corgi-slipper-attack`, `corgi-bite`, `corgi-dash`, `corgi-bark`, `corgi-double-jump`, `corgi-tail-rotor`, `corgi-hurt`, `corgi-death`, `tuxedo-cat`, `legendary-rib`, `rabbit-slipper`, `upside-down-bowl`를 등록한다.
- URL은 모두 `/assets/pixel/...` 절대 public 경로로 저장하며, 대소문자와 확장자를 manifest와 실제 파일에서 동일하게 유지한다.

### I03. 에셋 검증

- Related Files:
  - `scripts/validate-assets.mjs` :: `validateAssets`; new

#### Details

- manifest의 `required: true` 항목에 대해 파일 존재 여부, 프레임 크기, 중복 key를 검사한다.
- 생성 이미지가 누락되면 런타임에서 조용히 투명 텍스처로 대체하지 말고 명확한 오류를 출력한다.

## Acceptance Criteria

- [ ] `docs/art-style.md`에 픽셀 그리드·팔레트·캐릭터 기준선·생성형 에셋 후처리 규칙이 있다.
+ [x] 코기와 턱시도 고양이의 기준 디자인 레퍼런스 시트와 기본 포즈 계약이 동일한 스타일로 준비되어 있다.
+ [x] 왕갈비뼈·토끼 슬리퍼·뒤집어진 밥그릇의 기준 디자인 레퍼런스 시트가 준비되어 있다.
+ [x] `PIXEL_ASSETS`의 모든 필수 파일이 실제 경로와 일치하고 중복 key가 없다.
+ [x] UI 텍스트가 생성 이미지에 박히지 않고 런타임 UI에서 그려지도록 분리되어 있다.

## Validation

- `node scripts/validate-assets.mjs` — 필수 에셋 경로·중복 key·프레임 메타데이터 검증 통과
- `npm run lint` — TypeScript/manifest lint 통과
- `npm run build` — Next.js production build 통과

## Commit Message

```text
feat(art): establish pixel asset system and generated art contract

Plan: 2026-09-21-legendary-rib-corgi
Phase: P01-foundation-visuals
Task: T01-pixel-art-asset-system

- Add pixel art style guide and generated asset directories
- Register Phaser asset manifest and validation script
```

## Progress

+ [x] 구현 완료
+ [x] 검증 통과
+ commit: T01 commit recorded in git history
