# Task: T01 고물상 배치·치수·공통 계약

## Status: done

## Goal
월드 4 일반맵 네 개의 사물 10종·바닥 2종·안전 지형을 좌표와 타입으로 확정하고, 게임에 연결하기 전에 잘못된 배치를 검출한다.

## Decision Summary
- 3840×720px, 바닥 y=504, 코기 몸 72×40, 이동 240px/s, 점프 -473px/s·중력 1200px/s², 대시 480px/s·250ms·재사용 1400ms를 기준으로 한다. 더블 점프 없이 통과해야 한다.
- 테스트 폴더·test-plans 문서 금지. 자동 검증은 기존 scripts/ 바로 아래, 결과는 이 Task의 Progress에 기록한다. 기존 미커밋 변경은 보존한다.

## Implementation

### I01. 불변 데이터 타입과 실행 시스템의 공통 계약
- Related Files:
  - src/game/data/world04Types.ts :: 아래 모든 타입 — 신규 계약; new
  - src/game/data/world04Scrapyard.ts :: getWorld04Layout, isWorld04StageId — 배치; new
  - src/game/core/types.ts :: StageId — 기존 ID 타입; read-only
  - src/game/entities/playerTypes.ts :: DEFAULT_PLAYER_TUNING — 물리 기준; read-only
  - src/game/entities/Player.ts :: constructor — 월드 4 실제 몸 72×40 확인; read-only

