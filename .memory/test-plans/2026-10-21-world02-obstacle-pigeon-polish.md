# 월드 2 장애물과 비둘기 연출 검증

- 날짜: 2026-10-21
- 대상: `world-02-stage-1`

## 자동 검증

- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs`: 30/30 통과.
- `node scripts/validate-assets.mjs`: 필수 에셋 81개를 포함한 102개 등록 확인.
- `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 통과.

## 실제 게임 확인

- 전용 Chrome에서 `node .memory/test-plans/browser-world02-repeating-pigeons.mjs` 통과.
- 포카칩 봉지는 최초 주황 봉지처럼 모래에 낮게 놓인 픽셀 그림을 사용하며, 기존 흰색 상단·빨간 로고·파란 하단·감자칩을 유지한다. [화면](./assets/2026-10-21-world02-snack-bag-ground.png).
- 줄인 고양이 그림과 코기 점프 여유를 [화면](./assets/2026-10-21-world02-smaller-cat.png)에서 확인했다.
- 한 비둘기의 낙하 x 좌표는 `1364, 1280, 1196`이며, 착지 전 바닥 경고 표시가 없다. 두 번째 비둘기는 2016.5ms 뒤에 나타났다. [화면](./assets/2026-10-21-world02-repeating-pigeons.png).
- 일시정지 중 새의 이동과 재등장은 멈췄고, 낙하물 접촉 사망은 1건으로 기록됐다. 체크포인트 `world-02-stage-1-checkpoint`로 복귀했고 브라우저 예외·에셋 404는 0건이다.

## 범위와 남은 점

- 기존 `empty-snack-bag.png`와 `compose-world02-snack-bag.mjs`는 기존 디자인의 원본으로 보존했다. 실제 스테이지는 `empty-snack-bag-ground.png`를 읽으므로, 옛 합성 스크립트를 다시 실행해도 현재 게임 속 봉지는 바뀌지 않는다.
