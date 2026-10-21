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

## P02-T03 무기·방패 장착

- 상점 아이콘과 일치하는 투명 64×64 장착 이미지 9개를 만들고 필수 자산으로 등록했다. 기본 밥그릇은 기존 그림을 유지하며 새 방패를 장착하면 표시하지 않는다.
- [월드 2 신문지·우산](./assets/2026-10-21-goodboy-held-newspaper-umbrella.png), [삑삑이 공·쿠션](./assets/2026-10-21-goodboy-held-ball-cushion.png), [공격 중](./assets/2026-10-21-goodboy-held-attack.png), [좌향 이동](./assets/2026-10-21-goodboy-held-left.png), [월드 1 원반·냄비 뚜껑](./assets/2026-10-21-goodboy-held-world01.png)을 실제 Chrome 화면에서 확인했다. 처음 겹쳤던 무기·방패 위치는 분리해 다시 확인했다.
- 새 장비는 저장된 선택값으로 보스전에도 들어가며, 새 무기 J 입력은 고유 효과가 붙기 전까지 물건 이미지의 휘두름만 보여 준다. 기본 슬리퍼 이벤트는 발생하지 않는다. 공격·방어 고유 효과는 P03에서 연결한다.
- `node --test scripts/goodboy-held-assets.test.mjs scripts/goodboy-equipment-visual.test.mjs scripts/bowl-defense.test.mjs`: 5/5 통과. 장비 전면 배치·좌우 반전·교체·정리·기본 슬리퍼 이벤트 분리를 확인했다.
- 생성기·매니페스트 `--check`, `node scripts/validate-assets.mjs`, 타입 검사, 린트, 빌드가 모두 통과했다.

## P03-T01 무기별 실제 공격

- 월드 1 보스 재도전 화면에서 저장된 무기를 각각 장착해 `J`로 삼색이를 한 번씩 공격했다. 다섯 경우 모두 공격 전 체력 10/10에서 공격 후 9/10으로 바뀌었다: [신문지](./assets/2026-10-21-boss-rolled-newspaper-hit.png), [효자손](./assets/2026-10-21-boss-pink-backscratcher-hit.png), [삑삑이 공](./assets/2026-10-21-boss-squeaky-ball-hit.png), [뼈 부메랑](./assets/2026-10-21-boss-drumstick-boomerang-hit.png), [원반](./assets/2026-10-21-boss-plastic-frisbee-hit.png). [원반 공격 전 10/10](./assets/2026-10-21-boss-plastic-frisbee-before.png)과 비교했다.
- 신문지의 전방 사거리와 450ms 후딜레이, 효자손의 위쪽 판정과 명중 후 18px 반동, 공의 1회 튕김과 세 번째 고양이 그림자 방해, 부메랑의 귀환 중 재투척 금지, 원반의 빗나간 뒤 900ms 대기를 구현했다. `DrawbackDiscovery`를 실제 StageScene에 연결해 첫 발동만 저장한다.
- `node --test scripts/goodboy-weapons.test.mjs scripts/goodboy-equipment-visual.test.mjs scripts/calico-melee-hitbox.test.mjs scripts/bark-boss-stun.test.mjs`: 11/11 통과. 보스 공격 ID 중복 방지와 기본 슬리퍼·짖기 회귀를 포함한다.
- 타입 검사, 린트, `npm.cmd run build`를 서로 겹치지 않게 다시 실행해 모두 통과했다.

## P03-T02 방패별 실제 방어

- 보스 재도전 화면에 저장된 방패를 장착해 실제 가시 공격을 받았다. [쿠션](./assets/2026-10-21-boss-shield-cushion-pad-after.png), [피자 상자](./assets/2026-10-21-boss-shield-greasy-pizza-box-after.png), [우산](./assets/2026-10-21-boss-shield-umbrella-after.png), [냄비 뚜껑](./assets/2026-10-21-boss-shield-yellow-pot-lid-after.png) 모두 첫 방어 뒤 하트 3개, 강아지 0마리, 방어 횟수 1 감소를 확인했다.
- 방어 횟수를 마지막 1회로 설정한 실제 가시 충돌에서는 네 방패 모두 0회가 되어 그림이 사라지고 강아지는 0마리였다. [쿠션 마지막 방어](./assets/2026-10-21-boss-shield-cushion-pad-last-after.png)는 코기를 24px 밀었고, [피자 상자](./assets/2026-10-21-boss-shield-greasy-pizza-box-last-after.png)는 350ms 동안 미끄러졌다. [우산](./assets/2026-10-21-boss-shield-umbrella-last-after.png)은 앞쪽 가시만 막았다. [냄비 뚜껑](./assets/2026-10-21-boss-shield-yellow-pot-lid-last-after.png)은 ‘귀가 띵!’ 표시와 다음 투척 250ms 지연을 보였다.
- 같은 조건에서 [기본 밥그릇 마지막 방어](./assets/2026-10-21-boss-shield-upside-down-bowl-last-after.png)만 강아지 5마리와 중앙 경고를 표시했다. 옅은 붉은 화면과 기존 문구를 유지했다.
- `node --test scripts/goodboy-shields.test.mjs scripts/bowl-defense.test.mjs scripts/boss-feedback.test.mjs scripts/world02-obstacles.test.mjs`: 14/14 통과. 앞뒤·투사체·횟수·단점·기본 밥그릇·월드 2 장애물 즉사 규칙을 확인했다. 타입 검사, 린트, 빌드도 순차 통과했다.
