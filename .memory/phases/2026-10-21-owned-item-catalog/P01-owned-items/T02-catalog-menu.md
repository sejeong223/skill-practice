# Task: T02 상단 카탈로그 메뉴와 장비 재사용

## Status: pending

## Goal

월드 1·2의 플레이 화면에 보유품 카탈로그 버튼을 추가하고, 소유한 네 분류의 아이템을 가격 지불 없이 다시 장착·착용하거나 외형만 벗기게 한다. 상점·전투·저장·모바일 화면과 충돌하지 않는지 확인한다.

## Decision Summary

- 카탈로그는 상점과 다른 모달이다. 보유품만 표시하고 구매 버튼·상점 주인·출입 종·상점 음악은 없다. 열려 있는 동안 게임을 일시정지하고 닫으면 재개한다.
- 카탈로그의 무기·방패는 **교체만** 가능하다. 의상·장신구는 `착용`과 `벗기`가 가능하다. 기본·예전 도구에는 전용 상점 아이콘 대신 읽을 수 있는 이름 타일을 표시한다.

## Implementation

### I01. 카탈로그 화면과 상단 버튼

- Related Files:
  - `src/components/game/OwnedItemCatalogDialog.tsx` :: `OwnedItemCatalogDialog`, 네 분류와 보유품 카드·키보드 닫기; new.
  - `src/components/game/Hud.tsx` :: `HudProps`, 상단 `카탈로그` 버튼 및 픽셀형 가방/책 SVG; modify.
  - `src/components/game/GameOverlay.tsx` :: `GameOverlayProps`, `Hud`로 `onOpenCatalog` 전달; modify.
  - `src/app/globals.css` :: 새 버튼 위치·모달·카드·720/480px 반응형·보스 하트/상단 HUD 간격; modify.
  - `src/game/data/ownedItemCatalog.ts` :: T01의 `OwnedCatalogEntry`, `getOwnedCatalogEntries`; read-only.
  - `src/game/data/shopDialogue.ts` :: `SHOP_CATEGORY_LABELS`; read-only, 네 분류 한국어 표시 재사용.

#### Details

- **Signatures & Types**:
  ```typescript
  export interface OwnedItemCatalogDialogProps {
    readonly progress: ProgressState;
    readonly entries: readonly OwnedCatalogEntry[];
    readonly onEquip: (id: string) => void;
    readonly onUnequip: (category: "outfit" | "accessory") => void;
    readonly onClose: (source: "button" | "keyboard") => void;
  }
  export function OwnedItemCatalogDialog(props: OwnedItemCatalogDialogProps): ReactElement;
  // HudProps와 GameOverlayProps에 추가
  readonly onOpenCatalog: () => void;
  ```
- **Data & Schema Fields**: 화면 로컬 상태 `category: MarketCategory = "weapon"`. 현재 장착 여부는 `progress.equippedAttackToolId`/`equippedDefenseToolId`/`equippedOutfitId`/`equippedAccessoryId`로 계산한다. 선택한 분류는 저장하지 않는다. `OwnedCatalogEntry.iconUrl === null`은 기본·예전 도구의 이름 타일을 뜻한다.
- **Execution Flow / Logic**:
  1. 상단 버튼은 `aria-label="보유 아이템 카탈로그 열기"`, `title="카탈로그"`로 두고 기존 상점 버튼 왼쪽에 배치한다. 새 PNG를 만들지 않고 16×16 픽셀형 SVG를 사용한다.
  2. 모달은 `role="dialog"`, `aria-modal="true"`, 명확한 제목 `보유 아이템 카탈로그`, 닫기 버튼과 네 분류 탭을 둔다. 목록은 보유품 카드가 세로로 스크롤된다. 빈 분류에는 `보유한 아이템이 없습니다.`를 표시한다. 이미지가 있는 상품은 기존 `iconUrl`, 기본/예전 도구는 카테고리와 이름을 적은 픽셀형 대체 타일을 사용한다. 가격·구매 행동은 표시하지 않는다.
  3. 다른 보유품은 무기·방패 `장착`, 의상·장신구 `착용` 버튼을 쓴다. 현재 무기·방패는 비활성 `장착 중`, 현재 의상·장신구는 활성 `벗기` 버튼을 쓴다. 벗은 외형은 보유 목록에 남아 바로 다시 `착용`할 수 있다.
  4. 열 때 닫기 버튼으로 초점을 보내고 Tab/Shift+Tab은 모달 내부에서 순환시킨다. Escape는 한 번만 닫으며, 닫은 후 열기 버튼으로 초점을 돌린다. 카탈로그 뒤의 HUD는 게임 일시정지 동안 조작되지 않아야 한다.
  5. CSS의 오른쪽 아이콘 간격을 42px 단위로 조정한다. 기존 아이콘 순서는 오른쪽에서 `월드 선택(해금 시) → 초기화 → 일시정지 → 상점 → 카탈로그`; 월드 선택 전에는 `초기화 → 일시정지 → 상점 → 카탈로그`다. 데스크톱에서 카탈로그 `right:142px`, 월드 선택 해금 시 `184px`; 720px 이하에서는 각각 `134px`/`176px`이다. `.game-hud` 최대 너비는 기본 `calc(100% - 184px)`, 월드 선택 시 `calc(100% - 226px)`; 보스 하트 오른쪽은 기본 `186px`, 월드 선택 시 `228px`로 조정한다. 720px 이하의 보스 HUD 예약 폭은 기존 260/302px에서 302/344px로, 보스 하트 오른쪽은 136/178px에서 178/220px로 조정한다. 480px 화면에서는 카드 한 열·스크롤과 누를 수 있는 버튼 크기를 확인한다.
