# 월드 2 놀이터 점프 장애물 검증 기록

## T01 — 이미지와 에셋

- 월드 1 `world-01-props.png`를 선·면·눈 스타일의 기준으로 사용하고, 월드 2 놀이터 배경과 모래의 밝은 노랑·청록·분홍을 색 참고로 사용했다.
- 기본 제공 imagegen 도구로 각 물건의 투명 원화를 제작하고, 동물의 눈을 흰 안광 없는 점눈으로 수정했다. `sharp`의 nearest-neighbor 축소·투명 패딩·32색 팔레트로 9개 게임 크기 PNG를 만들었다. 과자 봉지 원화의 배경빛은 투명 알파로 정리했다.
- 결과물: `public/assets/pixel/props/world-02/`의 PNG 9개. 비교 이미지: [연락 시트](./assets/2026-10-20-world02-obstacle-contact-sheet.png).
- 검증: `node --test scripts/world02-obstacle-assets.test.mjs` 11/11, `node scripts/validate-assets.mjs` 통과(70항목·필수 49개), `npm.cmd run build` 통과, `node node_modules/typescript/bin/tsc --noEmit` 통과. 1× PNG를 2배 확대 연락 시트로 육안 확인했다.

## T02 — 배치와 일반 충돌

- 월드 2 첫 스테이지의 색 사각형 임시 함정·적을 제거하고, 8종 PNG의 바닥 기준을 y=504로 맞췄다. 코인의 경로, 연속 모래 발판, 체크포인트와 출구는 유지했다.
- 일반 7종에는 보이지 않는 정적 Arcade Zone의 overlap을 연결하고 기존 `death-requested` 이벤트를 전송한다. 고양이는 T03을 위해 특수 접촉으로 구분했다.
- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-sand-floor.test.mjs` 16/16, `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit` 모두 통과했다. 실제 충돌·점프와 체크포인트 재시작은 T04에서 확인한다.

## T03~T04

- 고양이 연출과 브라우저 플레이 검증 결과를 작업 순서대로 추가한다.
