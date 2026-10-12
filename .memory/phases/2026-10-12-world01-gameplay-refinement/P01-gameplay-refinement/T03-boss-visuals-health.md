# Task: T03 생선 뼈·머리 밥그릇과 삼색이 HP 10

## Status: done

## Goal

던지는 물체가 생선 뼈임을 알아볼 수 있게 키우고, 보스 전투 중 코기 머리에 실제 잔여 방어 횟수와 연결된 밥그릇을 표시하며, 삼색이 체력을10으로 낮춘다.

## Decision Summary

- 생선 뼈48×24→72×36, 판정40×18→54×24. 세 궤적·방향·700ms 예고·2600ms 재투척 간격을 유지한다.
- 코기 몸 이미지에 레퍼런스 전체를 얹지 않는다. 독립 투명 밥그릇을 머리에 부착하는 방식부터 시도하고, 어색하면 새 합성 착용 이미지를 생성할 수 있다.
- 현재 삼색이 아레나는1920px, 보스 x1280이다. 별도 미완료1280px 아레나 작업에 의존하지 않는다. 이번 작업은 양쪽 아레나 폭에서 화면 밖 판정이 정확하게 동작하도록 한다.
- 구현 전에 로컬 Next 문서 `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`를 읽는다. 에셋 생성/편집을 선택할 때 `imagegen` 스킬을 적용한다.

## Implementation

### I01. 생선 뼈 표시와 swept collision 확대

- Related Files:
  - `src/game/systems/World01CalicoBoss.ts` :: `releaseFishbone`, `updateFishbone`; modify
  - `src/game/systems/fishboneTrajectory.ts` :: `createFishboneTrajectory`, `fishbonePositionAt`; read-only
  - `public/assets/pixel/props/world-01/fishbone-projectile.png` :: 기존 그림; read-only
  - `scripts/fishbone-trajectory.test.mjs` :: 궤적 회귀; existing validation

#### Details

- **Signatures & Types**: 기존 `releaseFishbone():void`, `updateFishbone(now:number,delta:number):void` 유지. 파일 내부 표시 상수 `{width:72,height:36}`, hitbox 상수 `{width:54,height:24}`를 한 번 선언한다. `Fishbone`의 id/image/trajectory/elapsedSeconds 스키마는 유지한다.
- **Execution Flow / Logic**:
  1. 이미지 display size72×36, 현재 방향 flip과 depth11 유지. 원본 종횡비를 바꾸거나 투사체속도를 임의로 늦추지 않는다.
  2. 이전 위치와 현재 위치를 잇는 swept AABB를 x=min(prev.x,current.x)-27, y=min(prev.y,current.y)-12, width=abs(dx)+54, height=abs(dy)+24로 만든다. 한 프레임 현재점만 검사해 빠른 투사체가 코기를 관통하지 않게 한다.
  3. 월드 바깥 제거 기준은 하드코딩1920 대신 `scene.physics.world.bounds`를 사용하고 반폭36/반높이18을 고려한다. 바닥 아래 제거는 기존560 기준을 유지하거나 실제 아레나 바닥512+48로 계산해 동일하게 한다.
  4. 한 발의 충돌에서 먼저 clearFishbone한 뒤 기존 damage lock→tryBlock→하트 감소 경로로 진행한다. 이미지 확대 때문에 한 발이 두 방어를 소모하면 안 된다.
- **Error & State**: null fishbone은 즉시 반환. 일시정지 중 elapsedSeconds를 진행시키지 않는다. 기존 좌/우 및 공중 조준 clamp와 근접 공격 판정은 별개로 유지한다.

### I02. 최대 HP를 하나의 값으로 정렬

