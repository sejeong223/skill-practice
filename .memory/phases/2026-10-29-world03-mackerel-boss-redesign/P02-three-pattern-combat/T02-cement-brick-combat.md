# Task: T02 벽돌·시멘트 세 공격 전투 연결

## Status: pending

## Goal

월드 3 보스가 0.3초 전신 준비와 실제 준비 소리 뒤 벽돌·직진 시멘트 파도·포물선 시멘트 덩어리를 사용하게 한다. 체력 10 이하 2연계, 1하트 직접 피해, 시멘트 1초 감속, 짖기 중단과 재도전 초기화를 한 게임 루프로 완성한다.

## Decision Summary

- 노란 착지 타원과 공격 경고 문구는 월드 3에서 보이지 않는다. 0.3초 자세와 재질별 소리로 구분한다. 월드 2·4·5의 경고와 0.6초 준비는 유지한다.
- 벽돌은 기존 궤적·1400ms 고체를 보존한다. 파도는 발사 방향으로 360px/s 직진, 바로 뒤 160px만 자국. 덩어리는 약 700ms 포물선으로 날아 96px 웅덩이를 남긴다. 시멘트 자국 1500ms, 접촉 후 감속 1000ms·120px/s.

## Implementation

### I01. 세 공격 패턴과 시멘트 물리

- Related Files:
  - `src/game/systems/MackerelConstructionPattern.ts` :: `BossPattern` 구현, 세 공격/그림/소리/자국 — new
  - `src/game/systems/MackerelBrickPattern.ts` :: 기존 벽돌 코드 새 패턴으로 이전 뒤 제거 — delete
  - `src/game/systems/mackerelBrickPhysics.ts` :: 벽돌 궤적·swept 판정·착지 안전 위치 — read-only 또는 필요 최소 수정
  - `src/game/systems/mackerelCementPhysics.ts` :: 파도·덩어리·웅덩이 순수 물리 — new
  - `src/game/systems/mackerelAttackSchedule.ts` :: 예약/확정/취소 덱 — read-only
  - `src/game/systems/BossPattern.ts` :: 선택적 `resetForAttempt` 계약 — modify
  - `src/game/systems/PlayerController.ts` :: 시멘트 감속 상태와 이동속도 적용 — modify
  - `scripts/world03-boss-combat.test.mjs` :: 세 공격/시멘트 물리 하네스 — new
  - `scripts/world03-boss-bricks.test.mjs` :: 기존 벽돌 궤적 회귀 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface BossPattern {
    readonly warningText?: string;
    telegraph(targetX: number, serial: number): void;
    launch(targetX: number, serial: number): void;
    update(deltaMs: number): readonly BossHazardHit[];
    clear(): void;
    resetForAttempt?(attempt: number): void;
    destroy(): void;
  }
  class MackerelConstructionPattern implements BossPattern {
    constructor(scene: Phaser.Scene, player: Player, bossSprite: Phaser.GameObjects.Sprite,
      attempt: number, playPrepSound: (key: MackerelPrepSoundKey) => void,
      onCementContact: () => void);
  }
  type MackerelPrepSoundKey = "world-03-boss-brick" | "world-03-boss-trowel" | "world-03-boss-cement";
  PlayerController.applyCementSlow(durationMs: number): void;
  PlayerController.clearCementSlow(): void;
  PlayerController.getCementSlowRemainingMs(): number;
  ```
- **Data & Schema Fields**: 패턴 런타임은 예약 종류/serial, `Brick[]`, `Wave[]`, `Lump[]`, `Puddle[]`, 발사 포즈 잔여 시간, destroyed 플래그를 가진다. 객체 ID는 `kind-serial`로 유일하게 만든다. `BossHazardHit.kind`는 세 직접 피격 모두 `weak`로 기존 방패/하트 1칸 규칙을 유지한다. Puddle은 hazard hit가 아니라 감속 접촉만 만든다.
- **Execution Flow / Logic**:
  1. Precondition: P01의 필수 이미지·WAV와 P02-T01 공격 덱이 존재해야 한다. 첫 `telegraph`는 종류를 reserve하고 해당 전신 프레임 1/4/6 및 SFX를 한 번 적용한다. 바닥 마커를 만들지 않는다.
  2. Core: `launch`는 예약 종류를 commit하고 프레임 2/5/7을 180ms 보여준다. 벽돌은 현행 `advanceMackerelBrick`, 32×32 이미지·착지 정적 zone·1400ms·동시 착지 벽돌 최대 2개를 유지한다. 파도는 보스 x±48의 바닥 중심 y488에서 발사 순간 코기가 있는 쪽으로 방향을 고정해 360px/s로 진행한다. 가시 몸체 근처 56×18px swept hitbox를 쓰고 지면에 닿은 코기가 점프로 넘을 수 있도록 한다. 파도 뒤 현재 위치부터 최대 160px 한 줄의 자국만 표시·판정하고, 파도가 사라지면 마지막 자국이 1500ms 뒤 사라진다. 덩어리는 보스 앞발 부근에서 발사, 목표 x를 발사 시 고정, 700ms 궤적과 약 96px 높이 포물선 뒤 y492에 착지한다. 공중 덩어리는 swept bounds로 피격 1회, 착지 때 96×16 웅덩이를 만들며 고체 벽은 만들지 않는다.
  3. Contact: 시멘트 직접 피격은 `BossHazardHit`로 `BossEncounter`에 전달한다. 웅덩이는 코기 몸의 가로 영역이 겹치고 발이 바닥에 닿을 때 `onCementContact()`를 호출한다. `PlayerController`는 느려지는 동안 목표 가로속도를 120px/s로 제한하고 현재 |vx|도 즉시 120 이하로 맞춘다. 접촉 중 1000ms를 갱신하고 빠져나오면 시간만 감소한다. 점프 y속도와 중력은 그대로다.
  4. Error/cleanup: `clear`는 진행 중 투사체·웅덩이와 예약 공격을 지우고 포즈를 0으로 돌리되 이미 발사한 순서는 보존한다. `resetForAttempt(attempt)`는 덱도 재시드한다. `destroy`는 zone·collider·이미지를 모두 정리한다. 벽돌 착지 시 코기와 겹치면 현행 `clearPlayerFromBrick` 보정을 유지한다.

### I02. 보스 타이머·체력 단계·무경고·장면 연결

- Related Files:
  - `src/game/data/bossCombat.ts` :: 월드 3 `telegraphMs=300`, `showWarning=false` — modify
  - `src/game/systems/BossEncounter.ts` :: 월드 3 2연계 타이머·경고 조건·리셋 — modify
  - `src/game/scenes/StageScene.ts` :: `MackerelConstructionPattern`·SFX·감속 콜백·시도 번호 주입 — modify
  - `src/game/data/worlds.ts` :: 월드 3 보스 phase 설명의 벽돌 전용 낡은 문자열 교체 — modify
  - `scripts/boss-encounter.test.mjs` :: 월드 3 타이머·경고·리셋; 월드 2 기존 동작 — modify
  - `scripts/bark-boss-stun.test.mjs` :: 전공격 취소·경직 회귀 — modify
  - `scripts/boss-stage-content.test.mjs` :: 월드 3 패턴 메타데이터 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface BossCombatConfig { readonly showWarning?: boolean; /* existing fields unchanged */ }
  BossEncounter.resetAttempt(attempt?: number): void;
  // BossEncounter private runtime: comboPendingAtMs: number | null;
  ```
