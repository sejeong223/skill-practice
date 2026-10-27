# Task: T05 E 물기 공격과 6초 쿨타임·피해 2

## Status: done

## Goal

월드 2 보상을 얻은 코기가 E를 누르면 6초 쿨타임의 별도 물기 공격을 실행한다. 방향과 근접 명중 조건을 충족한 보스의 HP는 정확히 2 감소하고, 일반 적도 실제 피해를 받는다. Q 공격은 기존 무기 공격으로 남는다.

## Decision Summary

- 2026-10-27 사용자 지정에 따라 물기는 Q 슬리퍼 콤보의 추가 입력이 아닌 독립적인 E 스킬이다. 쿨타임은 `SKILL_DEFINITIONS.bite.cooldownMs=6000`을 `SkillSystem.use("bite", skillElapsedMs)`가 관리한다.
- 공격 범위는 기존 `isCalicoInSlipperReach`의 전방 근접 판정을 재사용해 보이는 전면 적에만 맞는다. 성공 입력은 빗나가더라도 쿨타임을 소비한다. 보스 1개당 E 입력 1회로 HP 2만 깎는다.

## Implementation

### I01. 스킬 입력과 대상에게 실제 피해 적용

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `update`, `publishBossFeedback` — `bitePressed`를 스킬 사용·음향·보스/일반 적 명중에 연결; modify
  - `src/game/systems/BossEncounter.ts` :: `acceptBiteHit` — 월드 2~5 보스 피해 2; modify
  - `src/game/systems/World01CalicoBoss.ts` :: `acceptBiteHit` — 월드 1 재도전에서 해금된 물기 피해 2; modify
  - `src/game/systems/calicoMeleeHitbox.ts` :: `isCalicoInSlipperReach` — 이미 검증된 전방 근접 판정 사용; read-only
  - `src/game/entities/Enemy.ts` :: `takeDamage` — 일반 맵 적 피해 적용에 사용; read-only
  - `src/game/systems/SkillSystem.ts` :: `use`, `getRemainingCooldown` — 기존 해금/쿨타임/`attack-bite` 상태 사용; read-only
  - `src/game/core/events.ts` :: `"bite-hit"` — 기존 실제 물기 음향 이벤트 payload 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // BossEncounter와 World01CalicoBoss 각각에 같은 외부 계약 추가
  public acceptBiteHit(player: Player): boolean;
  // 기존 스킬 계약
  public use(skillId: SkillId, now: number): SkillUseResult;
  public getRemainingCooldown(skillId: SkillId, now: number): number;
  // 근접 범위는 기존 함수를 사용
  export function isCalicoInSlipperReach(
    playerCenterX: number, playerCenterY: number, facing: -1 | 1,
    target: MeleeTargetBounds,
  ): boolean;
  ```
- **Data & Schema Fields**:
  - `InputSnapshot.bitePressed: boolean`은 T04가 추가한다. `SKILL_DEFINITIONS`의 bite cooldown 6000ms와 `inputAction="bite"`도 T04가 설정한다.
  - 보스 HP는 기존 `BossEncounterState.health` 또는 `CalicoBossState.health`를 사용하며 저장 스키마를 늘리지 않는다. 일반 적은 기존 `Enemy.health`와 `Enemy.takeDamage(2, now)`를 사용한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `StageScene.runtime.status === "play"`, `!stageTransitionStarted`, `player` 존재를 기존 update 초반에서 보장한다. `skillSystem.use("bite", skillElapsedMs)`는 해금 전과 남은 쿨타임 동안 `accepted=false`를 반환한다. 거절 시 애니메이션·피해·효과음은 발생하지 않는다.
  2. Core Processing: E 성공 시 `SkillSystem`의 `attack-bite` 상태를 적용하고 `gameplayEventBus.emit("bite-hit", { now: time })`을 1회 발생시켜 기존 오디오를 쓴다. `calicoBoss?.acceptBiteHit(player)` 또는 `bossEncounter?.acceptBiteHit(player)`는 기존 `canFight()`/패배 상태 확인 후 플레이어 몸 중심·방향과 보스 bounds를 `isCalicoInSlipperReach`로 검사하고, 명중했을 때만 기존 `applyDamage(2)`/`damageBoss(2)` 경로를 호출한다. 일반 맵에서는 active `mapEnemies`를 순회해 같은 범위의 적에게 `takeDamage(2,time)`를 입력당 한 번씩 호출한다.
  3. Error & Exception Handling: 보스가 이미 패배했거나 E가 공중에 빗나가면 추가 HP 변화가 없다. 동시에 Q도 눌렀더라도 각 입력의 쿨타임과 명중을 독립 처리하고 동일한 E를 한 프레임에 두 번 쓰지 않는다. 방어구/무기 장착과 기존 Q 공격 접촉 처리는 바꾸지 않는다.
  4. State Transition & Return: 적중 보스 HP는 `max(0, old-2)`가 되고 기존 보스 승리 콜백/패배 연출을 그대로 거친다. E 사용 후 5999ms 동안 재사용 불가, 6000ms에서 허용. 장면 재시작 시 기존 `resetBossFeedback`의 `skillSystem.resetCooldowns()`를 따른다.

### I02. Q의 낡은 자동 물기 연계를 제거

- Related Files:
  - `src/game/systems/SlipperAttack.ts` :: `SlipperAttackController.tryAttack`, `update`, `SlipperAttackResult` — Q가 물기 이벤트를 발생시키지 않게 수정; modify
  - `src/game/systems/CombatSystem.ts` :: `tryAttack` — 새 반환 타입과 Q 무기 경로 적용 확인; modify only if needed
  - `src/game/scenes/PrototypeScene.ts` :: `update` — 프로토타입에서도 E만 `skillSystem.use("bite")`를 호출하도록 연결; modify
  - `scripts/bite-skill.test.mjs` :: 입력·쿨타임·피해 회귀; new
  - `src/game/data/tools.ts`, `src/game/data/toolPresentation.ts` :: Q에서 제거한 낡은 물기 보너스 설명 갱신; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export interface SlipperAttackResult {
    accepted: boolean;
    kind: "slipper-hit" | "slipper-sneeze" | "cooldown" | "tool-preview";
    comboCount: number;
    knockbackX: number;
  }
  public tryAttack(now: number): SlipperAttackResult;
  public update(now: number): void;
  ```
