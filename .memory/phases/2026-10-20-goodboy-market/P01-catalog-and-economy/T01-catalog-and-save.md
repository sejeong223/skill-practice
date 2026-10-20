# Task: T01 상품 카탈로그와 저장 스키마

## Status: done

## Goal

19종 판매 상품의 단일 데이터 소스를 만들고 의상·장신구 소유/장착 정보를 기존 저장 파일에 안전하게 추가한다. 기존 기본 장비와 과거 상점 구매품은 복원되어야 한다.

## Decision Summary

- 판매 목록은 무기 5·방패 4·의상 5·장신구 5종만 포함한다. 의상과 장신구는 각각 한 개씩 장착하는 외형 아이템이다.
- 기존 `squeaky-ball`과 `cushion-pad`의 ID는 유지하고 가격만 10으로 바꾼다. 기존 `cardboard-tube`·`cardboard-box` 소유권은 남기되 판매 목록에서는 제외한다. 자동 환불은 하지 않는다.

## Implementation

### I01. 타입과 가격표

- Related Files:
  - `src/game/core/types.ts` :: `ToolDefinition`, `ProgressState`, 신규 `MarketCategory`, `MarketProduct`, `CosmeticId`; modify
  - `src/game/data/tools.ts` :: `TOOL_DEFINITIONS`; modify
  - `src/game/data/toolPresentation.ts` :: `TOOL_PRESENTATIONS`, `getToolPresentation`; modify
  - `src/game/data/marketCatalog.ts` :: `MARKET_PRODUCTS`, `getMarketProduct`; new

#### Details

- **Signatures & Types**: `MarketCategory = "weapon" | "shield" | "outfit" | "accessory"`; `MarketProduct = { readonly id: string; readonly category: MarketCategory; readonly nameKo: string; readonly price: number; readonly iconUrl: string; readonly advantageKo: string; readonly toolId?: ToolId; readonly cosmeticId?: CosmeticId }`; `getMarketProduct(id: string): MarketProduct | undefined`. 무기·방패는 `toolId`만, 의상·장신구는 `cosmeticId`만 가진 판별 가능한 유니온으로 정의한다. `ProgressState`에는 `ownedCosmeticIds: CosmeticId[]`, `equippedOutfitId: CosmeticId | null`, `equippedAccessoryId: CosmeticId | null`을 추가한다. `ToolDefinition.effectId: ToolEffectId`를 추가한다. `ToolEffectId`는 `slipper-combo | squeaky-bounce | newspaper-reach | backscratcher-arc | drumstick-return | frisbee-straight | legacy-tube | bowl-three-block | cushion-two-block | pizza-slip | umbrella-front | pot-lid-stagger | legacy-box`의 문자열 유니온이다. 기존 `passiveEffect`는 호환용으로 보존하며 런타임 분기는 `effectId`를 사용한다.
- **Data & Schema Fields**: 아래 순서·ID·금액을 그대로 `MARKET_PRODUCTS`에 넣는다. `iconUrl`은 `/assets/pixel/shop/items/{id}.png`. `shopVisible` 같은 선택적 플래그보다 카탈로그의 명시적 목록을 판매 기준으로 삼아 기본 장비·레거시 도구가 끼어들지 않게 한다.
  - 무기: `squeaky-ball` 삑삑이 공 10; `rolled-newspaper` 돌돌 말린 신문지 13; `pink-backscratcher` 분홍색 효자손 15; `drumstick-boomerang` 닭다리 뼈 부메랑 18; `plastic-frisbee` 플라스틱 원반 20.
  - 방패: `cushion-pad` 쿠션 패드 10; `greasy-pizza-box` 기름진 피자 박스 13; `umbrella` 우산 15; `yellow-pot-lid` 노란 양은 냄비 뚜껑 18.
  - 의상: `pink-caterpillar-suit` 핑크 애벌레 수트 12; `banana-peel-suit` 바나나 껍질 수트 12; `bee-bodysuit` 꿀벌 바디수트 14; `hotdog-outfit` 핫도그 옷 14; `diamond-armor` 다이아몬드 갑옷 20.
  - 장신구: `shinchan-eyebrow-sticker` 숮검등이 짱구 눈썹 스티커 14; `birthday-party-hat` 생일 고깔모자 14; `strawberry-headpiece` 딸기 탈 16; `propeller-hat` 어린이 프로펠러 모자 18; `prince-crown` 왕자님 왕관 24. 표시명 철자를 임의로 교정하지 않는다.