- Related Files:
  - `src/game/systems/World01CalicoBoss.ts` :: state 초기화, constructor, `resetAttempt`, `drawHealth`, `acceptMeleeHit`; modify
  - `src/game/data/worlds.ts` :: `BOSS_DEFINITIONS` world-01 pattern; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export const CALICO_MAX_HEALTH = 10;
  // 기존 CalicoBossState.health:number, phase union 유지
  private drawHealth(): void;
  public resetAttempt(now: number): void;
  ```
- **Data & Schema Fields**: 초기/리셋 health=CALICO_MAX_HEALTH. 게이지10칸, 칸 폭17/간격20, 전체200px를 boss.x 기준으로 중앙정렬. 표시 `삼색이  ${health} / ${CALICO_MAX_HEALTH}`. static pattern 문자열의 `twelve-slipper-hits`를 `ten-slipper-hits`로 맞춘다. 저장 스키마에 보스 HP를 새로 넣지 않는다.
- **Execution Flow / Logic**: 유효 공격마다1 감소, 1→0 전이에만 defeated/stopAttacks/onDefeated를 실행한다. `intro`/`defeated`/재채기/미승인 result는 감소하지 않는다. 이미0인 보스에 추가 입력을 보내도 음수와 이중 승리를 만들지 않는다.
- **Error & State**: 코기3하트, 방어3회, 회복/재진입 reset 동작은 유지한다. 이름만10으로 바꾸고 내부 health12 또는12칸 반복문을 남기지 않는다.

### I03. 투명 밥그릇 에셋과 머리 추적

- Related Files:
  - `src/game/entities/BowlShieldVisual.ts` :: 새 렌더링 보조 객체; new
  - `src/game/scenes/StageScene.ts` :: create/update/shutdown; modify
  - `src/game/assets/assetManifest.json` :: `corgi-bowl-shield` 등록; modify
  - `public/assets/pixel/props/world-01/corgi-bowl-shield.png` :: 투명 단독 밥그릇; new
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: 외형/프레임 참조; read-only by default
  - `public/assets/pixel/references/items/core-items-reference-v1.png` :: 색·형태 참조; read-only
  - `src/game/entities/PlayerAnimator.ts` :: anchor와 공격 이미지; read-only by default
  - `src/game/systems/DefenseToolSystem.ts` :: `getRemainingCharges`, `isBroken`, clang 이벤트; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export class BowlShieldVisual {
    constructor(scene: Phaser.Scene, player: Player,
      defense: DefenseToolSystem, eventBus: GameplayEventBus);
    update(delta: number, combatActive: boolean): void;
    reset(): void;
    destroy(): void;
  }
  interface BowlHeadAnchor { readonly x: number; readonly y: number; }
  // private image:Phaser.GameObjects.Image, elapsedMs:number=0,
  // flashUntil:number=0, unsubscribeClang:()=>void
  ```
- **Data & Schema Fields**: 새 manifest `{key:'corgi-bowl-shield',kind:'image',url:'/assets/pixel/props/world-01/corgi-bowl-shield.png',worldId:'world-01',required:true}`. 투명 여백 포함64×40 내의 픽셀풍 파란 뒤집힌 밥그릇, 런타임 초기 표시44×24, origin(0.5,0.5), depth=player.depth+2. 실제 보스 전투에만 생성·표시한다.
- **Anchor contract**: player.x/y는 발 기준이다. 초기 frame별 anchor는0:{x:22,y:-75},1:{x:22,y:-75},2:{x:22,y:-76},3:{x:22,y:-76}. flipX이면 x offset 부호와 bowl flip을 같이 바꾼다. idle/jump/fall은 프레임0 anchor. T01의 발 anchor와 함께 촬영해 귀/머리 실루엣에 맞게 수 px 보정하되 player 좌표·body 크기는 바꾸지 않는다. 최종 실측 anchor를 검증 기록에 적는다.
- **Execution Flow / Logic**:
  1. 현재 `upside-down-bowl` key는 갈비·슬리퍼·밥그릇이 함께 그려진 불투명 레퍼런스 전체다. 그대로 로드해 머리에 붙이지 말고 이를 참조한 독립 투명 bowl을 준비한다. 이미지 생성은 이 Task 실행 때만 수행한다.
  2. `StageScene`의 월드1 보스 분기에서 defense 초기화 후 visual을 생성한다. play 중 `playerAnimator.update` 뒤에 bowl update를 실행해 현재 프레임·방향·점프 위치를 따른다. non-play이면 combatActive=false로 숨긴다. 캐릭터 부모 container를 새로 만들어 Arcade body 좌표계를 바꾸지 않는다.
  3. `clang`을 구독해 toolId='upside-down-bowl'이면 elapsedMs+140까지 짧은 밝기/위치 반응을 준다. 첫째/둘째는 계속 착용, 셋째는140ms 반응을 마친 뒤 숨긴다. actual defense charge가0이면 계속 착용한 것처럼 표시하지 않는다. 별도 방어 횟수 카운터를 만들지 않는다.
  4. pause 동안 로컬 elapsedMs가 증가하지 않게 하고, 재개/리셋 시 뒤늦은 흔들림이 남지 않게 한다. destroy는 구독과 image를 해제하고 Scene의 참조를 undefined로 돌린다.
  5. 정지/보행4프레임/좌우/점프에서 합성이 어색하면 anchor·크기부터 조정한다. 계속 불가능하면 기존 코기 참조를 유지한 `corgi-bowl-run.png`(112×128×4, 투명, 기존 발 위치)를 새로 생성해 대체할 수 있다. 이 경우 manifest key `corgi-bowl-run`, kind spritesheet, frameWidth112/frameHeight128/frameCount4/required true; `PlayerAnimator.setRunTexture(textureKey:'corgi-run'|'corgi-bowl-run'):void`를 추가해 플레이어 인스턴스만 전환하고 별도 overlay와 중복 표시하지 않는다. 프레임 진행률과 body 크기를 보존하며 세 번째 방어 후 원래 시트로 복귀한다. 해당 분기를 썼다면 두 경로를 동시에 실행하지 않는다.
