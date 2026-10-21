# 월드 2 반복 비둘기 검증 기록

## 결과

- 월드 2 첫 스테이지의 첫 트리거 x=830에서 비둘기가 즉시 나타나고, 같은 구간에 코기가 머물러도 계속 나타난다.
- 실제 Chrome에서 연속 두 생성의 장면 시간 간격은 2016.6ms였다. 목표 2000ms와 한 렌더 프레임 정도의 차이다.
- 첫 비둘기는 x=1324, 1280, 1236에 세 번 떨어뜨렸다. [실제 화면](./assets/2026-10-21-world02-repeating-pigeons.png)에서 동시 비행 비둘기 두 마리와 개별 착지·낙하를 확인했다.
- 일시정지 후 실제 시간 2.2초 동안 비둘기의 x와 생성 횟수가 변하지 않았다. 재개 후 세 번째 새가 나타났다.
- 똥 접촉으로 사망 1회가 발생하고 월드 2 체크포인트 x≈2496으로 돌아왔다. 브라우저 예외 0건, 필수 `/assets/` 404 0건.
- 기존 단발 시나리오 실행 파일 `browser-world02-pigeon-drops.mjs`는 이 반복 시나리오를 실행하도록 연결했다.

## 검증

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/death-system.test.mjs`: 18/18 통과.
- `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 통과.
- `node .memory/test-plans/browser-world02-repeating-pigeons.mjs`: 실제 Chrome 검증 통과.
