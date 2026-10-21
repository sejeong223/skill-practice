# 월드 클리어 후 코인 재획득 검증 — 2026-10-21

## 규칙

- 실제 코인 식별자는 `${stageId}:${coinId}`로 저장한다. 사망·체크포인트 복귀·새로고침 뒤에는 이미 먹은 코인이 보이지 않고 충돌도 없다.
- 일반 스테이지 완료는 기록을 유지한다. 월드 보스 스테이지 완료 때 해당 월드 기록만 지우며, 보유 잔액과 다른 월드 기록은 유지한다. 이전 로드맵의 스테이지 완료별 초기화 대신 이번 사용자 요청을 적용했다.
- 옛 저장에는 코인별 기록이 없으므로 기존 잔액과 장비를 유지하고 새 기록은 빈 배열로 시작한다.

## 자동 검증

- `node --test scripts/coin-replay-ledger.test.mjs scripts/snack-wallet.test.mjs scripts/goodboy-market-purchase.test.mjs`: T01에서 11/11 통과. 실제 StageRuntime 엔티티의 사망/체크포인트 reset, 새 장면 생성, 저장 복원, 다른 스테이지 동명 ID와 기존 저장 호환을 확인했다.
- `node --test (Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)`: 40개 파일, 전체 136/136 통과. 일반 스테이지 완료와 월드 1·2 보스 완료 시 각각 기록 유지·초기화를 확인했다.
- `node scripts/validate-assets.mjs`: 등록 자산 99개·필수 78개 통과. `npm.cmd run world01:maps:check`: 월드 1 맵 4개·기믹 32개·Tiled 객체 58개 통과. 타입 검사, 린트, `npm.cmd run build` 순차 통과.

## 브라우저 검증

- Chrome 1280×720, 저장된 월드 1 보스 클리어 상태에서 첫 스테이지 코인 `world-01-stage-1-snack-1`을 실제 Arcade overlap으로 먹었다. 잔액 0→1, 기록 1개, 코인 화면·충돌 비활성화. 사망 뒤 재시도와 새로고침에서도 잔액 1·비활성화를 유지했다. [사망 뒤 화면](./assets/2026-10-21-coin-after-death.png).
- 월드 선택 경로로 월드 1 보스 장면에 들어가 실제 `StageRuntime.complete()`를 호출해 완료 처리했다. 기록이 0개가 되고 잔액 1은 유지됐다. 월드 1 첫 스테이지로 다시 들어가니 같은 코인이 보였고 [재도전 화면](./assets/2026-10-21-coin-after-world-clear.png), 재획득 시 잔액이 2가 됐다. 보스 체력을 공격해서 승리시키는 전체 전투는 이 검증에서 생략했지만, 승리 처리 코드가 호출하는 동일한 완료 메서드를 실제 장면에서 실행했다.
- 월드 2 첫 스테이지의 코인 `world-02-stage-1-segment-1-coin-1`도 실제 overlap으로 먹은 뒤 사망했다. 재시도에서 코인 비표시·충돌 비활성·잔액 1을 확인했다. 월드 2 보스 완료 뒤 재수급은 현재 월드 2 보스전 미구현으로 자동 단위 검증만 수행했다.
- 브라우저 예외 0건. 검증 스크립트: [browser-coin-replay.mjs](./browser-coin-replay.mjs).