- `TOOL_DEFINITIONS`에는 새 무기·방패 7개를 추가하고 기존 2개 가격을 수정한다. 각 도구의 `passiveEffect`, `charges`, `hiddenDrawbackId`, `discoverOnTrigger`는 P03 효과 명세와 일치하게 정의한다. 기존 `rabbit-slipper`, `upside-down-bowl`, `cardboard-tube`, `cardboard-box` 정의를 제거하지 않는다. `TOOL_PRESENTATIONS`도 모든 ID를 포괄한다. 새 도구의 단점은 첫 발동 전 UI에서 가린다.
- **무기/방패 메타데이터**: `squeaky-ball`: `effectId=squeaky-bounce`, `charges=null`, `hiddenDrawbackId=squeak-summons-cats`; `rolled-newspaper`: `newspaper-reach`, `null`, `newspaper-slow-recovery`; `pink-backscratcher`: `backscratcher-arc`, `null`, `backscratcher-recoil`; `drumstick-boomerang`: `drumstick-return`, `null`, `boomerang-return-lock`; `plastic-frisbee`: `frisbee-straight`, `null`, `frisbee-miss-cooldown`; `cushion-pad`: `cushion-two-block`, `2`, `cushion-side-bounce`; `greasy-pizza-box`: `pizza-slip`, `2`, `pizza-grease-slide`; `umbrella`: `umbrella-front`, `2`, `umbrella-rear-gap`; `yellow-pot-lid`: `pot-lid-stagger`, `3`, `pot-lid-ear-ringing`. 모든 판매 도구의 `discoverOnTrigger=true`.
- **판매 설명 `advantageKo`**: 무기 순서대로 `한 번 튕기는 공으로 삼색이를 맞힙니다.`, `신문지를 휘둘러 더 멀리 공격합니다.`, `위쪽까지 닿는 효자손으로 공격합니다.`, `던지면 돌아오는 뼈 부메랑입니다.`, `빠른 원반을 멀리 던집니다.`; 방패 순서대로 `정면의 약한 공격을 두 번 막습니다.`, `정면의 약한 공격을 두 번 막습니다.`, `정면의 약한 투사체를 두 번 막습니다.`, `정면의 약한 공격을 세 번 막고 다음 투척을 늦춥니다.`. 의상은 순서대로 `핑크 애벌레 모습으로 갈아입습니다.`, `바나나 껍질을 몸통에 둘러 입습니다.`, `줄무늬 꿀벌 수트를 입습니다.`, `빵 사이의 핫도그 코기가 됩니다.`, `반짝이는 각진 갑옷을 입습니다.`; 장신구는 순서대로 `짱구 눈썹 스티커를 눈 위에 붙입니다.`, `생일 고깔모자를 머리에 씁니다.`, `딸기 탈을 얼굴에 씁니다.`, `프로펠러 모자를 머리에 씁니다.`, `왕자님 왕관을 머리에 씁니다.`. 의상·장신구 설명에는 능력치 효과를 쓰지 않는다.
- **Execution Flow / Logic**: 카탈로그 순서로 필터하면 분류별 화살표 순서가 결정된다. 중복 ID/비양수 가격/잘못된 category 또는 아이콘 경로는 검증 스크립트에서 실패시킨다.

### I02. 저장 버전과 마이그레이션

- Related Files:
  - `src/game/core/constants.ts` :: `DEFAULT_VERSION`, `createDefaultProgressState`; modify
  - `src/game/persistence/saveTypes.ts` :: `SAVE_SCHEMA_VERSION`, `SaveSchemaVersion`; modify
  - `src/game/persistence/migrations.ts` :: `migrateSave`; modify
  - `src/components/game/GameShell.tsx` :: `cloneProgress`; modify
  - `scripts/goodboy-market-save.test.mjs` :: 신규 저장 회귀 테스트; new

#### Details

- **Signatures & Types**: 저장 스키마 2→3, `DEFAULT_VERSION` 2→3. 스토리지 키 `legendary-rib-corgi:progress:v1`은 유지하여 기존 저장을 읽는다. `migrateSave(input: unknown): ProgressState`는 버전 0/1/2/3을 받아 새 필드가 없으면 `[]/null/null`로 보완한다.
- **Execution Flow / Logic**: `ownedCosmeticIds`는 정의된 ID만 중복 제거해 보존한다. 장착 ID는 해당 분류이면서 소유한 경우만 유지, 아니면 `null`. 기존 보유 도구 목록은 기본/레거시 포함으로 필터하고, 장착 공격/방패는 소유·슬롯 검증 후 유지한다. `cloneProgress`는 `ownedCosmeticIds`를 복사한다. `ProgressStore`의 저장 포맷은 기존 envelope 필드명을 보존한다.
- **Error & Exception Handling**: 악의적 저장의 음수 코인, 엉뚱한 cosmetic ID/slot, 미래 버전은 기존 정책대로 안전하게 처리한다. 단순히 새 필드가 없다는 이유로 옛 코인·클리어·체크포인트를 초기화하면 안 된다.

## Acceptance Criteria

- [x] 카탈로그는 정확히 19종, 분류 순서 5/4/5/5, 가격은 요청과 동일하다.
- [x] 스키마 2 저장의 코인·월드 선택·체크포인트·과거 장비를 보존하며 의상 필드는 기본값으로 복원한다.
- [x] 스키마 3에서 의상·장신구 소유와 장착을 복원하고 잘못된 장착 ID를 버린다.

## Validation

- `node --test scripts/goodboy-market-save.test.mjs scripts/world-selection.test.mjs scripts/world01-respawn.test.mjs` — 새/기존 저장 복원.
- `node scripts/validate-assets.mjs` — 기존 필수 자산 회귀 없음.
- `npx tsc --noEmit && npm run lint && npm run build` — 타입·린트·빌드 통과.

## Commit Message

```text
feat(상점): 19종 상품 목록과 의상 장신구 저장 구조 추가

Plan: 2026-10-20-goodboy-market
Phase: P01-catalog-and-economy
Task: T01-catalog-and-save

- 기존 장비 보유 기록을 보존하며 판매 가격과 분류 정리
- 의상 장신구 소유 및 장착 저장을 스키마 3으로 마이그레이션
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (관련 테스트 22건·자산 검사·타입 검사·린트·빌드)
- commit: 이 Task 커밋
