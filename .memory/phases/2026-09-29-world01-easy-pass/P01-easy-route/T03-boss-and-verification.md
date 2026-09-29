# Task: T03 정지형 턱시도 보스전

## Status: pending

## Goal
`world-01-stage-boss`에 끊기지 않는 바닥, 처음부터 보이는 턱시도 고양이, 기본 공격 두 번으로 끝나는 전투를 만든다. 보스가 살아 있는 동안 출구는 완료 판정을 내리지 않는다.

## Decision Summary
- 사용자가 일반 4개와 보스를 모두 쉽게 만들고, 현재 없는 보스전을 새로 계획하라고 선택했다.
- 보스는 이동·접촉 피해·공격·소환·시간 제한이 없다. 플레이어의 `attackPressed`와 위치·방향만 확인한다.
- 이 Task는 보스전과 출구 잠금까지 구현한다. 일반 스테이지 연속 진행과 영구 저장은 T04에서 연결한다.

## Implementation

### I01. 보스 아레나와 콘텐츠 정의

- Related Files:
  - `src/game/data/worlds.ts` :: `createBossStage`, `createSegment`, `BOSS_DEFINITIONS` — 월드 1 보스 데이터만 수정; modify
  - `src/game/stages/StageRuntime.ts` :: `buildFromSegments`, `addExit` — 보스 타일맵이 없을 때 세그먼트로 바닥과 출구를 만드는 경로 확인; read-only
  - `src/game/stages/StageEntityFactory.ts` :: `createPlatform` — 플랫폼 `x`가 중심 좌표인지 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  function createBossStage(blueprint: WorldBlueprint): StageDefinition;
  function createSegment(stageId: StageId, segmentNumber: number, isBoss: boolean, length: number): StageSegment;
  // StageDefinition.id: StageId; kind: "boss"; bossId?: string; spawn: { x: number; y: number }
  // StageSegment.platforms: PlatformDefinition[]; traps: TrapDefinition[]; enemies: EnemyDefinition[]
  ```
- **Data & Schema Fields**:
  - 월드 1만 `id="world-01-stage-boss"`, `bossId="world-01-boss"`, `mapWidth=BOSS_MAP_WIDTH=1920`, `mapHeight=720`, `spawn={x:160,y:504}`로 설정한다.
  - 월드 1의 첫 세그먼트 플랫폼을 `{id:"world-01-stage-boss-segment-1-platform",x:960,y:520,width:1888,height:32}`로 설정한다. 바닥 상단은 y504, 수평 범위는 x16~1904이다. 출구 중심 x1824까지 이어진다.
  - 월드 1 보스 세그먼트 `traps=[]`, `enemies=[]`, `coins=[]`, `collectibles=[]`; `map.gimmicks=[]`, `map.chainRules=[]`, `map.objectDefinitions`에는 기존 출구만 둔다.
  - 월드 1 `BossDefinition.phases`의 두 데이터 항목은 각각 `healthThreshold:1`/`0.5`, `pattern:"stationary-first-hit"`/`"stationary-second-hit"`, `telegraph:"가까이에서 J 공격"`/`"한 번 더 J 공격"`으로 바꾼다. 다른 월드의 보스 데이터는 수정하지 않는다.
- **Execution Flow / Logic**:
  1. `createBossStage`에서 `blueprint.id === "world-01"`일 때만 기본 세그먼트 결과를 얕은 복사하고 플랫폼 중심과 빈 배열을 지정한다. 다른 월드는 현행 생성 경로를 유지한다.
  2. 월드 1 보스에는 Tiled JSON 자산이 없으므로 `TiledMapLoader.load`가 `null`을 반환하고 `StageRuntime.buildFromSegments`가 실제 바닥·출구를 생성한다. 기존 보스 맵의 출구 `MapObjectDefinition`은 카탈로그 정보이며 별도의 적 또는 함정을 만들지 않는다.
  3. 월드 1의 기존 `x=16,width=1888`은 플랫폼 중심 x16으로 처리되어 바닥이 x960에서 끝난다. 중심을 x960으로 바로잡아 출구 앞 낙하를 없앤다.

### I02. 보스 그림과 전투 상태

- Related Files:
  - `public/assets/pixel/props/world-01/tuxedo-boss.svg` :: 정지형 64×80 SVG; new
  - `src/game/assets/assetManifest.json` :: `world01-tuxedo-boss` 이미지 등록; modify
  - `src/game/systems/World01BossSystem.ts` :: `World01BossSystem` — 생성·입력 처리·체력 표시·정리; new
  - `src/game/entities/Player.ts` :: `Player.x`, `Player.y`, `flipX`; read-only
  - `src/game/input/inputTypes.ts` :: `InputSnapshot.attackPressed`; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export class World01BossSystem {
    public constructor(scene: Phaser.Scene, player: Player);
    public update(now: number, attackPressed: boolean): void;
    public isDefeated(): boolean;
    public destroy(): void;
  }
  // private health: number = 2;
  // private nextHitAt: number = 0;
  // private readonly bossX: number = 960;
  // private readonly floorY: number = 504;
  ```
