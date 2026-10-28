# Task: T02 착용 의상을 유지하는 전신 물기 이미지

## Status: done

## Goal

상점 의상 5종과 직접 그리는 의상의 흰색 템플릿에 각각 물기 4프레임 전신 시트를 만든다. 기본 물기 얼굴만 의상 위에 기계적으로 붙이면 바나나 후드·핫도그 의상처럼 얼굴 주변까지 그린 옷이 지워질 수 있으므로 의상별 머리와 몸을 한 장으로 완성한다.

## Decision Summary

- T01의 기본 `corgi-bite.png`와 각 `*-run.png`를 참조한다. 모든 물기 시트는 오른쪽을 보는 전신 4프레임, 448×128 RGBA, 각 112×128이다.
- **정정**: 각 run 프레임은 의상 색·형태와 코기 체형의 참조다. 옷·후드·방어구가 몸통·다리의 새로운 물기 자세를 따라 움직이도록 여섯 시트 전체를 새로 그린다. run의 몸통·발 픽셀을 그대로 유지하지 않는다.

## Implementation

### I01. 상점 의상 5종과 직접 그린 의상 템플릿 제작

- Related Files:
  - `public/assets/pixel/characters/corgi/equipment/pink-caterpillar-suit-bite.png` :: 애벌레 옷 전신 물기 4프레임 — new
  - `public/assets/pixel/characters/corgi/equipment/banana-peel-suit-bite.png` :: 바나나 껍질 후드 전신 물기 4프레임 — new
  - `public/assets/pixel/characters/corgi/equipment/bee-bodysuit-bite.png` :: 벌 옷 전신 물기 4프레임 — new
  - `public/assets/pixel/characters/corgi/equipment/hotdog-outfit-bite.png` :: 핫도그 옷 전신 물기 4프레임 — new
  - `public/assets/pixel/characters/corgi/equipment/diamond-armor-bite.png` :: 다이아 갑옷 전신 물기 4프레임 — new
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-bite.png` :: 직접 그린 의상 착색용 흰색 전신 물기 템플릿 — new
  - 동일 디렉터리의 각 `*-run.png`/`*-bark.png` :: 원래 의상 색·후드·윤곽선·발 위치 참조 — read-only
  - `public/assets/pixel/characters/corgi/corgi-bite.png` :: 기본 물기 표정/프레임 기준 — read-only
  - `src/game/assets/assetManifest.json` :: 여섯 시트의 필수 spritesheet 정의 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  // 각 이미지에 동일한 PixelAssetDefinition을 추가한다.
  { key: "wear-${outfitId}-bite", kind: "spritesheet",
    url: "/assets/pixel/characters/corgi/equipment/${outfitId}-bite.png",
    frameWidth: 112, frameHeight: 128, frameCount: 4, required: true }
  { key: "custom-outfit-template-bite", kind: "spritesheet",
    url: "/assets/pixel/characters/corgi/equipment/custom-outfit-template-bite.png",
    frameWidth: 112, frameHeight: 128, frameCount: 4, required: true }
  ```
