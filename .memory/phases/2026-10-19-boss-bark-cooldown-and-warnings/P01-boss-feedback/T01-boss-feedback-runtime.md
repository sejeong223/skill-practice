# Task: T01 보스전 쿨타임·경고 상태와 카메라 연출

## Status: done

## Goal
짖기를 성공적으로 사용하면 10초 동안 재사용을 막고, 보스전의 3·6·9번째 사용에 사레 경고 상태와 강한 카메라 흔들림을 발생시킨다. 월드 1 밥그릇의 기존 강아지 소환 이벤트도 같은 경고 상태로 연결한다. UI가 구독할 실제 상태를 발행한다.

## Decision Summary
- [결정 기록](../../../decisions/2026-10-19-boss-bark-cooldown-and-warnings.md). 사레는 시각 효과만이다. 코기 제어·체력·기존 보스 경직 효과에 불이익을 추가하지 않는다.
- 10초는 공통 짖기 스킬 값이다. 횟수와 경고는 보스전 도전 단위이며 저장하지 않는다. 성공한 사용만 카운트하며 보스 경직 명중 여부는 무관하다.
- 경고는 2500ms, 짖기 카메라 흔들림은 800ms/0.035. 일시정지 중 시간은 진행하지 않는다.
- 추가 요청: 일반 장애물 구간에서도 해금한 짖기를 사용한다. 쿨타임 snapshot은 normal/boss 모두 발행한다. 경고 횟수와 흔들림은 기존 보스전 범위를 유지한다. 이미지·효과음 연결은 T03에서 한다.

## Implementation

### I01. 스킬 쿨타임과 초기화 API
- Related Files:
  - `src/game/data/skills.ts` :: `SKILL_DEFINITIONS`, `BARK_COOLDOWN_MS` — modify
  - `src/game/systems/SkillSystem.ts` :: `use`, `getRemainingCooldown`, `resetCooldowns` — modify
  - `src/game/systems/SkillCooldowns.ts` :: `start`, `getRemaining`, `reset` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export const BARK_COOLDOWN_MS = 10_000;
  // SkillSystem에 추가. 해금 상태는 유지한다.
  public resetCooldowns(): void;
  // 기존 API 유지
  public use(skillId: SkillId, now: number): SkillUseResult;
  public getRemainingCooldown(skillId: SkillId, now: number): number;
  ```
- **Data & Schema Fields**: `SKILL_DEFINITIONS`의 `id: "bark"` 항목만 `cooldownMs: BARK_COOLDOWN_MS`로 설정한다. 새 저장 필드는 없다. 다른 스킬 정의는 유지한다.
- **Execution Flow / Logic**: `resetCooldowns()`는 내부 `this.cooldowns.reset()`만 호출한다. `unlocked`는 유지한다. 기존 거절 결과 `locked`/`cooldown`, 성공 결과 `remainingCooldownMs` 계약을 유지한다.
- **Important**: `getRuntimeState()`는 기존에 빈 `cooldownUntil`을 반환하므로 이번 기능의 상태 조회에 사용하지 않는다.

### I02. Phaser와 독립된 경고 상태
- Related Files:
  - `src/game/systems/bossFeedback.ts` :: 경고 타입·상수·`BossFeedbackController` — new
  - `src/game/stages/stageEvents.ts` :: `StageEventMap` — modify
  - `src/game/bridge/GameEventBus.ts` :: 기존 타입 기반 이벤트 버스 — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  import type { StageId } from "../core/types";
  export type BossWarningKind = "bark-third" | "bowl-alarm";
  export interface BossWarningView {
    readonly kind: BossWarningKind;
    readonly sequence: number;
  }
  export interface BossFeedbackSnapshot {
    readonly stageId: StageId;
    readonly active: boolean;
    readonly barkUnlocked: boolean;
    readonly barkRemainingMs: number;
    readonly barkCooldownMs: number;
    readonly warning: BossWarningView | null;
  }
  export const BOSS_WARNING_DURATION_MS = 2500;
  export const BARK_SHAKE_DURATION_MS = 800;
  export const BARK_SHAKE_INTENSITY = 0.035;
  export class BossFeedbackController {
    public recordBarkUse(): boolean;
    public showBowlAlarm(): void;
    public update(deltaMs: number): void;
    public getWarning(): BossWarningView | null;
    public clearWarning(): void;
    public reset(): void;
  }
  // StageEventMap에 추가 (type import 사용)
  "boss-feedback-changed": BossFeedbackSnapshot;
  ```
