# Task: T07 일반맵 네 개의 캠페인·복원 연결

## Status: pending

## Goal
완성된 배경·지형·지상·공중 시스템을 월드 4 일반맵 네 개에만 연결하고, 기존 입력·대시·체크포인트·사망·다음 스테이지 흐름을 실제로 작동시킨다.

## Decision Summary
- 첫 진입에 대시가 해금되어 있고 더블 점프는 없다. 맵3840×720,바닥504,spawn96,checkpoint2496,코인15개다.
- 월드 4의 샘플 발판/함정/적과 옛 placeholder 맵을 새 시스템과 중복 실행하지 않는다. 보스·인트로·다른 월드는 기존 경로다. 검증 폴더/test-plans 문서를 만들지 않는다.

## Implementation

### I01. 시스템 소유자와 동기 사망 보호
- Related Files:
  - src/game/systems/World04HazardSystem.ts :: World04HazardSystem — new
  - src/game/systems/World04TerrainSystem.ts,World04GroundSystem.ts,World04AirSystem.ts — 선행 API; read-only
  - src/game/core/events.ts :: GameplayEventBus — 기존 이벤트; read-only
  - src/game/systems/DeathSystem.ts,RestartController.ts — 동기 사망/부활 흐름; read-only
  - scripts/world04-runtime.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export class World04HazardSystem {
  constructor(scene:Phaser.Scene,player:Player,controller:PlayerController,
    layout:World04Layout,eventBus:GameplayEventBus,
    getCheckpointId:()=>string|null,canUpdate:()=>boolean);
  beforePlayerUpdate():void;
  afterPlayerUpdate(deltaMs:number):boolean;
  resetForAttempt(spawnX:number):void;
  getDebugState():readonly World04DebugEntry[];
  destroy():void;
}
```
- **Child API**: Terrain/Air constructor(scene,player,layout,port), Ground constructor(scene,player,controller,layout,port). 공통 update(deltaMs):boolean,resetForAttempt(spawnX):void,getDebugState():readonly World04DebugEntry[],destroy():void. Ground만 sampleSurface():PlayerSurfaceModifier|null을 추가 제공한다.
- **Data & Schema Fields**: Port는 isActive():boolean,isDashing():boolean,kill(sourceId,risk):boolean이다. 위험 분류는 attack/physical/fall. 소유자 내부 destroyed:boolean=false,deathLatched:boolean=false,generation:number=0이며 생성된 terrain/ground/air 참조는 각각 해당 클래스의 non-null 인스턴스다.
- **Execution Flow / Logic**:
  1. 세 자식을 한 번 생성하고 같은 port를 넘긴다. isActive는 !destroyed&&canUpdate(),isDashing은 controller.isDashing().
  2. kill은 !isActive/deathLatched이면 false. attack이고 실제 대시 중이면 false. 그 외에는 deathLatched=true를 먼저 설정한 뒤 death-requested를 emit한다.
  3. payload={stageId:layout.stageId,cause:risk==="fall"?"fall":"trap",checkpointId:getCheckpointId(),gimmickId:sourceId,outcome:"instant-death",now:scene.time.now}. 새 사망 이벤트/체력 경로를 만들지 않는다.
  4. emit 안에서 DeathSystem→RestartController→restart 이벤트가 동기 실행된다. 그 안에서 reset이 latch를 해제해도 kill은 반드시 true를 반환한다. before/after의 generation을 비교해 이전 프레임 나머지 처리를 중단한다.
  5. beforePlayerUpdate에서 활성 상태면 controller.setSurfaceModifier(ground.sampleSurface()), 비활성이면 clearSurfaceModifier. 여기서 기계 시간은 진행하지 않는다.
  6. afterPlayerUpdate는 Terrain→Ground→Air 순서. 각 자식이true이거나 generation 변경이면 즉시 true를 반환한다. 정상 종료만 false다.
  7. reset은 generation++,deathLatched=false,modifier해제,각 자식reset. 이전 플레이어 위치도 부활 좌표로 갱신한다.
  8. destroy는 generation++,destroyed=true,modifier해제,세 자식destroy. 재호출은 no-op.
- **Test cases**: 한 프레임에 전기+압축기 접촉, 무적이면 전기만 무시, physical은 사망, emit 안의 reset 재진입 뒤 추가 판정0,정지 중시간0,반복reset/destroy.

### I02. 기존 스테이지 데이터·코인·테마 연결
- Related Files:
  - src/game/data/worlds.ts :: createSegment,createNormalStage,createStageMap — modify
  - src/game/data/worldMaps.ts :: getWorld04StageTheme — modify
  - src/game/maps/ParallaxRenderer.ts :: createLayer — modify
  - src/game/stages/StageRuntime.ts :: buildFromSegments,addCheckpoint — modify
  - src/game/data/world04Scrapyard.ts :: getWorld04Layout,isWorld04StageId — read-only
  - src/game/stages/segmentCoinPresentation.ts — 기존 다른 월드/보스 분기; read-only
  - scripts/world04-campaign.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export function getWorld04StageTheme(
  stageId:StageId,base:WorldMapThemeDefinition
):WorldMapThemeDefinition;
```
- **Data routing**:
  1. createSegment에서 isWorld04StageId(stageId)일 때만 platforms/traps/enemies를 빈 배열로 둔다. coins는 기존 segment별3개,총15개 ID를 그대로 생성한다. 기존 continuousFloor 조건에 월드4를 단순 추가하면 통바닥이 생기므로 그렇게 하지 않는다.
  2. createNormalStage의 월드4 spawn은 layout.spawn={x96,y504}를 복사한다. 기존 mapWidth/Height3840×720,5개 sections,checkpointSectionIndex4,checkpoint ID를 유지한다.
  3. createStageMap의 layers에도 getWorld04StageTheme를 적용한다. 월드4 checkpoint object의 y는384,height120으로 맞춰 발 높이504에 대응한다. x2496은 기존 section 시작 기준 anchor 관례를 유지하며 -9로 이동해 section3으로 넘어가게 만들지 않는다.
  4. gimmicks/chainRules는 월드4에서 빈 배열이다. 새 사물을 기존 Trap 또는 World01 Gimmick으로 재등록하지 않는다.
  5. StageRuntime.buildFromSegments에서 world04 layout을 조회하고 각 coinIndex의 x/y와 appearance="bone"을 사용한다. id는 기존 segment coinId를 사용하고 데이터 ID와 같음을 검사한다. 다른 월드에는 기존 world03CoinPositions/segmentCoinPresentation 경로를 사용한다.
  6. addCheckpoint는 월드4 일반맵만 y444,height120으로 생성하여 respawnPosition.y=504가 되게 한다. x=section.x=2496,깃발 그림은 기존 world-01-checkpoint-flag 재사용.