- **Error & Exception Handling**: 분류를 바꾼 뒤 목록이 비어 있어도 이전 카드가 남지 않는다. 상점 전용 사진/음악을 이 모달에 복사하지 않는다. 기본/예전 도구의 `iconUrl:null`에 `next/image`를 호출하지 않아 누락 이미지가 생기지 않는다.

### I02. 소유권 검증·일시정지·씬 동기화

- Related Files:
  - `src/components/game/GameShell.tsx` :: `catalogOpen`, `handleOpenCatalog`, `handleCloseCatalog`, `handleCatalogEquip`, `handleCatalogUnequip`, 기존 `handleMarketEquip`·`handleEquip` 공유 장착 경로, 모달 상호 배제; modify.
  - `src/game/stages/stageEvents.ts` :: `StageEventMap["catalog-state-changed"]`; modify.
  - `src/game/scenes/StageScene.ts` :: `catalogOpen` 플래그, `shopPauseGuard`를 일반 메뉴 Escape 가드로 확장, `StageScene.update`; modify.
  - `src/game/data/ownedItemCatalog.ts` :: 클릭 때 최신 소유권 검증; read-only.
  - `src/game/entities/PlayerWearables.ts`, `src/game/entities/EquipmentVisual.ts`, `src/game/systems/CombatSystem.ts`, `src/game/systems/DefenseToolSystem.ts` :: 기존 동기화 경로; read-only.
  - `src/game/persistence/AutoSaveCoordinator.ts` :: 기존 `equipment-change-requested`·`cosmetic-change-requested` 저장 경로; read-only.
  - `scripts/goodboy-market-integration.test.mjs`, `scripts/goodboy-market-save.test.mjs` :: 재장착·소유권·저장 회귀; modify where behavior needs coverage.
  - `.memory/test-plans/browser-owned-item-catalog.mjs` :: Chrome 구매·벗기·교체·재접속·모바일 검증; new.

#### Details

- **Signatures & Types**:
  ```typescript
  // StageEventMap에 추가. 저장 이벤트는 아님.
  "catalog-state-changed": { open: boolean; closeViaEscape: boolean };
  // GameShell 내부 UI 진입점
  const handleCatalogEquip: (id: string) => void;
  const handleCatalogUnequip: (category: "outfit" | "accessory") => void;
  const handleCloseCatalog: (source: "button" | "keyboard") => void;
  ```
