# 리트리버의 굿보이 마켓 검증 — 2026-10-20

## P02-T01 상점 원본 이미지

- [골든 리트리버 주인 원화](./assets/2026-10-20-goodboy-shopkeeper-source.png)에서 작은 무광 눈, 미소, 연두색 조끼를 확인했다. 실제 게임용 PNG는 `public/assets/pixel/shop/goodboy-retriever.png` 256×256이다.
- 상품 19종을 [1× 연락 시트](./assets/2026-10-20-goodboy-market-contact-sheet.png)와 [2× 연락 시트](./assets/2026-10-20-goodboy-market-contact-sheet-2x.png)에서 확인했다. 무기 5, 방패 4, 의상 5, 장신구 5 순서이며 각 형태와 색이 구별된다.
- `node --test scripts/goodboy-market-assets.test.mjs`: 2/2 통과. 20개 이미지의 카탈로그 경로, 64×64/256×256 크기, 투명 여백, 고유 파일을 검사한다.
- `node scripts/generate-goodboy-market-assets.mjs --check`, `node scripts/validate-assets.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 통과.
- 실제 상점 카드 배치는 P04-T03에서 검증한다.