#### Details
- **Signatures & Types**: 다음은 인터페이스 계약이다. 런타임 구현은 이 Task에서는 데이터 조회·검증·기하 계산에 한정한다.
```typescript
export type World04StageId =
  | "world-04-stage-1" | "world-04-stage-2"
  | "world-04-stage-3" | "world-04-stage-4";
export type World04ObstacleKind =
  | "scrap" | "tire" | "oil" | "belt" | "cable" | "press" | "plate-gate"
  | "crane" | "swing" | "saw";
export type World04TerrainKind = "collapse" | "rise";
export type World04Risk = "none" | "attack" | "physical" | "fall";
export interface World04Point { readonly x: number; readonly y: number; }
export interface World04Rect extends World04Point {
  readonly width: number; readonly height: number;
}
export interface World04Solid extends World04Rect {
  readonly id: string; readonly role: "ground" | "platform" | "ceiling";
}
export interface World04ObjectBase {
  readonly id: string;
  readonly triggerX: number;
}
export type World04Object =
  | (World04ObjectBase & { readonly kind: "scrap"; readonly rect: World04Rect })
  | (World04ObjectBase & { readonly kind: "tire"; readonly rect: World04Rect;
      readonly launchVelocityY: number })
  | (World04ObjectBase & { readonly kind: "oil"; readonly rect: World04Rect;
      readonly acceleration: number; readonly deceleration: number })
  | (World04ObjectBase & { readonly kind: "belt"; readonly rect: World04Rect;
      readonly speed: number; readonly periodMs: number; readonly warningMs: number;
      readonly initialDirection: -1 | 1 })
  | (World04ObjectBase & { readonly kind: "cable"; readonly rect: World04Rect;
      readonly periodMs: number; readonly offMs: number; readonly warningMs: number })
  | (World04ObjectBase & { readonly kind: "press"; readonly rect: World04Rect;
      readonly openMs: number; readonly warningMs: number; readonly closeMs: number;
      readonly holdMs: number; readonly reopenMs: number })
  | (World04ObjectBase & { readonly kind: "plate-gate";
      readonly plate: World04Rect; readonly door: World04Rect;
      readonly openMs: number; readonly rearmMs: number })
  | (World04ObjectBase & { readonly kind: "crane"; readonly payload: World04Rect;
      readonly liftTopY: number; readonly destinationX: number;
      readonly dwellMs: number; readonly legMs: number })
  | (World04ObjectBase & { readonly kind: "swing"; readonly pivot: World04Point;
      readonly length: number; readonly radius: number;
      readonly amplitudeRad: number; readonly periodMs: number })
  | (World04ObjectBase & { readonly kind: "saw";
      readonly fromX: number; readonly toX: number; readonly centerY: number;
      readonly radius: number; readonly periodMs: number });
export type World04Terrain =
  | { readonly id: string; readonly kind: "collapse"; readonly rect: World04Rect;
      readonly edgeDistance: number; readonly fallMs: number }
  | { readonly id: string; readonly kind: "rise"; readonly rect: World04Rect;
      readonly rearWidth: number; readonly frontWidth: number;
      readonly triggerInset: number; readonly riseHeight: number;
      readonly reactMs: number; readonly holdMs: number; readonly lowerMs: number };
export interface World04Coin extends World04Point { readonly id: string; }
export interface World04Cell {
  readonly id: "A" | "B" | "C" | "D" | "E";
  readonly x: number; readonly width: number; readonly template: World04Template;
}
export type World04Template =
  | "scrap-hop" | "dash-tunnel" | "collapse-scrap" | "rise-retreat"
  | "plate-saw" | "tire-swing" | "oil-electric" | "conveyor-press"
  | "saw-scrap" | "magnet-cross" | "rise-magnet" | "plate-saw-scrap"
  | "tire-swing-collapse";
export interface World04Layout {
  readonly stageId: World04StageId;
  readonly width: 3840; readonly height: 720; readonly floorY: 504;
  readonly spawn: World04Point; readonly checkpoint: World04Point;
  readonly cells: readonly World04Cell[];
  readonly solids: readonly World04Solid[];
  readonly gaps: readonly World04Rect[];
  readonly terrain: readonly World04Terrain[];
  readonly objects: readonly World04Object[];
  readonly coins: readonly World04Coin[];
}
export interface World04RuntimePort {
  isActive(): boolean;
  isDashing(): boolean;
  kill(sourceId: string, risk: Exclude<World04Risk, "none">): boolean;
}
export interface World04DebugEntry {
  readonly id: string;
  readonly kind: World04ObstacleKind | World04TerrainKind;
  readonly state: string;
  readonly elapsedMs: number;
  readonly rects: readonly World04Rect[];
}
export function isWorld04StageId(id: string): id is World04StageId;
export function getWorld04Layout(id: string): World04Layout | null;
```
- **Data & Schema Fields**: 모든 필드는 위 readonly 타입을 사용한다. 배치 객체에 생략된 암묵적 값이나 undefined를 남기지 않는다. nullable은 getWorld04Layout의 대상 외 반환값뿐이며 kind별로 해당하는 필드만 둔다.
- id는 stage ID+cell ID+kind로 유일하게 만들고, 추가 같은 종류가 있을 때만 순번을 붙인다.
- **Execution Flow / Logic**:
  1. ID는 정확히 world-04-stage-1~4만 허용한다. 보스·다른 월드·오탈자는 null/false로 반환한다.
  2. 네 배치는 모듈 평가 때 고정 생성한다. Math.random, StageRandom, 날짜·시드에 따라 필수 경로를 바꾸지 않는다.
  3. 모듈 생성 결과를 validateWorld04Layout에 넣어 오류가 있으면 stage ID를 포함한 Error를 던진다.
  4. 반환값은 호출자가 수정하지 않도록 타입을 readonly로 두고 내부 중첩 배열/객체도 freeze한다. 다른 맵을 바꿔도 공유 객체가 변하지 않도록 생성 시 분리한다.

### I02. 정확한 맵 구성과 좌표
- Related Files:
  - src/game/data/world04Scrapyard.ts :: WORLD04_LAYOUTS 및 템플릿 생성 함수 — new
  - src/game/data/snackPresentation.ts :: SNACK_PRESENTATION — 코인 기준; read-only

