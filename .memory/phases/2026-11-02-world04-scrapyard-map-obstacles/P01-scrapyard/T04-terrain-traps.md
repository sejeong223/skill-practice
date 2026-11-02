# Task: T04 지형과 꺼짐·후퇴 상승 바닥

## Status: pending

## Goal
통바닥 잔여 충돌 없이 평지·발판·구멍을 구성하고, 무전조 꺼짐과 후퇴만 가능한 1회 상승 함정을 실제 그림·충돌체로 구현한다.

## Decision Summary
- 상승 바닥은 사전 전조0, 후퇴 전용, 한 시도1회다. 작동 후 반응 시간은 있으나 작동 전에 들썩임·균열·경고음은 없다.
- 아직 StageScene에 연결하지 않는다. 독립 시스템과 실제 상태 계산을 검증한다. 테스트 파일은 기존 scripts/ 아래에만 둔다.

## Implementation

### I01. 순수한 지형 상태 계산
- Related Files:
  - src/game/systems/world04TerrainState.ts :: createTerrainState, advanceTerrainState — new
  - src/game/data/world04Types.ts :: World04Rect, World04Terrain, World04Layout, World04RuntimePort — read-only
  - src/game/systems/world04Geometry.ts :: overlapRect,sweepRect — read-only
  - scripts/world04-terrain.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
