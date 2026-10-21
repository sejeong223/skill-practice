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

## P04-T01 게임 중 상점 화면

- 월드 2 플레이 화면에서 [데스크톱 상점](./assets/2026-10-21-goodboy-shop-desktop.png)과 [720×405 화면](./assets/2026-10-21-goodboy-shop-mobile.png)을 확인했다. 네 분류 버튼·네모 안 좌우 화살표·리트리버 주인·상품 이미지와 대사가 표시되고, 모바일 상단의 상점·일시정지·초기화·월드 선택 버튼이 서로 겹치지 않았다.
- 100코인에서 의상 12, 왕관 24, 무기 10, 방패 10코인을 구매했다. 잔액 44코인, 네 장비 선택값, 코기 외형이 즉시 바뀌었다. [장착 후 화면](./assets/2026-10-21-goodboy-shop-equipped.png). Escape로 닫으면 일시정지 창 없이 동일한 x=96에서 다시 플레이했다.
- 0코인 구매 시 [부족 대사](./assets/2026-10-21-goodboy-shop-insufficient.png)가 나오고 코인·소유 상태가 변하지 않았다. 브라우저 예외 0건. `node --test scripts/goodboy-shop-ui.test.mjs scripts/goodboy-market-purchase.test.mjs scripts/world-selection.test.mjs`: 12/12 통과.

## P04-T02 출입 효과음과 전용 BGM

- 44.1kHz·16비트 WAV 벨 0.82초와 상점 원곡 88BPM·8마디 21.82초를 재현 가능한 스크립트로 생성했다. 파형의 무음·클리핑·반복 경계와 컨트롤러의 3회 이상 재입장·탭 숨김·재생 거부 재시도를 검사했다. `node --test scripts/goodboy-shop-audio.test.mjs scripts/audio-pause.test.mjs`: 15/15 통과.
- Chrome의 실제 사용자 클릭 이벤트로 월드 2, 월드 1 일반 구간, 삼색이 보스전에서 각각 세 번 출입했다. 들어간 동안 상점 WAV 두 개가 재생되고 기존 음악 관리자는 정지했다. 나온 뒤 상점 루프는 0초·정지 상태, 기존 음악은 같은 곡 키로 재개됐고 브라우저 예외는 0건이었다. 보스 인트로는 저장된 관람 기록으로 건너뛴 뒤 확인했다.
- 브라우저의 재생 상태와 시간은 확인했다. 효과음의 주관적인 청감은 자동 검증 범위 밖이다.

## P04-T03 전체 통합 검증

- [19종 전부 구매한 화면](./assets/2026-10-21-goodboy-shop-all-purchased.png)에서 카테고리별 5/4/5/5개를 각각 넘겨 이름·가격·64px 이미지 로드를 확인하고 전부 구매했다. 시작 1000코인에서 합계 290코인을 쓴 710코인이 남았으며, 새로고침 뒤에도 소유 목록 19종과 잔액이 복원됐다. 첫 상품의 버튼은 `장착`으로 바뀌어 중복 구매 경로가 사라졌다. 예외 0건.
- `node --test scripts/goodboy-market-integration.test.mjs`: 2/2 통과. 월드 1·2 코인 공유, 구매 이벤트, 의상·방패 저장 복원, 중복 구매 방지와 카탈로그 이미지의 실제 파일을 함께 검사했다.
- `Get-ChildItem scripts -Filter '*.test.mjs'`로 찾은 39개 파일을 `node --test`에 전달하여 전체 132/132 통과. `node scripts/validate-assets.mjs`는 99개 등록·78개 필수 자산 통과, `npm.cmd run world01:maps:check`는 월드 1 네 맵·32개 기믹·58개 Tiled 객체 통과. 타입 검사, 린트, `npm.cmd run build`도 순차 통과했다.
- 기존 P02·P03의 실제 코기 착용/짖기/점프/좌우 이동·보스 무기 5종 명중·방패 4종 첫/마지막 방어 화면을 함께 회귀 근거로 삼았다. 이번 변경에서는 해당 동작을 다시 구현하거나 수정하지 않았다.
