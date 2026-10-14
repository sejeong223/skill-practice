# Task: T03 짖기로 삼색이 보스 공격 일시 정지

## Status: done

## Goal

이미 짖기를 배운 상태에서 월드 1 삼색이 보스와 다시 싸울 때, 가까운 거리의 유효한 짖기가 진행 중인 공격을 중단하고 보스 공격 패턴을 잠시 멈추게 한다. 해금 안내의 효과 설명을 실제 동작과 맞춘다.

## Decision Summary

- 현재 공격 패턴이 구현된 보스는 `World01CalicoBoss`뿐이다. 이후 보스 전투는 구현될 때 짖기 연결을 추가하며, 이번 Task에서 새 월드 2 보스 전투나 재도전 메뉴를 만들지 않는다.
- 320px 내에서 성공한 짖기는 현재 텔레그래프·생선 가시·소환견 공격을 중단하고 1200ms간 새 공격을 막는다. 보스 재경직 대기시간은 3000ms다. 짖기 자체의 기존 900ms 쿨다운과 보스 HP·공격 수치는 유지한다.

## Implementation

### I01. 보스 짖기 판정과 시간 상태

- Related Files:
  - `src/game/systems/bossBarkStun.ts` :: 거리·대기시간·경직 시간의 순수 판정; new.
  - `src/game/systems/World01CalicoBoss.ts` :: `World01CalicoBoss.tryBarkStun()`, `update()`, `resetAttempt()`, `stopAttacks()`, `destroy()`; modify.
  - `src/game/systems/SkillSystem.ts` :: `SkillSystem.use()`의 `SkillUseResult.accepted`; read-only.

#### Signatures & Types

```typescript
export interface BossBarkStunState {
  readonly remainingMs: number;
  readonly nextAllowedAt: number;
}
export const BARK_BOSS_RANGE_PX = 320;
export const BARK_BOSS_STUN_MS = 1200;
export const BARK_BOSS_RESTUN_MS = 3000;
export function beginBossBarkStun(
  state: BossBarkStunState,
  now: number,
  distancePx: number,
  active: boolean,
): BossBarkStunState | null;
export function tickBossBarkStun(
  state: BossBarkStunState,
  deltaMs: number,
): BossBarkStunState;

public tryBarkStun(now: number): boolean;
```

#### Data & Schema Fields

- `BossBarkStunState.remainingMs`: 남은 보스 경직 시간(ms), 초기값 `0`, `null` 아님. `nextAllowedAt`: 다음 성공 가능한 Phaser 시각(ms), 초기값 `0`, `null` 아님. 보스 인스턴스에만 저장하고 `ProgressState`에는 넣지 않는다.
- `beginBossBarkStun()`은 `active`이고 `distancePx <= 320`, `remainingMs === 0`, `now >= nextAllowedAt`일 때만 `{ remainingMs: 1200, nextAllowedAt: now + 3000 }`을 반환한다. 아니면 `null`을 반환하고 상태를 바꾸지 않는다.
- `tickBossBarkStun()`은 음수 delta를 0으로 방어하고 `remainingMs`를 최대 `deltaMs`만큼 줄여 0 이하로 내려가지 않게 한다. `nextAllowedAt`은 그대로 둔다.
- 거리 판정은 `Player.body.center`와 삼색이 `sprite.getBounds()`의 중심 사이의 유클리드 거리다. 방향 제한은 없다.

#### Execution Flow / Logic

1. `World01CalicoBoss.tryBarkStun(now)`는 `phase`가 `ready`/`telegraph`/`projectile`인 경우에만 위 순수 판정을 호출한다. `intro`·`defeated`, 멀리 있는 보스, 재경직 대기 중인 보스는 `false`다.
2. 성공하면 `clearFishbone()`으로 기존 투사체를 제거하고 `clearDogs()`로 기존 소환견·코기 조작 잠금을 해제한다. 기존 `warning`은 숨기고 보스 `phase`를 `ready`, `projectileId`를 `null`, `nextThrowAt`을 `this.elapsed + 700`으로 놓는다. 짧은 `당황!` 표시를 보스 위 별도 텍스트로 보여준다. 이 처리는 보스 HP를 감소시키지 않는다.
3. `World01CalicoBoss.update(now, delta)`는 시작 부분에서 남은 경직이 있으면 `tickBossBarkStun()`으로 시간을 줄이고 그 프레임을 끝낸다. 이때 `this.elapsed` 및 신규 텔레그래프/생선 가시/소환견 업데이트가 진행되지 않는다. 마지막 경직 프레임 뒤 표시를 숨기고 다음 프레임부터 기존 패턴을 재개한다. 기존 `Math.min(delta, 50)` 프레임 상한을 경직 감소에도 사용한다.
4. `resetAttempt()`는 경직 시간·재경직 대기·표시를 지우고 기존 보스 체력/공격 초기화 흐름을 유지한다. `stopAttacks()`는 처치 시 표시를 숨기며 `destroy()`는 새 텍스트를 파괴한다. 경직 중 슬리퍼 공격으로 보스를 처치할 수 있다.

