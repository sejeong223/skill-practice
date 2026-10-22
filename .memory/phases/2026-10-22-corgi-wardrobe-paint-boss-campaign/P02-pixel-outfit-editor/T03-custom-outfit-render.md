# Task: T03 사용자 옷의 카탈로그 장착과 코기 출력

## Status: pending

## Goal

저장된 사용자 옷 세 벌을 카탈로그의 의상 목록에 보여주고, 선택한 색이 코기의 걷기·짖기 스프라이트에 맞춰 표시되게 한다.

## Decision Summary

- 사용자 결정: 기존 의상과 직접 그린 옷은 같은 착용 자리를 사용한다. 카탈로그에서 다시 입거나 벗을 수 있다.
- 코드 사실: `getOwnedCatalogEntries`는 시장 상품만 읽으며 `PlayerWearables.setEquipment`는 `CosmeticId`만 받는다. `StageScene`의 `cosmetic-change-requested`는 시장 상품이 아닌 의상을 거부한다.

## Implementation

### I01. 카탈로그의 사용자 옷 항목

- Related Files:
  - `src/game/data/ownedItemCatalog.ts` :: `OwnedCatalogEntry`에 `{category:"outfit";customOutfitId:CustomOutfitId;cosmeticId?:never;toolId?:never}` 분기 추가, `getOwnedCatalogEntries`가 `customOutfits`를 의상 그룹에 삽입.
  - `src/components/game/OwnedItemCatalogDialog.tsx` :: 사용자 옷 1~3 이름/미리보기, 장착·벗기기 상태 분기.
  - `src/components/game/GameShell.tsx` :: `equipOwnedEntry`, `unequipCosmetic`, `handleCatalogEquip`에서 고정 의상↔사용자 옷 상호 해제; 자동 저장.
  - `scripts/owned-item-catalog.test.mjs` :: 저장된 사용자 옷만 나타남, 장착/벗기기 분기 검사.
- **Signatures & Types**: `getOwnedCatalogEntries(progress:Pick<ProgressState,"ownedToolIds"|"ownedCosmeticIds"|"customOutfits">):readonly OwnedCatalogEntry[]`. 사용자 옷 entry ID는 슬롯 ID 그대로 사용. icon은 편집 셀로 만든 미리보기 data URL 또는 `null`+프리뷰 컴포넌트; 외부 URL 불필요.
- **Execution Flow / Logic**: 사용자 옷을 입으면 `equippedCustomOutfitId=id`, `equippedOutfitId=null`; 시장 의상을 입으면 역으로 설정. 의상을 벗으면 두 필드 모두 null. 장신구는 그대로 둔다. 저장되지 않은 슬롯을 장착하라는 요청은 거부한다.
- **Error & State Transition**: 삭제 기능이 없으므로 슬롯 덮어쓰기 시 같은 ID의 옷은 즉시 새 셀로 다시 렌더한다. 시장 상품 구매/장착과 무기·방패 장착은 기존 동작 유지.

### I02. 게임 내 동적 의상 텍스처

- Related Files:
  - `src/game/entities/PlayerWearables.ts` :: 사용자 옷 선택·셀 변경·텍스처 생성/교체/해제/파괴.
  - `src/game/scenes/StageScene.ts` :: 시작 시 저장된 사용자 옷을 적용하고 변경 이벤트를 받음.
  - `src/game/stages/stageEvents.ts` :: `"custom-outfit-change-requested":{id:CustomOutfitId|null;design:CustomOutfitDesign|null}`와 `"custom-outfit-saved":{design:CustomOutfitDesign}` 정의.
  - `scripts/goodboy-wearables.test.mjs` :: 프레임·좌우 반전·재저장·장면 재시작의 텍스처 수명 검사.
- **Signatures & Types**: `PlayerWearables.setEquipment(outfitId:CosmeticId|null, accessoryId:CosmeticId|null, customOutfit?:CustomOutfitDesign|null):void`. 텍스처 키는 `wear-custom-${id}-${updatedAt}-run/bark`처럼 버전 식별. 셀 `null`은 흰색, 6자리 hex는 그 색으로 출력.
- **Execution Flow / Logic**: T01 흰 옷 템플릿의 각 포즈 알파 마스크를 읽고 56×32 셀을 옷 내부에만 합성한다. 448×128 걷기 시트의 프레임 0~3과 112×128 짖기 PNG를 만들고 `PlayerWearables.sync()`에서 기존 프레임/위치/스케일/flipX를 그대로 따른다. 정지·이동·짖기·재시작 시 한 벌만 보인다.
- **Error & State Transition**: Phaser 텍스처 생성 실패 시 기본 흰 옷으로 표시하고 콘솔 진단을 남긴다. 슬롯을 바꾸거나 씬이 파괴되면 이전 동적 텍스처와 Image를 해제해 누적 메모리를 막는다. 다른 씬의 텍스처를 잘못 제거하지 않도록 소유 키만 삭제한다.

## Acceptance Criteria

- [ ] 저장한 세 슬롯만 카탈로그에 있고 선택·벗기기·고정 의상 교체가 된다.
- [ ] 실제 코기에 칠한 색이 걷기·짖기·좌우 반전에서 몸에 맞게 나타난다.
- [ ] 새로고침과 재도전 후 장착 상태를 복원하고 반복 교체에서 텍스처가 누적되지 않는다.

## Validation

- `node --test scripts/owned-item-catalog.test.mjs scripts/goodboy-wearables.test.mjs scripts/goodboy-market-save.test.mjs` — 카탈로그·렌더·저장 회귀.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 사용자 옷 저장→카탈로그 장착→짖기/이동→새로고침→벗기기→시장 의상 장착을 수동 확인.

## Commit Message

```text
feat(착용): 직접 그린 옷을 카탈로그와 코기 스프라이트에 연결

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P02-pixel-outfit-editor
Task: T03-custom-outfit-render

- 사용자 옷 세 슬롯의 재장착과 벗기기를 지원
- 걷기와 짖기 프레임에 사용자 색을 합성하고 수명을 관리
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
