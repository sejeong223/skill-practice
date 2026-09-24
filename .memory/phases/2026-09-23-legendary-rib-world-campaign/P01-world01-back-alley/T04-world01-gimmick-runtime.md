# Task: T04 World 1 기믹 런타임과 조작 파훼

## Status: done

## Goal

Tiled 기믹을 실제 플레이 규칙으로 연결해, 처음에는 힌트 없이 죽고 재시도에서 정확한 조작으로만 살아남을 수 있게 한다. 특히 강제 제어·가짜 보상·가짜 체크포인트가 일반 trap overlap과 혼동되지 않도록 별도 runtime 상태와 사망 흐름을 사용한다.

## Decision Summary

- 공통 runtime은 World 2~5에서도 재사용하고, World 1의 좌표·trigger·counterplay만 데이터로 주입한다.
- 기믹이 발생해도 스킬·공격 도구·방어 도구의 사용 가능 여부가 맵 통과 판정을 바꾸지 않는다.
- 실패는 `death-requested`로 통합하지만 `gimmickId`와 outcome을 함께 기록해 사망 카운트 화면에서 원인을 추적할 수 있게 한다.

## Implementation

### I01. Gimmick runtime system

- Related Files:
  - `src/game/systems/MapGimmickSystem.ts` :: `MapGimmickSystem`; new
  - `src/game/scenes/StageScene.ts` :: create/update/shutdown; modify
  - `src/game/stages/StageRuntime.ts` :: map gimmick access/reset; modify
  - `src/game/maps/MapInteractionSystem.ts` :: player trigger and chain action bridge; modify

#### Details

- 생성자는 `(scene, player, inputManager, stage, map, gameplayEventBus, mapInteractionSystem)`을 받고 `update(time, delta)`, `reset(snapshot)`, `getState(gimmickId)`, `destroy()`를 제공한다.
- `walk-enter`는 player body center와 trigger rectangle의 첫 교차 시 한 번만 발동한다. `forward` 방향은 `player.flipX === false` 및 `body.velocity.x > 0`으로 판정한다.
- `forward-jump-wall`은 trigger zone에서 jumpPressed와 forward 조건이 동시에 성립할 때 보이지 않는 collision body를 활성화한다. 충돌 시 `velocityX=-420`, `velocityY=-760`으로 튕기고 fall/death outcome을 예약한다. 뒤로 이동 중 점프는 활성화하지 않는다.
- `ground-collapse`는 접근 즉시 바닥 collision을 끄고 player가 공중에 있지 않은 경우 즉사시킨다. trigger 위를 점프로 통과하면 chain을 소비하지 않고 살아남는다.
- `ground-rise`는 enter 후 정확히 `1000ms` 뒤 target collision을 켠다. active window에 player body가 있으면 즉사한다. `micro-forward-then-back`은 입력을 요구하지만 자동 보정하지 않는다.
- `revealed-white-spike`는 trigger 이전에는 visual과 collision을 비활성화하고, player가 지정 x에 진입한 프레임에만 활성화해 즉사시킨다.
- `jump-pigeon`은 지정 zone 안에서 jumpPressed가 들어온 경우에만 비둘기 entity를 spawn하고 즉사한다. 점프하지 않고 통과하면 안전하다.

### I02. 가짜 코인·가짜 체크포인트·통제불능

- Related Files:
  - `src/game/entities/Player.ts` :: control override/tint API; modify
  - `src/game/systems/PlayerController.ts` :: override update and input mash; modify
  - `src/game/input/InputManager.ts` :: Space press sample; modify only if required
  - `src/game/systems/DeathSystem.ts` :: gimmick context and death accounting; modify
  - `src/game/core/events.ts` :: outcome payload integration; modify

#### Details

- Player API는 `startControlOverride(kind, durationMs, sourceId)`, `registerEscapePress(sourceId)`, `clearControlOverride(sourceId)`, `setGimmickTint(color | null)`을 제공한다.
- `fake-bone-green`은 collectible overlap 후 몸을 초록색으로 tint하고 `deathDelayMs` 뒤 scripted death를 요청한다. 실제 coin bank에는 추가하지 않는다.
- `fake-bone-reverse`는 collect 후 `drift-backward` override를 걸어 왼쪽으로 계속 밀고, 화면 밖 x 경계 이탈 시 death를 요청한다. 좌우 입력은 override 중 무시한다.
- `fake-bone-fire`는 collect 후 엉덩이 불꽃 variant와 `launch-up` override를 적용하고 map top boundary를 이탈할 때 launch-death를 요청한다.
- `fake-checkpoint`는 깃발에 닿는 순간 가시를 활성화하고 즉사시키며 `CheckpointSystem.activate`와 map snapshot 생성을 호출하지 않는다.
- `name-bubble-control-loss`는 왼쪽에서 지정 player name 말풍선을 표시하고 `run-left` override를 건다. `jumpPressed`가 들어올 때마다 1회 증가시키며 `100회` 전에 deadline을 넘기면 death, 100회면 override를 해제한다. 이 연출은 허용된 말풍선 UI이며 별도 도움말은 표시하지 않는다.
- `DeathContext`와 `death`, `death-requested` payload에 `gimmickId?: string`과 `outcome?: GimmickOutcome["kind"]`를 추가하고, 기존 death count·checkpoint restart·coin reset 계약은 유지한다.

### I03. 진짜 체크포인트와 재시작 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: checkpoint overlap; modify
  - `src/game/systems/CheckpointSystem.ts` :: fake checkpoint exclusion and map snapshot; modify
  - `src/game/systems/RestartController.ts` :: control override cleanup; modify

#### Details

- `CheckpointSystem.activate`는 object property 또는 resolved gimmick kind가 `fake-checkpoint`면 false를 반환한다.
- 진짜 checkpoint만 `MapRuntimeSnapshot`과 random seed를 저장하며, 사망 후 복구 시 발동된 기믹 상태를 snapshot 기준으로 복원한다.
- restart 시 `Player.clearAllControlOverrides()`를 먼저 호출해 이전 사망의 강제 이동이 새 시도에 누출되지 않게 한다.
- map bounds 밖 사망과 gimmick 사망 모두 기존 checkpoint 또는 spawn으로 돌아가며, current stage coins는 0으로 리셋한다.

## Acceptance Criteria

- [ ] 13개 World 1 기믹 종류가 각각 정의된 trigger와 outcome으로 실행된다.
- [ ] 전진 시작 시 개미, 전방 점프 시 투명 벽, 점프 시 비둘기처럼 방향·입력 조건이 정확히 구분된다.
- [ ] Space 100회 탈출이 성공하면 살고, 제한 초과 시 사망하며 재시작 때 카운터가 초기화된다.
- [ ] 가짜 코인과 가짜 checkpoint가 보상·snapshot을 생성하지 않는다.
- [ ] 스킬·도구 없이도 각 기믹의 counterplay가 입력만으로 가능하다.
- [ ] 동일 seed 재시작에서 기믹 위치와 결과가 재현된다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- 개발 실행에서 각 기믹 trigger를 수동 호출해 event payload와 사망 원인을 확인
- input trace로 `run-left` 상태에서 Space 99회/100회/101회를 각각 재현

## Commit Message

```text
feat(gameplay): 월드1 억까 조작과 즉사 런타임 구현

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T04-world01-gimmick-runtime

- Implement hidden direction-sensitive gimmicks and control overrides
- Preserve checkpoint snapshots while separating fake rewards and fake flags
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (`npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run world01:maps:check`)
- commit: `feat(gameplay): 월드1 억까 조작과 즉사 런타임 구현`