- **Data & Schema Fields**: `GameShell.catalogOpen:boolean`은 기본 `false`인 UI 상태이며 저장하지 않는다. `StageScene.catalogOpen:boolean`은 Phaser의 입력 보호용 상태다. `ProgressState` 필드나 저장 스키마 버전은 추가하지 않는다.
- **Execution Flow / Logic**:
  1. `handleOpenCatalog`는 `mode === "play"`, `introGateStep === "ready"`, 월드 1·2 stage, `!paused`, `!shopOpen`, `!worldSelectOpen`, `!resetProgressDialogOpen`, `!catalogOpen`을 확인한다. 상태 창을 닫고 `catalogOpen=true`, `catalog-state-changed(open:true)`, `pause-requested(paused:true)`를 이 순서로 보낸다. 상점 열기·월드 선택도 `!catalogOpen`을 확인한다.
  2. 카탈로그에서는 T01의 `getOwnedCatalogEntries(progressRef.current)`를 클릭 직전에 다시 호출해 ID와 분류, 현재 소유 여부를 검사한다. 이미 소유하지 않은 ID는 무시한다. 도구는 해당 슬롯 값과 기존 `equipment-change-requested`를, 외형은 해당 슬롯 값과 기존 `cosmetic-change-requested`를 갱신한다. 기존 상점의 `handleMarketEquip`·상태 창의 `handleEquip`과 소유권 검증·이벤트·저장 경로를 공통 함수로 묶고, 구매 직후 즉시 장착은 유지한다. 외형 `벗기`는 T01의 `unequipCosmetic`을 재사용한다. 각 성공 처리 뒤 React 진행 상태를 갱신하고 `autoSaveRef.current?.flush()`를 호출한다.
  3. `catalog-state-changed`의 `open`을 `StageScene`에 반영한다. `shopPauseGuard`는 상점·카탈로그 양쪽의 Escape 닫기 프레임을 막는 `menuPauseGuard`로 이름을 바꾸고, `StageScene.update`의 일반 일시정지 조건에서 `!shopOpen && !catalogOpen && !menuPauseGuard`를 확인한다. 닫을 때 `catalog-state-changed(open:false)` 후 `pause-requested(paused:false)`를 보내며, 모달이 닫힌 같은 키 입력이 일시정지를 다시 켜지 않게 한다.
  4. `PauseOverlay`는 카탈로그가 열린 동안 보이지 않게 한다. 스테이지 시작 이벤트에서 카탈로그 상태를 닫고, 컷신·사망·클리어 도중에는 열리지 않게 한다. 상점·월드 선택·초기화 대화상자가 카탈로그와 겹치지 않는다. 카탈로그 출입에는 `ShopAudioController`를 호출하지 않는다.
  5. 기존 `StageScene`의 도구·외형 변경 리스너가 실제 코기 파츠, 공격, 방어 충전량과 밥그릇 표시를 갱신한다. 카탈로그에서 무기·방패를 비우는 요청은 만들지 않는다. 재접속 후 같은 보유·착용 상태가 복원된다.
- **Error & Exception Handling**: 모달이 닫힌 뒤 남은 클릭, 잘못된 ID·분류, 플레이 불가 상태에서는 변경 요청을 거부한다. 오래된 렌더 목록만 믿지 않고 최신 `progressRef`로 다시 검증한다. 메뉴를 열고 닫아도 코인이 변하거나 상점 BGM이 재생·중첩되지 않는다.

## Acceptance Criteria

- [ ] 상단 카탈로그를 열면 무기·방패·의상·장신구의 보유품만 보이고 기본·예전 장비도 이름 타일로 선택할 수 있다.
- [ ] 카탈로그에서 보유한 무기·방패를 교체하고, 의상·장신구는 각각 착용·벗기·재착용할 수 있다. 미보유품은 장착할 수 없다.
- [ ] 변경 직후 코기 외형·전투 동작·저장값이 동기화되고 새로고침 후에도 유지된다. 구매·코인 차감은 카탈로그에서 발생하지 않는다.
- [ ] 게임 일시정지·Escape 닫기·상점/월드 선택 상호 배제·데스크톱/모바일 상단 간격이 정상이다.

## Validation

- `node --test scripts/owned-item-catalog.test.mjs scripts/goodboy-market-integration.test.mjs scripts/goodboy-market-save.test.mjs scripts/goodboy-shop-ui.test.mjs scripts/goodboy-wearables.test.mjs scripts/goodboy-equipment-visual.test.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node .memory/test-plans/browser-owned-item-catalog.mjs` — 로컬 서버와 Chrome CDP에서 상점 구매→외형 벗기→카탈로그 재착용, 기본/예전 도구 교체, 월드 1 보스전의 공격·방어 변경, 새로고침, 1280px/720px/480px 배치·키보드 초점·오류를 확인.

## Commit Message

```text
feat(items): 보유 아이템 카탈로그 메뉴와 재장착 연결

Plan: 2026-10-21-owned-item-catalog
Phase: P01-owned-items
Task: T02-catalog-menu

- 상단 카탈로그에서 보유 장비를 교체하고 외형 재착용
- 일시정지·저장·모바일 화면과 상점 동작 검증
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
