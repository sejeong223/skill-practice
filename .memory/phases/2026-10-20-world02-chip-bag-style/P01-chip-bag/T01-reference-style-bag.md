# Task: T01 참고 구도 포카칩 봉지

## Status: done

## Goal

월드 2의 과자 봉지를 참고 이미지와 같은 큰 구도의 만화식 픽셀 아트로 바꾼다.

## Implementation

- `.memory/test-plans/assets/2026-10-20-blue-snack-source-v2.png` — imagegen 원화. 흰 윗부분·빈 빨간 로고·파란 하단·단순한 노란 감자칩, 투명 배경; new.
- `scripts/compose-world02-snack-bag.mjs` — 원화를 80×84px로 축소하고 정확한 `포카칩` 글자를 합성; modify.
- `public/assets/pixel/props/world-02/empty-snack-bag.png` — 실제 게임 자산; modify.
- `src/game/data/world02Obstacles.ts` — 봉지의 표시 크기와 기존 점프 가능한 Zone을 확인; modify.
- `scripts/world02-obstacle-assets.test.mjs`, `scripts/world02-obstacles.test.mjs` — 새 크기·색·점프 검증; modify.

## Acceptance Criteria

- [x] 게임 픽셀 스타일로 흰색 상단·빨간 로고·파란 하단·감자칩·`포카칩`을 알아볼 수 있다.
- [x] 봉지가 선 포장 형태이고 기존 충돌·점프 기능이 유지된다.

## Validation

- `node scripts/compose-world02-snack-bag.mjs --check`
- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs`
- `node scripts/validate-assets.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`
- 확대 미리보기 육안 확인.

## Commit Message

```text
fix(월드2): 포카칩 봉지를 참고 구도의 픽셀 아트로 수정

Plan: 2026-10-20-world02-chip-bag-style
Phase: P01-chip-bag
Task: T01-reference-style-bag

- 흰색 상단과 빨간 로고, 파란 하단과 과자 조각 구성
- 정확한 포카칩 글씨와 점프 가능한 크기 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (관련 테스트 20건·자산 검사·재생성 검사·타입 검사·린트·빌드)
- [검증 기록](../../../test-plans/2026-10-20-world02-chip-bag-style.md)
- commit: 이 Task 커밋
