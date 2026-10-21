# Task: T01 먹은 코인을 저장하고 재시도에서 숨기기

## Status: done

## Goal

실제 코인을 한 번 먹은 뒤 사망·체크포인트·새로고침으로 같은 위치를 다시 지나도 코인이 보이지 않고 잔액이 한 번만 증가하게 한다.

## Decision Summary

- 진행 상태에 `collectedCoinIds: string[]`를 추가한다. 원소는 `${stageId}:${coinId}`이며 같은 문자열 coinId라도 스테이지가 다르면 별개다.
- 기존 세이브에 필드가 없으면 `[]`로 복원하고 잔액은 그대로 둔다. 가짜 코인은 StageRuntime의 `coin` 레코드가 아니므로 기록 대상에서 제외한다.

## Implementation

### I01. 저장 모델과 공통 키

- Related Files:
  - `src/game/core/types.ts` :: `ProgressState.collectedCoinIds`; modify
  - `src/game/core/constants.ts` :: `createDefaultProgressState`; modify
  - `src/game/persistence/migrations.ts` :: `migrateSave`; modify
  - `src/components/game/GameShell.tsx` :: `cloneProgress`; modify
  - `src/game/systems/coinLedger.ts` :: `coinLedgerKey`, `hasCollectedCoin`, `recordCollectedCoin`; new
  - `src/game/systems/EconomySystem.ts` :: `collectCoin(stageId, amount, coinId?)`; modify

#### Details

- **Signatures & Types**: `coinLedgerKey(stageId: StageId, coinId: string): string`; `hasCollectedCoin(progress: Pick<ProgressState, "collectedCoinIds">, stageId: StageId, coinId: string): boolean`; `recordCollectedCoin(...): boolean`는 최초 기록에만 true를 반환한다.
- **Schema**: 새 배열 기본값 `[]`, 저장 envelope `schemaVersion: 3` 유지. 마이그레이션에서 문자열 배열만 수용하고 중복을 제거한다. 과거 필드가 없으면 빈 배열. 기존 bankedCoins 등은 그대로 승계한다.
- **Flow**: 실제 게임은 `coinId`를 전달해 기록을 잔액 증가 이벤트 `coin-changed`보다 먼저 추가한다. 기존 집계형 `collectCoin(stageId, amount)` 호출은 호환을 위해 ID 없는 직접 적립으로 유지한다. 빈 ID/중복 기록은 지급하지 않는다.

### I02. 엔티티 생성·재시작 동작

- Related Files:
  - `src/game/stages/StageRuntime.ts` :: `add`, `collectCoin`, `resetCoins`; modify
  - `scripts/snack-wallet.test.mjs` :: 기존 사망 재획득 기대값 수정; modify
  - `scripts/coin-replay-ledger.test.mjs` :: 저장/재시도/스테이지 ID 구분; new

#### Details

- 생성된 실제 코인 엔티티는 기록에 있으면 즉시 inactive/invisible, StaticBody disabled로 만든다. `resetCoins()`도 기록된 코인을 다시 켜지 않는다.
- `collectCoin`은 활성 엔티티와 미기록 ID를 모두 확인하고 `EconomySystem.collectCoin(stageId, 1, coinId)` 성공 때만 비활성화·잔액 증가·획득 이벤트를 발생시킨다. 기존 활성 코인의 중복 overlap 방지는 유지한다.
- `currentStageCoins`는 사망 후 0이지만 `bankedCoins`와 코인 기록은 그대로다. 다른 스테이지에서 같은 coinId는 독립이다. 저장 직후 재로드와 체크포인트 스냅샷 복원도 검사한다.

## Acceptance Criteria

- [ ] 사망·체크포인트·새로고침 뒤 먹은 코인이 화면/충돌에서 빠지고 잔액이 다시 오르지 않는다.
- [ ] 가짜 코인과 다른 스테이지의 같은 문자열 ID는 영향이 없다.
- [ ] 기존 세이브의 잔액·장비·진행 상태가 유지된다.

## Validation

- `node --test scripts/coin-replay-ledger.test.mjs scripts/snack-wallet.test.mjs scripts/goodboy-market-purchase.test.mjs` — 수집·저장·재시도.
- `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 정적 검사와 빌드.

## Commit Message

```text
feat(코인): 먹은 코인을 저장하고 사망 후 다시 나오지 않게 수정

Plan: 2026-10-21-world-coin-replay
Phase: P01-coin-lifecycle
Task: T01-persist-collected-coins

- 실제 코인 ID를 스테이지별로 저장하고 재시작에서 숨김
- 기존 저장 호환과 잔액 중복 적립 방지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `35831fa`
