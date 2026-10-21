# Plan: 리트리버의 굿보이 마켓

## Goal

월드 2에도 월드 1과 같은 뼈다귀 코인을 배치하고, 월드 1·2 플레이 중 열 수 있는 `리트리버의 굿보이 마켓`을 완성한다. 19종 상품 디자인, 구매·저장·착용, 9종 장비의 고유 효과, 상점 주인·대사, 딸랑 효과음과 전용 음악을 실제 게임에서 확인한다.

## Decisions

[2026-10-20-goodboy-market](../decisions/2026-10-20-goodboy-market.md)의 목록·가격·문구·동작·기존 저장 호환성·전투 효과를 따른다. 이 단계는 청사진 작성만 하며 코드나 이미지를 만들지 않는다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 상품 카탈로그·저장 스키마·코인·구매 | [P01](../phases/2026-10-20-goodboy-market/P01-catalog-and-economy/phase.md) |
| P02 | `done` | 상점 주인과 상품 이미지, 기존 코기에 맞는 착용 레이어 | [P02](../phases/2026-10-20-goodboy-market/P02-pixel-art-and-equipment/phase.md) |
| P03 | `done` | 현재 구현된 전투에서 무기·방패별 실제 효과 | [P03](../phases/2026-10-20-goodboy-market/P03-combat-behaviors/phase.md) |
| P04 | `done` | 상점 UI·일시정지·음향·전체 검증 | [P04](../phases/2026-10-20-goodboy-market/P04-shop-experience/phase.md) |

## Dependencies and guardrails

- 순서: 데이터·저장 → 아트·실시간 착용 → 공격/방어 → 상점 UI·음악·종단 검증. 각 Task는 완료 후 타입 검사·관련 테스트·빌드 통과 상태로 커밋한다.
- 판매 목록은 정확히 무기 5, 방패 4, 의상 5, 장신구 5종. 이전 구매품은 목록에서 숨겨도 저장에서 삭제하지 않는다.
- 상점 전용 음악 동안 기존 월드 음악은 일시정지하고 닫을 때 중복 재생 없이 재개한다. 상점에서 `Escape`를 눌렀을 때 Phaser의 일반 일시정지 토글과 충돌하지 않게 한다.
- 착용 파츠는 `corgi-run` 112×128의 4프레임과 `corgi-bark` 112×128에 맞추며 코기 본체를 교체하지 않는다. 기존 월드 1의 단순 픽셀·만화식 스타일을 따른다.
- 기존 월드 2 점프 장애물의 즉사 규칙, 밥그릇·짖기·월드 선택·체크포인트 정책을 회귀시키지 않는다.
