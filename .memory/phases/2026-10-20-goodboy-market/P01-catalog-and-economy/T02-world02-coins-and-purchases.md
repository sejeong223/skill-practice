# Task: T02 월드 2 뼈다귀 코인과 상점 거래

## Status: done

## Goal

월드 2 코인을 월드 1과 동일한 뼈다귀 픽셀로 표시하고, 새 카탈로그의 도구·의상·장신구를 공유 코인 지갑으로 한 번씩만 구매한다.

## Decision Summary

- 월드 2 코인 이미지는 `world-01-props` 아틀라스의 `bone-coin` 프레임과 `SNACK_PRESENTATION`의 34×26 표시 크기를 그대로 쓴다.
- 구매 실패(코인 부족·중복·유효하지 않은 ID)에는 코인을 빼지 않는다. 구매 성공 후 바로 장착할 수 있도록 구매 결과를 UI로 반환한다.

## Implementation

### I01. 월드 2 코인 표현

- Related Files:
  - `src/game/stages/StageRuntime.ts` :: `buildFromSegments`, `buildFromMap`; modify
  - `src/game/stages/StageEntityFactory.ts` :: `StageEntityRequest`, `createCoin`; modify if needed
  - `src/game/data/snackPresentation.ts` :: `SNACK_PRESENTATION`; read-only
  - `src/game/data/worlds.ts` :: `createSegment`; read-only unless 배치 높이 조정 필요
  - `scripts/world02-bone-coins.test.mjs` :: 월드별 코인 이미지 검증; new

#### Details

- **Execution Flow / Logic**: `buildFromSegments`에서 `definition.worldId === "world-02"`인 모든 코인 생성 요청에 `appearance: "bone"`을 준다. 이미 맵 기반 `collectibleType === "snack-coin"`인 코인은 기존 `bone` 로직을 유지한다. 월드 2 첫 스테이지 연속 모래바닥에서 골격 프레임이 땅에 묻히거나 장애물과 겹치지 않도록 y 좌표는 `SNACK_PRESENTATION.topOffsetFromFloor`와 실제 바닥선으로 계산한다. 코인 ID·수량·`coin-collected` 이벤트는 그대로 둔다.
- **Error & Exception Handling**: 프레임 누락 시 조용히 노란 원으로 떨어지지 않도록 기존 필수 아틀라스 검증에서 실패하게 한다. 월드 1 맵 배치와 다른 월드의 레거시 코인은 변형하지 않는다.

### I02. 구매 원자성·자동 저장

- Related Files:
  - `src/game/systems/EconomySystem.ts` :: `purchaseTool`를 일반 상품 구매로 확장하거나 `purchaseMarketProduct`; modify
  - `src/game/stages/stageEvents.ts` :: 구매 결과 이벤트 타입; modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: `SAVE_EVENTS`; modify
  - `scripts/goodboy-market-purchase.test.mjs` :: 잔액·소유권·중복·저장 테스트; new

#### Details

- **Signatures & Types**: 권장 `PurchaseResult = { ok: true; itemId: string; category: MarketCategory; bankedCoins: number } | { ok: false; reason: "insufficient-coins" | "already-owned" | "unknown-item" }`. `purchaseMarketProduct(itemId: string): PurchaseResult`. 기존 `purchaseTool(toolId: string): boolean`를 사용하는 테스트/호출자는 호환 래퍼로 유지할 수 있다.
- **Data & Schema Fields**: 가격은 `MARKET_PRODUCTS`만 참조한다. 무기·방패는 `ProgressState.ownedToolIds`, 의상·장신구는 `ownedCosmeticIds`에 넣는다. `bankedCoins`를 함께 갱신한다.
- **Execution Flow / Logic**: ID 확인 → 보유 확인 → 잔액 확인 → 코인 차감과 소유권 추가 → `tool-purchased` 또는 `market-item-purchased` 이벤트 발행 → `coin-changed` 및 자동 저장. 19종 중 `squeaky-ball`·`cushion-pad`도 새 가격 10 적용. 구매 실패에는 이벤트·차감 없음. `GameShell`이 구매 성공 직후 `equipment-change-requested` 또는 신규 `cosmetic-change-requested`를 발행해 바로 장착하도록 다음 UI Task에서 호출한다.
- **Error & Exception Handling**: 이중 클릭/연속 요청에도 같은 ID는 한 번만 과금한다. 새로고침 직후 마지막 구매가 사라지지 않도록 코인 변경 또는 구매 성공을 즉시 flush한다. 기존 `EconomySystem.collectCoin`과 `commitStageClear`는 같은 지갑을 사용한다.

## Acceptance Criteria

- [x] 월드 2 첫 스테이지를 포함한 fallback 구간의 코인이 뼈다귀 프레임으로 생성된다.
- [x] 월드 1·2 코인이 같은 `bankedCoins`를 올리고 19종을 각자 명시된 가격으로 구매한다.
- [x] 중복·코인 부족은 잔액/소유권 변화 없이 실패하며 구매 후 재로드해도 보유 상태가 남는다.

## Validation

- `node --test scripts/world02-bone-coins.test.mjs scripts/goodboy-market-purchase.test.mjs scripts/snack-wallet.test.mjs` — 코인 외형·지갑·구매.
- `npx tsc --noEmit && npm run lint && npm run build` — 타입·린트·빌드 통과.

## Commit Message

```text
feat(상점): 월드 2 뼈다귀 코인과 19종 상품 구매 연결

Plan: 2026-10-20-goodboy-market
Phase: P01-catalog-and-economy
Task: T02-world02-coins-and-purchases

- 월드 2 코인에 기존 뼈다귀 스프라이트 적용
- 코인 부족과 중복 결제를 막고 구매 내역 저장
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (관련 테스트 10건·타입 검사·린트·빌드)
- commit: 이 Task 커밋
