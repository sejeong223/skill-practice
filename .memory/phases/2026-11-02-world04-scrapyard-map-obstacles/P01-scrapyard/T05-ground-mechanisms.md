# Task: T05 지상 기믹 일곱 종류와 이동 표면

## Status: pending

## Goal
고철·폐타이어·폐유·컨베이어·전기·압축기·압력판/차단문이 각자의 규칙대로 동작하고, 이동 효과가 PlayerController의 매 프레임 속도 처리에 덮어써지지 않게 한다.

## Decision Summary
- 전기는 대시 무적으로 통과하며 평상시 접촉은 즉사다. 고철·압사는 무적과 무관하고 닫힌 문은 통과할 수 없다. 타이어·기름·컨베이어는 자체 피해가 없다.
- 기존 PlayerController의 기본 조작·대시·시멘트 처리와 포즈 이벤트를 유지한다. Scene 연결은 T07이며 테스트 파일은 기존 scripts/ 아래에만 만든다.

## Implementation

### I01. PlayerController에 명시적인 표면·도약 입력 추가
- Related Files:
  - src/game/systems/PlayerController.ts :: update,launchFromSurface,setSurfaceModifier,clearSurfaceModifier — modify
  - src/game/entities/playerTypes.ts :: PlayerSurfaceModifier — modify
  - src/game/entities/Player.ts :: PlayerJumpStartEvent — read-only
  - scripts/world04-surface-motion.test.mjs — new
  - scripts/dash-movement.test.mjs, scripts/dash-invulnerability.test.mjs — read-only

#### Details
- **Signatures & Types**:
```typescript
export interface PlayerSurfaceModifier {
  readonly acceleration: number | null;
  readonly deceleration: number | null;
  readonly conveyorVelocityX: number;
}
// PlayerController에 추가할 public API
public setSurfaceModifier(modifier: PlayerSurfaceModifier | null): void;
public clearSurfaceModifier(): void;
public launchFromSurface(velocityY: number): boolean;
```
- **Data & Schema Fields**: private surfaceModifier:PlayerSurfaceModifier|null=null. null이면 기존 동작과 동일하다. setSurfaceModifier는 인수를 복사하고 유한하지 않거나 0 이하인 가감속은 Error로 거절한다. 운반 속도는 유한수이며 기존 tuning 객체는 변경하지 않는다.
- 위 계약은 표면 수정값이 null이면 기존 동작을 그대로 유지한다는 뜻이다. 가감속 값은 null 또는 양수, 운반 속도는 유한수만 허용한다.
- **Execution Flow / Logic**:
  1. update의 controlOverride/controlEnabled/잠금 분기는 기존 순서를 유지한다. 잠김·강제 제어 중에는 표면 효과를 적용하지 않는다.
  2. 정상 이동에서 grounded이면 modifier를 적용한다. targetVelocity=direction*currentRunSpeed()+conveyorVelocityX. moveToward를 한 번 호출하며 컨베이어 속도를 매 프레임 덧셈 누적하지 않는다.
  3. 방향 입력이 있으면 modifier.acceleration??tuning.acceleration, 없으면 modifier.deceleration??tuning.deceleration. 공중에서는 기본값·운반속도0을 사용한다.
  4. 대시 중에는 기존 dashDirection*dashSpeed=±480을 사용한다. 표면 속도/감속으로 대시 거리·시간을 바꾸지 않는다. 종료 후 일반 제어로 돌아간다.
  5. launchFromSurface는 유한한 음수 velocityY만 받는다. 제어 불가/잠금/강제 제어 중이면 false. 성공하면 jumpBuffer/coyote를0으로 지우고 setVelocityY, player-jump-started({kind:"normal",facingLeft:player.flipX})를 emit한다. 중력·스킬·방향·현재 대시는 변경하지 않는다.
  6. 새 표면이 없으면 clearSurfaceModifier로 null 복원. 사망·재시작·장면 종료 시 T07 소유자가 반드시 호출한다.
- **Rationale**: 외부 시스템에서 setVelocityX를 호출하면 다음 controller.update가 덮어쓴다. 목표 속도와 가감속의 입력으로 통합해야 표면 변화와 조작이 함께 작동한다.
- **Tests**: default null일 때 기존 이동 수치 일치, conveyor에 계속 서 있어도 속도 누적0, oil 안에서 감속 거리 증가·벗어나면 기본값 복귀, 공중/대시/잠금에서 적용 예외, 타이어 도약1회 이벤트·잘못된 velocity 거절·중력 유지.

