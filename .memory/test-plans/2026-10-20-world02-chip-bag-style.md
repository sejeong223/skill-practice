# 월드 2 포카칩 봉지 참고 구도 검증 — 2026-10-20

- [확대 미리보기](./assets/2026-10-20-blue-snack-preview-v2.png)에서 흰색 봉합 윗부분, 빨간 로고, 파란 하단, 노란 과자와 정확한 `포카칩` 글씨를 육안 확인했다. [생성 원화](./assets/2026-10-20-blue-snack-source-v2.png)를 남겼다.
- 실제 게임 자산은 투명 배경 80×84px이다. 기존 봉지 Zone 42×28과 스프링 3종의 크기는 유지했다.
- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs`: 20/20 통과. 색 구성·크기·고양이 기능·기본 점프 이론상 여유를 확인했다.
- `node scripts/compose-world02-snack-bag.mjs --check`, `node scripts/validate-assets.mjs`(70개 항목, 필수 49개), `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 통과.
- 이번 수정 후 실제 브라우저 점프는 다시 실행하지 않았다. 충돌 Zone이 그대로인 상태에서 기존 브라우저 점프 검증과 자동화된 물리 계산을 근거로 한다.