- **Data & Schema Fields**:
  - 매니페스트 항목: `{"key":"world01-tuxedo-boss","kind":"image","url":"/assets/pixel/props/world-01/tuxedo-boss.svg","required":true}`. 기존 `tuxedo-cat` 참조 이미지 키를 덮어쓰지 않는다.
  - SVG는 `viewBox="0 0 64 80"`, 검은 몸·삼각 귀, 흰 얼굴 중앙·가슴·앞발, 분홍 코, 노란 눈을 픽셀형 직사각형/다각형으로 그린다. 투명 배경이고 그림 전체가 64×80 안에 들어간다.
  - 보스 이미지 `scene.add.image(960,464,"world01-tuxedo-boss")`, `setDepth(8)`, `setOrigin(0.5)`; 아래쪽 y504가 바닥에 닿는다. 텍스트 `scene.add.text(960,380,"가까이에서 J 공격 · 2/2",...)`는 보스 위에 항상 보이고, 체력을 `2/2 → 1/2 → 승리! 오른쪽 출구로 이동`으로 갱신한다.
  - 유효 타격: `attackPressed === true`, `now >= nextHitAt`, `Math.abs(player.x-960) <= 112`, `Math.abs(player.y-504) <= 60`, 보스를 바라봄. `bossX >= player.x`면 `player.flipX === false`, 반대쪽이면 `player.flipX === true`이다.
- **Execution Flow / Logic**:
  1. 생성 시 체력 2, 다음 타격 시각 0, 보스 이미지와 안내 텍스트를 만든다. Phaser 물리 바디를 붙이지 않으므로 보스에게 부딪혀도 피해를 입지 않는다.
  2. `update`는 보스가 이미 쓰러졌거나 조건이 맞지 않으면 아무 일도 하지 않는다. 유효 공격 한 번에 체력을 1 낮추고 `nextHitAt=now+450`으로 둔다. 실패한 공격에는 벌점을 주지 않는다.
  3. 체력이 0이면 `isDefeated()`가 `true`가 되고 이미지 색 또는 알파와 안내 문구로 승리를 즉시 표시한다. 이후 공격은 무시한다. 카운트다운·소환·이동·피해 이벤트는 만들지 않는다.
  4. `destroy`에서 이미지·텍스트를 제거한다. 장면 재시작 시 새 인스턴스의 체력은 다시 2다. 과거 인스턴스의 타이머나 이벤트 리스너는 남기지 않는다.

### I03. 장면 입력과 출구 잠금

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`, `update`, `shutdown` 정리, 출구 overlap 콜백 — 월드 1 보스에만 전투 시스템 연결; modify
  - `src/game/stages/StageRuntime.ts` :: `complete` — 상태 변경과 `stage-completed` 이벤트 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  private bossSystem?: World01BossSystem;
  public update(time: number, delta: number): void;
  // 출구 overlap: () => void
  ```
- **Data & Schema Fields**:
  - 장면 ID 비교값은 정확히 `"world-01-stage-boss"`; 다른 스테이지의 출구는 기존처럼 즉시 `runtime.complete()`를 호출한다.
- **Execution Flow / Logic**:
  1. `create`에서 플레이어와 런타임 생성 후 월드 1 보스 스테이지일 때만 `new World01BossSystem(this,this.player)`를 만든다. 이전 장면의 필드는 초기화한다.
  2. `update`에서 이미 구한 `input = inputManager.getSnapshot()`의 `attackPressed`를 `bossSystem.update(time,input?.attackPressed ?? false)`에 전달한다. 런타임 상태가 `play`일 때만 처리하여 일시정지 중 공격을 무시한다.
  3. 출구 overlap 콜백에서 월드 1 보스이고 `!bossSystem?.isDefeated()`이면 반환한다. 보스가 쓰러진 뒤에는 기존 `runtime.complete()`를 호출한다. 조건부 접근에 `undefined`가 들어와도 출구가 열리지 않게 한다.
  4. `shutdown`에서 `bossSystem.destroy()`를 호출하고 참조를 지운다. F2/장면 재시작을 반복해도 보스 그림과 안내가 중복되지 않는다.

## Acceptance Criteria
- [ ] 보스 바닥이 시작점부터 출구까지 이어지고, 출구 앞에서 떨어지지 않는다.
- [ ] 턱시도 고양이는 시작부터 보이며 이동·접촉 피해·공격·소환을 하지 않는다.
- [ ] 기본 공격 키를 가까이서 보스를 바라보며 450ms 이상 간격으로 두 번 누르면 승리한다. 공격 실패에 벌점이 없다.
- [ ] 승리 전에는 출구 overlap으로 `stage-completed`가 발생하지 않고, 승리 후 출구에서 정확히 한 번 발생한다.
- [ ] 다른 월드 보스 정의와 일반 스테이지 출구 동작은 유지된다.

## Validation
- `npx.cmd tsc --noEmit` — 새 시스템·장면 연결 타입 검사 통과
- `npm.cmd run lint` — 린트 통과
- `npm.cmd run build` — 새 SVG 자산 로드 경로를 포함한 빌드 통과
- T04 수동 검증에서 F2로 보스에 진입해 공격 2회·잠긴 출구·연속 바닥 확인

## Commit Message
```text
feat(game): add a gentle two-hit world one boss fight

Plan: 2026-09-29-world01-easy-pass
Phase: P01-easy-route
Task: T03-boss-and-verification

- Connect the boss arena floor to its exit
- Add a stationary two-hit tuxedo boss and gate the exit
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
