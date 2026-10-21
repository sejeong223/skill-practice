# Task: T01 상점 버튼·모달·주인 대사

## Status: done

## Goal

월드 1·2 플레이 중 상단 상점 버튼으로 들어가 4개 분류의 19종을 구경·구매·장착하고, 나가면 같은 장소에서 플레이를 이어간다.

## Decision Summary

- 상점은 플레이 중 언제든 열 수 있다. 월드 선택/초기화/컷신/사망/클리어와 중복 표시하지 않는다.
- 좌우 삼각 화살표는 각각 테두리 있는 네모 버튼 안에 놓고 목록을 순환한다. 주인 대사는 진입·선택·성공·부족 이벤트마다 지정한 문구를 사용한다.

## Implementation

### I01. 상단 버튼과 모달

- Related Files:
  - `src/components/game/Hud.tsx` :: `HudProps`, 우측 상단 버튼; modify
  - `src/components/game/GameOverlay.tsx` :: `GameOverlayProps`, 기존 안전구역 `ShopPanel` 제거/단일 진입점; modify
  - `src/components/game/ShopPanel.tsx` :: 4분류·선택 상품·주인 모달로 교체; modify
  - `src/components/game/GameShell.tsx` :: `shopOpen`, 진입/닫기/구매/장착 handlers; modify
  - `src/app/globals.css` :: HUD 버튼과 반응형 상점 디자인; modify
  - `scripts/goodboy-shop-ui.test.mjs` :: 상품 이동·버튼·대사 테스트; new

#### Details

- **Signatures & Types**: `ShopPanelProps = { bankedCoins: number; products: readonly MarketProduct[]; progress: ProgressState; onPurchase(id: string): PurchaseResult; onEquip(id: string): void; onClose(): void; }`. 선택 상태 `category: MarketCategory`, `index: number`은 모달 내부에서 관리. 분류 변경 때 index=0. 좌/우는 `(index ± 1 + count) % count`. `GameShell`은 `shopOpen: boolean`, `handleOpenShop()`, `handleCloseShop(source: "button" | "keyboard")`를 둔다.
- **Data & Schema Fields**: 분류명 `무기류`, `방패류`, `의상류`, `장신구류`; 상점명 `리트리버의 굿보이 마켓`; vendor 이미지 `/assets/pixel/shop/goodboy-retriever.png`; 19개 `iconUrl`은 P01 카탈로그 참조. 각 상품 카드에 이름·가격·장점·소유/착용을 표시한다. 이미 산 상품은 `장착` 또는 `장착 중`, 미보유 상품은 `구매`로 표시한다. 코인 부족이어도 구매 버튼을 비활성화하지 않고 클릭하면 대사를 보여 준다.
- **Dialogue**: 진입 후보 `어서 오개, 손님! 천사 같은 미소와 신상 장비로 모신다개~!` / `냥아치 잡으러 가냐개? 내 장비면 15cm 다리로도 문제없다개!`; 선택 후보 `오~ 손님 안목 미쳤다개! 그거 가성비 대박 상품이다개!` / `이거 끼면 동네 강아지들이 다 부러워할 걸개!`; 성공 후보 `탁월한 선택이라개! 살아서 꼭 왕갈비뼈를 찾아오라개~!` / `감사하다개! 영수증은 갈비뼈 찾고 챙겨주겠다개!`; 부족 단일 `손님, 자본주의는 냉정한 법이라개~`. 2개 후보는 발생할 때마다 `Math.random`으로 독립 추첨한다. 복사에서 물결표/쉼표/느낌표를 바꾸지 않는다.
- **Execution Flow / Logic**: 진입 버튼 click → `mode === "play"`, `!paused`, `!worldSelectOpen`, `!resetProgressDialogOpen`, intro ready, 월드 ID 1/2를 검사 → status 창 닫기 → `shopOpen=true` → `shop-state-changed` 이벤트와 `pause-requested {paused:true}` 순서로 전송. StageScene은 월드 물리와 타이머를 멈춘다. 구매 성공이면 P01 거래 함수 호출·React progress clone·해당 슬롯 즉시 장착 이벤트; 실패 reason `insufficient-coins`이면 부족 대사. 중복은 재결제하지 않고 장착 버튼으로 전환. 나가기는 `shop-state-changed` 닫힘→`pause-requested false`→같은 스테이지/위치/코인으로 재개. `PauseOverlay`는 `shopOpen` 동안 렌더하지 않는다. `GameOverlay inert={paused}`는 상점 모달 바깥에만 적용한다.
- **Error & Exception Handling**: 기존 `Hud` 오른쪽 `pause/reset/world-select`와 새 `shop` 버튼이 모바일·보스 하트·코인 HUD에서 겹치지 않도록 CSS의 right offsets와 `has-world-select`/`has-boss-hearts` 규칙을 모두 재계산한다. 모달은 `role="dialog"`, `aria-modal="true"`, 한국어 라벨, 키보드 탭/포커스 복귀를 제공한다. `Escape` 닫기와 Phaser `pausePressed`가 같은 프레임에 이중 토글되지 않도록 `InputManager`의 `pauseHeld` 상태와 StageScene의 `shopPauseGuard`를 사용해 키를 놓을 때까지 일반 pause 입력을 무시한다.

