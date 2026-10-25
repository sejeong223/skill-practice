# Task: T02 진짜 간식·누적 잔액·가짜 위장과 장애물 밀도

## Status: done

## Goal

각 일반 맵에서 처음 만나는 간식 세 개를 실제로 얻은 뒤 외형이 같은 가짜 간식을 만나게 하고, 정적 장애물을 6개로 늘리며 비둘기를 조금 크게 만든다. 진짜 간식은 획득 즉시 영구 잔액에 적립·저장하고 오른쪽 상단에 표시해 후속 상점의 재화로 사용한다.

## Decision Summary

- 선행 T01 완료 상태: 일반 맵2560px, 바닥/구간 정합화, 기존 기믹24개. 이 Task 이후 정적24+맨홀2+가짜6=32개다. 진짜20개는 기믹 수와 분리한다.
- 정상/가짜는 획득 전 `world-01-props`의 `bone-coin`, 표시·판정34×26, 바닥 기준 동일 높이, tint 없음, 동일한 정지 표시를 사용한다. 초록/역주행/발사 효과는 접촉 이후에만 드러난다.
- 초반 세 번 획득은 안전한 동선과 배치로 유도한다. 플레이어가 의도적으로 건너뛴 경우를 막는 강제 획득이나 지연 생성은 추가하지 않는다.
- 현재 Tiled 실행 경로에는 진짜 코인 배치가 없으며 기존 `createCoin`은 노란 타원이다. 가짜의 tint만 지워서는 요구사항을 만족하지 않는다.
- 후속 요청에 따라 `ProgressState.bankedCoins`는 획득 즉시 늘고 사망/새로고침에도 남는 보유 잔액이다. `currentStageCoins`는 시도 통계일 뿐, 잔액 표시나 클리어 때 재합산에 쓰지 않는다. 기존 저장 잔액을 승계하며 상점 개방·상품 추가는 이 Task 범위 밖이다.
- 구현 전에 로컬 Next 문서 `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`를 읽는다.

## Implementation