- **Data & Schema Fields**: 기존 `biteWindowUntil`과 `"bite-hit"`/`"bite-window-expired"` 결과는 Q 연계용이므로 제거한다. `holdingSlipper`, `sneezeUnlockAt`, 3연타 후 재채기·350ms 잠금과 기본 슬리퍼 콤보는 유지한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: Q 재채기 잠금이 끝나기 전은 기존처럼 거절한다.
  2. Core Processing: 재채기 후 `update(now)`에서 슬리퍼를 다시 잡게 하고 다음 Q는 일반 슬리퍼 공격이다. `bite-hit` 이벤트는 E 스킬 성공 경로에서만 난다. 프로토타입도 T04의 `bitePressed`를 사용한다.
  3. Error & Exception Handling: E 미해금인 월드 1에서 Q로 물기 효과음/애니메이션이 나지 않는다. 재채기 중 이동 잠금은 기존 시점에 풀린다.
  4. State Transition & Return: Q는 장착 무기 공격, E는 독립 물기라는 계약이 전 스테이지에서 성립한다.

### I03. 6초 쿨타임 가시성 및 검증

- Related Files:
  - `src/game/systems/bossFeedback.ts` :: `BossFeedbackSnapshot` — bite 해금/남은 시간/전체 6000ms 필드 추가; modify
  - `src/game/scenes/StageScene.ts` :: `publishBossFeedback` — bite 상태 계산 및 기존 중복 발행 비교에 포함; modify
  - `src/components/game/BossCombatOverlay.tsx` :: `BossCombatOverlayProps`, 렌더 — E 키와 물기 6초 쿨타임을 기존 짖기 카드 옆에 표시; modify
  - `src/components/game/GameShell.tsx` :: `BossCombatOverlay` 호출 — `progress.keybinds.bite` 전달; modify
  - `src/app/globals.css` :: `.boss-combat-overlay`/쿨타임 카드 — 좁은 화면에서 두 카드가 겹치지 않게 배치; modify
  - `scripts/boss-encounter.test.mjs` :: E 피해 2와 치명타 1회; modify
  - `scripts/boss-feedback.test.mjs` :: 쿨타임 상태; modify
  - `scripts/bite-skill.test.mjs` :: 해금/미해금/경계 시간/빗나감; new