- **Data & Schema Fields**: 월드 3 HP 20·attackIntervalMs 2600·telegraphMs 300·bossName `고등어 태비`·showWarning false. 다른 보스는 showWarning 기본 true, 원래 수치 보존. 첫 준비 1500ms 뒤 시작. 체력 10 이하에서 **첫 발사 후** 800ms 뒤 둘째 준비, 다시 300ms 뒤 둘째 발사. 두 번째 발사로 또 다른 연계를 예약하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition: StageScene은 `runtime.runtimeState.attempt`를 초기 패턴과 사망 후 `resetAttempt(attempt)`에 전달한다. `DeathSystem`이 attempt를 늘리므로 고정 `runtimeState.randomSeed`만 사용하지 않는다.
  2. Core: 기존 첫 공격/기본 2600ms 주기를 보존한다. 첫 발사 시 HP≤10이면 `comboPendingAtMs=elapsed+800`; 타이머가 도달하면 일반 공격보다 우선해 두 번째 `telegraph`를 시작한다. `BossEncounter`가 월드 3에서만 warning Text를 숨기고 `MackerelConstructionPattern.telegraph`의 SFX와 전신 자세를 사용한다.
  3. Error/cleanup: 짖기 경직 시작, 사망, 승리, 장면 종료에서 pending combo·예약·위험물을 제거한다. 짖기 경직 중 보스 시계와 패턴 update는 멈추며 종료 후 안전 시간 700ms를 유지한다. HP 10 경계가 첫 발사 이후 바뀌면 다음 첫 공격부터 연계한다.
  4. State/return: 덱의 발사 종류와 serial이 연계에서도 한 번씩 소비된다. 월드 2 치즈 태비, 월드 4 턱시도, 월드 5 메인쿤의 기존 600/600/450ms 준비·경고는 그대로다.

## Acceptance Criteria

- [ ] 세 공격 준비 자세·소리가 각각 0.3초, 월드 3 바닥 표식·경고 문구 0개.
- [ ] 첫 세 발사의 종류별 1회, HP 10 이하 0.8+0.3초 2연계, 재도전 시드·짖기 취소가 맞는다.
- [ ] 벽돌 1400ms 고체, 파도 직진/160px 자국, 덩어리 96px 웅덩이, 시멘트 직접 1하트·감속 1000ms가 맞는다.
- [ ] 월드 2·4·5 패턴, 방패, 짖기 경직, 일시정지·사망 초기화가 회귀하지 않는다.

## Validation

- `node --experimental-strip-types --test scripts/mackerel-attack-schedule.test.mjs scripts/world03-boss-combat.test.mjs scripts/world03-boss-bricks.test.mjs scripts/boss-encounter.test.mjs scripts/bark-boss-stun.test.mjs scripts/boss-stage-content.test.mjs` — 공격·방패·경직·월드별 회귀 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 타입·정적·번들 통과.
- 월드 3 보스 실제 플레이 — 세 동작 식별, 뒤로 피하기/점프, 후반 2연계, 짖기 취소, 사망 재도전/사운드 재생 확인.

## Commit Message

```text
feat(월드3): 벽돌과 두 시멘트 공격을 보스전에 연결

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P02-three-pattern-combat
Task: T02-cement-brick-combat

- 무경고 0.3초 준비와 체력 절반 2연계 구현
- 시멘트 직격·잔류 감속과 사망·짖기 초기화 검증
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
