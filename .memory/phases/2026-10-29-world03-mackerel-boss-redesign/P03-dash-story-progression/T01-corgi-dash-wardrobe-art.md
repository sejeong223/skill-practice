# Task: T01 코기 전신 지상 대시와 의상

## Status: done

## Goal

숫자 1 대시의 지상 0.25초 동안 기존 코기 얼굴이나 달리기 몸이 겹치지 않는 독립 전신 자세를 만들고, 기존 5종 의상·5종 장신구·색칠한 맞춤 옷까지 같은 자세로 표시한다. 공중 대시는 이미 만든 발레 회전 그림을 그대로 사용한다.

## Decision Summary

- 사용자 선택: 지상 대시는 몸을 낮고 앞으로 길게 뻗는 새 전신, 공중 대시는 기존 발레 회전과 짧은 속도 잔상. 발레 회전 중 바라보는 방향 고정과 현재 착용 의상은 그대로다.
- `assetManifest.json`의 기존 `corgi-dash`는 32×48 4프레임 선택형 항목이지만 실제 PNG가 없다. 112×128 전신 4프레임 필수 자산으로 대체해야 한다.

## Implementation

### I01. 기본 전신 대시와 의상 원본

- Related Files:
  - `art/source/corgi-dash-base-concept.png` :: 기본 코기 4자세 원본 — new
  - `art/source/corgi-dash-outfits/*.png` :: 분홍 애벌레·바나나·벌·핫도그·다이아 갑옷 전신 — new
  - `art/source/corgi-dash-accessories/*.png` :: 짱구 눈썹·생일 모자·딸기·프로펠러 모자·왕관 — new
  - `art/source/corgi-dash-custom-outfit.png` :: 흰색 맞춤 옷 템플릿 — new
  - `art/source/corgi-dash-custom-uv.png` :: 색칠 격자 56×32의 픽셀 매핑 — new
  - `scripts/build-corgi-dash-sprites.mjs` :: 원본 정규화·PNG 생성·`--check` — new
  - `public/assets/pixel/characters/corgi/corgi-dash.png` :: 기본 448×128 — new
  - `public/assets/pixel/characters/corgi/equipment/*-dash.png` :: 의상·장신구 시트 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-dash.png` :: 맞춤 옷 템플릿 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-dash-uv.png` :: 색칠 UV — new
  - `src/game/assets/assetManifest.json` :: 기본/의상/장신구/맞춤 옷 필수 등록 — modify
  - `scripts/corgi-dash-art.test.mjs` :: 전신 프레임·장비·알파 검증 — new

#### Details

- **Signatures & Types**:
  ```text
  base: corgi-dash, spritesheet 112×128, frameCount=4, required=true
  outfit: wear-{cosmeticId}-dash, spritesheet 112×128×4, required=true
  accessory: wear-{cosmeticId}-dash, spritesheet 112×128×4, required=true
  custom-outfit-template-dash: spritesheet, 112×128, frameCount=4, required=true
  custom-outfit-template-dash-uv: image, 448×128, required=true
  ```
- **Data & Schema Fields**: 4프레임 순서는 0 낮게 자세 잡기, 1 전신 뻗기, 2 발로 바닥 밀기, 3 복귀. 각 112×128 프레임, 발 기준 행 약 99. 기존 `corgi-run.png`의 주황·흰 털 경계, 검은 점눈과 안광 없는 표정, 코·귀·꼬리 비율을 유지한다. 현재 물기·짖기처럼 전체 몸이 들어간 독립 프레임이다. 의상은 코기 전신과 포즈가 같은 완성된 그림, 장신구는 몸 위 별도 투명 레이어다.
- **Execution Flow / Logic**:
  1. Precondition: 실제 기본 run/bark/bite/pirouette 시트와 5개 의상·5개 장신구 목록을 확인한다. 미커밋 발레 PNG는 변경·복원하지 않는다.
  2. Core: 기본·의상 원본을 각각 전신으로 재작화한다. 기존 run 몸통 위에 새 얼굴/다리만 겹쳐 만드는 방식은 사용하지 않는다. 색칠 템플릿은 흰 옷 영역을 UV로 56×32 사용자 셀에 대응시켜 대시 중 무늬가 정확히 따라가게 한다. 생성 스크립트가 동일한 PNG를 재현하게 한다.
  3. Error handling: source 누락, 112×128 프레임 불일치, 전신의 일부 잘림, 액세서리와 본체 위치 오차, UV의 흰 옷 아닌 픽셀 가리킴은 실패한다.
  4. State/return: manifest가 필수 대시 자산을 로드하며 기존 run/bite/bark/pirouette 파일은 건드리지 않는다.