- **Theme**:
  - getWorld04StageTheme는 대상외에는 base를 그대로 반환한다. 월드4 일반맵에만 palette={far:"#e8b197",mid:"#7a7278",gameplay:"#5a5555",foreground:"#302d3b",accent:"#e9a942"}와 새 assetKey를 적용한다.
  - background-far→world-04-scrapyard-far, background-mid→world-04-scrapyard-mid-N, foreground→world-04-scrapyard-foreground. 기존 layerId/depth/scrollFactor를 유지한다.
  - hazardCatalog는 scrap,tire,oil,belt,cable,press-left,plate,crane,swing,saw의 world-04-scrapyard- 접두 키로 구성한다. 게임 종류/위험 분류는 world04Types를 기준으로 하고 이 시각 key 목록을 enum 대신 쓰지 않는다.
  - ParallaxRenderer.createLayer의 textureHeight 기반 tileScale 분기에 world-04-scrapyard-만 추가한다. 다른 월드4 보스 이미지·캐릭터 키를 포괄하지 않는다.
- **Errors**: layout의 코인 수/ID 불일치, 필요한 자산 누락은 맵 ID/key를 포함한 Error로 실패한다. 조용히 샘플 맵을 보여주는 fallback을 추가하지 않는다.
- **Tests**: 실제 STAGE_DEFINITIONS/StageRuntime을 사용해4개 맵의 빈 샘플 생성물·15개 코인·깃발 위치·메타데이터 검증을 확인한다. world03 및 world04 boss의 기존 구조는 전후 비교한다.

