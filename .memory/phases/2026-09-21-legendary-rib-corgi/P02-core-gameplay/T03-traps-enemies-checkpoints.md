# Task: T03 적·함정·사망·희소 체크포인트·재시작

## Status: pending

## Goal

플레이어가 적·함정·낙사로 죽고, 목숨 제한 없이 긴 스테이지의 체크포인트 또는 시작점에서 즉시 재시작하는 억까 루프를 구현한다. 사망 시 현재 스테이지 코인만 잃고 안전 금고 코인은 유지한다.

## Decision Summary

- 정상 긴 스테이지에는 체크포인트를 정확히 1개만 둔다.
- 고정 함정은 항상 같은 위치·조건을 사용하고, randomized: true인 일부 함정과 고양이 행동만 attempt seed로 변한다.

## Implementation

### I01. 적·함정 판정

- Related Files:
  - src/game/entities/Enemy.ts :: Enemy — new
  - src/game/entities/Trap.ts :: Trap — new
  - src/game/systems/EnemySystem.ts :: EnemySystem — new
  - src/game/systems/TrapSystem.ts :: TrapSystem — new

#### Details

- Enemy는 Arcade dynamic body 또는 static hazard body를 사용하며 health, stunnedUntil, patrolState, contactDamage를 갖는다.
- Trap은 lethal, weak, knockback, offscreen, delayed, fake-safe 타입을 지원한다.
- offscreen trap은 카메라 밖에서도 활성화될 수 있지만, stage definition에 triggerRegion을 명시해야 한다.
- 적 사망은 particle/knockback 연출 후 loot 이벤트를 발행하고, trap 사망은 lethal 이벤트를 직접 발행한다.

### I02. 체크포인트

- Related Files:
  - src/game/systems/CheckpointSystem.ts :: CheckpointSystem — new
  - src/game/core/runtimeTypes.ts :: CheckpointSnapshot — modify

#### Details

- 정상 스테이지의 checkpoint는 id, x, y, facing, stageId만 가진다.
- checkpoint에 처음 접촉하면 checkpointUsed: true로 만들고 snapshot을 런타임 메모리에 저장한다.
- checkpoint를 통과한 뒤 사망하면 플레이어 위치와 일부 stage entities만 재생성하며, 스테이지 전체 재로드가 필요한 trap은 stage seed를 유지한 채 재초기화한다.
- 체크포인트가 없는 보스전은 stage spawn을 restart point로 사용한다.

### I03. 사망·재시작·통계

- Related Files:
  - src/game/systems/DeathSystem.ts :: DeathSystem — new
  - src/game/systems/RestartController.ts :: RestartController — new
  - src/game/core/events.ts :: death events — modify

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface DeathContext {
    stageId: StageId;
    cause: "enemy" | "trap" | "fall" | "tool-drawback" | "scripted";
    checkpointId: string | null;
  }

  export class DeathSystem {
    handleDeath(context: DeathContext): void;
    getDeathCount(stageId?: StageId): number;
  }

  export class RestartController {
    restartAtCheckpointOrSpawn(): void;
  }
  ~~~
- 사망 시 deathsTotal과 deathsByStage[stageId]를 증가시키고 현재 스테이지 코인을 0으로 만든다.
- bankedCoins와 영구 owned tools, unlocked skills는 절대 사망 rollback 대상에 포함하지 않는다.
- 사망 화면은 250ms 이하의 만화식 hit freeze/flash 후 즉시 restart를 시작하며, 별도 목숨 UI를 표시하지 않는다.

## Acceptance Criteria

- [ ] 일반 스테이지에 체크포인트가 정확히 하나만 활성화된다.
- [ ] 체크포인트 이전/이후 위치에서 각각 사망했을 때 올바른 restart 위치로 이동한다.
- [ ] 사망 시 current-stage coins만 0이 되고 banked coins는 유지된다.
- [ ] 누적 사망 횟수가 전체·스테이지별로 증가한다.
- [ ] 고정 함정은 재시도마다 동일하고 randomized trap만 attempt seed에 따라 바뀐다.
- [ ] 목숨 제한 없이 즉시 재시작된다.

## Validation

- npm run lint — death/checkpoint event 타입 통과
- npm run build — systems import 통과
- npm run dev — 함정·적·낙사·체크포인트·사망 통계를 수동 확인

## Commit Message

~~~text
feat(loop): add traps enemies checkpoints and instant death retry

Plan: 2026-09-21-legendary-rib-corgi
Phase: P02-core-gameplay
Task: T03-traps-enemies-checkpoints

- Add lethal hazards, enemy collisions and sparse checkpoints
- Preserve banked coins while resetting current-stage coins on death
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