#### Details
- **Coordinate contract**: 모든 rect는 월드 좌표의 좌상단 x/y와 양수 width/height다. 원형은 중심·반지름이다. 아래 템플릿 표의 x 값만 cell.x를 더한다. 바닥 y=504, 일반 발판 top=448, 플랫폼 두께24, 기본 바닥 충돌 높이32다.
- **Cells**: A=(288,560), B=(944,560), C=(1600,560), D=(2736,400), E=(3232,400). 0~192 및 3648~3840은 안전 구간. 2368~2656은 체크포인트 보호 구간이며 높이를 바꾸지 않는다.
- spawn=(96,504), checkpoint=(2496,504). 출구를 지나서도 y=504 바닥을 4096까지 잇는 것은 T07 Scene의 역할이다.
- **Stage table**:
| Stage | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| 1 | scrap-hop | dash-tunnel | collapse-scrap | rise-retreat | plate-saw |
| 2 | tire-swing | oil-electric | conveyor-press | rise-retreat | saw-scrap |
| 3 | magnet-cross | plate-saw | conveyor-press | collapse-scrap* | saw-scrap |
| 4 | tire-swing-collapse | oil-electric | rise-magnet | conveyor-press | plate-saw-scrap |

- D의 collapse-scrap*는 400px 폭에 맞춘 compact 변형이다. 틈 x=96,width128, 고철 x=296,width48. 일반형과 물리 값은 동일하고 좌표만 이 예외를 적용한다.
- **Templates**:
| Template | 로컬 배치 |
| --- | --- |
| scrap-hop | scrap=(136,472,48,32); platform=(256,448,128,24); 열린 gap=(408,504,96,216) |
| dash-tunnel | cable=(272,460,16,44); ceiling=(184,424,192,20). 천장 아래 통로 높이는60px |
| collapse-scrap | collapse=(224,504,128,32); scrap=(448,472,48,32) |
| rise-retreat | rise=(160,504,112,32); 뒤쪽 x=0~160에 위험물을 놓지 않음 |
| plate-saw | plate=(56,498,48,6); door=(240,360,16,144); saw fromX=144,toX=304,centerY=392 |
| tire-swing | tire=(96,498,72,6); open gap=(224,504,128,216); platform=(320,448,128,24); swing pivot=(310,245) |
| tire-swing-collapse | tire-swing와 같되 open gap 대신 같은 x/width의 collapse 다리를 배치 |
| oil-electric | oil=(64,498,160,6); cable=(286,460,16,44); ceiling=(214,424,192,20) |
| conveyor-press | belt=(64,498,160,6); press=(256,392,128,112) |
| saw-scrap | scrap=(144,472,48,32); saw fromX=120,toX=312,centerY=392 |
| magnet-cross | payload=(248,424,72,80), destinationX=336, liftTopY=330; 시동 triggerX=cell.x+80 |
| rise-magnet | rise=(96,504,112,32); payload=(392,424,72,80), destinationX=480,liftTopY=330; crane triggerX=cell.x+304 |
| plate-saw-scrap | plate-saw와 같고 scrap=(128,476,48,28) 추가 |

- press rect의 높이112는 바닥부터 올라오는 압축판 범위다. 기본 점프의 최대 상승 약93px로 그 위를 넘지 못한다.
- 크레인의 높은 화물은 y330~410에 있다. 바닥의 코기 몸 y464~504에는 닿지 않지만 점프 정점 부근의 몸 y371~411과는 겹치므로 지상 통로를 열면서 점프 경로를 막는다.
- **Parameters**:
| Kind | 고정 초기값 |
| --- | --- |
| tire | launchVelocityY=-620; 자동 도약은 새 기술 해금이 아님 |
| oil | acceleration=900, deceleration=360; 표면 밖에서는 즉시 일반 튜닝 |
| belt | speed=90,periodMs=2400,warningMs=300,initialDirection=-1; 각 2400ms마다 방향 전환 |
| cable | periodMs=2200,offMs=210,warningMs=250; 주기 시작210ms만 꺼지고 이후 켜짐, 마지막250ms는 켜진 상태의 경고 |
| press | openMs=700,warningMs=240,closeMs=260,holdMs=500,reopenMs=260; warning도 열린 상태 |
| plate-gate | openMs=850,rearmMs=300; 자동 사전 신호 없음 |
| crane | dwellMs=800,legMs=600; 양쪽 정지2회+왕복 이동6회=5200ms |
| swing | length=150,radius=24,amplitudeRad=0.75,periodMs=2200 |
| saw | radius=22,periodMs=1800 |
| collapse | edgeDistance=12,fallMs=180 |
| rise | rearWidth=80,frontWidth=32,triggerInset=56,riseHeight=320,reactMs=700,holdMs=300,lowerMs=180 |

