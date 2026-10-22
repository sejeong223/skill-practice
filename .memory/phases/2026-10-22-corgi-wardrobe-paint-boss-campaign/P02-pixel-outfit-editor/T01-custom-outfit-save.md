# Task: T01 사용자 흰 옷 세 벌의 저장 형식

## Status: pending

## Goal

구버전 저장을 잃지 않으면서 직접 그린 흰 옷을 최대 세 벌 보관하고 한 벌만 장착할 수 있는 안정적인 진행 데이터 모델을 만든다.

## Decision Summary

- 사용자 결정: 흰 옷은 무료이며 3벌까지 저장·재장착한다. 기존 판매 의상과 같은 한 슬롯을 쓴다.
- 코드 사실: 저장 스키마는 v3이고 `migrateSave`가 알 수 없는 `CosmeticId`를 버린다. `cloneProgress`는 현재 배열만 얕게 복제한다.

## Implementation

### I01. 타입·기본값·스키마 이행

- Related Files:
  - `src/game/core/types.ts` :: `CustomOutfitId`, `CustomOutfitDesign`, `ProgressState` 추가/수정.
  - `src/game/core/constants.ts` :: `DEFAULT_VERSION`을 4로 올리고 `createDefaultProgressState`에 새 필드 기본값 추가.
  - `src/game/persistence/saveTypes.ts` :: `SaveSchemaVersion`, `SAVE_SCHEMA_VERSION`을 4로 올림. 기존 `PROGRESS_STORAGE_KEY`는 유지.
  - `src/game/persistence/migrations.ts` :: `migrateSave`에서 v0~v4 허용 및 사용자 옷 정제.
  - `src/components/game/GameShell.tsx` :: `cloneProgress`에서 사용자 옷/셀 배열까지 복제.
- **Signatures & Types**:
  - `type CustomOutfitId = "custom-outfit-1" | "custom-outfit-2" | "custom-outfit-3"`.
  - `interface CustomOutfitDesign { id: CustomOutfitId; cells: (string | null)[]; updatedAt: string }`.
  - `ProgressState.customOutfits: CustomOutfitDesign[]`, `ProgressState.equippedCustomOutfitId: CustomOutfitId | null`.
  - `function sanitizeCustomOutfits(value: unknown): CustomOutfitDesign[]`는 저장 유효성을 검사해 최대 세 슬롯을 반환한다.
- **Data & Schema Fields**: `cells` 길이 정확히 `56*32=1792`; `null`은 기본 흰 천, 문자열은 `^#[0-9A-Fa-f]{6}$` 색 코드; `updatedAt`은 유효한 ISO 문자열. 슬롯당 한 벌, 중복 ID는 마지막 유효 항목 하나로 정규화. 장착 ID는 실제 저장된 슬롯만 허용.
- **Execution Flow / Logic**:
  1. v3 이하 저장은 기존 `clearedStages`, 코인, 장비, 체크포인트를 그대로 읽고 `customOutfits=[]`, `equippedCustomOutfitId=null`을 채운다.
  2. v4에서는 잘못된 개별 사용자 옷만 제외한다. 잘못된 셀 색/길이 때문에 전체 진행 저장을 초기화하지 않는다.
  3. `equippedOutfitId`와 `equippedCustomOutfitId`가 모두 있으면 사용자 옷을 우선하고 고정 의상 ID를 null로 정규화한다. 어느 쪽도 없을 수 있다.
  4. 저장 시 최대 세 슬롯을 강제하고 새 저장은 v4 envelope로 기록한다. `cloneProgress`는 각 `cells`를 새 배열로 만들어 편집 중 이전 React 상태를 변경하지 않는다.
- **Error & State Transition**: 손상된 저장의 나머지 진행 데이터는 가능한 한 보존한다. 슬롯 삭제는 이번 기능에 없으며, 기존 슬롯 선택 시 덮어쓰기만 허용한다. `selectedWorldId`는 기존 1·2 타입을 이 Task에서 확대하지 않는다.

### I02. 저장 회귀 검사

- Related Files:
  - `scripts/goodboy-market-save.test.mjs` :: v3→v4 이행, 3벌 상한, 잘못된 픽셀만 제외, 장착 참조 복원 시나리오 추가.
- **Execution Flow / Logic**: v3 실제 저장 형태를 fixture로 사용해 코인/도구/컷신/체크포인트가 유지되는지 확인한다. v4 저장을 다시 불러와 셀 데이터와 장착 상태를 비교한다.

## Acceptance Criteria

- [ ] 세 슬롯만 저장하며 잘못된 색·길이·ID는 안전하게 정제된다.
- [ ] 기존 저장의 진행도·코인·장비가 유지된다.
- [ ] 고정 의상과 사용자 옷을 동시에 장착한 저장은 하나로 정리된다.

## Validation

- `node --test scripts/goodboy-market-save.test.mjs` — 저장/이행 회귀.
- `npx tsc --noEmit && npm run build` — 필수 필드 확장으로 인한 컴파일 오류 해결.

## Commit Message

```text
feat(저장): 사용자 흰 옷 세 벌과 장착 상태를 안전하게 저장

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P02-pixel-outfit-editor
Task: T01-custom-outfit-save

- 저장 스키마를 v4로 이행하고 구버전 진행을 보존
- 사용자 옷 셀과 슬롯의 유효성 검사를 추가
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
