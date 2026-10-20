# Task: T01 상점 주인과 19종 상품 원본 이미지

## Status: done

## Goal

상점 화면에서 바로 보여 줄 골든 리트리버 주인과 상품 19종의 서로 구별되는 픽셀 아트 이미지를 만든다.

## Decision Summary

- 비교 기준은 `public/assets/pixel/characters/corgi/corgi-run.png`과 `public/assets/pixel/props/world-01/world-01-props.png`. 기존 사용자가 거부한 실사·광택 눈·세밀한 털 묘사를 피한다.
- 19개 상품 아이콘은 투명한 64×64 PNG, 주인은 투명한 256×256 PNG. 확대 시 nearest-neighbor로 픽셀을 보존한다.

## Implementation

### I01. 주인과 상품 디자인

- Related Files:
  - `public/assets/pixel/shop/goodboy-retriever.png` :: 골든 리트리버 반신 픽셀 아트; new
  - `public/assets/pixel/shop/items/{id}.png` :: 아래 ID 19종; new
  - `src/game/data/marketCatalog.ts` :: `MARKET_PRODUCTS.iconUrl`; read-only / 경로 정합 수정
  - `scripts/goodboy-market-assets.test.mjs` :: 파일·해상도·알파 검증; new

#### Details

- **Data & Schema Fields**: 주인은 짧고 둥근 귀, 금빛 털, 점·짧은 선으로 된 단순한 눈, 다정한 미소, 몸통을 가리는 연두색 조끼. 어두운 자주색 외곽선, 2~4단계 명암, 평면에 가까운 색. 아이콘은 64×64 안에 전체 형태가 잘리지 않도록 4px 이상 투명 여백을 둔다. 아이콘 파일명은 P01 카탈로그의 `id`와 완전히 같다.
- **각 상품의 필수 실루엣/색**:
  - 무기 5: `squeaky-ball`은 노란 둥근 공과 삑삑이 구멍; `rolled-newspaper`는 묶인 회색 신문말이; `pink-backscratcher`는 손가락 모양 끝의 분홍 효자손; `drumstick-boomerang`은 닭다리 모양 굽은 뼈; `plastic-frisbee`는 테두리 있는 밝은 플라스틱 원반.
  - 방패 4: `cushion-pad`는 누빈 폭신한 패드; `greasy-pizza-box`는 삼각 기름 얼룩이 있는 납작한 피자 상자; `umbrella`는 손잡이와 큰 펼친 우산; `yellow-pot-lid`는 노란 양은 뚜껑과 손잡이.
  - 의상 5: `pink-caterpillar-suit`는 둥근 애벌레 마디; `banana-peel-suit`는 3갈래 바나나 껍질; `bee-bodysuit`는 노랑·검정 줄무늬와 작은 날개; `hotdog-outfit`은 갈색 빵 양쪽과 소시지; `diamond-armor`는 하늘색 각진 흉갑.
  - 장신구 5: `shinchan-eyebrow-sticker`는 두꺼운 검은 눈썹 2개; `birthday-party-hat`은 알록달록한 원뿔; `strawberry-headpiece`는 딸기 꼭지와 씨; `propeller-hat`은 작은 어린이용 프로펠러 모자; `prince-crown`은 금빛 3봉 왕관.
- **Execution Flow / Logic**: 상품별 원본을 같은 팔레트와 아웃라인으로 제작한다. 투명 배경을 유지하고 파일 하나에 한 품목만 둔다. 실제 게임 크기(상점 카드 64~96px)에서 실루엣을 눈으로 검토해 피자 박스/신문지 등 유사한 갈색 물체가 구별되게 한다. 이미지를 바꾸면서 기존 월드 1 원본 이미지는 수정하지 않는다.
- **Error & Exception Handling**: 파일 누락, 완전 불투명 배경, 잘린 외곽선, 카탈로그 URL 불일치는 검사 실패 처리한다. 주인 이미지도 마찬가지다.

## Acceptance Criteria

- [x] 주인은 연두색 조끼·친절한 미소·단순한 눈의 골든 리트리버로 한눈에 보인다.
- [x] 아이콘 19종이 모두 다른 파일로 있고 가격표의 상품명과 형태·색이 맞다.
- [x] 실사풍/눈의 안광/부드러운 사진식 그라데이션이 없고 월드 1 픽셀 아트와 어울린다.

## Validation

- `node --test scripts/goodboy-market-assets.test.mjs` — 20개 PNG의 수·크기·알파·경로.
- `node scripts/validate-assets.mjs` — 기존 자산 회귀.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- 이미지 뷰어 또는 임시 로컬 접촉표에서 19종 상품을 1×·2× 배율로 확인하고 결과를 `.memory/test-plans/2026-10-20-goodboy-market.md`에 기록한다. 실제 상점 UI 검증은 P04-T03에서 수행한다.

## Commit Message

```text
feat(상점): 리트리버 주인과 상품 19종 픽셀 아트 제작

Plan: 2026-10-20-goodboy-market
Phase: P02-pixel-art-and-equipment
Task: T01-market-pixel-art

- 연두색 조끼 상점 주인 이미지 추가
- 카테고리별 19종 투명 상품 아이콘 제작
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (상품 PNG 20개·재생성·자산 검사·타입 검사·린트·빌드)
- [시각 검증](../../../test-plans/2026-10-20-goodboy-market.md)
- commit: 이 Task 커밋
