# 월드 2 비둘기 배설 간격 검증

- 날짜: 2026-10-21
- 대상: `world-02-stage-1`

## 자동 검증

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs`: 10/10 통과. 한 비둘기의 세 낙하 x가 `1364, 1280, 1196`이고 간격이 약 824ms임을 확인했다.
- `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 통과.

## 실제 게임 확인

- 전용 Chrome에서 `WORLD02_CAPTURE_SCREENSHOTS=0`으로 `browser-world02-repeating-pigeons.mjs`를 실행했다.
- 첫 비둘기의 두 연속 배설 간격: `833.3ms`, `816.6ms`. 목표 `823.5ms`의 프레임 오차 범위 안이다.
- 비둘기 재등장 간격: `2016.5ms`로 기존 2초 주기를 유지했다. 세 낙하 지점과 바닥 예고 표시 없음도 확인했다.
- 일시정지 중 이동·재등장 멈춤, 낙하물 접촉 사망 1건, 체크포인트 복귀, 브라우저 예외 0건, 필수 에셋 404 0건을 확인했다.

## 알아야 할 점

- 비둘기 속도가 `160 → 102px/s`로 내려가 한 새의 총 비행 시간이 길어졌다. 2초마다 새 개체가 나타나는 기존 정책은 유지하므로 여러 비둘기가 동시에 보일 수 있다.