- **Data & Schema Fields**: controller의 private `barkUseCount=0`, `warningSequence=0`, `warning: BossWarningView|null=null`, `warningRemainingMs=0`을 사용한다. snapshot은 조회용 복사본이며 외부에서 내부 상태를 바꾸지 못하게 한다.
- **Execution Flow / Logic**:
  1. `recordBarkUse()`는 호출마다 횟수를 1 증가시키고 3의 배수면 `bark-third` 경고로 교체한다. 이때만 `true`를 반환한다. 그 외에는 `false`.
  2. 경고 생성은 종류와 무관하게 sequence를 1 증가시키고 남은 시간을 2500ms로 설정한다. `showBowlAlarm()`은 사용 횟수를 변경하지 않는다.
  3. `update()`는 유한하고 양수인 delta만 사용해 남은 시간을 0 이상으로 감소시킨다. 만료되면 `warning=null`. 일시정지는 호출부가 update를 생략한다.
  4. 두 경고는 큐에 쌓거나 중첩하지 않는다. 새 경고가 기존 경고를 대체한다.
  5. `clearWarning()`은 경고와 남은 시간만 비우고 횟수·sequence는 보존한다. `reset()`은 횟수·sequence·경고·남은 시간을 모두 초기화한다.
- **Error & Exception Handling**: 음수/NaN/Infinity delta는 0으로 처리한다. 타이머·Player·DOM·Phaser 의존성은 없다.

### I03. StageScene 연결과 시간 기준
- Related Files:
  - `src/game/scenes/StageScene.ts` :: `create`, `update`, `setPaused`, `handleCalicoDefeat`, shutdown — modify
  - `src/game/systems/World01CalicoBoss.ts` :: `tryBarkStun`, `isDefeated` — read-only
  - `src/game/systems/StrayDogEvent.ts`, `DefenseToolSystem.ts` — read-only

#### Details
- **Signatures & Types** (StageScene private members):
  ```typescript
  private skillElapsedMs = 0;
  private bossFeedback = new BossFeedbackController();
  private lastBossFeedbackSnapshot?: BossFeedbackSnapshot;
  private publishBossFeedback(force?: boolean, forceInactive?: boolean): void;
  private resetBossFeedback(): void;
  ```
- **Time domain**: `create()` 및 같은 Scene의 재시작 시 `skillElapsedMs=0`, `skillSystem.resetCooldowns()`, controller 초기화. `update()`가 runtime `play`인 경우에만 `skillElapsedMs += Math.max(0, finite(delta) ? delta : 0)`. 짖기의 `use()`와 `getRemainingCooldown()` 모두 이 시간을 넘긴다. `playerController`, 전투 시스템, `calicoBoss.tryBarkStun(time)`에는 기존 `time` 인자를 유지하여 다른 타이머와 섞지 않는다.
- **Bark flow**:
  1. 기존 `runtime === play` 및 해금 검사를 통과한 입력에서 `skillSystem.use("bark", skillElapsedMs)`를 호출한다.
  2. `accepted`일 때 기존 `calicoBoss?.tryBarkStun(time)`를 계속 호출한다. 사레가 발생해도 이 효과를 취소하지 않는다.
  3. `stageDefinition.kind === "boss"`, 전환 중 아님, 보스 패배 전이면 `bossFeedback.recordBarkUse()`를 호출한다. `true`면 `this.cameras.main.shake(BARK_SHAKE_DURATION_MS, BARK_SHAKE_INTENSITY, true)`를 정확히 한 번 실행한다.
  4. 잠긴 스킬·쿨타임 중 입력은 controller를 호출하지 않는다. 일반 스테이지 사용은 보스 횟수로 누적하지 않는다. 기존 소환견으로 인한 제어 잠금 중 짖기 사용 가능 여부는 바꾸지 않는다.
- **Bowl flow**: `gameplayEventBus.on("stray-dog-surge", ...)`를 `create()`에서 구독한다. `stageId === "world-01-stage-boss"`, runtime `play`, `source === "upside-down-bowl"`, `count > 0`, 패배 전일 때 `showBowlAlarm()`과 즉시 발행만 한다. `clang`/`bowl-broken`에도 추가 구독해 중복 경고를 발생시키지 않는다. 방어 charge 및 개 5마리/2.5초의 기존 동작은 바꾸지 않는다.
- **Publishing**:
  - snapshot `active`는 normal/boss 종류 + runtime `play` + 전환/패배 전일 때 true. `barkUnlocked`는 진행 상태에서 조회한다. 남은 시간은 `getRemainingCooldown("bark", skillElapsedMs)`를 `Math.ceil(raw / 100) * 100`으로 올림하여 0.1초 단위로 발행한다. 미해금이면 0. `barkCooldownMs=BARK_COOLDOWN_MS`. 기존 계획의 `BossFeedbackSnapshot`/이벤트 이름은 유지하되 데이터의 쿨타임 부분은 일반 구간에도 사용한다.
  - `warning`은 controller 조회값. inactive snapshot의 warning은 null로 내보내되 일시정지 중 controller 내부 경고는 보존한다.
  - `force` 기본값은 false이며 값이 같아도 발행하는 옵션이다. `forceInactive` 기본값도 false이며 true이면 runtime의 동기 상태와 무관하게 snapshot.active를 false로 만든다.
  - 초기 진입, 성공한 사용, 소환, 경고 만료, pause/resume, reset/shutdown은 즉시 발행한다. 일반 update는 모든 scalar/경고 kind·sequence가 지난 snapshot과 같으면 생략한다. 매 프레임 React를 갱신하지 않는다.
  - controller update는 플레이 프레임의 입력 처리 전에 호출하고 최종 snapshot은 입력/보스 update 후 발행한다.