### I02. 장면 상태 이벤트

- Related Files:
  - `src/game/stages/stageEvents.ts` :: `shop-state-changed: { open: boolean; closeViaEscape: boolean }`; modify
  - `src/game/scenes/StageScene.ts` :: `setPaused`, `update`, shop 입력 가드; modify
  - `src/game/input/inputTypes.ts` :: `InputSnapshot.pauseHeld`; modify
  - `src/game/input/InputManager.ts` :: `getSnapshot`; modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: P02에서 연결한 장착 이벤트 저장 확인; read-only

#### Details

- `equipment-change-requested`, `cosmetic-change-requested`는 소유권 확인 뒤 해당 슬롯을 갱신하고 저장 요청/flush한다. 상점 진입/나가기 자체는 캐릭터 위치나 재시작 포인터를 바꾸지 않는다. 스테이지 교체/컴포넌트 unmount 시 모달을 닫아 월드 전환 후 상점이 떠 있지 않게 한다.

## Acceptance Criteria

- [ ] 월드 1·2의 일반 구간과 삼색이 전투에서 상점을 열고 같은 위치에서 재개한다.
- [ ] 4분류, 19종, 네모 속 좌우 삼각 화살표, 주인·상품 이미지와 정확한 대사가 나타난다.
- [ ] 부족·중복 구매는 코인을 빼지 않고, 의상/장신구와 장비는 구매 후 즉시 착용된다.
- [ ] 상점에서 Escape 한 번으로 정상 복귀하며 화면이 재일시정지되지 않는다. 모바일 우측 상단 버튼들이 겹치지 않는다.

## Validation

- `node --test scripts/goodboy-shop-ui.test.mjs scripts/goodboy-market-purchase.test.mjs scripts/world-selection.test.mjs` — 대사·이동·거래·월드 선택.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- 720px 이하와 기본 화면 폭에서 버튼/모달 터치와 Escape·Enter·Tab을 실제 브라우저로 확인한다.

## Commit Message

```text
feat(상점): 플레이 중 굿보이 마켓 진입과 상품 탐색 구현

Plan: 2026-10-20-goodboy-market
Phase: P04-shop-experience
Task: T01-shop-ui-and-flow

- 상단 상점 버튼과 네 분류 상품 모달 추가
- 주인 대사와 즉시 구매 장착, 일시정지 복귀 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (타입·린트·자동 테스트·브라우저, 프로덕션 빌드는 T03에서 재확인)
- commit: `7eacf9f`