- objects.triggerX는 특별히 표에 지정한 crane 외에는 cell.x다. 도달 전에는 시간이0이며, 도달 후에만 각 장치의 로컬 시간이 흐른다. gate는 영역이 활성화되어도 plate를 밟아야 문이 열린다.
- **Solids and gaps**:
  1. 열린 gap과 collapse rect의 x 범위를 합쳐 바닥 [0,3840)을 분할한다. 그 범위를 제외한 부분만 role=ground, y504,height32의 solids로 만든다.
  2. gaps에는 열린 구멍만 기록한다. collapse의 정상 다리는 TerrainSystem이 별도로 만들어 제거할 수 있게 한다.
  3. rise 자리의 기본 바닥은 유지한다. 솟는 두 판은 별도의 바디이며 내려온 후 기본 바닥을 사용한다.
  4. template의 platform/ceiling은 solids에 더한다. 배경 그림에 별도 충돌을 만들지 않는다.
- **Coins**: x=[96,160,224,880,912,1568,2208,2288,2400,2496,2608,2672,3168,3648,3744], 모두 y=464. i=0~14에 대해 기존 ID stageId+"-segment-"+(floor(i/3)+1)+"-coin-"+(i%3+1)을 유지한다. 새 경제 규칙을 넣지 않는다.

### I03. 충돌 계산과 배치 검증
- Related Files:
  - src/game/systems/world04Geometry.ts :: 아래 기하 함수 — new
  - src/game/data/world04LayoutValidation.ts :: validateWorld04Layout — new
  - scripts/world04-layout.test.mjs :: 배치·기하·성공 경로의 필요 조건 — new

#### Details
- **Signatures & Types**:
```typescript
export function overlapRect(a: World04Rect, b: World04Rect): boolean;
export function overlapCircleRect(center: World04Point, radius: number, rect: World04Rect): boolean;
export function sweepRect(
  playerBefore: World04Rect, playerAfter: World04Rect,
  hazardBefore: World04Rect, hazardAfter: World04Rect
): boolean;
export function sweepCircleRect(
  playerBefore: World04Rect, playerAfter: World04Rect,
  centerBefore: World04Point, centerAfter: World04Point, radius: number
): boolean;
export function validateWorld04Layout(layout: World04Layout): readonly string[];
```
- **Logic**:
  1. 직사각형 경계가 닿기만 한 경우는 overlap=false. NaN/음수 크기/반지름은 공개 데이터 검증에서 오류로 보고하며 런타임 기하 함수는 false를 반환한다.
  2. 원-사각형은 원 중심을 rect에 clamp한 최근접 점과 거리²<radius²로 검사한다. 사각 바운딩 박스로 원의 투명한 모서리를 즉사 처리하지 않는다.
  3. swept 충돌은 플레이어와 위험물의 상대 이동을 사용한다. 시작/끝 겹침뿐 아니라 둘 사이를 통과한 경우도 검출한다. rect는 두 축의 slab 진입/탈출 시각을 [0,1]과 교차한다.
  4. circle sweep는 고정 플레이어 rect 좌표계로 상대 궤적을 옮기고, 선분이 rect 내부를 통과하는지 또는 선분과 각 rect 변 사이 최소 거리²가 radius² 미만인지 검사한다. 모서리 원 밖의 근접 통과를 오검출하지 않는다.
  5. validate는 ID 중복, 유한 좌표/양수 치수, kind와 필드, 맵 경계, gap 정렬/중복, 안전 구간, checkpoint 주변, rise의 후퇴 영역 [rise.x-160,rise.x), 맵4의 10종 전체 포함을 검사한다. 의도적 조합은 허용하되 후퇴 영역과 위험물의 최대 이동 범위는 교차 금지다.
  6. rise-magnet의 payload 최소x=cell.x+392이므로 rise 끝 cell.x+208과 분리된다. swing 최대x 범위는 pivot.x±sin(0.75)*150±24로 계산한다.
