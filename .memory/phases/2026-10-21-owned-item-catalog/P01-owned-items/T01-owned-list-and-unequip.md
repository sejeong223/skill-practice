# Task: T01 보유품 목록과 의상·장신구 벗기

## Status: done

## Goal

보유 도구·외형만 정확히 모으는 카탈로그 데이터를 만들고, 이미 착용한 의상·장신구를 상점에서 벗겨 코기와 저장 상태에 즉시 반영한다.

## Decision Summary

- 무기·방패 장착값은 필수 문자열 그대로 유지한다. 외형 두 슬롯만 `null`로 벗기며 구매·소유 기록은 바꾸지 않는다.
- 판매 목록의 19종만 읽으면 기본 토끼 슬리퍼·뒤집힌 밥그릇과 과거 저장의 종이관·종이 상자가 빠지므로, 도구 정의와 보유 ID를 카탈로그의 기준으로 사용한다.

## Implementation

### I01. 보유품 전용 카탈로그 데이터

- Related Files:
  - `src/game/data/ownedItemCatalog.ts` :: `OwnedCatalogEntry`, `getOwnedCatalogEntries`; new.
  - `src/game/data/marketCatalog.ts` :: `MARKET_CATEGORIES`, `MARKET_PRODUCTS`, `getMarketProduct`; read-only.
  - `src/game/data/tools.ts` :: `TOOL_DEFINITIONS`; read-only.
  - `src/game/data/toolPresentation.ts` :: `getToolPresentation`; read-only.
  - `scripts/owned-item-catalog.test.mjs` :: 보유품 선택·분류·기본/예전 도구·미보유 제외; new.

#### Details

- **Signatures & Types**:
  ```typescript
  export type OwnedCatalogEntry = Readonly<{
    id: string;
    nameKo: string;
    descriptionKo: string;
    iconUrl: string | null;
  } & (
    { category: "weapon" | "shield"; toolId: ToolId; cosmeticId?: never } |
    { category: "outfit" | "accessory"; cosmeticId: CosmeticId; toolId?: never }
  )>;
  export function getOwnedCatalogEntries(
    progress: Pick<ProgressState, "ownedToolIds" | "ownedCosmeticIds">,
  ): readonly OwnedCatalogEntry[];
  ```
- **Data & Schema Fields**: 기존 `ProgressState.ownedToolIds: ToolId[]`, `ownedCosmeticIds: CosmeticId[]`만 읽는다. 새 저장 필드·버전·상품 가격은 없다. 반환 순서는 `MARKET_CATEGORIES`의 무기→방패→의상→장신구이며, 도구는 `TOOL_DEFINITIONS` 순서, 외형은 `MARKET_PRODUCTS` 순서다. 동일 ID는 한 번만 표시한다.
- **Execution Flow / Logic**:
  1. `TOOL_DEFINITIONS`에서 보유 ID와 일치하는 도구만 고른다. 분류는 `tool.slot === "attack"`이면 `weapon`, 아니면 `shield`다. 판매품이면 상품의 `nameKo`·`advantageKo`·`iconUrl`을, 상점에 없는 기본/예전 도구면 `getToolPresentation`의 `nameKo`·`effectKo`와 `iconUrl:null`을 쓴다.
  2. 의상·장신구는 `MARKET_PRODUCTS`에서 해당 분류이며 보유 ID인 상품만 고른다. 상품명·설명·아이콘을 그대로 사용한다. 다른 종류에 속한 ID, 알 수 없는 ID, 미보유 상품은 출력하지 않는다.
  3. 도구의 숨겨진 단점 문구는 이 목록에 포함하지 않는다. 기존 상점의 미공개 단점 규칙과 충돌하지 않게 한다.
- **Error & Exception Handling**: 구 저장의 중복 ID는 중복 카드가 되지 않게 하고, 판매가 중단된 도구도 `TOOL_DEFINITIONS`에 있으면 사라지지 않게 한다. 어떤 분류의 보유품이 없어도 빈 배열을 정상 반환한다.

### I02. 상점에서 외형만 벗기