export interface World04BodySample {
  readonly before: World04Rect; readonly after: World04Rect;
  readonly velocityX: number; readonly velocityY: number; readonly grounded: boolean;
}
export interface World04TerrainState {
  readonly id: string;
  readonly phase: "armed" | "falling" | "collapsed" |
    "retreat" | "strike" | "lowering" | "spent";
  readonly elapsedMs: number;
}
export interface World04TerrainStep {
  readonly state: World04TerrainState;
  readonly bridgeEnabled: boolean;
  readonly frontRect: World04Rect | null;
  readonly rearRect: World04Rect | null;
  readonly dangerRects: readonly World04Rect[];
  readonly fallProgress: number;
}
export function createTerrainState(definition: World04Terrain): World04TerrainState;
export function advanceTerrainState(
  definition: World04Terrain, state: World04TerrainState,
  sample: World04BodySample, deltaMs: number
): World04TerrainStep;
```
- **Data & Schema Fields**: 모든 좌표는 좌상단 rect다. 초기 state={id,phase:"armed",elapsedMs:0}. before/after는 그림 bounds가 아니라72×40 플레이어 body의 실제 위치다. nullable front/rear는 판이 없음을 뜻한다. 상태 계산 함수는 입력 객체를 변경하지 않는다.
- **Collapse flow**:
  1. armed 상태에서 지상·velocityY>=0이며, 오른쪽 이동이면 body.right가 rect.x-12를 통과하면서 body.left<rect.x일 때 작동한다. 왼쪽 접근도 월드3와 대칭으로 처리한다.
  2. 공중에서 점프로 넘으면 다리가 미리 무너지지 않는다. 이미 열린 정적 구멍과 collapse 다리를 혼동하지 않는다.
  3. 작동한 프레임에 bridgeEnabled=false. 그림은180ms 동안96px 아래로 떨어지고 alpha1→0, 이후 collapsed로 유지한다. 위험은 판의 접촉 즉사가 아니라 구멍으로 떨어지는 낙사다.
  4. reset하면 그림/바디/시간을 함께 armed로 되돌린다.
- **Rise geometry (단위px)**:
  - definition.rect=(x,504,112,32), rearWidth80,frontWidth32,triggerInset56,riseHeight320.
  - 발동 평면은 x+56이다. 몸의 오른쪽이 왼쪽에서 이 평면을 통과하면 발동한다. grounded 조건을 넣지 않아 미리 점프해서 함정 전체를 건너뛰지 못하게 한다.
  - 발동 즉시 앞쪽 판 rect=(x+80,184,32,320)이 나타나 실제 고체로 앞을 막는다. 이 장면이 최초 신호다. 발동 전에는 두 판 모두 전혀 보이지 않는다.
  - 뒤쪽80px는 반응 시간700ms 동안 바닥 상태다. 안전한 후퇴는 body.right<=x가 되는 것이다. 키 입력 여부로 성공을 판정하지 않는다.
  - 700ms에 뒤쪽 판=(x,184,80,320)이 실제로 치솟는다. 그 순간부터 두 판의 실제 rect가 physical 즉사 범위다. 점프 최대 약93px/타이어 도약 약160px보다 판이 높아 점프·전방 대시로 넘을 수 없다.
  - 1000ms까지 strike, 이후180ms 동안 두 판을 바닥 아래로 내린다. lowering 중에도 보이는 판에 접촉하면 physical 위험이다. t=1180ms에 모든 추가 판/위험을 제거하고 spent가 된다.
  - spent는 같은 시도에 재발동하지 않는다. 사망 후 reset만 armed로 되돌린다.
- **Important timing**: 발동 프레임에는 elapsed=0으로 시작한다. 무전조를 구현한다며 발동 프레임부터 뒤쪽 판을 활성화하면 후퇴할 수 없으므로 금지한다. 반대로 700ms 전에 흔들림/경고를 추가하는 것도 금지한다.
- **Error & Exception Handling**: 잘못된 delta는0, 함수 입력에 포함된 배치 값은 T01 검증을 통과한 값이다. 상태 id 불일치는 Error. 큰 delta에서도 경계를 건너뛸 때 strike 구간의 위험 접촉을 놓치지 않도록 각 전환 지점에서 검사할 결과를 남긴다.

### I02. 그림·정적 바디·낙사 연결
- Related Files:
  - src/game/systems/World04TerrainSystem.ts :: World04TerrainSystem — new
  - src/game/entities/Player.ts :: body,resetTo — read-only
  - public/assets/pixel/tiles/world-04/world-04-scrapyard-floor.png — read-only
  - public/assets/pixel/tiles/world-04/world-04-scrapyard-platform.png — read-only
  - public/assets/pixel/tiles/world-04/world-04-scrapyard-rise-column.png — read-only
  - src/game/systems/World03CollapsingFloor.ts — 참고만 하고 수정하지 않음; read-only

#### Details
- **Signatures & Types**:
```typescript
export class World04TerrainSystem {
  constructor(scene: Phaser.Scene, player: Player,
    layout: World04Layout, port: World04RuntimePort);
  update(deltaMs: number): boolean;
  resetForAttempt(spawnX: number): void;
  getDebugState(): readonly World04DebugEntry[];
  destroy(): void;
}
```
- **Port contract**: isActive()는 플레이 가능 여부, isDashing()는 대시 상태다. kill(sourceId,risk)는 사망 요청이 실제 발생하면 true를 반환한다. true면 즉시 모든 루프에서 반환한다. 이 시스템의 rise/fall은 대시 무적 예외를 적용하지 않는다.
- **Execution Flow / Logic**:
  1. layout.solids 각 rect에 static zone+player collider를1개씩 만든다. 지상 사물은 여기서 만들지 않는다. 기존 통바닥 Rectangle을 추가하지 않는다.
  2. ground 그림은 y504부터720까지 floor 텍스처를 표시하되 실제 바디 높이는32. 정적 gap/꺼진 다리에는 그림과 바디를 만들지 않는다. platform/ceiling은 platform 텍스처와 해당 rect를 사용한다.
  3. collapse 다리는 자기 zone/collider와 그림을 소유한다. floor/다리의 tilePositionX를 월드x 기준으로 맞춰 대기 상태의 이음새가 함정 위치를 드러내지 않게 한다.
  4. rise 앞판은 retreat 동안 blocking collider만 활성화한다. strike/lowering에서는 실제 보이는 rect로 피해 판정을 추가한다. 뒤쪽 판은 retreat 동안 존재하지 않는다.
  5. 발동 프레임의 빠른 이동으로 코기가 앞판을 관통했다면 swept 교차를 검출하고 실제 고체 분리처럼 body.right를 front.left에 맞춘다. y나 방향키를 강제로 바꾸지 않는다. 이미지·바디·body.prev/prevFrame을 분리 후 위치로 동기화하여 다음 프레임에 다시 튀지 않게 한다.
  6. player.body.bottom>=704이면 port.kill(stageId+"-fall","fall")를 호출한다. 플레이어는 월드 경계에서 바닥에 멈출 수 있으므로 y>720만 검사하면 안 된다.
  7. delta는 호출자에서0~50ms로 제한한다. pause/death/cutscene에는 isActive=false이므로 시간·그림·판정·이전 위치를 진행하지 않는다. Scene Timer/Tween은 사용하지 않는다.
  8. reset은 세대 번호를 증가시키고 모든 상태·다리·그림·이전 body sample을 현재 부활 좌표로 동기화한다. spawnX는 유한성 확인과 재시도 기준으로만 사용하며 함정 배치를 옮기지 않는다.
  9. destroy는 자신이 만든 collider→zone→그림 순서로 제거하고 참조/배열을 비운다. 두 번 호출해도 안전하다. 원래 월드3 바닥 객체를 되살리는 로직을 복사하지 않는다.
- **State reentrancy**: kill 호출 중 동기 reset이 실행될 수 있다. update 시작의 generation을 보관하고 호출 뒤 다르면 즉시 true를 반환한다. 예전 after sample을 새 시도의 previous sample로 덮어쓰지 않는다.
- **Rendering**: 판은 높이 변화에 맞춰 crop/tile로 표시하며 y를 정수로 정렬한다. 충돌체는 보이는 높이를 넘지 않는다. lowering 끝 프레임에 투명한 판정이 남지 않는다.

### I03. 후퇴 전용 조건과 복원의 검증
- Related Files:
  - scripts/world04-terrain.test.mjs :: state and runtime cases — new
  - scripts/world03-collapsing-floor.test.mjs — 기존 월드3 회귀; read-only

#### Details
- 타입스크립트 모듈을 기존 createRequire+typescript.transpileModule 로더로 로드한다. Phaser 객체는 좁은 fake scene으로 zone/충돌체/그림의 생성·enable·destroy를 관찰한다.
- 상승 이전의 그림/콜라이더 변화0, trigger crossing 직후 앞판만 활성,699ms까지 rearRect=null,700ms에 보이는 rearRect와 일치하는 physical 위험,1180ms에 spent/완전 해제를 검사한다.
- 몸72×40 기준: 계속 전진/제자리/일반 점프/전방 대시 실패, body.right<=x까지 후퇴 성공, 무적 중에도 strike 접촉 실패. 성공 후 재진입 시 재작동0회.
- reset/상황정지/재진입마다 그림·시간·몸 이전 좌표가 초기화된다. kill 콜백 안에서 즉시 reset하는 fixture로 같은 프레임의 두 번째 사망 요청0을 확인한다.
- collapse의 바디가 제거되면 그 위치에 다른 바닥 collider가 없고, reset 후 정확히1개가 복원되는지 검사한다.
- 이 단위 검증은 실제 인간 반응/Phaser 클리어를 대체하지 않는다. T08에서 실제 입력으로700ms 창을 검증한다.

## Acceptance Criteria
- [ ] 네 맵의 지형이 데이터와 일치하고 열린 구멍 아래 통바닥이 남지 않는다.
- [ ] 상승 함정이 무전조·후퇴 전용·작동 후 반응 시간·1회성을 모두 만족한다.
- [ ] 실제 그림 밖의 숨은 즉사 영역이나 부활 직후 남은 판정이 없다.
- [ ] StageScene은 아직 변경하지 않고 독립 생성/업데이트/복원/해제가 검증된다.

## Validation
- node --experimental-strip-types --test scripts/world04-terrain.test.mjs scripts/world04-layout.test.mjs scripts/world03-collapsing-floor.test.mjs — 상태·충돌·기존 함정 회귀.
- npx tsc --noEmit — 타입 검사.
- npx eslint src/game/systems/world04TerrainState.ts src/game/systems/World04TerrainSystem.ts scripts/world04-terrain.test.mjs — 대상 검사.

## Commit Message
```text
feat(world04): 꺼지는 바닥과 후퇴 전용 상승 함정 구현

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T04-terrain-traps

- 구간별 바닥과 낮은 발판 및 낙사 처리 구현
- 전조 없는 일회성 상승 판과 후퇴 탈출 및 복원 검증
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과: 미실행 — 계획 단계

