# 리트리버의 굿보이 마켓 검증 — 2026-10-20

## P02-T01 상점 원본 이미지

- [골든 리트리버 주인 원화](./assets/2026-10-20-goodboy-shopkeeper-source.png)에서 작은 무광 눈, 미소, 연두색 조끼를 확인했다. 실제 게임용 PNG는 `public/assets/pixel/shop/goodboy-retriever.png` 256×256이다.
- 상품 19종을 [1× 연락 시트](./assets/2026-10-20-goodboy-market-contact-sheet.png)와 [2× 연락 시트](./assets/2026-10-20-goodboy-market-contact-sheet-2x.png)에서 확인했다. 무기 5, 방패 4, 의상 5, 장신구 5 순서이며 각 형태와 색이 구별된다.
- `node --test scripts/goodboy-market-assets.test.mjs`: 2/2 통과. 20개 이미지의 카탈로그 경로, 64×64/256×256 크기, 투명 여백, 고유 파일을 검사한다.
- `node scripts/generate-goodboy-market-assets.mjs --check`, `node scripts/validate-assets.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 통과.
- 실제 상점 카드 배치는 P04-T03에서 검증한다.

## P02-T02 코기 의상·장신구 착용

- 의상 5종과 장신구 5종 각각을 기존 코기의 달리기 4프레임·짖기 1프레임에 맞춘 투명 PNG 20개로 제작했다. 원본 코기 이미지와 충돌 바디는 수정하지 않았다.
- [달리기 파츠 미리보기](./assets/2026-10-20-goodboy-wearables-run.png), [짖기 파츠 미리보기](./assets/2026-10-20-goodboy-wearables-bark.png)에서 전체 조합을 확인했다.
- 실제 Chrome 월드 2 화면에서 [꿀벌 옷+왕관](./assets/2026-10-20-goodboy-wearables-browser-bee-crown.png), [핫도그 옷+생일 고깔](./assets/2026-10-20-goodboy-wearables-browser-hotdog-hat.png), [짖기](./assets/2026-10-20-goodboy-wearables-browser-bark.png), [점프](./assets/2026-10-20-goodboy-wearables-browser-jump.png), [좌우 반전](./assets/2026-10-20-goodboy-wearables-browser-left.png)을 확인했다. 저장된 착용 정보를 새로고침 후 복원한 장면이다.
- `node --test scripts/goodboy-wearables-assets.test.mjs scripts/goodboy-wearables.test.mjs scripts/bark-presentation.test.mjs`: 6/6 통과. 20개 PNG 프레임·투명도, 포즈/방향/교체/벗기기, 저장·자동 저장 연결을 확인했다.
- `node scripts/generate-goodboy-wearables.mjs --check`, `node scripts/sync-goodboy-wearables-manifest.mjs --check`, `node scripts/validate-assets.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 통과.
- 상점 구매 버튼에서 즉시 착용 이벤트를 보내는 경로는 P04-T01에서 연결한다.
