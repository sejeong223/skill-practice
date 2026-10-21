# Task: T02 월드 클리어 후 돌아오면 코인 재획득

## Status: done

## Goal

일반 스테이지 완료에는 코인 소진 기록이 유지되고 월드 보스 클리어 뒤에는 그 월드의 기록만 초기화해, 다시 돌아왔을 때 정상적으로 코인을 벌 수 있게 한다.

## Decision Summary

- 이번 사용자 요청의 월드 클리어 기준이 기존 스테이지별 재도전 로드맵보다 우선한다.
- 보스 스테이지 `world-XX-stage-boss`의 `EconomySystem.commitStageClear()`에서 해당 월드 기록만 제거하며, 기존 보유 잔액과 다른 월드 기록은 유지한다.

## Implementation

### I01. 월드 완료 시 기록 초기화

- Related Files:
  - `src/game/systems/coinLedger.ts` :: `clearCollectedCoinsForWorld`; modify
  - `src/game/systems/EconomySystem.ts` :: `commitStageClear`; modify
  - `scripts/coin-replay-ledger.test.mjs` :: 일반 완료/보스 완료/재도전 테스트; modify

#### Details

- **Signature**: `clearCollectedCoinsForWorld(progress: Pick<ProgressState, "collectedCoinIds">, worldId: WorldId): number`는 지운 항목 수를 반환한다.
- **Flow**: 일반 스테이지 완료는 ledger 불변. 보스 스테이지 완료 때 stageId의 월드 접두사와 일치하는 항목만 제거한다. `coin-changed`와 `stage-completed`의 자동 저장 전에 제거가 끝나야 한다. `StageRuntime.complete()`의 이미 완료된 상태 가드는 중복 처리 방지로 유지한다.
- **Error handling**: 다른 월드의 동명 coinId, 기존 잔액·구매품·스킬은 그대로다. 저장된 완료 기록 `clearedStages`만으로 소비 기록을 임의 초기화하지 않는다.

### I02. 실제 플레이와 전체 회귀

- Related Files:
  - `scripts/coin-replay-ledger.test.mjs` :: 스테이지/월드 경계; modify
  - `.memory/test-plans/2026-10-21-world-coin-replay.md` :: 브라우저와 검증 기록; new

#### Details

- 월드 1의 실제 코인 수집→사망→원래 위치 비표시/잔액 불변, 새로고침과 체크포인트 복원, 월드 1 보스 완료 후 월드 선택으로 돌아온 재획득을 확인한다. 월드 2의 같은 정책 및 다른 월드 기록 보존도 검사한다.
- 오래된 세이브는 기존 잔액을 유지한다. 상점 구매·뼈다귀 코인 표시·가짜 코인 효과·월드 선택·체크포인트 회귀를 확인한다.

## Acceptance Criteria

- [ ] 월드 보스 완료 전 사망·재접속으로 이미 먹은 코인을 다시 받을 수 없다.
- [ ] 해당 월드를 클리어한 뒤 돌아오면 같은 코인을 다시 먹을 수 있다.
- [ ] 월드 1 완료가 월드 2의 수집 기록/잔액을 바꾸지 않는다.

## Validation

- `node --test (Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)` — 전체 회귀.
- `node scripts/validate-assets.mjs`, `npm.cmd run world01:maps:check`, `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 자산·맵·정적 검사·빌드.
- 실제 Chrome에서 사망/새로고침/월드 재진입과 잔액·코인 표시를 확인한다.

## Commit Message

```text
feat(코인): 월드 클리어 후 재도전에서 코인을 다시 획득

Plan: 2026-10-21-world-coin-replay
Phase: P01-coin-lifecycle
Task: T02-reset-after-world-clear

- 보스 클리어 때 해당 월드 코인 기록만 초기화
- 사망 방지와 클리어 후 재수급을 통합 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `d231b77`