### I02. 자세 선택과 레이어 동기화

- Related Files:
  - `src/game/entities/Player.ts` :: `PlayerAppearanceTextures.dash` — modify
  - `src/game/entities/PlayerAnimator.ts` :: `triggerDash`, `stopDash`, 4프레임 지상 전신/공중 잔상 — modify
  - `src/game/entities/PlayerWearables.ts` :: 기본·의상·장신구 dash texture 선택·교체 — modify
  - `src/game/entities/customOutfitTexture.ts` :: `OutfitPose`에 `dash`, 대시 UV 검사·채색 — modify
  - `scripts/corgi-dash-wardrobe.test.mjs` :: 5의상·5장신구·맞춤옷·공중 회전 — new
  - `scripts/corgi-pirouette-integration.test.mjs` :: 기존 회전 우선 순서 회귀 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type PlayerAppearanceTextures = Readonly<{
    run: string; bark: string; bite: string | null; dash: string;
    pirouette: string; pirouetteMirror: string;
  }>;
  type OutfitPose = "run" | "bark" | "bite" | "dash" | "pirouette" | "pirouetteMirror";
  PlayerAnimator.triggerDash(airborne: boolean): void;
  PlayerAnimator.stopDash(): void;
  ```
- **Data & Schema Fields**: 지상 애니메이션 잔여 시간 250ms, 4프레임 각각 약 62.5ms. `Player`의 Arcade body 72×40(월드 2 이후), 이동 충돌·발 기준은 시각 스프라이트 교체로 늘리지 않는다. 맞춤 옷 dash는 4×112×128 픽셀, UV는 같은 크기로 유효한 흰 옷 픽셀만 매핑한다.
- **Execution Flow / Logic**:
  1. Precondition: 호출자가 지상/공중 여부를 전달한다. 이 Task는 대시 키·이동을 아직 연결하지 않으며 테스트가 `triggerDash`를 직접 호출한다.
  2. Core: 지상은 base/착용 의상 대시 텍스처 프레임을 보여주고 장신구도 dash 포즈로 전환한다. 공중은 `PlayerAnimator.updatePirouette`가 기존 600ms·방향 잠금대로 계속 표시되고 2개의 낮은 알파 잔상이 회전 프레임을 따라간다. 대시 중 짖기·물기의 효과 자체는 허용하되 전신 대시/공중 회전 그림을 250ms 동안 우선 표시한다. 장비를 250ms 중 변경해도 현재 대시 프레임·잔상·발 기준을 유지한다.
  3. Error handling: 텍스처 미로드 시 명시적 기본 코기로 폴백하되 대시 자산은 필수 로딩 실패로 잡는다. death/reset/scene destroy에서 전신·잔상·타이머를 정리한다.
  4. State/return: 대시 끝에는 run/현재 공중 회전으로 돌아간다. 기존 짖기·물기 이미지와 발레 회전의 우선 순서를 깨지 않는다.

## Acceptance Criteria

- [x] 지상 대시에서 독립 전신 시트와 다섯 의상·다섯 장신구가 자세를 따라간다.
- [x] 색칠한 맞춤 옷은 대시 4프레임에 같은 사용자 색을 유지한다.
- [x] 공중 대시는 600ms 발레 회전과 착용 의상을 보존하며 잔상만 잠깐 나타난다.
- [x] 기존 달리기·짖기·물기·발레 시트와 코기 물리 body는 바뀌지 않는다.

## Validation

- `node scripts/build-corgi-dash-sprites.mjs --check` — 원본·출력 동일.
- `node --experimental-strip-types --test scripts/corgi-dash-art.test.mjs scripts/corgi-dash-wardrobe.test.mjs scripts/corgi-pirouette-integration.test.mjs` — 전신·장비·회전 우선순위 통과.
- `npx.cmd tsc --noEmit` 및 `npm.cmd run lint` — 텍스처 타입/정적 검사 통과.
- 실제 게임에서 기본/각 의상/맞춤옷/장신구의 지상 대시·공중 대시 한 프레임씩 캡처해 전신과 발 위치 비교.

## Commit Message

```text
feat(코기): 전신 대시 자세와 의상 픽셀 이미지 제작

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P03-dash-story-progression
Task: T01-corgi-dash-wardrobe-art

- 코기와 착용 의상의 4프레임 지상 대시 제작
- 공중 발레 회전 잔상과 맞춤 옷·장신구 동기화
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 — 자산 재생성, 12건, 타입·린트. 실제 플레이 캡처는 P03-T04에서 진행
- commit: 이번 Task 커밋