- **Data & Schema Fields (정정)**: `outfitId`는 `pink-caterpillar-suit | banana-peel-suit | bee-bodysuit | hotdog-outfit | diamond-armor` 다섯 개이다. 각 파일은 RGBA 448×128, 프레임 0~3의 x 구간 `frame*112..frame*112+111`이다. 전신 자세에 따라 발을 새로 그리되 하단 y 99~102에 정렬한다. alpha 0 배경은 유지한다. 진행 저장 모델과 상품 ID는 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01 기본 물기 시트를 완성한 뒤 기존 의상 run과 bark를 확대 확인한다. 특히 바나나 후드와 핫도그 빵의 얼굴 옆 윤곽, 벌의 줄무늬, 갑옷 경계, 흰색 직접 그리기 영역을 기록한다.
  2. Core Processing (정정): 기본 물기 시트의 네 전신 포즈에 맞춰 각 의상의 몸통·다리·후드·갑옷을 함께 다시 그린다. 단일 얼굴만 남기고 의상별 색·명암·검은 외곽선 스타일을 맞춘다. 직접 그리기 템플릿은 넓은 흰색 의상 영역을 유지해 T03의 `isWhiteSuitPixel` 착색 함수가 기존 56×32 칸을 계속 칠할 수 있게 한다. 이미지는 픽셀 경계에 맞추고 리샘플링을 쓸 경우 최근접 보간만 사용한다.
  3. State Transition & Return: 기존 run/bark/상품 이미지는 유지하고 새 bite 여섯 장만 manifest에 추가한다. `PreloadScene.loadAsset`이 기존 spritesheet 정의를 읽도록 한다. 데이터 저장 구조는 바뀌지 않는다.
  4. Error & Exception Handling: 후드·의상 일부가 맨몸 얼굴로 덮이거나, 옛 주둥이가 두 개 보이거나, 프레임 발 기준선이 달라지면 자산을 수정한다. 잘린 턱/불투명 배경/색 번짐도 허용하지 않는다.

### I02. 의상별 이미지 계약 테스트

- Related Files:
  - `scripts/outfit-bite-art.test.mjs` :: 여섯 PNG와 manifest 키/규격/윤곽/의상 유지 검사 — new
  - `scripts/corgi-bite-art.test.mjs` :: 기본 물기 전신 계약 — read-only
  - `scripts/goodboy-wearables.test.mjs` :: 착용 의상 ID와 key 목록 참조 — read-only

#### Details

- `sharp`로 각 run/bite 시트를 RGBA로 열어 448×128, 프레임별 머리·몸·발·꼬리의 불투명 픽셀, 프레임별 서로 다른 입 영역 체크섬, 대응 run과 같은 발 최하단 y를 확인한다.
- 의상 run과 bite의 몸통 픽셀 동일성 단언을 폐기한다. 몸통 영역의 실루엣 변화, 네 프레임의 서로 다른 자세, 두 번째 프레임의 앞다리 전진을 확인한다. 직접 그리기 템플릿은 네 프레임 모두 56×32 착색 범위 안에 넓은 흰색 몸통이 있어야 한다. 실제 의상 형태는 PNG 확대 리뷰로 확인한다.
- 테스트는 manifest의 여섯 key가 `required:true`, `kind:"spritesheet"`, 112×128×4임을 검사한다. asset validator와 빌드가 필수 파일을 읽어야 한다.

## Acceptance Criteria

- [ ] 상점 의상 5종과 직접 그린 의상 템플릿에서 물기 네 프레임 모두 전신·의상이 보인다.
- [ ] 바나나 후드·핫도그 외곽·기타 의상 디테일이 물기 도중 사라지지 않고 옛 얼굴이 겹치지 않는다.
- [ ] 여섯 이미지의 크기·프레임·발 위치·투명도·필수 에셋 등록이 확인된다.

## Validation

- `node --test scripts/corgi-bite-art.test.mjs scripts/outfit-bite-art.test.mjs` — 기본·의상 7개 시트 계약 통과.
- `node scripts/validate-assets.mjs` — 여섯 필수 파일 경로 검증 통과.
- `npm.cmd run build` — 필수 spritesheet 포함 빌드 성공.
- 기본·상점 의상 5종·직접 그리기 템플릿의 4프레임을 확대 확인하고 각 의상 윤곽이 유지되는지 검토한다.
- `git diff --cached --check` 및 `git diff --cached --stat` — 이미지·manifest·해당 테스트만 스테이징.

## Commit Message

```text
feat(코기): 모든 의상에 전신 물기 프레임 추가

Plan: 2026-10-28-corgi-bite-full-body
Phase: P01-bite-sprite
Task: T02-outfit-bite-art

- 상점 의상 5종과 직접 그린 의상 물기 시트 제작
- 의상 윤곽·프레임·발 위치 계약 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (이미지 테스트 9건, 필수 에셋 검사, 빌드, 확대 리뷰)
- commit: 이 Task의 Git 커밋