> 완료 후 정책 보완(2026-10-12): 이 Task의 사망/재시작 후 코인 복원·재적립은 현재 유지하는 동작이다. 의상 상점과 클리어한 월드 재도전을 함께 설계하고 정상 반복 수급을 검증한 뒤에만 같은 클리어 도전 내 중복 적립을 제한한다. [후속 로드맵](../../../plans/2026-10-12-world01-gameplay-refinement.md#follow-up-roadmap--의상-상점과-반복-수급)을 따른다. 이 Task의 완료 상태·구현·검증 기대값은 변경하지 않는다.

### I01. 최종 배치와 비둘기 크기

- Related Files:
  - `src/game/data/world01Gimmicks.ts` :: `dangers`, `coins`, `visuals`, `makeCoin`, `WORLD01_GIMMICK_MINIMUMS`; modify
  - `src/game/data/world01Maps.ts` :: `createStageMap` / 진짜 간식 MapObject 생성; modify
  - `src/game/systems/MapGimmickSystem.ts` :: `overlapsGimmick`, `getVisualSize`; modify

#### Details

- **Signatures & Types**:
  ```typescript
  type Stage = 1 | 2 | 3 | 4;
  const realSnackXs: Readonly<Record<Stage, readonly number[]>>;
  function createRealSnackObject(stage: Stage, index: number, x: number): MapObjectDefinition;
  // 기존 DangerKind/CoinKind 및 WorldGimmickDefinition 유지.
  ```
- **Data & Schema Fields**: 진짜 간식은 기존 `MapObjectDefinition`을 사용한다. `id=world-01-stage-${stage}-snack-${index+1}`, `kind='collectible'`, `x=표의 좌상단x`, `y=getWorld01FloorY(stage,x)-40`, `width=34,height=26`, `visualKey='bone-coin'`, `layerId='world-01-gameplay'`, `collision=false`, `properties={collectibleType:'snack-coin',coinValue:1}`. nullable 필드는 추가하지 않는다. `gimmickId`/치명적 chain을 붙이지 않는다.
- **Exact final coordinates** (T01 배치를 대체):

  | Stage | 정적 장애물·맨홀 kind:x | 가짜 간식 kind:x | 진짜 간식 x |
  | :--- | :--- | :--- | :--- |
  | 1 | ant-static:544, white-spike-static:848, box-static:1152, pigeon-static:1520, ant-static:1872, box-static:2208 | fake-bone-green:1328 | 224,304,384,1008,1776 |
  | 2 | ant-static:544, open-manhole:832, pigeon-static:1088, white-spike-static:1312, box-static:1760, ant-static:2016, pigeon-static:2256 | fake-bone-reverse:704, fake-bone-green:1632 | 224,304,384,1584,1904 |
  | 3 | ant-static:544, box-static:848, white-spike-static:1152, pigeon-static:1520, ant-static:1872, box-static:2208 | fake-bone-fire:1328 | 224,304,384,1008,1776 |
  | 4 | pigeon-static:544, open-manhole:832, box-static:1088, white-spike-static:1344, ant-static:1632, pigeon-static:1888, box-static:2112 | fake-bone-reverse:1216, fake-bone-fire:2000 | 224,304,384,1472,1776 |

- **Existing floor/sections**: 구간 `[0,192,912,1648,2368,2560]`. 스테이지1/3 y512. 스테이지2 x<1024→512,<1280→496,<1792→480,<2048→496,이후512. 스테이지4 x<896→512,<1152→496,<1664→480,<1920→496,이후512. `sectionIndex`는 중앙 x 기준으로 다시 산출한다.
- **Sizes & collision**: 비둘기 기존48×32를60×40으로 변경, 바닥 접지 유지. 충돌은 `Rectangle(gimmick.x+10,floorY-38,40,37)`로 몸통 안에 둔다. 다른 위험 크기는 ant32×20, spike38×28, box44×36, manhole80×16 그대로다.
- **Execution Flow / Logic**:
  1. 새 x로 기믹/오브젝트/chain ID를 일관되게 만들되 저장 checkpoint ID는 유지한다. checkpoint x1520/2320, 출구x2416 유지.
  2. 모든 간식 y를 floor-40으로 정렬한다. 기존 가짜의 floor-122 및 최소80px 공중 배치 규칙은 이번 요청에 따라 폐기한다. 걷는 코기 body가 진짜 세 개를 실제로 획득할 수 있고 가짜는 점프로 피할 수 있어야 한다.
  3. 맵별 정적6, 스테이지2/4 맨홀각1, fake종류각2를 유지한다. 종류별 전체 정적 개수는 ant7/spike4/pigeon6/box7.
  4. 위험의 오른쪽 끝과 다음 위험 x 사이 최소144px, 위험 x 간격 최대448px. 마지막 체크포인트 복귀 위치(x+40)에 위험이 겹치지 않는다. 초록 간식 뒤 첫 물리 위험의 시작 x는 최소128px 떨어뜨려 기본속도240px/s에서450ms 변신 연출 전에 다른 위험에 먼저 닿지 않게 한다. 시작/끝 안전구간192px 유지. 코인을 장애물 수로 세지 않는다.
- **Error & State**: 좌표/크기를 바꾸면서 시각보다 큰 투명 치명 구역을 만들지 않는다. 데이터 검사 실패 시 간격을 임의로 완화하지 말고 배치를 함께 수정한다.

### I02. Tiled 진짜 간식의 획득·재시도 생명주기

- Related Files:
  - `src/game/stages/StageEntityFactory.ts` :: `StageEntityRequest`, `createCoin`; modify
  - `src/game/stages/StageRuntime.ts` :: `buildFromMap`, `collectCoin`, `complete`, 새 `resetCoins`, EconomySystem 연결; modify
  - `src/game/scenes/StageScene.ts` :: coin overlap callback, `RestartController`의 onMapRestore, `map-state-restored`; modify
  - `src/game/data/snackPresentation.ts` :: 정상/가짜 공통 표시 계약; new
  - `src/game/systems/DeathSystem.ts` :: 사망시 currentStageCoins=0; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // src/game/data/snackPresentation.ts, Phaser import 없는 상수
  export const SNACK_PRESENTATION: Readonly<{
    textureKey: 'world-01-props'; frameKey: 'bone-coin';
    width: 34; height: 26; topOffsetFromFloor: 40;
  }>;
  // 기존 coin 요청에 선택 필드 추가, 기본 legacy로 타 월드 타원 유지
  type CoinAppearance = 'legacy' | 'bone';
  // { kind:'coin'; id:string; x:number; y:number; appearance?:CoinAppearance }
  private createCoin(scene: Phaser.Scene, id: string, x: number, y: number,
    appearance?: CoinAppearance): Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image;
  public collectCoin(coinId: string): boolean;
  public resetCoins(): void;
  ```
- **Data & Schema Fields**: `RuntimeStageState.currentStageCoins:number`는 해당 시도 획득 통계, `ProgressState.bankedCoins:number`는 영구 보유 잔액이다. 진짜 간식은 기록의 `kind='coin'`, `stageEntityKind='coin'`, `entityId=map object id`. 새 저장 필드나 영구 `collectedItems` 기록은 추가하지 않는다. `MapObjectKind`를 늘릴 필요 없이 `collectibleType`으로 분기한다.
- **Execution Flow / Logic**:
  1. `buildFromMap`의 collectible 분기에서 `properties.collectibleType === 'snack-coin'`이면 factory의 bone coin을 중앙좌표(x+17,y+13)로 생성하고 runtime record kind coin으로 등록한다. 다른 collectible은 기존 코드 유지.
  2. bone coin은 위 공통 atlas frame을 써서 image34×26으로 그리고 동일 크기의 static body를 갖는다. `MapInteractionSystem`에서는 일반 collectible을 중복으로 렌더링/획득하지 않아야 한다. 해당 collectible에는 chain이 없다.
  3. `StageScene`의 기존 coin overlap은 `runtime.status === 'play'`인 때에만 `collectCoin(id)`를 호출한다. 유효한 활성 coin record를 확인하고 active=false, visible=false, static body.enable=false로 만든 뒤 I05의 `EconomySystem.collectCoin(stageId,1)`에 한 번 위임한다. 이 경로만 currentStageCoins+1 및 bankedCoins+1을 수행하고 `coin-changed`를1회 발행한다. 보이지 않는 코인에 대한 반복 겹침은 적립하지 않는다.
  4. `resetCoins()`는 기존 coin record를 재사용해 active/visible/body.enable을 true로 돌린다. 새 collider를 생성하지 않는다. 사망/체크포인트 복귀의 onMapRestore에서 호출한다. 사망 정책의 currentStageCoins=0은 통계 초기화로 유지하지만 bankedCoins는 변경하지 않는다. `coin-changed`로 통계0과 유지된 보유 잔액을 함께 전달한다. checkpoint 이전 코인도 같은 시도 정책으로 복원한다. 복원된 진짜 코인을 실제로 다시 먹으면 새 시도의 획득으로1회 더 적립한다.
  5. `restartStage`/`restartFromCheckpoint`가 전체 build를 하는 경로와 직접 onMapRestore 경로를 구분한다. 직접 복귀에는 `resetCoins`가 필요하다. rebuild가 일어난 경로에서는 overlap이 현재 엔티티를 참조하는지 확인한다. 같은 호출을 여러 번 해도 점수 증가/구독 중복이 없어야 한다.
  6. stage clear 때 `complete()`는 I05의 `commitStageClear()`를 통해 완료 기록/시도 통계만 정리한다. 이미 획득 때 적립했으므로 최초 클리어의 `bankedCoins += currentStageCoins`를 제거하고 재합산하지 않는다. 가짜 간식은 runtime 진짜 코인 목록에 등록하지 않아 잔액·통계 모두 지급하지 않는다.
- **Error & State**: 존재하지 않는 ID/비활성 엔티티는 false 반환. 필수 atlas 누락은 에셋 검사에서 실패시킨다. 진짜만 타원으로 fallback해 가짜를 노출시키지 않는다.

### I03. 수집 이전 위장과 이후 드러남

- Related Files:
  - `src/game/systems/MapGimmickSystem.ts` :: `getVisualFrame`, `createGimmickVisual`, `changeBoneVisual`, `reset`, `getVisualSize`; modify
  - `src/game/data/world01Gimmicks.ts` :: `makeCoin` counterplay notes; modify
  - `src/game/data/world01Maps.ts` :: `createChainRules`; preserve existing outcomes
  - `src/game/assets/assetManifest.ts` :: 기존 프레임 매핑; read-only

#### Details

- **Signatures & Types**: `getVisualFrame(gimmick: WorldGimmickDefinition,revealed:boolean): string | undefined`. 현재 `void revealed`를 제거하고 세 fake 종류에서 false면 공통 `bone-coin`, true면 종류별 `bone-coin-green/reverse/fire`를 반환한다.
- **Execution Flow / Logic**:
  1. create/reset의 armed 가짜는 공통 frame/size/높이/tint/alpha=1. 진짜와 다른 빛, 경고 문구, 깜빡임, 소리, 위치 높이를 부여하지 않는다. 기존 notes의 `색이 다른` 안내는 `획득 전에는 구별되지 않는 간식을 접촉하지 않고 지나간다`로 바꾼다.
  2. 실제 겹침에서 기존 `beginGimmick(...,'object-hit')`를 한 번 실행한 후 `changeBoneVisual`을 호출한다. 초록 효과는 코기 tint #40d850→450ms 뒤 사망이라는 기존 chain을 보존한다. reverse/fire의 효과·기간도 유지한다.
  3. snapshot reset에서 armed는 기본 프레임으로 돌아오며 tint/이전 표시가 남지 않는다. 이미 발동한 상태를 복원할 경우 수집 가능한 진짜처럼 다시 보이지 않도록 해당 consumed 가짜는 숨긴다. 상태를 임의로 armed로 만들어 중복 사망을 일으키지 않는다.
  4. debug 모드의 내부 ID는 디버그 목적만 유지한다. 일반 플레이 HUD/라벨에는 가짜의 정체를 표시하지 않는다.

### I04. 생성·검사 기준의 동시 갱신

- Related Files:
  - `scripts/world01-maps.mjs` :: `verifyMap`, `run`; modify
  - `src/game/data/validateMaps.ts` :: `validateAllMaps`; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-1.json`, `world-01-stage-2.json`, `world-01-stage-3.json`, `world-01-stage-4.json` (같은 디렉터리) :: regenerate
  - `.memory/test-plans/2026-10-12-world01-gameplay-refinement.md` :: 배치·획득 검증 기록; modify

#### Details

- `WORLD01_GIMMICK_COUNT` 파생값은32이며 명시 기대값32, 맵별 정적6, 맨홀2, fake6, 진짜20(각5)를 두 검사 경로에 반영한다. 검사값을 실제 배열 길이와 자기 비교하는 방식으로 무력화하지 않는다.
- Tiled 총 객체는58(기믹32+진짜20+체크포인트2+출구4). 진짜 collectible은 Tiled `gimmicks` objectgroup에 저장되어도 `gimmickId`가 없으므로 치명 기믹 수에 포함되지 않는다.
- 좌우 안전구간, 최소 위험 끝간격144/최대 시작간격448, 초록 간식 뒤 위험 시작간격128 이상, checkpoint spawn 비중첩, 공통 coin y=floor-40, 첫3 간식의 종류와 실제 점수 속성, 전체 atlas frame 참조를 검사한다. 기존 fake coin 최소80px 높이 검사는 제거/대체한다.
- T01에서 강화한 생성물 비교로 좌표·크기·속성·tile 데이터의 stale JSON을 검출한다. 검증을 맞추려고 위험을 숨기거나 카탈로그에만 개수를 더하지 않는다.

### I05. 영구 잔액·즉시 저장·오른쪽 상단 표시 연결

- Related Files:
  - `src/game/systems/EconomySystem.ts` :: `collectCoin`, `commitStageClear`, `handleDeath`, `purchaseTool`; modify
  - `src/game/stages/StageRuntime.ts` :: constructor, `collectCoin`, `complete`, `resetCoins`; modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: constructor의 coin-changed 구독, `flush`, `destroy`; modify
  - `src/components/game/GameShell.tsx` :: coin-changed 구독, `handleEvent`, HUD 렌더링 게이트; modify
  - `src/components/game/SnackCoinCounter.tsx` :: 전용 잔액 표시; new
  - `src/components/game/Hud.tsx` :: 기존 금고/이번 스테이지 중복 표시 정리; modify
  - `src/app/globals.css` :: `.snack-coin-counter`, 모바일 배치; modify
  - `src/game/core/types.ts` :: `ProgressState.bankedCoins`, `RuntimeStageState.currentStageCoins`; read-only, 주석 설명만 필요 시 갱신
  - `src/game/persistence/ProgressStore.ts`, `saveTypes.ts`, `migrations.ts` :: 기존 저장 경로; read-only
  - `src/game/bridge/GameEventBus.ts`, `src/components/game/GameEventBridge.tsx`, `ShopPanel.tsx` :: 기존 이벤트·상점 잔액 계약; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 EconomySystem 공개 계약 유지
  public collectCoin(stageId: StageId, amount?: number): boolean;
  public commitStageClear(): number; // 반환은 현재 보유 잔액, 추가 정산 없음
  public handleDeath(): void; // 시도 통계만 초기화
  public purchaseTool(toolId: string): boolean; // 기존 구매 로직/진입 조건 유지
  // StageRuntime: 전달받은 progress가 있는 경우 같은 참조를 주입
  private readonly economy?: EconomySystem;
  // 새 React client component, 값을 자체 적립하지 않는 표현 전용
  export interface SnackCoinCounterProps { readonly balance: number; }
  export function SnackCoinCounter(props: SnackCoinCounterProps): ReactElement;
  // 기존 coin-changed 이벤트 유지
  // { stageId:StageId; currentStageCoins:number; bankedCoins:number }
  ```
- **Data & Schema Fields**:
  - `bankedCoins`: 기존 기본0, 음이 아닌 정수, nullable 아님. 현재 보유/소비 가능한 잔액이며 누적 총 획득 통계와는 다르다. 기존 `SaveEnvelope` schemaVersion2와 저장 key를 유지해 이전 잔액을 보존한다.
  - `currentStageCoins`: 현재 시도의 획득 개수, 사망/재시작/클리어 때0. HUD에는 이 값을 더하지 않는다.
  - `SnackCoinCounter.balance`: `GameShell` React progress 스냅샷의 bankedCoins만 전달한다. localStorage를 컴포넌트가 별도로 읽거나 별도 React 잔액을 만들어 동기화하지 않는다.
- **Execution Flow / Logic — 적립과 정산**:
  1. `EconomySystem.collectCoin`은 기존 stageId/양의 정수 amount 검증을 유지한다. 성공 시 공유 progress.bankedCoins와 runtime.currentStageCoins를 각각 amount만큼 올린 뒤 기존 `emitCoins`를 한 번 호출한다. 실패 입력은 어떤 값/이벤트도 변경하지 않는다.
  2. StageRuntime constructor는 전달된 progress가 있을 때 자신의 runtimeState와 eventBus를 사용한 EconomySystem 인스턴스를 만든다. 실제 StageScene은 공유 progress를 전달하므로 반드시 이 경로로 적립한다. 선택 인자가 없는 독립 runtime 테스트/프로토타입의 경우 기존 임시 currentStageCoins 증가+bankedCoins0 이벤트를 유지하며 가짜 영구 저장 객체를 만들어 실제 저장된 것처럼 취급하지 않는다.
  3. StageRuntime.collectCoin의 직접 증분/이벤트 발행은 economy가 있는 경로에서 제거한다. GameShell의 economyRef는 기존 구매용으로 유지하고 coin-changed를 받아 collectCoin을 다시 호출하지 않는다. 같은 shared progress를 쓴 두 서비스가 같은 획득에 이중으로 더하지 않아야 한다.
  4. `EconomySystem.commitStageClear`는 잔액을 더하지 않고 currentStageCoins=0, clearedStages에 stageId가 없으면 추가, emitCoins, 현재 bankedCoins 반환. 코인0개 클리어도 정상 완료 등록한다. StageRuntime.complete는 해당 정산 함수를 한 번 호출하고 stage-completed를 기존 형태로 발행한다. 기존 직접 bankedCoins 합산은 삭제한다. 이미 완료된 runtime의 repeated complete는 기존 멱등 guard로 무시한다.
  5. `handleDeath`와 `DeathSystem`의 currentStageCoins=0 동작은 통계용으로 유지한다. StageRuntime의 reset 이벤트는 최신 bankedCoins를 전달한다. 기존 저장된 완료 스테이지를 재도전해도 진짜 코인을 다시 실제로 먹는 행위는 정상 적립된다. 영구 ID 소진/일일 제한 같은 별도 경제 기능을 추가하지 않는다.
  6. 기존 `purchaseTool`은 같은 bankedCoins를 차감하고 tool-purchased 이벤트를 사용한다. 상점 가격/노출/상품을 변경하지 않는다. 기존 명시적 진행 초기화는 잔액도0으로 만드는 동작을 유지한다.
- **Execution Flow / Logic — 저장과 React 동기화**:
  1. `AutoSaveCoordinator` constructor에 `coin-changed` 전용 구독을 추가해 변경된 공유 progress를 `flush()`로 즉시 저장한다. 기존100ms debounce용 SAVE_EVENTS와 중복 등록하지 않는다. 이미 예정된 다른 저장은 flush가 취소/통합한다. 기존 destroy/beforeunload cleanup 경로를 유지한다.
  2. 이 순서는 `잔액 변경→coin-changed→공유 progress 저장`이다. 저장기는 bankedCoins를 다시 계산하지 않는다. 정상 localStorage 환경에서는 수집 직후 클리어 없이 새로고침해도 같은 잔액을 읽는다.
  3. `GameShell`의 coin-changed 구독은 runtimeRef.current.currentStageCoins와 progressRef.current.bankedCoins를 각각 **payload 값으로 대입**하고 `setRuntime({...})`, `setProgress(cloneProgress(progressRef.current))`를 실행한다. payload 잔액을 기존 잔액에 더하지 않는다. GameEventBridge는 이미 coin-changed를 구독하므로 새 중복 bridge를 만들지 않는다.
  4. 현재 handleEvent의 `코인 상태가 저장되었습니다` toast는 매 코인 수집마다 띄우지 않도록 제거한다. 잔액 숫자가 직접 반응하며 저장 예외 상황에서 성공 문구가 표시되지 않게 한다. 나머지 기존 toast는 유지한다.
  5. 새 필드가 없으므로 migrations를 바꾸지 않는다. 기존 잔액N인 저장을 로드해 첫 코인 후N+1이 표시·저장되는지 검증한다. ProgressStore의 저장 실패/미지원 처리는 유지하고 사용자 데이터를 지우는 복구를 추가하지 않는다.
- **Execution Flow / Logic — 오른쪽 상단 표시**:
  1. GameShell의 `.game-content-frame` 바로 아래에 `progressLoaded && introGateStep === 'ready'` 조건으로 SnackCoinCounter를 렌더링한다. `mode !== 'stage-clear'`인 GameOverlay 게이트와 분리해 클리어 화면에서도 숫자가 사라지지 않게 한다. 최초 온보딩/이름 입력 전에는 숨긴다.
  2. 표시 `간식 코인` 라벨과 `balance.toLocaleString('ko-KR')` 숫자. role=status, aria-live=polite, aria-atomic=true, 접근성 이름 `보유 간식 코인 ${balance}개`. 숫자는 tabular-nums. 기존 자산 재생성/새 이미지가 필요하지 않다. 상점 진입 버튼처럼 보이게 만들지 않는다.
  3. 기본 위치는 게임 프레임 기준 absolute top56px/right16px, 모바일(max-width768px) top56px/right8px, z-index4, pointer-events:none. 오른쪽 첫 줄의 기존 하트·일시정지·초기화 아래 둘째 줄에 두어 겹침을 피한다. 초기 max-width는 `min(220px, calc(100% - 128px))`, 12px 픽셀폰트와 작은 내부 여백. 밝은 배경에 기존 HUD 색을 사용하고 숫자를 잘라내거나 보유액을 임의의99+로 축약하지 않는다. 큰 값에서는 글자 크기/내부 줄배치로 수를 전부 읽게 한다.
  4. `.hud-stats` 안에는 넣지 않는다. 현재 모바일 보스 규칙 `.game-overlay.has-boss-hearts .hud-stats {display:none}`와 game-hud의 overflow:hidden이 새 잔액을 숨기지 않아야 한다. Hud의 옛 금고/이번 스테이지 숫자 두 span을 제거해 한 화면에 다른 의미의 코인 잔액이 중복되지 않게 하고 장비/쿨다운은 보존한다.
  5. pause/death overlay/보스 컷신 종료/클리어에서 보유액 자체는 변하지 않는다. 카운터는 일반적인 컷신 UI보다 아래에 있어도 되지만 게임 HUD가 보이는 상태에서 잔액이 누락되면 안 된다. 1280×720,844×390,390×844에서 설정 버튼·하트·캔버스와 겹침을 확인하고 위치만 조정한다.
- **Error & State**: storage 미지원/실패가 게임을 중단하지 않으며, 성공적인 저장을 보장할 수 없는 환경은 검증에서 명시한다. 자동 저장 구독은 destroy에서 해제한다. 코인 아이콘/카운터 자체의 animation이나 전체 HUD 재설계는 필요하지 않다.

### I06. 코인 적립·저장 행동 검사

- Related Files:
  - `scripts/snack-wallet.test.mjs` :: 실제 EconomySystem/AutoSaveCoordinator/ProgressStore의 연동 검증; new
  - `.memory/test-plans/2026-10-12-world01-gameplay-refinement.md` :: HUD/재접속 증거; modify

#### Details

- Node의 node:test/assert와 메모리 Storage 구현을 사용한다. extensionless TS는 기존 `scripts/world01-maps.mjs`처럼 createRequire+TypeScript transpileModule 로더를 테스트 안에서 등록한다. DOM/Phaser를 불러오는 UI는 별도 실제 브라우저 검증으로 확인한다.
- 초기 bankedCoins10에서 실제 EconomySystem.collectCoin 세 번→잔액13/통계3, 이벤트payload도13. AutoSaveCoordinator에 같은 progress/store/bus를 주입해 타이머를 기다리지 않고 store.load().bankedCoins===13인지 확인한다.
- handleDeath→잔액13/통계0, 새 시도 획득→14, commitStageClear 두 번→잔액14 유지/완료ID중복없음. 코인0개 최초클리어도 완료ID가 추가된다. 다른 stageId/0/음수/소수 amount는 무변경.
- 기존 schemaVersion2 저장 잔액 로드, 저장 후 coordinator.destroy/재생성으로 잔액복원, 변경이 없던 과거 저장의 다른 진행 필드 보존을 검사한다. 저장 실패 시 예외가 게임 이벤트 처리를 중단하지 않는지도 확인한다.
- 동일한 활성 coin record 반복 겹침의1회적립, 가짜 적립0, 사망 후 재생성 코인 재획득, HUD 숫자 갱신/새로고침 복원은 StageScene 실제 플레이로 검증한다. 미래 상점의 새 구매 플로우는 구현하지 않고 기존 EconomySystem.purchaseTool이 같은 잔액을 사용한다는 계약만 회귀 확인한다.

## Acceptance Criteria

- [x] 각 맵 첫 세 간식을 걸어서 먹으면 시도 통계가1→2→3, 보유 잔액은 기존N에서N+1→N+2→N+3으로 증가한다. 그보다 앞에 가짜가 없다.
- [x] 수집 전 진짜/가짜가 같은 bone-coin 프레임34×26과 같은 높이로 보이고 색/효과로 구별되지 않는다.
- [x] 초록 코인을 먹은 후에만 코기 초록 변신과 기존 사망이 발생하며, 다시 시작하면 미발동 외형이다.
- [x] 같은 활성 진짜 코인의 중복 적립이 불가하고 사망/체크포인트 복귀 후 시도 통계만0, 보유 잔액은 유지된다. 복원된 진짜 코인 재획득은 한 번 더 적립된다.
- [x] 오른쪽 상단 잔액이 일반맵·보스·일시정지·사망·클리어·모바일에서 확인되고, 실제 획득 즉시 갱신된다.
- [x] 코인 수집 직후 클리어 없이 새로고침해도 보유 잔액이 유지되며, 최초/반복 클리어에서 이중 적립되지 않는다. 기존 저장 잔액·상점 재화 필드가 동일하다.
- [x] 맵별 정적6개, 총 기믹32개/진짜20개/체크포인트2개. 비둘기는60×40이고 접지·판정이 자연스럽다.
- [x] 장애물 사이 점프/착지 공간과 체크포인트 복귀가 유효하다.

## Validation

- `npm.cmd run world01:maps`, `npm.cmd run world01:maps:check` — 최종32개 기믹/58개 Tiled 객체와 배치 규칙 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run test:progression` — 통과.
- `node --experimental-strip-types --test scripts/snack-wallet.test.mjs` — 적립/사망/클리어/즉시 저장/기존 저장 호환 통과.
- `npm.cmd run dev` — 각 맵 초반 실제3회 수집, fake 접촉/회피, 사망 후 동일 ID 재수집, stage2 checkpoint 복귀, stage4 checkpoint→boss 복귀 확인.
- 같은 브라우저의 테스트 저장으로 보유10→3개수집13→사망13→재획득14→새로고침14→클리어14를 확인한다. mobile844×390/390×844와 desktop1280×720에서0/1,234/1,234,567을 표시해 숫자 잘림·하트/버튼 겹침·모바일 숨김 여부를 확인한다.
- 진짜/미발동 가짜를 같은 화면 배율로 촬영해 나란히 비교하고, 점프해 비둘기를 넘을 때 빈 투명 영역에서 죽지 않는지 확인한다. 정적 값만 비교하는 새 테스트 파일 대신 맵 검사와 행동 검증을 확장한다.

## Commit Message

```text
feat(world01): 간식 위장과 누적 잔액 표시 및 장애물 밀도 개선

Plan: 2026-10-12-world01-gameplay-refinement
Phase: P01-gameplay-refinement
Task: T02-snacks-obstacles

- 진짜 간식 세 개를 선행 배치하고 가짜의 획득 전 외형을 통일
- 진짜 간식을 획득 즉시 영구 적립하고 오른쪽 상단 잔액과 저장을 연결
- 사망 후 잔액을 유지하고 클리어 시 중복 적립을 제거
- 맵별 정적 장애물을 6개로 늘리고 비둘기 표시와 판정을 확대
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 본 Task 제목의 Git 커밋 참조
