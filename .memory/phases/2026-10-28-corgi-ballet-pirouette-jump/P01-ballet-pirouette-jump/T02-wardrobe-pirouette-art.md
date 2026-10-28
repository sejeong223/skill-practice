# Task: T02 발레 회전 의상·장신구·색칠 의상 자산

## Status: done

## Goal

기본 코기와 같은 8개 회전 각도에서 현재 의상 5종, 직접 색칠한 의상, 장신구 5종이 코기 몸과 함께 자연스럽게 보이도록 전신·레이어 자산을 완성한다.

## Decision Summary

- 점프 중 착용 의상과 장신구를 유지한다. 옷을 입힌 코기는 매 프레임 머리·몸통·다리를 포함한 전신이며, 기존 달리기 시트에 옷 조각을 덧붙인 결과물이 아니다.
- T01의 오른쪽 출발 시트와 똑같이 `112×128` 프레임 8개, 시트 `896×128`, 발 앵커 `y=99`, 각도 순서 `0 옆 → 2 정면 → 4 반대 옆 → 6 뒷모습 → 0`을 사용한다.

## Implementation

### I01. 다섯 의상과 다섯 장신구의 8방향 아트

- Related Files:
  - `public/assets/pixel/characters/corgi/corgi-pirouette.png` :: T01 전신 각도·발 앵커 기준 — read-only
  - `public/assets/pixel/characters/corgi/equipment/*-run.png` :: 해당 제품의 기존 색·실루엣 기준 — read-only
  - `public/assets/pixel/characters/corgi/equipment/*-bark.png` :: 얼굴·귀와 장신구 위치 기준 — read-only
  - `art/source/corgi-pirouette-outfits/{id}.png` :: 의상별 오른쪽 출발 전신 원본 5장 — new
  - `art/source/corgi-pirouette-accessories/{id}.png` :: 장신구별 회전 레이어 원본 5장 — new
  - `public/assets/pixel/characters/corgi/equipment/{id}-pirouette.png` :: 의상 5종·장신구 5종의 오른쪽 출발 게임 시트 — new
  - `public/assets/pixel/characters/corgi/equipment/{id}-pirouette-mirror.png` :: 위 각 시트의 프레임별 좌우 반전 — new
  - `scripts/build-corgi-pirouette-sprites.mjs` :: T01 생성기에 의상·장신구 variant와 `--check` 추가 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type OutfitId = "pink-caterpillar-suit" | "banana-peel-suit" | "bee-bodysuit" | "hotdog-outfit" | "diamond-armor";
  type AccessoryId = "shinchan-eyebrow-sticker" | "birthday-party-hat" | "strawberry-headpiece" | "propeller-hat" | "prince-crown";
  type PirouetteVariant = Readonly<{ id: OutfitId | AccessoryId; category: "outfit" | "accessory"; source: string; output: string }>;
  // 모든 variant는 원본 + 프레임별 반전 2개 PNG를 만든다.
  ```
- **Data & Schema Fields**:
  - `OutfitId`의 각 프레임은 얼굴·몸통·다리·발을 모두 포함한 코기 전신이다. 색·무늬와 코기 얼굴은 해당 `*-run.png`와 일치시키되, 몸통 자세와 의상 앞·옆·뒤 면은 새로 그린다.
  - `AccessoryId`의 각 프레임은 투명 배경 위 장신구만 포함한다. 플레이어 전신의 같은 `x/y`와 원점 `(0.5,99/128)`으로 겹치며, 눈썹 스티커처럼 뒷모습에서 보이지 않아야 하는 프레임은 완전히 투명해도 된다. 앞모습에서는 얼굴을 과하게 가리지 않는다.
  - 각 게임 시트는 RGBA `896×128`, 8프레임이다. 반전은 시트 전체가 아니라 8개 `112px` 슬롯을 각각 반전한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `src/game/data/marketCatalog.ts`의 `outfit` 5개·`accessory` 5개 ID를 기준으로 정확히 10종을 선정한다. T01의 기본 코기 각도와 기존 제품 이미지를 함께 본다.
  2. Core Processing: 의상 5종은 같은 각도의 코기를 매번 전신으로 새로 그린다. 장신구 5종은 각도별 귀·머리 위치와 앞뒤 가림에 맞춘 레이어로 만든다. T01 생성기를 variant 목록에 확장하고 각 시트의 mirror를 생성한다. 에셋 제작 시 투명 비트맵 생성 도구를 사용한 뒤 프레임 정렬과 1px 윤곽을 직접 검토한다.
  3. Error & Exception Handling: 누락 variant, 의상 프레임의 전신 누락, 장신구 프레임의 잘못된 치수, 반전 불일치가 있으면 생성·`--check`가 실패한다. 의상·장신구가 서로 다른 카테고리여도 동일한 파일명 접미사를 사용하므로 ID 중복을 검사한다.
  4. State Transition & Return: 10종 × 2방향 = 20개 게임 시트가 생성된다. 이 Task에서는 게임 표시 로직을 바꾸지 않는다.

### I02. 색칠 의상 템플릿과 셀 좌표 지도

- Related Files:
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-run.png` :: 기존 흰 의상과 코기 얼굴 기준 — read-only
  - `art/source/corgi-pirouette-custom-outfit.png` :: 흰 천이 포함된 전신 8프레임 원본 — new
  - `art/source/corgi-pirouette-custom-uv.png` :: 각 흰 천 픽셀의 색칠 셀 번호 원본 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-pirouette.png` :: 전신 흰 의상 시트 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-pirouette-mirror.png` :: 프레임별 반전 시트 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-pirouette-uv.png` :: 색칠 좌표 지도 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-pirouette-mirror-uv.png` :: 반전 시트용 색칠 좌표 지도 — new
  - `scripts/build-corgi-pirouette-sprites.mjs` :: 흰 의상과 UV 지도 생성·검사 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type PaintUvPixel = Readonly<{ r: number; g: number; b: 0; a: 0 | 255 }>;
  // a=255: encodedCell = r + (g << 8), cellIndex = encodedCell - 1, 1 <= encodedCell <= 1792.
  // a=0: 색칠 대상 아님. 셀은 기존 56×32 CustomOutfitDesign.cells 배열과 동일.
  ```
- **Data & Schema Fields**:
  - 흰 의상 원본·게임 시트·UV 이미지는 모두 `896×128`이다. 전신 시트에는 코기 색과 검은 윤곽을 유지하고, 색칠할 천 픽셀만 불투명한 중립 흰색(`R,G,B >= 230`, 채널 차 `<= 8`)으로 둔다.
  - UV 지도에서 색칠할 흰 천 픽셀만 `a=255`이고 `r + 256*g`가 `1..1792`다. 다른 모든 픽셀은 `a=0`이다. 회전 각도별 앞면·옆면·뒷면의 천 영역에 기존 `56×32` 그림이 연결되도록 셀 번호를 배치한다.
  - 반전 UV 지도는 원본 UV 지도 각 프레임의 좌우 반전이며 프레임 순서와 셀 번호 자체는 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 사용자 그림 데이터 `CustomOutfitDesign.cells`가 `56×32=1792`개임을 확인한다. 기존 run/bark/bite 템플릿은 수정하지 않는다.
  2. Core Processing: 회전 8각도에 맞춰 흰 의상을 입은 코기 전신을 새로 그린다. 각 흰 천 픽셀의 대응 셀 번호를 UV PNG에 기록하고, 원본·반전 시트와 UV 두 장을 생성한다.
  3. Error & Exception Handling: UV가 흰 천 바깥을 가리키거나 흰 천에 UV가 없거나 인덱스가 범위를 벗어나면 스크립트가 실패한다. 색칠 대상 밖 코기 피부·눈·검은 윤곽은 UV 알파 `0`이어야 한다.
  4. State Transition & Return: T03이 기존 저장 색칠 셀을 회전 템플릿에 적용할 수 있는 픽셀별 지도 두 장이 준비된다.

### I03. 에셋 등록과 시트 검사

- Related Files:
  - `src/game/assets/assetManifest.json` :: 의상·장신구 20시트, 색칠 전신 2시트, UV 지도 2이미지 — modify
  - `scripts/corgi-pirouette-wardrobe-art.test.mjs` :: 제품 ID·전신·레이어·UV·반전 검사 — new

#### Details

- **Signatures & Types**:
  ```typescript
  type WardrobePirouetteAsset = Readonly<{
    key: `wear-${OutfitId | AccessoryId}-pirouette${"" | "-mirror"}` | `custom-outfit-template-pirouette${"" | "-mirror"}`;
    kind: "spritesheet";
    frameWidth: 112;
    frameHeight: 128;
    frameCount: 8;
    required: true;
  }>;
  ```
- **Data & Schema Fields**:
  - `wear-{id}-pirouette`와 `wear-{id}-pirouette-mirror`의 URL은 `/assets/pixel/characters/corgi/equipment/{id}-pirouette{suffix}.png`이다. `custom-outfit-template-*`도 같은 디렉터리와 접미사를 쓴다.
  - UV 키 두 개는 `custom-outfit-template-pirouette-uv`, `custom-outfit-template-pirouette-mirror-uv`이며 `kind:"image"`, `required:true`이다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `MARKET_PRODUCTS`의 10개 cosmetic ID와 시트 manifest 키를 1:1 대조한다.
  2. Core Processing: 모든 시트를 필수로 등록한다. 새 테스트는 의상 프레임 전신의 색·몸통·발 존재, 장신구의 올바른 레이어 투명도, 색칠용 흰 천과 UV 인덱스의 픽셀 단위 일치, 모든 반전 시트의 슬롯별 일치를 확인한다.
  3. Error & Exception Handling: 장신구가 뒷면에서 숨는 것은 허용하되, 모든 8프레임이 비어 있는 제품은 실패한다. 의상은 빈 프레임을 허용하지 않는다.
  4. State Transition & Return: `PreloadScene`이 T03에서 필요한 모든 외형을 필수 자산으로 자동 로드한다.

## Acceptance Criteria

- [ ] 기존 의상 5종은 8각도 모두 새 전신 코기이며 발 앵커·팔레트가 T01과 맞는다.
- [ ] 장신구 5종은 정면·옆·뒷모습마다 머리 방향을 따르며 기존 착용 아이템을 알아볼 수 있다.
- [ ] 사용자 색칠 의상은 8각도 흰 천과 `1..1792` UV 셀을 가지며 코기 피부·윤곽 픽셀을 색칠하지 않는다.
- [ ] 24개 신규 에셋(시트 22개, UV 이미지 2개)이 manifest에서 `required:true`로 등록된다.

## Validation

- `node scripts/build-corgi-pirouette-sprites.mjs --check` — 기본·의상·장신구·색칠 전신/UV 출력 재현 확인.
- `node --test scripts/corgi-pirouette-art.test.mjs scripts/corgi-pirouette-wardrobe-art.test.mjs` — 각도·전신·착용 레이어·UV 검사 통과.
- `node scripts/validate-assets.mjs` — 새 필수 에셋 경로와 키 검사 통과.

## Commit Message

```text
feat(corgi): 발레 회전 의상과 장신구 전신 아트 추가

Plan: 2026-10-28-corgi-ballet-pirouette-jump
Phase: P01-ballet-pirouette-jump
Task: T02-wardrobe-pirouette-art

- 기존 의상 5종과 장신구 5종을 8방향 회전에 맞춰 제작
- 색칠 의상 전신과 픽셀별 색칠 좌표 지도 등록
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 완료 (이 Task의 Git 커밋)

## Worktree Guard

- 이 Task의 자산·생성기·검사·manifest만 스테이징한다. 기존 보스·HUD·월드 3 미커밋 변경은 보존한다.