### I02. 일곱 종류의 상태·시간 계산
- Related Files:
  - src/game/systems/world04GroundState.ts :: createGroundState,advanceGroundState — new
  - src/game/data/world04Types.ts :: World04Object,World04Rect — read-only
  - src/game/systems/world04Geometry.ts :: overlapRect,sweepRect — read-only
  - scripts/world04-ground.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export type World04GroundDefinition = Extract<World04Object,
  {kind:"scrap"|"tire"|"oil"|"belt"|"cable"|"press"|"plate-gate"}>;
export type World04GroundState =
  | { readonly kind:"scrap"|"oil"; readonly id:string }
  | { readonly kind:"tire"; readonly id:string; readonly armed:boolean;
      readonly animationMs:number; readonly wasInside:boolean }
  | { readonly kind:"belt"|"cable"|"press"; readonly id:string;
      readonly started:boolean; readonly elapsedMs:number }
  | { readonly kind:"plate-gate"; readonly id:string;
      readonly phase:"closed"|"open"|"rearming";
      readonly elapsedMs:number; readonly wasDown:boolean; readonly released:boolean };
export interface World04GroundSample {
  readonly before:World04Rect; readonly after:World04Rect;
  readonly grounded:boolean; readonly velocityY:number; readonly canLaunch:boolean;
}
export interface World04GroundStep {
  readonly state:World04GroundState;
  readonly dangerRects:readonly World04Rect[];
  readonly risk:"none"|"attack"|"physical";
  readonly blockingRect:World04Rect|null;
  readonly launchVelocityY:number|null;
  readonly warning:boolean;
  readonly frame:number;
  readonly conveyorVelocityX:number;
}
export function createGroundState(definition:World04GroundDefinition):World04GroundState;
export function advanceGroundState(
  definition:World04GroundDefinition,state:World04GroundState,
  sample:World04GroundSample,deltaMs:number
):World04GroundStep;
```
- **Shared defaults**: 모든 rect는 좌상단 좌표다. delta=0~50ms, 초기 elapsed=0이다. 시간 장치는 before.right<triggerX<=after.right일 때 처음 started가 되며 그 프레임은 elapsed=0이다. 정지 중에는 시간을 더하지 않는다. 주기와 배치는 T01의 불변 데이터를 사용한다.
- **Exact behavior**:
  1. scrap: rect가 항상 physical 위험. 기본48×32 또는 최종맵48×28. 그림 여백은 포함하지 않는다.
  2. tire: 중심 발 위치가 pad.x~pad.right에 있고 grounded,velocityY>=0이면 armed 상태에서 -620 도약을1회 요청한다. 지상 센서이며 앞을 막는 solid를 만들지 않는다. 실행 성공 후 armed=false,180ms 반발 프레임. 발 위치가 pad에서12px 이상 벗어난 후 다시 착지하면 재사용 가능하다. 밟은 채 한 프레임마다 도약시키지 않는다.
  3. oil: 발 중심이 표면 안이고 |body.bottom-504|<=8일 때 가속900/감속360. 표면을 떠나면 즉시 해제, 잔여 디버프나 체력 피해 없음.
  4. belt: 각2400ms마다 -90/+90 운반 방향을 번갈아 적용한다. 전환 전300ms에 방향 표시만 깜박인다. elapsed=2400에서 정확히 뒤집고, 표시된 방향과 실제 속도가 일치한다.
  5. cable: t=elapsed%2200; [0,210)은 꺼짐, [210,2200)은 attack 위험. 마지막250ms는 위험이 유지되는 불꽃 프레임이다. 꺼짐0/불꽃1/통전2 프레임. collider로 길을 막지 않는다.
  6. press: 전체1960ms 주기. 열린700→열린채경고240→닫힘260→완전압축500→열림260. core rect폭128/높이112, 닫힘비율p에서 leftJaw=(x,y,64p,112),rightJaw=(x+128-64p,y,64p,112). p=0이면 dangerRects=[]; 나머지는 physical. 대피 공간은 core 밖이다.
  7. plate-gate: 발 중심이 plate 범위에 있고 grounded,velocityY>=0이면 눌림. closed에서 새로운 눌림에 open/elapsed0. 850ms 동안 문이 열린다. 850ms에 닫힐 때 문 rect에 남은 플레이어는 physical 압사, 이후 닫힌 문은 blockingRect로 길을 막되 단순 옆면 대기는 즉사가 아니다. rearming300ms 동안 문이 닫혀 있고 plate를 최소1회 떠나야 다시 누를 수 있다. 누른 채로 자동 연속 개방하지 않는다.
- **Gate visual**: 닫힌 문의 top360,bottom504,width16. open에서는 그림을160px 올리고 blockingRect=null. 닫힘 순간 그림과 바디를 같이 되돌린다. plate-gate는 사전 경고/타이머 UI를 표시하지 않는다.
- **Error/Return**: definition.kind와 state.kind가 다르면 Error(id 포함). 입력 객체를 수정하지 않는다. tire launch를 controller가 거절하면 이전 armed 상태를 유지하여 제어가 돌아왔을 때 정상 작동한다.

### I03. 실제 그림·충돌·표면 소유자
- Related Files:
  - src/game/systems/World04GroundSystem.ts :: World04GroundSystem — new
  - src/game/systems/PlayerController.ts — I01 API 사용; modify
  - src/game/assets/assetManifest.json — 자산 확인; read-only
  - scripts/world04-ground.test.mjs — 독립 실행·복원; new

#### Details
- **Signatures & Types**:
```typescript
export class World04GroundSystem {
  constructor(scene:Phaser.Scene,player:Player,controller:PlayerController,
    layout:World04Layout,port:World04RuntimePort);
  sampleSurface():PlayerSurfaceModifier|null;
  update(deltaMs:number):boolean;
  resetForAttempt(spawnX:number):void;
  getDebugState():readonly World04DebugEntry[];
  destroy():void;
}
```
- **Contract used by caller**: sampleSurface는 controller.update 전에 호출한다. update는 controller/새 대시 입력 처리 후 호출한다. update가 true면 사망/재시작으로 이번 프레임이 끝난 것이다.
- **Execution Flow / Logic**:
  1. 지상7종만 분리해 상태와 이미지를 만든다. 키는 world-04-scrapyard-<kind>이며 press는 press-left/right, plate-gate는 plate/door로 구성한다. T03의 중심/발 앵커를 적용한다.
  2. sampleSurface는 현재 발 접촉과 belt 상태를 읽기만 한다. 겹친 oil은 더 작은 가감속을 적용하고 belt는 단일 접촉만 허용한다. T01 검증으로 벨트 중첩을 막고, 불가피한 동률은 id 순으로 하나만 선택해 속도를 합산하지 않는다.
  3. update에서 순수 상태를 진행하고 프레임·위치·문 바디를 동기화한다. 압축판 그림은 실제 dangerRects를 따라 crop/정수 좌표로 표시한다. 열린 상태에는 보이지 않는 판정이 없다.
  4. 공격형 전기는 port.kill(id,"attack")에서 대시 여부를 판단한다. 고철·압사에는 physical을 사용한다. 넓은 이미지 bounds가 아니라 rect/sweepRect로 접촉을 계산한다.
  5. gate 닫힘 판정은 static body를 enable하기 전에 검사해 물리 엔진이 플레이어를 밀어낸 뒤 압사를 놓치지 않게 한다. closed 바디는 이후 이동을 차단한다.
  6. kill이true거나 generation이 변경되면 즉시 반환한다. 사망 이벤트 안에서 reset이 실행되어도 이후 다른 사물 처리를 이어가지 않는다.
  7. reset은 모든 타이머·누름 상태·도약 상태·문 바디·이전 위치를 초기화하고 controller.clearSurfaceModifier를 호출한다. destroy는 이미지/문 collider/body를 제거하고 modifier를 해제한다.
- **Tests**: 전체 주기의 경계 직전/정확 경계/직후, 대시 상태 전기 생존/고철·압사 사망, 문 닫힐 때 겹침·옆 대기·재누름, tire 중복 발사 방지, 2개 위험이 겹친 프레임의 사망1회, pause0ms·reset·destroy.

## Acceptance Criteria
- [ ] 지상7종이 모두 동작하고 기름/컨베이어 값이 controller에 통합된다.
- [ ] 대시의 시간·속도·방향 고정 및 다른 월드의 기본 이동이 유지된다.
- [ ] 차단문 실패 뒤 다시 시도할 수 있고 진행 불능 상태가 없다.
- [ ] 실제 Scene에 아직 연결하지 않아 기존 맵의 실행 경로가 바뀌지 않는다.

## Validation
- node --experimental-strip-types --test scripts/world04-ground.test.mjs scripts/world04-surface-motion.test.mjs scripts/dash-movement.test.mjs scripts/dash-invulnerability.test.mjs — 새 동작과 기존 대시 회귀.
- npx tsc --noEmit — 타입 검사.
- npx eslint src/game/systems/PlayerController.ts src/game/entities/playerTypes.ts src/game/systems/world04GroundState.ts src/game/systems/World04GroundSystem.ts scripts/world04-ground.test.mjs scripts/world04-surface-motion.test.mjs — 대상 검사.

## Commit Message
```text
feat(world04): 지상 기계와 표면 이동 효과 구현

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T05-ground-mechanisms

- 고철과 전기 및 압축기와 차단문 동작 구현
- 타이어 도약과 기름 및 컨베이어 이동 효과 통합
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과: 미실행 — 계획 단계

