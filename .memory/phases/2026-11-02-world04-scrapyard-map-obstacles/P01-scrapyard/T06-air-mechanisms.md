# Task: T06 자석 크레인·고철 추·레일 원형톱

## Status: done

## Goal
공중 장애물 세 종류가 고정된 궤적과 주기로 움직이고, 실제 원형/고체 그림에 맞는 접촉 판정과 대시 예외를 제공한다.

## Decision Summary
- 크레인의 운반 고철은 physical 위험으로 대시 무적을 무시한다. 추·톱은 attack 위험으로 대시 중 통과 가능하며 평상시 즉사다.
- 체인·레일·크레인 상단 기계는 장식이다. 난수와 플레이어 추적을 추가하지 않는다. 검증 파일은 기존 scripts/ 바로 아래에만 둔다.

## Implementation

### I01. 순수 궤적 계산
- Related Files:
  - src/game/systems/world04AirState.ts :: evaluateWorld04Air,advanceWorld04AirClock — new
  - src/game/data/world04Types.ts :: World04Object,World04Rect,World04Point — read-only
  - src/game/systems/world04Geometry.ts :: overlapCircleRect,sweepCircleRect,sweepRect — read-only
  - scripts/world04-air.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export type World04AirDefinition = Extract<World04Object,{kind:"crane"|"swing"|"saw"}>;
export interface World04AirClock {
  readonly id:string; readonly started:boolean; readonly elapsedMs:number;
}
export interface World04AirPose {
  readonly rect:World04Rect|null;
  readonly circle:{readonly center:World04Point;readonly radius:number}|null;
  readonly magnet:World04Point|null;
  readonly warning:boolean;
  readonly phase:string;
}
export function evaluateWorld04Air(
  definition:World04AirDefinition,elapsedMs:number
):World04AirPose;
export function advanceWorld04AirClock(
  definition:World04AirDefinition,state:World04AirClock,
  previousPlayerRight:number,currentPlayerRight:number,deltaMs:number
):World04AirClock;
```
- **Data & Schema Fields**: elapsedMs는 초기0, started=false. triggerX를 오른쪽으로 처음 가로지른 프레임에 started=true/elapsed0. 그 이후 플레이 중의 delta만 누적한다. rect와 circle은 종류에 따라 하나만 non-null이며 magnet은 crane만 non-null이다.
- **Crane exact flow**:
  - payload 기본72×80, A=(payload.x,payload.y), B=(destinationX,payload.y), 높은 top=liftTopY330. 이때 bottom410이므로 바닥으로 걷기는 가능하고 일반 점프 경로와는 겹친다.
  - 주기5200ms: A정지800 → A상승600 → 높은 위치에서 A→B600 → B하강600 → B정지800 → B상승600 → 높은 위치에서 B→A600 → A하강600.
  - 각 이동 구간은 선형 보간한다. 끝점은 정확히 맞물리며 주기 끝에 화물이 순간 이동하지 않는다.
  - 두 정지 구간의 마지막250ms만 자석 불빛을 켜 움직임을 예고한다. magnet 위치는 payload 상단 중심에서 y=-16에 붙인다. 후크/케이블은 장식이며 payload만 고체 위험이다.
- **Swing exact flow**:
  - pivot=(310+cell.x,245),length150,radius24,amplitude0.75,period2200ms.
  - angle=0.75*sin(2π*t/2200); center=(pivot.x+150*sin(angle),pivot.y+150*cos(angle)).
  - t=0이면 바로 아래, 주기/2에도 바로 아래, 주기/4·3/4에는 양 끝이다. 체인의 끝은 원형 몸체 중심에 연결한다.
- **Saw exact flow**:
  - centerY392,radius22,period1800ms. fromX/toX는 배치 데이터 값을 사용한다.
  - u=(elapsed%1800)/1800, p=u<0.5?2u:2-2u, centerX=fromX+(toX-fromX)*p.
  - 회전 그림은400ms마다1회전하되 충돌은 항상 반지름22의 원이다.
- **Validation/Errors**: elapsed가 음수/NaN이면0으로 정규화한다. 데이터의 반지름/주기/끝점 오류는 T01 validator가 거절한다. 정의와 clock.id 불일치에는 Error.
- **Return**: 기존 state/definition을 수정하지 않는다. 실제 궤적의 좌표는 float로 유지하고 그림을 표시할 때만 반올림한다.

### I02. 실제 사물·고속 접촉·복원
- Related Files:
  - src/game/systems/World04AirSystem.ts :: World04AirSystem — new
  - public/assets/pixel/objects/world-04/world-04-scrapyard-crane.png, -magnet.png, -payload.png, -swing.png, -saw.png — read-only
  - src/game/systems/TuxedoMagnetPattern.ts — 별도 보스 패턴, 변경 금지; read-only
  - scripts/world04-air.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export class World04AirSystem {
  constructor(scene:Phaser.Scene,player:Player,
    layout:World04Layout,port:World04RuntimePort);
  update(deltaMs:number):boolean;
  resetForAttempt(spawnX:number):void;
  getDebugState():readonly World04DebugEntry[];
  destroy():void;
}
```
- **Execution Flow / Logic**:
  1. layout.objects에서 crane/swing/saw만 분리한다. 각 clock과 이전 body/pose를 저장한다. 시작 전에는 t=0 위치에 보이며 움직이지 않는다.
  2. crane은 상단 설비·자석·화물 이미지를 분리한다. payload와 같은72×80 rect에 static zone 및 player collider를 만든다. 현재/이전 화물 위치를 갱신하고 그림과 zone을 같은 좌표에 맞춘다.
  3. 콜라이더가 접촉을 먼저 분리할 수 있으므로 physical 접촉 콜백과 상대이동 sweep를 함께 사용하되 port의 시도별 중복 방지로 사망은1회다. 크레인에 플레이어를 태워 운반하거나 밀리는 효과를 추가하지 않는다.
  4. 추·톱에는 solid collider를 만들지 않는다. 원-사각형 및 상대 이동 sweepCircleRect로 body와 접촉을 계산하고 port.kill(id,"attack")에 위임한다. 이미지의 사각 bounds를 그대로 사용하지 않는다.
  5. 체인/레일은 픽셀 선 또는 기존 금속 발판 텍스처로 그리되 위험 판정은 없고 플레이어를 가리는 큰 전경으로 쓰지 않는다.
  6. 각 update는 port.isActive와 generation을 확인한다. 사망/동기 reset이면 즉시 true로 반환하며 다음 사물을 처리하지 않는다.
  7. reset은 elapsed0/started=false, 실제 그림·payload body·이전 위치를 t=0 및 부활한 플레이어 위치로 맞춘다. 이전 프레임 위치와 새 spawn 사이를 sweep하지 않는다.
  8. pause에는 clock·회전·화물·체인 모두 정지한다. Tween/Scene Timer/Date.now로 별도의 동작 시간을 만들지 않는다.
  9. destroy는 collider,zone,이미지,graphics를 전부 제거하며 두 번 호출해도 안전하다.