- Related Files:
  - `src/components/game/ShopPanel.tsx` :: `ShopPanelProps`, `ShopPanel`의 액션 버튼; modify.
  - `src/components/game/GameShell.tsx` :: `unequipCosmetic`, `handleMarketUnequip`, `ShopPanel` props; modify.
  - `src/game/scenes/StageScene.ts` :: `cosmetic-change-requested` 구독; read-only. 이미 `null`을 허용한다.
  - `src/game/entities/PlayerWearables.ts` :: `setEquipment`; read-only. 이미 `null`이면 파츠를 파괴한다.
  - `src/game/persistence/AutoSaveCoordinator.ts` :: `cosmetic-change-requested` 저장 이벤트; read-only.
  - `src/game/persistence/migrations.ts` :: `equippedCosmetic`; read-only. `null`을 복원한다.
  - `scripts/goodboy-market-save.test.mjs`, `scripts/goodboy-shop-ui.test.mjs`, `scripts/goodboy-wearables.test.mjs` :: 장착→벗기→저장→재착용 및 상점 버튼 상태; modify.

#### Details

- **Signatures & Types**:
  ```typescript
  // ShopPanelProps에 추가
  readonly onUnequip: (category: "outfit" | "accessory") => void;
  // GameShell 내부의 공유 동작과 상점 진입점
  const unequipCosmetic: (category: "outfit" | "accessory") => void;
  const handleMarketUnequip: (category: "outfit" | "accessory") => void;
  ```
- **Data & Schema Fields**: `equippedOutfitId: CosmeticId | null`과 `equippedAccessoryId: CosmeticId | null`의 기존 `null`을 쓴다. `ownedCosmeticIds`는 그대로 유지한다. 무기·방패의 `equippedAttackToolId: ToolId`, `equippedDefenseToolId: ToolId`는 손대지 않는다.
- **Execution Flow / Logic**:
  1. `ShopPanel`에서 `owned && equipped && (category === "outfit" || category === "accessory")`이면 활성 버튼 `벗기`로 바꾸고 `onUnequip(category)`를 부른다. 그 외 구매·장착·장착 중 버튼 동작은 그대로다. 벗긴 뒤 같은 제품의 버튼은 `장착`이 된다.
  2. `GameShell.handleMarketUnequip`는 `shopOpen && mode === "play"`를 확인한 뒤 `unequipCosmetic`을 호출한다. 이 공유 동작은 해당 슬롯이 이미 `null`이면 아무 일도 하지 않는다. 값이 있으면 `progressRef.current`의 해당 외형 ID를 `null`로 만들고 `setProgress(cloneProgress(...))`, `eventBus.emit("cosmetic-change-requested", {outfitId:null} | {accessoryId:null})`, `autoSaveRef.current?.flush()` 순서로 처리한다. T02에서 같은 공유 동작을 카탈로그에서도 재사용한다.
  3. `StageScene`의 기존 구독이 `PlayerWearables.setEquipment`을 호출하고, `ProgressStore`가 `null`을 저장/복원한다. 코인 차감·환불이나 중복 구매는 발생하지 않는다.
- **Error & Exception Handling**: 상점이 닫혔거나 플레이 상태가 아니면 벗기 요청을 거부한다. 무기·방패 카테고리로 `onUnequip`이 호출되지 않게 타입과 UI 조건을 함께 둔다. 장착 중 상품 버튼의 `disabled`가 남아 있으면 벗기를 누를 수 없으므로 외형일 때만 해제한다.

## Acceptance Criteria

- [x] 보유품 목록에 기본·예전 장비를 포함한 **소유한** 아이템만 보이며 미보유와 중복 ID는 없다.
- [x] 상점에서 착용 중인 의상·장신구를 각각 벗길 수 있고 코기 파츠가 즉시 사라진다. 소유권과 코인 잔액은 그대로다.
- [x] 벗은 뒤 같은 상품을 다시 착용할 수 있고 새로고침 후에도 벗은 상태가 보존된다. 무기·방패는 비어 있지 않다.

## Validation

- `node --test scripts/owned-item-catalog.test.mjs scripts/goodboy-market-save.test.mjs scripts/goodboy-shop-ui.test.mjs scripts/goodboy-wearables.test.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`

## Commit Message

```text
feat(items): 보유품 목록과 의상·장신구 벗기 추가

Plan: 2026-10-21-owned-item-catalog
Phase: P01-owned-items
Task: T01-owned-list-and-unequip

- 기본·예전 도구를 포함한 보유 아이템 목록 생성
- 상점에서 외형만 벗겨 코기와 저장 상태 갱신
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
