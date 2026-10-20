# Task: T01 새 무기 5종의 고유 공격

## Status: done

## Goal

J 공격 입력이 장착 무기를 실제로 사용하게 하고, 삼색이 보스전에서 무기별 사거리·투사체·단점이 작동하게 한다. 월드 1·2 일반 구간에서도 무기 사용 동작이 보인다.

## Decision Summary

- 기본 토끼 슬리퍼의 3연타·재채기·물기와 짖기의 3초 쿨다운·보스 멈춤은 유지한다. 새 무기 효과는 각 1회 공격당 보스 체력을 최대 1만 줄인다.
- 월드 2의 8종 점프 장애물과 잠자는 고양이는 기존 즉사/점프 규칙을 유지한다. 투사체로 치울 수 없다.

## Implementation

### I01. 무기별 공격 판정

- Related Files:
  - `src/game/systems/CombatSystem.ts` :: `tryAttack`, `setAttackTool`, `update`, `resetForStage`; modify
  - `src/game/systems/SlipperAttack.ts` :: 기존 슬리퍼 동작; read-only 또는 타입 추출
  - `src/game/systems/World01CalicoBoss.ts` :: `acceptMeleeHit`에 무기 공통 피격 경로 추가; modify
  - `src/game/systems/WeaponAttack.ts` :: 신규 공격 모델/투사체 관리자; new
  - `src/game/core/events.ts` :: `weapon-fired`, `weapon-hit`, `drawback-triggered`; modify
  - `src/game/data/tools.ts` :: 새 무기 effect/hiddenDrawbackId 확인; modify if needed
  - `scripts/goodboy-weapons.test.mjs` :: 결정적 시간 기반 공격 테스트; new

#### Details

- **Signatures & Types**: `AttackContact = { readonly attackId: string; readonly toolId: ToolId; readonly kind: "melee" | "projectile"; readonly bounds: Phaser.Geom.Rectangle; readonly facing: -1 | 1; readonly now: number }`; `CombatSystem.tryAttack(now: number): AttackResult`; `CombatSystem.update(now: number, delta: number): readonly AttackContact[]`; `World01CalicoBoss.acceptToolHit(contact: AttackContact): boolean`. 현재 `acceptMeleeHit(SlipperAttackResult, Player)`를 기존 테스트용 래퍼로 유지해도 된다. 보스는 `attackId`를 한 번 처리하면 왕복/중복 프레임에서 재피격되지 않게 한다.
- **Data & Schema Fields**: 정확한 무기/동작: `squeaky-ball`(10코인)은 전방 공 투척→1회 튕김→닿으면 1타, 3회째 투척 때 `squeak-summons-cats` 그림자 방해; `rolled-newspaper`(13)는 기본보다 전방 24px 긴 근접 히트박스, 후딜레이 450ms; `pink-backscratcher`(15)는 전방 위쪽까지 닿는 히트박스, 명중 후 반대 방향 18px 밀림; `drumstick-boomerang`(18)은 전방/회수 중 대상당 1타, 돌아오기 전 재투척 불가; `plastic-frisbee`(20)는 빠른 직선 원반, 첫 대상 1타, 빗나가면 900ms 재사용 대기. 코인 가격은 P01 카탈로그에서만 읽는다.
- **Execution Flow / Logic**: 공격 입력→선택 장비 검증→쿨다운/발사 중 여부 확인→근접이면 그 프레임의 박스, 투사체면 장면 안 독립 sprite와 시간 기반 좌표 갱신→보스 충돌 시 `acceptToolHit`→타격 피드백/`weapon-hit` 이벤트→해당 단점 실제 발동 시 `drawback-triggered`를 도구별 ID로 발행한다. 기본 슬리퍼일 때는 기존 `SlipperAttackController`와 `PlayerAnimator.triggerSlipperSwing`만 사용한다. 일반 구간에도 `CombatSystem`을 생성하여 사용 시각/쿨다운이 작동하되 점프 장애물은 피격 대상에서 제외한다.
- **Error & Exception Handling**: 보스 컷신/패배/죽음/상점 일시정지 동안 공격·투사체 이동·재사용 타이머가 진행되지 않는다. 장비 교체·리스폰·scene 종료 때 비행 중 sprite와 hit ID를 정리한다. 본인이 소유하지 않은 tool ID는 받아들이지 않는다.

### I02. 장비 복원과 부작용 공개

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`, `update`, `equipment-change-requested`, shutdown; modify
  - `src/game/systems/DrawbackDiscovery.ts` :: `discover`; read-only / 필요 시 modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: `drawback-discovered`; read-only
  - `scripts/goodboy-weapons.test.mjs` :: 장비 변경·재도전·부작용 테스트; new

#### Details

- P02-T03에서 제거한 보스 입장 장비 강제 초기화가 다시 생기지 않도록 검증한다. `CombatSystem.setAttackTool(progress.equippedAttackToolId)`와 `equipment-change-requested` 경로를 무기별 공격 판정에 연결한다. 현재 `DrawbackDiscovery`는 `PrototypeScene`에만 생성된다. 실제 `StageScene`에도 `new DrawbackDiscovery(this.progress, this.gameplayEventBus, this.persistenceEventBus)`를 1개 생성해 `discoveredDrawbackIds`와 자동 저장 버스를 연결하고 scene 종료 때 `destroy()`한다.
- 재도전 시 `resetForStage`는 현재 장착 ID를 유지하며 공격 쿨다운·투사체만 리셋한다. 이전에 소유한 `cardboard-tube`도 유효 장비로 남기고 기본 근접 공격의 대체 판정을 제공해 저장 호환성을 지킨다.

## Acceptance Criteria

- [x] 5종의 새 무기가 모두 J 입력에 따라 서로 다른 공격으로 보이고 위 장단점이 실제로 발동한다.
- [x] 삼색이 체력은 공격 ID당 최대 1만 감소하고 기본 슬리퍼·짖기 전투는 그대로 동작한다.
- [x] 상점에서 장착한 무기가 보스 입장·재도전·새로고침 후에도 유지되고 단점은 처음 발동 후에만 공개된다.

## Validation

- `node --test scripts/goodboy-weapons.test.mjs scripts/calico-melee-hitbox.test.mjs scripts/bark-boss-stun.test.mjs` — 보스 공격·회귀.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- 브라우저에서 5종으로 보스 1회씩 맞히고 코인·장착·하트·일시정지 상태를 확인한다.

## Commit Message

```text
feat(전투): 상점 무기 다섯 종류의 공격과 단점 구현

Plan: 2026-10-20-goodboy-market
Phase: P03-combat-behaviors
Task: T01-weapon-effects

- 장착 무기에 맞는 근접 및 투사체 공격 추가
- 삼색이 피격과 부작용 기록을 실제 스테이지에 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
