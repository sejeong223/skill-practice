# Task: T05 12회 근접 타격 삼색이 전투와 보스 전용 하트

## Status: pending

## Goal
삼색이의 12칸 라이프바를 토끼 슬리퍼 근접 명중으로 소진시키는 보스전을 만든다. 생선 가시는 예고 후 한 발씩 날아오며 점프로 피하거나 뒤집힌 밥그릇으로 세 번 자동 방어한다. 세 번째 방어에 강아지 무리가 코기를 잠시 감싸 움직임을 막는다. 보스전에서만 코기 얼굴과 3하트가 일시정지 왼쪽에 보이고, 막지 못한 생선 가시에 맞을 때마다 하트 하나가 줄며 세 번째 피격에서만 사망한다.

## Decision Summary
- 슬리퍼의 `slipper-hit` 근접 판정만 보스 HP 1을 깎는다. `slipper-sneeze`와 `bite-hit`은 카운트하지 않는다. 공격 버튼을 눌렀지만 닿지 않은 경우도 HP를 깎지 않는다.
- 하트는 단일 보스전의 체력이다. 1·2번째 유효 피격은 하트만 줄이고 같은 전투를 계속한다. 세 번째 유효 피격에만 `DeathSystem`을 호출하여 4단계 끝 체크포인트로 돌아간다. 일반 맵에는 하트를 표시하거나 차감하지 않는다.

## Implementation

### I01. 보스 전투 상태·충돌·투사체

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`, `update`, boss exit guard, shutdown; modify
  - `src/game/systems/CombatSystem.ts` :: `tryAttack`, `resetForStage`; read-only/use
  - `src/game/systems/SlipperAttack.ts` :: `SlipperAttackResult`; read-only/use
  - `src/game/systems/DefenseToolSystem.ts` :: `tryBlock`, `resetForStage`; read-only/use
  - `src/game/systems/DeathSystem.ts` :: `handleDeath`, third-hit death path; read-only/use
  - `src/game/data/tools.ts` :: `TOOL_DEFINITIONS`; read-only/use
  - `src/game/systems/World01CalicoBoss.ts` :: arena state and attack lifecycle; new
  - `src/game/stages/StageRuntime.ts` :: boss fallback platform and gated completion; modify
  - `src/game/data/worlds.ts` :: `createBossStage` arena layout; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface CalicoBossState {
    health: number; // integer 0..12
    phase: "intro" | "ready" | "telegraph" | "projectile" | "defeated";
    nextThrowAt: number;
    projectileId: string | null;
    corgiHearts: 0 | 1 | 2 | 3;
    damageLockedUntil: number;
  }
  class World01CalicoBoss {
    start(now: number): void;
    update(now: number, delta: number): void;
    acceptMeleeHit(result: SlipperAttackResult, player: Player): boolean;
    resetAttempt(now: number): void;
    isDefeated(): boolean;
    destroy(): void;
  }
  ```
- **Data & Schema Fields**:
  - Boss arena 1920×720; grounded platform spans x16–1904 at y520. Calico center x1280, feet aligned with platform, source asset `world-01-calico-boss`, collision width at most 76px. Player spawns x160 with rabbit slipper and upside-down bowl equipped for this fight. Boss exit overlap does not complete the stage; HP 0 starts the T06 victory dialogue directly.
  - HP 12, visible 12 cells attached above calico and updated after accepted collision; one cell per actual hit. Hit range <=100px from player attack origin, player must face calico and vertical body centers must be within 64px. No projectile slipper object. A `slipper-sneeze` neither hurts boss nor consumes a health cell; recovery/bite window uses existing controller behavior.
  - Fishbone image `world-01-fishbone`; one active projectile maximum, telegraph 700ms, throw interval 2600ms, travel speed 220px/s toward player position at release, width32 height16, hitbox <=28×12. No contact damage from stationary calico, surprise alternate pattern, arena-wide attack or rate increase. At collision create `IncomingAttack {id,kind:"weak",damage:1}`. If `tryBlock(...).blocked`, destroy projectile without changing hearts; otherwise consume that projectile, subtract exactly one heart and start 900ms damage immunity. Only the 3→2→1→0 transition requests death.
- **Execution Flow / Logic**:
  1. Construct boss after the T04 intro gate and start timers only when runtime status becomes `play`. In `StageScene.update`, process `input.attackPressed` through `CombatSystem.tryAttack` once and call `acceptMeleeHit`; update combat cooldowns and boss projectile each frame. Pause freezes both clock advancement and active projectile movement.
  2. Collision check uses Phaser bodies/rectangles, facing and range; one accepted attack damages at most once. On HP 0, destroy any fishbone, disable new throws, mark defeated, freeze combat and invoke the T06 victory dialogue callback once. No boss-exit overlap is required.
  3. The first two unblocked hits keep boss HP, projectile cadence, shield charges/broken state and attack combo unchanged; play a brief hurt flash and continue control after immunity. On the third unblocked hit, `DeathSystem` counts one actual death. A new boss entry after stage4 return clears projectile and dogs and restores boss HP12, shield charges3, corgi hearts3, attack combo and boss position. Do not replay first-time dialogue. Fix fallback platform center so it actually spans the arena; currently width1888 centered at x16 leaves much of the arena unsupported.

### I02. Third block dog surround

- Related Files:
  - `src/game/systems/StrayDogEvent.ts` :: constructor subscription, `spawnSurge`, `clear`; modify
  - `src/game/entities/Player.ts` :: `lockControl`/`unlockControl`; read-only/use
  - `src/game/scenes/StageScene.ts` :: dog sprite/body placement, timed cleanup; modify
  - `src/game/core/events.ts` :: `drawback-triggered`, `stray-dog-surge`; modify only if payload extension required