#### Details

- **Signatures & Types**:
  ```typescript
  export interface BossFeedbackSnapshot {
    readonly stageId: StageId; readonly active: boolean;
    readonly barkUnlocked: boolean; readonly barkRemainingMs: number; readonly barkCooldownMs: number;
    readonly biteUnlocked: boolean; readonly biteRemainingMs: number; readonly biteCooldownMs: number;
    readonly warning: BossWarningView | null;
  }
  export interface BossCombatOverlayProps {
    readonly eventBus: GameEventBus; readonly stageId: StageId; readonly visible: boolean;
    readonly barkKeybind: string; readonly biteKeybind: string;
  }
  ```
- **Data & Schema Fields**: `biteRemainingMs`는 `SkillSystem.getRemainingCooldown("bite", skillElapsedMs)`를 100ms 단위로 표시한다. `biteCooldownMs=BITE_COOLDOWN_MS`(T04의 6000ms 상수). 잠김이면 카드를 숨긴다. 저장 스키마는 T04가 마련한 버전 5 그대로다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 보스 피드백 `snapshot.active`가 true이고 stageId가 맞을 때만 표시한다.
  2. Core Processing: 기존 짖기 카드와 동일한 `준비`/남은 초/진행 막대를 물기 카드에도 적용한다. 두 카드는 한 컨테이너에 배치해 모바일 폭 600px 이하에서도 겹치지 않는다.
  3. Error & Exception Handling: 0으로 나누지 않게 cooldown 상수 6000을 사용하고, 죽음/클리어/컷신에서는 기존 `active=false`로 모두 숨긴다.
  4. State Transition & Return: 사용자가 E 입력 직후 6.0초를 보고 감소하며, 다음 사용 가능 시 `준비`를 본다.

## Acceptance Criteria

- [ ] 월드 2 클리어 전에는 E가 물기 피해를 주지 않고, 해금 후에는 E만 물기를 사용한다.
- [ ] 범위 내 보스에게 E 한 번은 HP 정확히 2 감소, 빗나감/잠김/쿨타임 중에는 HP 변화가 없다.
- [ ] 물기 쿨타임은 6초이고 화면에서 남은 시간이 보인다.
- [ ] Q 공격·슬리퍼 재채기·무기 장착·짖기 W가 각각 독립적으로 작동한다. E의 전용 이미지 표시는 T06에서 연결한다.

## Validation

- `node --test scripts/bite-skill.test.mjs scripts/boss-encounter.test.mjs scripts/boss-feedback.test.mjs scripts/goodboy-weapons.test.mjs` — 해금·피해·쿨타임·기존 무기 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 0개.
- `node node_modules/eslint/bin/eslint.js src/game/scenes/StageScene.ts src/game/scenes/PrototypeScene.ts src/game/systems/BossEncounter.ts src/game/systems/World01CalicoBoss.ts src/game/systems/SlipperAttack.ts src/game/systems/bossFeedback.ts src/components/game/BossCombatOverlay.tsx src/components/game/GameShell.tsx scripts/bite-skill.test.mjs` — lint 오류 0개.
- `node node_modules/next/dist/bin/next build` — 최종 클라이언트 빌드 통과.
- 브라우저에서 월드 2 클리어 후 E의 근접 명중 HP 2, 6초 재사용 거절, W 짖기, Q 장착 무기, 모바일 두 쿨타임 카드를 확인하고 `.memory/test-plans/2026-10-27-world02-cheese-tabby-victory-review.md`에 기록한다.

## Commit Message

```text
feat(game): E 물기로 보스에게 피해 2를 적용하기

Plan: 2026-10-27-world02-cheese-tabby-victory-story-bite
Phase: P01-boss-victory-flow
Task: T05-bite-damage

- 6초 물기 스킬을 별도 E 입력과 실제 근접 피해에 연결
- Q의 낡은 자동 물기를 제거하고 쿨타임 표시와 전투 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: T05-bite-damage
