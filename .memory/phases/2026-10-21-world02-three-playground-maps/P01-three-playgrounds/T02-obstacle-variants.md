# Task: T02 캔·과자 봉지·고양이 외형 7장

## Status: pending

## Goal

월드 2 맵 2·3에서 기존 장애물 판정과 모양을 공유할 새 캔 2장, 봉지 1장, 고양이 2종의 잠든·할퀴는 그림 4장을 만든다.

## Decision Summary

- 모두 맵 1의 만화 같은 픽셀 테두리·색면에 맞춘 투명 PNG다. 새 캔과 봉지는 **외형만** 달라지고 물리 크기는 T03에서 기존 종류를 재사용한다.
- 첨부 사진은 치토스의 주황 밀봉 윗부분, 검은 봉지, 노랑 로고와 치즈 스낵 무늬의 색·구성 참고다. 실제 게임에서는 현재 포카칩처럼 바닥에 펼쳐진 세로 봉지 실루엣을 유지한다.

## Implementation

### I01. 캔과 봉지 변형

- Related Files:
  - `public/assets/pixel/props/world-02/crushed-cider-can.png` :: 초록·청록 사이다 캔; new.
  - `public/assets/pixel/props/world-02/crushed-fanta-can.png` :: 주황 환타 캔; new.
  - `public/assets/pixel/props/world-02/empty-cheetos-bag-ground.png` :: 치토스 디자인의 바닥에 놓인 과자 봉지; new.
  - `src/game/assets/assetManifest.json` :: 대응 키 `world-02-obstacle-crushed-cider-can`, `world-02-obstacle-crushed-fanta-can`, `world-02-obstacle-empty-cheetos-bag`; modify, 모두 `kind:"image"`, `worldId:"world-02"`, `required:true`.

#### Details

- **Signatures & Types**: 에셋은 기존 `PixelAssetDefinition`의 `{ key:string, kind:"image", url:string, worldId:"world-02", required:true }` 형태를 따른다. 코드 로직과 저장 스키마 변경 없음.
- **Data & Schema Fields**: 캔 각각 40×28px 투명 PNG, 기존 콜라 캔과 같은 비틀림·찌그러짐·바닥 접점. 봉지는 기존 `empty-snack-bag-ground.png`와 같은 1536×1024px 투명 캔버스·낮고 넓게 누운 실루엣; 게임 표시 크기 175×95px와 originY 0.88은 T03에서 적용한다.
- **Execution Flow / Logic**: 이미지 생성/편집에는 기존 콜라 캔과 현재 바닥의 포카칩 봉지를 로컬 참조 이미지로 사용한다. 새 봉지는 상단 주황, 하단 검정, 노랑 `치토스` 글씨/치즈 과자 조각을 픽셀 단위로 읽히게 한다. 캔의 중앙 글씨·색은 각각 다른 음료로 구분한다. 검은 배경이 아니라 알파 투명으로 저장한다.
- **Error & Exception Handling**: 사진의 직립 봉지를 그대로 배치하면 이전 사용자 피드백과 어긋난다. 새 봉지는 현재 바닥 봉지의 기울기와 두께를 기준으로 편집해 실제 게임 크기에서 비교한다.

### I02. 잠든·할퀴는 고양이 쌍

- Related Files:
  - `public/assets/pixel/props/world-02/sleeping-orange-cat.png`, `scratching-orange-cat.png` :: 주황 줄무늬 고양이; new.
  - `public/assets/pixel/props/world-02/sleeping-tuxedo-cat.png`, `scratching-tuxedo-cat.png` :: 검정·흰색 고양이; new.
  - `src/game/assets/assetManifest.json` :: 대응 `world-02-obstacle-{sleeping|scratching}-{orange|tuxedo}-cat` 네 키; modify, 모두 필수 이미지.
  - `scripts/world02-obstacle-assets.test.mjs` :: 기존 9장 검증을 보존하고 새 7장 형식·키·알파·그림 차이 검사; modify.
  - `scripts/world02-variant-assets.test.mjs` :: 캔 색 구분, 치토스 봉지 주황·검정·노랑 식별, 고양이 포즈와 색 비교; new.

#### Details

- **Signatures & Types**: 그림은 기존 `World02ObstacleSystem`의 Phaser `setTexture(key)`로 교체 가능한 독립 image 키다.
- **Data & Schema Fields**: 고양이 네 장 각각 96×56px 투명 PNG. 게임 표시 크기 100×60px와 충돌체 40×26px는 T03에서 정의한다.
- **Execution Flow / Logic**: 기존 `sleeping-fat-cat.png`/`scratching-fat-cat.png`의 가로 실루엣·발톱 방향·자주색 외곽선을 참조한다. 둘 다 잠든 자세와 앞발을 뻗는 할퀴기 자세를 별도로 그린다. 눈은 단순하고 흰 안광을 넣지 않는다.
- **Error & Exception Handling**: 잠든 그림만 새로 만들면 접촉 시 옛 회색 고양이로 바뀌므로 한 종류마다 포즈 쌍을 필수로 등록한다. 생성 결과의 실제 축소 표시와 투명 가장자리를 검사한다.

## Acceptance Criteria

- [ ] 새 캔 2장, 봉지 1장, 고양이 4장의 파일과 필수 에셋 키가 모두 존재한다.
- [ ] 캔의 찌그러짐, 낮게 놓인 치토스 봉지, 고양이 두 종류의 잠든/할퀴는 포즈가 실제 게임 크기에서 구별된다.
- [ ] 기존 콜라·포카칩·회색 고양이 이미지는 그대로 유지된다.

## Validation

- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-variant-assets.test.mjs`
- `node scripts/validate-assets.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`

## Commit Message

```text
feat(world02): 새 캔과 과자 봉지 및 고양이 그림 추가하기

Plan: 2026-10-21-world02-three-playground-maps
Phase: P01-three-playgrounds
Task: T02-obstacle-variants

- 기존 놀이터 화풍의 새 장애물 외형 7장 제작
- 투명도와 잠든·할퀴는 포즈 쌍 검사
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