- **Lifecycle**:
  - `setPaused(true)`는 camera `shakeEffect.reset()`을 호출하고 inactive snapshot을 발행한다. controller 시간과 skillElapsedMs는 정지하며 `resume`은 snapshot을 다시 발행한다. 흔들림은 재시작하지 않는다.
  - gameplay `death`·`restart` 구독에서 reset 및 쿨타임 초기화. `handleCalicoDefeat()`가 runtime을 cutscene으로 바꾸는 지점과 shutdown에서도 전체 상태를 정리하고 inactive snapshot을 보낸다. 다른 비일시정지 비플레이 상태에서는 `clearWarning()`과 흔들림 정리만 수행해 일시적인 컷신이 도전 횟수를 초기화하지 않게 한다.
  - `resetBossFeedback()`은 controller/쿨타임/시간/마지막 snapshot을 초기화하고 흔들림을 종료하며 직접 발행하지 않는다. death·shutdown에서는 `resetBossFeedback(); publishBossFeedback(true, true)` 순서로 아직 runtime이 play인 동기 이벤트에서도 inactive를 보장한다. create·restart는 reset 후 현재 runtime에 따라 별도 발행한다.
  - 새 구독 해제 함수는 기존 `eventUnsubscribers`에 보관한다. shutdown에서 버스를 정리하기 전에 inactive snapshot을 보낸다. `StageScene` 인스턴스가 재사용되므로 create에서도 상태를 초기화한다.

### I04. 검증
- Related Files:
  - `scripts/boss-feedback.test.mjs` — new
  - `scripts/bowl-defense.test.mjs`, `scripts/bark-boss-stun.test.mjs` — read-only regression
- 기존 bowl-defense 테스트의 TypeScript CommonJS transpile require hook을 재사용해 순수 controller, `SkillSystem`과 `SKILL_DEFINITIONS`를 로드한다. Player 대신 `setAnimationState` 등을 기록하는 최소 객체를 전달한다.
- 잠긴 짖기 거절, 0ms 성공/9999ms 거절/10000ms 성공, 쿨타임 초기화 후 해금 유지, 성공 때만 count 호출하는 연동을 검사한다.
- 3·6회만 record 결과 true, 다른 skill/거절 입력은 연결부에서 제외, 보스 명중 여부와 무관한 사용 횟수를 확인한다.
- 경고 교체·sequence 증가·2500ms 만료·음수/비정상 delta·reset 후 첫 두 번 미발동을 검사한다.
- 실제 일시정지 clock·Scene 수명주기·카메라 흔들림 검증은 T02 브라우저에서 함께 수행한다. 이번 Task에서 해당 동작을 구현해 둔다.
- 일반 스테이지에서는 accepted 사용과 10초 cooldown이 동일하게 동작하고, snapshot active=true/미해금 여부가 정확하며 경고 횟수는 누적하지 않는 것을 확인한다. 전환 후 이전 스테이지 snapshot이 UI에 남지 않도록 종료 알림을 검증한다.

## Acceptance Criteria
- [x] 짖기 공통 쿨타임이 실제 10000ms이며 일시정지 중 감소하지 않는다.
- [x] 일반 장애물 구간에서도 해금한 짖기를 사용할 수 있고 실제 쿨타임 snapshot이 전달된다.
- [x] 보스전 성공 사용 3·6·9회만 사레 경고/800ms 강한 흔들림을 발생시킨다.
- [x] 사레가 코기 이동·체력·기존 보스 경직에 추가 제약을 주지 않는다.
- [x] 기존 강아지 소환 시 밥그릇 경고 상태를 한 번 발생시킨다.
- [x] pause·death·victory·restart·shutdown 상태가 정리되고 새 UI 이벤트가 동작한다.

## Validation
- `node --test scripts/boss-feedback.test.mjs scripts/bowl-defense.test.mjs scripts/bark-boss-stun.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js src/game/data/skills.ts src/game/systems/SkillSystem.ts src/game/systems/bossFeedback.ts src/game/stages/stageEvents.ts src/game/scenes/StageScene.ts scripts/boss-feedback.test.mjs`

## Commit Message
```text
feat(game): 보스전 짖기 쿨타임과 경고 상태 연결

Plan: 2026-10-19-boss-bark-cooldown-and-warnings
Phase: P01-boss-feedback
Task: T01-boss-feedback-runtime

- 짖기 10초 쿨타임과 보스전 세 번째 사용 경고·흔들림 추가
- 기존 밥그릇 소환 경고 연결과 일시정지·재도전 상태 정리
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in git history
