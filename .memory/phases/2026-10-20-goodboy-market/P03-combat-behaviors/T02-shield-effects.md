# Task: T02 새 방패 4종의 고유 방어

## Status: done

## Goal

선택한 방패의 방어 횟수와 범위를 실제 삼색이 공격에 적용하고, 기본 밥그릇의 강아지 소환 경보가 다른 방패에서 잘못 발동하지 않게 한다.

## Decision Summary

- 기본 `upside-down-bowl`은 기존 3회 방어 후 깨짐·동네 강아지 소환 연출을 유지한다.
- 신규 방패는 코기 정면에 표시되고 자동 방어하지만 월드 2의 점프 장애물·잠자는 고양이 즉사는 방어하지 않는다.

## Implementation

### I01. 도구별 방어 정책

- Related Files:
  - `src/game/systems/DefenseToolSystem.ts` :: `resetForStage`, `setDefenseTool`, `tryBlock`; modify
  - `src/game/systems/World01CalicoBoss.ts` :: `updateFishbone`, `resetAttempt`; modify
  - `src/game/systems/StrayDogEvent.ts` :: `bowl-broken` 구독 조건; modify
  - `src/game/core/events.ts` :: 일반 `shield-blocked`, `shield-broken` 또는 기존 이벤트 확장; modify
  - `src/game/data/tools.ts` :: 4종 charges/effect/drawback; modify if needed
  - `scripts/goodboy-shields.test.mjs` :: 정면/후면/횟수/경보 테스트; new

#### Details

- **Signatures & Types**: `IncomingAttack`에 `sourceX: number` 또는 `direction: -1 | 1` 필드를 추가해 정면 판정을 만든다. `DefenseResult = { blocked: boolean; reason: "blocked" | "broken" | "not-weak" | "no-charges" | "wrong-direction" | "unsupported-kind"; remainingCharges: number; toolId: ToolId }`. `DefenseToolSystem.getToolId(): ToolId`를 제공하고 `resetForStage(progress.equippedDefenseToolId)`로 재도전한다. 방어 횟수는 `TOOL_DEFINITIONS.charges`에서 읽는다.
- **Data & Schema Fields**: `cushion-pad`(10코인) 정면 약한 공격 2회 방어, 두 번째 후 옆으로 24px 밀림과 기존 `cushion-side-bounce` ID; `greasy-pizza-box`(13) 2회 방어, 매 방어 뒤 350ms 미끄러짐; `umbrella`(15) 정면 약한 투사체 2회 방어, 후면은 통과; `yellow-pot-lid`(18) 3회 방어, 방어 시 삼색이 다음 투척 250ms 지연, 마지막 방어 뒤 400ms 약한 귀울림 시각 효과. 각 방패의 `hiddenDrawbackId`가 실제 발동 때 `drawback-triggered`에 일치해야 한다.
- **Execution Flow / Logic**: 보스 가시의 이동 방향과 코기 `flipX`로 정면 여부 판단 → 선택 방패 kind/charges 검증 → 성공 시 횟수 1 감소, 해당 방패 전용 이벤트/연출 발행 → 0이 되면 방패 그림 숨김. `bowl-broken`은 `toolId === "upside-down-bowl"`일 때만 내보낸다. `StrayDogEvent`도 tool ID를 확인한다. 새 방패는 동네 개 경보를 발생시키지 않는다.
- **Error & Exception Handling**: 보스가 아닌 `hazard`/`lethal-trap`은 방패로 막지 않는다. 컷신·상점 일시정지에는 방어 횟수와 시각 타이머가 흐르지 않는다. 장비 교체/리스폰은 선택한 방패의 초기 횟수로 재설정하되 구매 상태를 변경하지 않는다.

### I02. 보스·장비 표시 통합

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `DefenseToolSystem` 초기화·장비 변경·재도전; modify
  - `src/game/entities/BowlShieldVisual.ts` :: 밥그릇 전용 표시; modify if needed
  - `src/game/entities/EquipmentVisual.ts` :: 일반 방패 소모 상태 표시; modify
  - `src/game/systems/DrawbackDiscovery.ts` :: P03-T01 생성 인스턴스 사용; read-only

#### Details

- 보스 입장 때 `progress.equippedDefenseToolId`를 강제 초기화하지 않는다. P02 전면 방패 파츠는 남은 방어 횟수가 0이면 숨기고, 기본 밥그릇은 기존 `BowlShieldVisual`와 겹치지 않는다. 뒤집혀 있는 방패 이미지나 사용 후 유령 이미지가 없어야 한다. 기존 밥그릇 경고의 옅은 빨간 배경과 문구는 그대로 동작한다.

## Acceptance Criteria

- [x] 4종 방패 각각 정해진 횟수·정면 조건·단점대로 방어하고 장비 이미지는 코기 앞에 놓인다.
- [x] 기본 밥그릇 3번째 방어만 동네 강아지를 부르고 다른 방패는 부르지 않는다.
- [x] 보스 재도전/장비 변경/일시정지 후 방어 횟수·장착 상태가 맞다.

## Validation

- `node --test scripts/goodboy-shields.test.mjs scripts/bowl-defense.test.mjs scripts/boss-feedback.test.mjs` — 신규 효과·기존 경보 회귀.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- 브라우저에서 4종 방패로 삼색이 가시를 막고 월드 2 장애물 즉사 유지 확인.

## Commit Message

```text
feat(전투): 상점 방패 네 종류의 방어 효과와 단점 구현

Plan: 2026-10-20-goodboy-market
Phase: P03-combat-behaviors
Task: T02-shield-effects

- 방패마다 다른 방어 횟수와 정면 조건 적용
- 밥그릇 강아지 경보가 다른 방패에 번지지 않게 분리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `dc618fe`