- **Meaningful tests**: 네 맵 데이터 불변성/대상외null, 각 종류 분포7+3/terrain별도, 15코인 기존ID, 안전구간, 72×40 몸을 고려한 대시 통로(16+72=88px: 보행 약367ms>소등210ms, 대시 약184ms<250ms), 천장 여유20px<전기44px, 원 모서리 비접촉/정면접촉, 고속 직사각형·원 sweep 양방향, 후퇴 영역 충돌을 일부러 넣었을 때 실패.
- tests는 기존 scripts/dash-movement.test.mjs와 같은 typescript.transpileModule+createRequire의 .ts 로더 방식을 사용한다. 새 테스트 디렉터리/공용 테스트 패키지를 만들지 않는다.

## Acceptance Criteria
- [x] 대상 맵4개, 사물10종(7+3), 별도 지형2종과 정확한 배치 데이터가 조회된다.
- [x] 본문 표의 기본값·ID·좌표가 구현되며 안전 구간과 후퇴 공간이 검증된다.
- [x] 기존 world-01~03/보스/StageScene에는 아직 연결하지 않는다.
- [x] 실제 몸 크기를 고려한 기하 테스트가 통과한다. 정적 계산만으로 실제 클리어까지 확인했다고 기록하지 않는다.

## Validation
- node --experimental-strip-types --test scripts/world04-layout.test.mjs — 정상 배치와 의도적으로 잘못된 배치, swept 충돌을 검사한다.
- npx tsc --noEmit — 새 타입과 기존 프로젝트의 타입 검사.
- npx eslint src/game/data/world04Types.ts src/game/data/world04Scrapyard.ts src/game/data/world04LayoutValidation.ts src/game/systems/world04Geometry.ts scripts/world04-layout.test.mjs — 대상 파일 검사.
- 기존 변경으로 실패한 항목은 원인과 로그 요약을 Progress에 구분 기록한다. unrelated 파일을 정리해 통과시키지 않는다.

## Commit Message
```text
feat(world04): 고물상 맵 배치와 충돌 계약 정의

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T01-layout-contracts

- 일반맵 네 개의 사물과 바닥 함정 좌표 및 타입 정의
- 안전 구간과 후퇴 공간 및 고속 충돌 검증 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 0cafbd1
- 검증 결과: 배치·손상 데이터 거절·대시 통로·충돌 기하 4개 테스트 통과. T08 최종 회귀 61건에도 포함하여 재확인했고 전체 타입·린트·빌드가 통과했다. 실제 맵 통과와 최종 좌표 조정은 T08 Progress에 기록했다.


### 2026-11-02 사용자 추가 지시: 맵마다 기믹을 많이 배치
- 한 맵에 기믹이 매우 많이 등장하고 클리어가 매우 까다로워야 한다. 기존 5개 셀마다 여러 기믹을 겹쳐 배치한다. 사물과 바닥 함정 합계는 맵 1부터 22개·24개·26개·27개다.
- 고철 점프에 기름·탄성 타이어·공중 톱을, 대시 통로에 전기선·낮은 천장·컨베이어·고철·톱을 조합한다. 꺼지는 바닥은 타이어와 착지 지점의 고철·톱으로 연결한다.
- 압력판과 시간제 문에는 기름·방향 전환 컨베이어·톱을, 압축기에는 컨베이어와 후속 고철·톱을 배치한다. 크레인에는 이동 화물과 전기선 통로를 연결한다.
- 무전조 상승 바닥 앞의 후퇴 공간과 입구·체크포인트·출구 안전 구역은 유지한다. 장애물을 늘리기 위해 피할 수 없는 위치에 사물을 겹치지 않는다.
- 초기 체크포인트 접근 구간의 고철 x2240, 톱 x2224~2296, 컨베이어 x2184~2312는 T08의 실제 입력 검증에서 조정한다. 최종 좌표와 조정 근거는 T08 Progress 및 src/game/data/world04Scrapyard.ts를 기준으로 한다.