- **Shape/phase rules**: debug의 rects는 실제 화물 rect 또는 원의 외접 사각형을 반환하되 테스트의 최종 피해 판정은 원 함수로 확인한다. phase는 crane의8구간 이름, swing="swing",saw="travel"로 고정한다.

### I03. 궤적과 공격/지형 분류 검증
- Related Files:
  - scripts/world04-air.test.mjs :: movement/collision/reset tests — new

#### Details
- 각 궤적의0·1/4·1/2·주기 끝, 큰 경과 시간의 모듈러, crane 구간 경계 연속성을 수치로 확인한다.
- 추·톱의 투명 모서리 근접은 생존, 원 안 접촉은 사망, 대시 중에는 통과. 화물은 대시 중에도 사망하고 고속 대시가 한 프레임 사이에 화물을 통과하지 못한다.
- reset 직후 이전 궤적/이전 player 위치 때문에 사망하지 않는지, pause 동안 위치가 변하지 않는지, 동기 reset 후 두 번째 사물이 판정하지 않는지 검사한다.
- 배치 데이터의 최대 궤적이 checkpoint/입구/출구/상승 함정 후퇴 영역에 닿지 않는지 확인한다. 실패하면 데이터 오류이며 임의로 위험을 비활성화해 테스트를 통과시키지 않는다.

## Acceptance Criteria
- [x] 세 공중 기믹이 다른 동작과 실루엣을 가지며 결정된 분류대로 사망한다.
- [x] 원의 투명 모서리·체인·레일에 보이지 않는 즉사 판정이 없다.
- [x] 주기 시작·재시작·일시정지가 결정적이고 보스 자석 패턴을 변경하지 않는다.
- [x] StageScene 연결 없이 독립적인 상태·물리 연동 검증이 가능하다.

## Validation
- node --experimental-strip-types --test scripts/world04-air.test.mjs scripts/world04-layout.test.mjs — 궤적·고속 충돌·분류·안전 영역 검사.
- npx tsc --noEmit — 타입 검사.
- npx eslint src/game/systems/world04AirState.ts src/game/systems/World04AirSystem.ts scripts/world04-air.test.mjs — 대상 검사.

## Commit Message
```text
feat(world04): 자석 크레인과 공중 위험물 구현

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T06-air-mechanisms

- 크레인 왕복 운반과 고철 추 및 레일 톱의 궤적 구현
- 대시 예외와 원형 충돌 및 재시작 상태 검증
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 식별자를 가진 커밋
- 검증 결과: 공중 궤적·충돌·배치 검증 7개, tsc, 대상 ESLint 통과. 크레인8구간 연속성, 추 양끝·톱 왕복, 대시 예외/물리 즉사, 정지·재시작·해제 검증. 학습 노트: evaluateWorld04Air는 경과 시간만으로 위치를 계산해 같은 시도에서 같은 궤적이 재현된다. 화물은 rect, 추·톱은 circle sweep을 사용하고 체인·레일은 장식이다. 기존 보스 자석 시스템은 수정하지 않았다. 범위 밖 발견: 특이사항 없음.