### I03. StageScene의 정확한 생성·프레임·복원·해제 순서
- Related Files:
  - src/game/scenes/StageScene.ts :: create,update,createExitFloor,restoreCheckpoint,shutdown — modify
  - src/game/systems/world04Checkpoint.ts :: shouldActivateWorld04Checkpoint — new
  - src/game/maps/TiledMapLoader.ts — 기존 로더, 수정 불필요; read-only
  - src/game/systems/MapGimmickSystem.ts — 월드4에서 중복 실행하지 않음; read-only
  - src/game/systems/developmentWorld03Start.ts — 개발 시작 강제 설정, 유지; read-only
  - scripts/world04-runtime.test.mjs,scripts/world04-campaign.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export function shouldActivateWorld04Checkpoint(input:{
  previousCenterX:number;currentCenterX:number;
  checkpointX:number;alreadyActive:boolean;
}):boolean;
// StageScene private 필드/메서드
private world04Hazards?:World04HazardSystem;
private world04Layout:World04Layout|null=null;
private world04PreviousCenterX?:number;
private activateWorld04CheckpointByCrossing():void;
```
- **Create order**:
  1. stageId를 정한 뒤 world04Layout=getWorld04Layout(stage.id). theme 합성의 바깥쪽에 getWorld04StageTheme를 적용한다.
  2. 월드4 일반맵은 this.loadedMap=null로 두고 TiledMapLoader.load를 호출하지 않는다. 이전 placeholder cache에 맵이 있어도 사용하지 않는다.
  3. Player/Controller/Runtime 생성은 기존 순서. runtime platform은0개이며 terrain 자식이 지형을 소유한다.
  4. GameplayEventBus·SkillSystem·DeathSystem·CheckpointSystem·RestartController가 준비된 후 world04Hazards 생성. canUpdate는 this.runtime?.getStatus()==="play" && !this.stageTransitionStarted && !(this.eventBus?.isDeathOverlayVisible() ?? false) && !this.shopOpen && !this.catalogOpen && !this.paintOpen && this.player?.active===true && !this.player.isControlLocked()를 검사한다.
  5. 월드4에는 MapGimmickSystem을 생성하지 않는다. mapInteraction은 기존 빈 map 상태/체크포인트 이벤트용으로 유지한다. 기존 MapGimmickSystem도 바닥 낙사를 처리하므로 둘을 함께 켜면 사망 경로가 중복된다.
  6. 기존 일반 platform collider loop는 월드4에서 빈 목록이 된다. createExitFloor에서 world04Layout이면 floorY=504로 결정하여3840~4096까지 출구 지지대를 만든다. 플랫폼 목록이 없다고 return해 출구에서 떨어지게 만들지 않는다.
  7. create의 resumeCheckpointId 처리 후 world04Hazards.resetForAttempt(player.x)와 world04PreviousCenterX=player.body.center.x를 실행한다. 동일 처리를 restoreCheckpoint 끝에도 넣되 초기화 호출이 중복되어도 상태는 같아야 한다.
- **Update order (월드4만)**:
  1. 기존 pause/death overlay/status guard가 먼저 실행된다.
  2. delta의 유한성 검사 후 elapsed=Math.min(50,Math.max(0,delta)). 월드4의 skillElapsedMs,controller.update,기계 update는 같은 elapsed를 사용한다. 다른 월드는 기존 elapsed 경로를 유지한다.
  3. world04Hazards.beforePlayerUpdate → playerController.update(time,elapsed) → 기존 대시 입력/SkillSystem.use/startDash(250,480) → activateWorld04CheckpointByCrossing → world04Hazards.afterPlayerUpdate(elapsed).
  4. afterPlayerUpdate가true면 이 Scene.update를 즉시 return. 이전 사물 루프나 공통 전투/맵 판정이 부활한 코기에게 이어지지 않는다.
  5. 정상일 때 기존 출구 감지·공격·캐릭터 애니메이션·카메라 갱신을 계속한다. 새 대시 키/점프 포즈를 별도로 구현하지 않는다.
- **Checkpoint crossing**: 유한한 값이고 !alreadyActive && previousCenterX<2496 && currentCenterX>=2496이면 획득. 공중/대시 여부로 거절하지 않는다. 기존 activateCheckpoint를 호출해 깃발음/HUD 이벤트를 재사용한다. 마지막 centerX는 매 정상 프레임 갱신하고 reset 때는 부활 좌표로 초기화한다.
- **Restart/reset hooks**:
  - gameplayEventBus의 restart 구독에서 기존 reset들에 이어 world04Hazards.resetForAttempt(player.x),controller.clearSurfaceModifier,world04PreviousCenterX 갱신.
  - death 구독에서는 기존 cancelDash/animation/쿨타임 초기화를 유지한다.
  - runtime의 map-state-restored 구독에서도 세계4 상태를 현재 부활 좌표로 초기화한다. 새 영구 저장 필드는 만들지 않는다.
  - shutdown에서는 world04Hazards.destroy→undefined,world04Layout=null,previousCenterX=undefined,clearSurfaceModifier. 부모 Runtime/Player 관련 객체가 파괴되기 전에 호출한다.
- **Progression**: 기존 getNextStageId와 stage-completed 구독으로1→2→3→4→world-04-stage-boss를 유지한다. 기존 World04EntranceScene·턱시도 전투·더블 점프 보상은 수정하지 않는다.
- **Invalid direct QA entry**: 실제 캠페인에서는 대시가 해금되어 있다. 개발 도구로 진입할 때만 테스트 전용 메모리 progress에 dash를 넣는다. 이번 Task에서 플레이어 저장을 자동 변조하거나 전역 개발 시작점을 바꾸지 않는다.

### I04. 통합 회귀 및 오류 처리
- Related Files:
  - scripts/world04-runtime.test.mjs :: lifecycle test — new
  - scripts/world04-campaign.test.mjs :: actual definitions/runtime test — new
  - scripts/world03-checkpoint-respawn.test.mjs,scripts/world03-construction-stages.test.mjs — read-only
  - scripts/stage-progression.test.mjs,scripts/boss-stage-content.test.mjs — read-only

#### Details
- reset 중 재진입,death overlay 동안 판정0,메뉴 pause,새 스테이지의 elapsed0,체크포인트 전/후 사망 위치96/2496,공중 깃발 획득,14번째 프레임 대시/전기 경계,사망1회·코인 경제 유지,exitFloor 존재를 검사한다.
- World04HazardSystem에 실제 세 자식과 fake Scene/Player/Controller를 주입한 테스트로 시간을 진행한다. 파일에 특정 문자열이 있는지만 검사하는 방식으로 기능 통과를 대신하지 않는다.
- 앱/Next 코드 수정은 필요 없다. 불가피하게 앱 파일을 건드리게 된다면 먼저 node_modules/next/dist/docs/의 관련 .md 가이드를 읽는다. 이미 확인한 설치 가이드는 01-app/01-getting-started/01-installation.md다.
- 기존 미커밋 StageScene/worlds/StageRuntime의 보스·대시 변경은 작업 시작 기준이다. HEAD로 돌리거나 파일 전체의 다른 변경까지 무조건 커밋하지 않는다.

## Acceptance Criteria
- [ ] 월드4 일반맵에 새 그림·12종 기믹만 연결되고 샘플 함정·통바닥·기존 맵이 중복되지 않는다.
- [ ] 입력·대시·표면·기계 업데이트 순서와 실제 대시 무적 분류가 맞는다.
- [ ] 체크포인트/부활/정지/장면전환에서 같은 패턴과 안전한 시작 상태가 복원된다.
- [ ] 정상 출구 이동과4→기존 보스 연결이 유지된다.
- [ ] 다른 월드·보스·개발 시작 설정을 변경하지 않는다.

## Validation
- node --experimental-strip-types --test scripts/world04-runtime.test.mjs scripts/world04-campaign.test.mjs scripts/world04-ground.test.mjs scripts/world04-air.test.mjs scripts/world04-terrain.test.mjs scripts/world03-checkpoint-respawn.test.mjs scripts/world03-construction-stages.test.mjs scripts/stage-progression.test.mjs scripts/boss-stage-content.test.mjs — 통합과 인접 회귀.
- node scripts/validate-assets.mjs — 필수 자산.
- npx tsc --noEmit — 타입 검사.
- npm run lint — 전체 린트.
- npm run build — 프로덕션 빌드.
- 자동 검증 통과와 실제 플레이 확인은 구분해 기록한다. 실제 입력 검증은 T08에서 완료한다.

## Commit Message
```text
feat(world04): 고물상 일반맵과 재도전 흐름 연결

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T07-campaign-integration

- 네 일반맵의 배경과 지형 및 장애물 시스템 연결
- 체크포인트와 사망 복원 및 대시 판정 순서 보장
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과: 미실행 — 계획 단계

