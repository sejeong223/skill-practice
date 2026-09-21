# Task: T02 스킬 쿨다운·슬리퍼 공격·밥그릇·장비 부작용

## Status: pending

## Goal

스킬과 상점 도구를 분리한 전투 시스템을 구현한다. 기본 토끼 슬리퍼 공격, 물기 연계, 개별 스킬 쿨다운, 뒤집어진 밥그릇 방어, 숨겨진 억까 부작용 발견까지를 하나의 테스트 가능한 runtime API로 제공한다.

## Decision Summary

- 스킬은 능동 기술이며 bark → bite → dash → double-jump → tail-rotor 순서로 보스 처치 후 해금된다.
- 공격 도구는 영구 보조 효과, 방어 도구는 제한 횟수형이다. 모든 도구에는 장점과 숨겨진 부작용이 있다.

## Implementation

### I01. 스킬 시스템

- Related Files:
  - src/game/systems/SkillSystem.ts :: SkillSystem — new
  - src/game/systems/SkillCooldowns.ts :: SkillCooldowns — new
  - src/game/data/skills.ts :: skill definitions — modify

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface SkillRuntimeState {
    unlocked: Set<SkillId>;
    cooldownUntil: Partial<Record<SkillId, number>>;
  }

  export class SkillSystem {
    constructor(player: Player, definitions: readonly SkillDefinition[]);
    unlockAfterBoss(bossId: string): SkillId | null;
    canUse(skillId: SkillId, now: number): boolean;
    use(skillId: SkillId, now: number): SkillUseResult;
    getRemainingCooldown(skillId: SkillId, now: number): number;
  }
  ~~~
- bark는 범위 내 고양이를 stun시키고, bite는 슬리퍼를 놓은 뒤의 근접 공격이며, dash는 수평 돌진, double-jump는 공중 1회 추가 점프, tail-rotor는 짧은 하강 제어다.
- 각 skill은 data registry의 cooldownMs를 사용하며, 쿨다운은 장비 교체나 일시정지로 초기화하지 않는다.
- 보스 보상은 순서가 어긋나거나 이미 해금된 경우 ContentRegistryError를 발생시킨다.

### I02. 토끼 슬리퍼 공격 콤보

- Related Files:
  - src/game/systems/CombatSystem.ts :: CombatSystem — new
  - src/game/systems/SlipperAttack.ts :: SlipperAttackController — new
  - src/game/data/tools.ts :: rabbit-slipper — modify

#### Details

- J 입력은 attack 슬롯을 실행한다.
- 기본 상태에서 코기는 슬리퍼를 입에 물고 휘둘러 slipper-hit 판정을 만든다.
- 연속 타격 카운트는 마지막 타격 후 700ms 동안 유지한다. 세 번째 타격이 성공하면 slipper-sneeze drawback을 한 번 발동한다.
- slipper-sneeze는 코기에게 sneeze 애니메이션, 에취! 텍스트/효과음, 반대 방향 3m에 해당하는 knockbackX를 적용하고 슬리퍼를 놓는다.
- bite 해금 후 슬리퍼를 놓은 뒤 500ms 안에 J를 다시 누르면 직접 물기 hitbox를 만든다. 물기는 슬리퍼의 세 번째 타격 카운트를 새로 시작한다.
- 공격 도구 효과는 attack slot에 장착된 tool modifier만 읽고, 공격 logic 자체를 교체하지 않는다.

### I03. 뒤집어진 강아지 밥그릇

- Related Files:
  - src/game/systems/DefenseToolSystem.ts :: DefenseToolSystem — new
  - src/game/systems/StrayDogEvent.ts :: StrayDogEvent — new
  - src/game/data/tools.ts :: upside-down-bowl — modify

#### Details

- 기본 방어 도구는 upside-down-bowl이며 stage runtime마다 remainingCharges: 3으로 초기화한다.
- weak attack만 차단한다. lethal trap, 낙사, boss phase damage에는 적용하지 않는다.
- 차단할 때마다 clang 이벤트와 stray-dog-surge 이벤트를 발행한다.
- stray dog 이벤트는 우호 NPC 그룹을 생성해 현재 적에게 공격하게 하지만, NPC collision body는 플레이어와 통과하지 않아 길목을 막는다.
- 3회 차단 후 bowl은 broken 상태가 되고 해당 stage에서 더 이상 발동하지 않는다.

### I04. 숨겨진 부작용 발견

- Related Files:
  - src/game/systems/DrawbackDiscovery.ts :: DrawbackDiscovery — new
  - src/game/core/events.ts :: gameplay events — new

#### Details

- Tool definition에는 장점과 hiddenDrawbackId만 저장하고 상점 설명에는 drawback을 표시하지 않는다.
- drawback이 처음 발동하면 drawback-discovered 이벤트를 한 번만 발행하고 ProgressState.discoveredDrawbackIds에 추가한다.
- 발견 이후 캐릭터 상태 창에서는 부작용을 공개하지만, 구매 전 상점 카드에는 여전히 장점 중심으로 표시한다.

## Acceptance Criteria

- [ ] 보스 처치 순서에 따라 5개 스킬이 정확히 해금된다.
- [ ] 모든 스킬 쿨다운이 독립적으로 작동하고 pause/equipment change로 초기화되지 않는다.
- [ ] 토끼 슬리퍼의 3연타 솜먼지 재채기와 3m 후퇴가 정확히 1회 발동한다.
- [ ] 물기 해금 후 슬리퍼를 놓은 직후 직접 물기 연계가 가능하다.
- [ ] 밥그릇이 약한 공격 3회만 막고, 매번 유기견 이벤트를 발생시킨다.
- [ ] 부작용은 첫 발동 전에는 숨겨지고 첫 발동 후 상태 기록에 나타난다.

## Validation

- npm run lint — skill/equipment/event 타입 통과
- npm run build — combat runtime import 통과
- npm run dev — J 연타, K/L skill, 밥그릇 3회, 유기견 길막을 수동 확인

## Commit Message

~~~text
feat(combat): add cooldown skills and cursed equipment loop

Plan: 2026-09-21-legendary-rib-corgi
Phase: P02-core-gameplay
Task: T02-skills-equipment-combat

- Add ordered skill unlocks and independent cooldowns
- Add slipper combo, bowl defense, stray dog drawback events
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
