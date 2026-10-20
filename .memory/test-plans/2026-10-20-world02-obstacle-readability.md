# 월드 2 장애물 가독성 검증 — 2026-10-20

- 캔 72×50, 봉지 96×64, 삽 64×84, 라바콘 72×78, 고양이 두 포즈 128×75로 표시 크기를 키웠다. 오리·코끼리·토끼 스프링 기구의 이미지 및 충돌 범위는 유지했다.
- [파란 포카칩 봉지 확대 미리보기](./assets/2026-10-20-blue-snack-preview.png)에서 색과 정확한 한글을 확인했다. 원본 원화는 [여기](./assets/2026-10-20-blue-snack-source.png)에 보관했다.
- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/world02-sand-floor.test.mjs`: 22/22 통과. 점프 속도·중력·달리기 속도와 Zone 크기로 단일 점프 통과 가능성을 검사했고, 고양이 포즈 전환/초기화의 표시 크기를 검사했다.
- `node scripts/compose-world02-snack-bag.mjs --check`, `node scripts/validate-assets.mjs`(70개 항목, 필수 49개), `npm.cmd run lint`, `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run build`: 모두 통과.
- 이번 변경에서는 실제 브라우저로 첫 스테이지를 다시 달려보는 검증은 하지 않았다. 직전 장애물 계획에서 8종 전체 점프·접촉·체크포인트를 Chrome으로 확인한 기록은 [여기](./2026-10-20-world02-playground-jump-obstacles.md)에 있다. 이번 점프 안전성은 자동화된 물리 계산에 근거한다.