### I02. 성공한 기술 사용만 보스에 전달

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `StageScene.update()`의 `barkPressed` 분기; modify.
  - `src/game/systems/World01CalicoBoss.ts` :: 공개 `tryBarkStun()` 호출 대상; modify.
  - `src/game/core/events.ts` :: `skill-used` 이벤트 계약; read-only.

#### Signatures & Types

```typescript
interface SkillUseResult {
  skillId: SkillId;
  accepted: boolean;
  reason: "used" | "locked" | "cooldown";
  remainingCooldownMs: number;
}
```

#### Data & Schema Fields

- 기존 `progress.unlockedSkills.includes("bark")`와 `SkillSystem.use("bark", time)`를 유지한다. 새 저장 필드, 새 키 바인딩, 다른 보스 ID 분기는 추가하지 않는다.

#### Execution Flow / Logic

1. 기존 `barkPressed` 분기에서 `const result = this.skillSystem?.use("bark", time)`를 받는다.
2. `result?.accepted === true`일 때만 현재 `calicoBoss?.tryBarkStun(time)`을 호출한다. 거리 밖에서는 기술 자체의 애니메이션·쿨다운은 소비하되 보스 상태는 바꾸지 않는다.
3. `calicoBoss`가 없는 일반 스테이지에서는 기존 기술 사용 경로를 유지한다. 후속 보스는 전투가 구현될 때 같은 성공 사용 지점에 연결한다.

### I03. 경직 회귀 검사

- Related Files:
  - `scripts/bark-boss-stun.test.mjs` :: 순수 시간·거리 판정 테스트; new.
  - `scripts/fishbone-trajectory.test.mjs` :: 기존 생선 가시 패턴 회귀; read-only.

#### Details

- Node의 기존 `--experimental-strip-types` 테스트 방식으로 `bossBarkStun.ts`를 가져온다.
- 범위 경계 `320` 허용/`321` 거부, `intro`·`defeated`에서 `active=false` 거부, 첫 성공 뒤 `3000ms` 이내 연타 거부, 정확히 대기시간이 끝난 시점 허용을 검사한다.
- 50ms 프레임 24회 후 `remainingMs=0`이 되는지, 음수/큰 delta에도 음수가 되지 않는지, `nextAllowedAt`이 경직 tick 중 변하지 않는지 검사한다.
- 실제 Phaser 플레이에서는 이미 `bark`가 해금된 진행 상태로 `world-01-stage-boss`를 직접 시작해 L 키로 텔레그래프 중단, 생선 가시/소환견 제거, 코기 조작 잠금 해제, `당황!` 표시, 다음 공격 재개, 멀리서 사용·연타 실패, 사망 후 재시작 초기화를 확인한다.

## Acceptance Criteria

- [ ] 가까운 유효 짖기는 삼색이의 진행 중 공격을 끊고 1.2초 동안 신규 공격을 막는다. 해당 보스의 재경직은 성공 후 3초 동안 일어나지 않는다.
- [ ] 생선 가시와 소환견이 중단될 때 코기 조작 잠금도 해제된다. 보스 체력·슬리퍼 타격 횟수·기술 쿨다운은 변하지 않는다.
- [ ] 멀리서 사용, 미해금·쿨다운 중 사용, 보스 등장 전/처치 후 사용은 보스 공격 상태를 바꾸지 않는다.
- [ ] 재시작·처치·Scene 종료 때 경직 상태와 표시가 남지 않는다.

## Validation

- `node --experimental-strip-types --test scripts/bark-boss-stun.test.mjs scripts/fishbone-trajectory.test.mjs` — 범위·시간 경계와 기존 투사체 계산 통과.
- `npx.cmd eslint src/game/systems/bossBarkStun.ts src/game/systems/World01CalicoBoss.ts src/game/scenes/StageScene.ts scripts/bark-boss-stun.test.mjs` — 관련 파일 린트 통과.
- `npx.cmd tsc --noEmit` — 보스 상태·기술 결과 타입 검사 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- 개발 실행의 삼색이 전투에서 L 입력으로 공격 중단·재개와 사망 후 초기화를 육안 확인한다. 현재 사용자용 재도전 버튼이 없으므로 검증에는 해금된 진행 상태를 주입한 개발 경로를 사용한다.

## Commit Message

```text
feat(world01): 짖기로 삼색이 공격을 잠시 중단

Plan: 2026-10-14-world01-bark-unlock-and-korean-skills
Phase: P01-skill-ui-and-bark
Task: T03-bark-boss-stun

- 유효한 짖기에 보스 경직과 공격 중단 연결
- 거리와 재경직 시간 및 초기화 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (경계·생선 가시 테스트 5건, eslint, TypeScript, build, 보스 통합 하네스)
- commit: `87a31eb`