#### Details
- **Signatures & Types**:
  ```typescript
  // StrayDogEvent subscribes to `bowl-broken` or matching `drawback-triggered`,
  // never to each `clang`; accepts player x/y as an origin callback.
  ```
- **Data & Schema Fields**:
  - Three `world-01-stray-dog` sprites surround current player x at offsets -48, 0, +48, with distinct facing/tint; no fixed x520 spawn. They do not deal damage or attack calico. Surround lasts 2200ms of unpaused game time; clear on the third-hit death, victory and scene shutdown. Lock movement/jump with key `bowl-stray-dog-blockade` only during surround. Keep warning/animation visible so the drawback reads as a consequence of the third shield block.
- **Execution Flow / Logic**:
  1. Blocks one and two emit `clang` only. Block three emits `clang` plus existing `bowl-broken`/drawback event; the latter triggers one dog surge. Guard duplicate event processing.
  2. After 2200ms unlock this one control key and remove dog sprites; do not remove unrelated locks. The first two damaging hits do not reset shield or dogs. Reset shield to three charges only on the next boss entry after actual death, so a fresh run can experience the third-block drawback again.

### I03. Boss-only health hearts, third-hit death and UI

- Related Files:
  - `src/game/scenes/StageScene.ts` :: bossHearts field, collision damage handler, `StageSceneData`; modify
  - `src/game/stages/stageEvents.ts` :: `boss-hearts-changed`; modify
  - `src/components/game/GameEventBridge.tsx` :: event whitelist; modify
  - `src/components/game/GameShell.tsx` :: active stage ID and boss lives state; modify
  - `src/components/game/GameOverlay.tsx` :: boss hearts prop; modify
  - `src/components/game/Hud.tsx` :: corgi face and heart display; modify
  - `src/app/globals.css` :: desktop/mobile heart alignment; modify
  - `src/game/persistence/migrations.ts` :: no save schema change; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // StageEventMap:
  "boss-hearts-changed": { stageId: "world-01-stage-boss"; remaining: 0 | 1 | 2 | 3 };
  // StageSceneData adds resumeCheckpointId?: string; used only for stage4 return.
  // GameOverlay/Hud add bossHearts?: 0 | 1 | 2 | 3; hide if activeStageId is not boss.
  ```
- **Data & Schema Fields**:
  - Runtime-only boss health starts at 3 on entering World 1 boss. Face PNG `world-01-corgi-face` 24×24 plus three visible heart icons; extinguish/remove one heart per unblocked hit. HUD block sits left of pause button (`right:102px`, `top:16px` desktop), with mobile position adjusted so it never covers pause/reset or stage title. Accessible label `코기 남은 하트 N개`.
  - Do not add hearts to `ProgressState`: on reload the boss starts a fresh 3-heart run at last cleared stage/checkpoint. Ordinary stage deaths have no lives event and no hearts UI.
- **Execution Flow / Logic**:
  1. Route every unblocked fishbone collision through one `takeBossDamage(projectileId, now)` handler. Consume projectile first and reject duplicate ID or `now < damageLockedUntil`. Decrement exactly once and emit `boss-hearts-changed`. At 2/1, show hurt animation and continue the same encounter with unchanged calico HP and bowl charges. Do not emit `death-requested`, `death` or increment `deathsTotal` for these hits.
  2. At 0, emit one `death-requested` with cause `enemy`. After `DeathSystem` finishes its restart call, start `StageScene` with `{stageId:"world-01-stage-4",resumeCheckpointId:"world-01-stage-4-checkpoint"}`. Stage4 `create` resolves that actual map object, positions player safely beside x3488, activates it with `CheckpointSystem`/snapshot, then emits stage start. Reentry into boss creates 3 hearts and a fresh encounter. Fail visibly if checkpoint ID is absent rather than teleporting to arbitrary x.
  3. Emit hearts event at boss start and after each unblocked hit; update `GameShell` from event payload. Also update active stage title on each `stage-started` and use live stage ID to conditionally show hearts; existing `GameShell` currently holds initial stage metadata only. On stage4 return, hearts disappear immediately.

## Acceptance Criteria
- [ ] Calico health bar needs 12 real close-range slipper hits; button presses from afar, sneeze and bite leave it unchanged. Boss exit cannot clear early.
- [ ] Every fishbone has visible 700ms warning, one projectile at a time and an avoidable jump path. First three blocked contacts consume bowl charges; third block triggers one 2200ms dog surround. Unblocked contact removes one heart, once per projectile.
- [ ] Boss HUD shows corgi face + three hearts left of pause; hearts become 2, 1, 0 on successive unblocked hits and never appear in normal stages. At 2/1 the boss HP and shield state remain unchanged, the death counter does not rise and the fight does not restart.
- [ ] Only the third unblocked hit raises death count by one and returns to stage4 x3488 true checkpoint; next boss entry restores all three hearts. Pause and actual death clean up all timers, locks and sprites.

## Validation
- `npx.cmd tsc --noEmit` — boss/UI event and state types compile.
- `npm.cmd run lint` — boss lifecycle and React props pass.
- `npm.cmd run build` — assets/UI integration compile.
- `npm.cmd run dev` — manually verify 12 hits, out-of-range misses, three blocks/dogs, fishbone dodge, hearts, and stage4 checkpoint return.

## Commit Message
```text
feat(world01): add calico fishbone fight and boss-only lives

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T05-calico-combat

- Require twelve melee slipper hits and telegraph fishbone throws
- Trigger dog blockade on third bowl block and consume one heart per unblocked hit
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