- **Error & State**: 착용 그림 로드 실패 시 필수 에셋 검사 실패로 처리한다. 방패를 머리에 그리는 것은 기존 전방위 weak 방어를 머리 충돌 전용으로 바꾸라는 뜻이 아니다. 방어 판정은 DefenseToolSystem이 유지한다.

## Acceptance Criteria

- [x] 투사체72×36과 swept 판정54×24가 함께 적용되고, 세 궤적을 육안으로 식별할 수 있다.
- [x] 좌/우 발사에서 한 발당 방어 또는 하트1개만 처리한다.
- [x] 초기/리셋/재진입/게이지/이름에 HP10이 일치하고 10번째 유효 공격에서 승리한다.
- [x] 실제 전투 중 코기의 머리에 밥그릇이 안정적으로 얹히며 이동/점프/방향 전환을 따른다.
- [x] 1·2번째 방어 반응과 3번째 반응 후 소멸이 보이고, 재진입하면 다시3회 방패가 표시된다.
- [x] 원래 보행 접지, 슬리퍼 표시, 컷신 자동 진행과 코기3하트는 유지된다.

## Validation

- `node scripts/validate-assets.mjs`, `npx.cmd tsc --noEmit`, `npm.cmd run lint` — 통과.
- `node --experimental-strip-types --test scripts/fishbone-trajectory.test.mjs scripts/calico-melee-hitbox.test.mjs` — 기존 궤적/근접 회귀 통과.
- `npm.cmd run dev` — 1280×720 및 모바일 가로에서 투척3종, 근접 유효9회에서HP1/10회승리, 재채기·거리실패 무피해, 3회방어/4번째피격, 일시정지/재진입을 직접 검증한다.
- `.memory/test-plans/2026-10-12-world01-gameplay-refinement.md`에 idle/각run frame/좌우/공중 bowl과 생선 뼈 스크린샷, 선택한 에셋 경로·anchor를 기록한다. 단순 상수 대입을 복제하는 테스트는 만들지 않는다.

## Commit Message

```text
feat(world01): 생선 뼈와 머리 방패를 선명하게 하고 보스 체력 조정

Plan: 2026-10-12-world01-gameplay-refinement
Phase: P01-gameplay-refinement
Task: T03-boss-visuals-health

- 생선 뼈 표시와 충돌 범위를 함께 확대
- 실제 방어 횟수에 연결된 머리 밥그릇을 표시
- 삼색이 초기화와 게이지를 최대 HP 10으로 통일
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 본 Task 제목의 Git 커밋 참조
