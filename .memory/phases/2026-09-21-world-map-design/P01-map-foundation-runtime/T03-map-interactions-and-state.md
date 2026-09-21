# Task: T03 맵 연쇄 상호작용과 상태 스냅샷

## Status: done

## Goal

Tiled 오브젝트의 조건→반응 규칙을 실행하는 MapInteractionSystem을 추가하고, 고정 패턴·시드 기반 변형·연쇄 이벤트·체크포인트 복구 상태를 하나의 런타임 계약으로 묶는다. 스킬과 도구를 맵 이동 입력으로 연결하지 않는다.

## Decision Summary

- 대부분의 함정은 고정이고 일부 변형만 stage attempt seed로 선택한다.
- 체크포인트 재시작은 현재 seed를 유지하며, 맵 오브젝트는 체크포인트 스냅샷으로 완전 복구한다.
- 도구와 스킬은 맵 이동이나 필수 지형 개방에 사용하지 않는다.

## Implementation

### I01. 맵 이벤트 타입과 규칙 실행기

- Related Files:
  - src/game/core/events.ts :: GameplayEventMap; modify
  - src/game/stages/stageEvents.ts :: StageEventMap; modify
  - src/game/maps/MapInteractionSystem.ts :: MapInteractionSystem; new
  - src/game/maps/MapRuleRegistry.ts :: MapRuleRegistry; new

#### Details

- GameplayEventMap에 map-object-triggered, map-chain-fired, map-object-state-changed, map-reset 이벤트를 추가한다.
- MapInteractionSystem 생성자는 scene, player, gameplay event bus, stage id, StageRandom, loaded map을 받는다.
- registerRules(rules), update(time, delta), triggerObject(objectId, trigger), fireChain(chainId), reset(snapshot) 메서드를 제공한다.
- 조건은 sourceId, requiredState, probability, sectionRole, attemptSeedGroup로 평가한다.
- 액션은 오브젝트 활성/비활성, 위치 이동, 적 스폰, 충돌 토글, 카메라 효과, 사용자 정의 gameplay 이벤트 emit만 허용한다.
- skill-used, clang, bowl-broken 등의 도구·스킬 이벤트를 맵 이동 규칙의 trigger로 등록하지 않는다.

### I02. 시드 기반 변형 규칙

- Related Files:
  - src/game/random/StageRandom.ts :: fork or scoped random helper; modify
  - src/game/stages/StageRuntime.ts :: resolved map rules; modify
  - src/game/core/runtimeTypes.ts :: MapRuntimeSnapshot; new type

#### Details

- StageRandom은 stage id와 attempt를 기반으로 하며 object의 seedGroup마다 독립적인 하위 스트림을 생성한다.
- randomized=false인 rule과 object는 모든 재시도에서 동일해야 한다.
- randomized=true인 rule은 stage restart에서만 새 attempt seed를 받고 checkpoint restart에서는 같은 선택을 재사용한다.
- MapRuntimeSnapshot은 checkpointId, randomSeed, activeObjectStates, movedObjectPositions, spawnedEntityIds, firedChainIds를 포함한다.

### I03. 체크포인트 스냅샷 및 복구

- Related Files:
  - src/game/systems/CheckpointSystem.ts :: snapshot lifecycle; modify
  - src/game/systems/RestartController.ts :: restart mode; modify
  - src/game/stages/StageRuntime.ts :: restartFromCheckpoint, restartStage; modify

#### Details

- StageRuntime.restartFromCheckpoint()은 currentStageCoins를 0으로 만들고, checkpointId와 randomSeed는 유지하며, MapRuntimeSnapshot으로 동적 상태를 복원한다.
- StageRuntime.restartStage()는 attempt를 증가시키고 checkpoint를 초기화하며 새 randomSeed를 만든다.
- 두 restart 경로 모두 기존 entity instance를 안전하게 destroy하고 다시 build하되, checkpoint restart는 동일 seed로 같은 변형을 재구성한다.
- checkpoint 이전에 수집한 current-stage coin은 기존 경제 규칙대로 잃는다. bankedCoins는 건드리지 않는다.

## Acceptance Criteria

- [ ] Tiled chainId와 variant 속성으로 2개 이상의 연쇄 액션을 실행할 수 있다.
- [ ] stage restart는 랜덤 변형을 바꾸고 checkpoint restart는 같은 변형을 유지한다.
- [ ] 움직인 오브젝트, 소환 적, fired chain이 checkpoint 상태로 복원된다.
- [ ] 맵 시스템이 스킬·도구 입력을 이동 경로 해금 조건으로 사용하지 않는다.
- [ ] 이벤트 listener dispose와 scene shutdown에서 모든 규칙이 해제된다.

## Validation

- npm run lint
- npm run build
- 개발용 샘플에서 object-enter → move-object → spawn-enemy 체인을 실행
- 같은 seed로 두 번 checkpoint restart했을 때 resolved variant와 snapshot state가 같은지 확인

## Commit Message

feat(map): add seeded interaction chains and snapshots

Plan: 2026-09-21-world-map-design
Phase: P01-map-foundation-runtime
Task: T03-map-interactions-and-state

- Execute Tiled condition-action chains
- Preserve seeded variants and restore dynamic map state at checkpoints

## Progress

- [x] 구현 완료
- [x] 검증 통과: npm.cmd run lint, npm.cmd run build
- commit: pending
