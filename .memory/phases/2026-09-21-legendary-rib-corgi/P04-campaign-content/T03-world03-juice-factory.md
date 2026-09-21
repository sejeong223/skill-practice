# Task: T03 월드 3 무한 육즙 공장·세 번째 간부

## Status: pending

## Goal

왕갈비뼈 독점 계획의 생산 거점인 무한 육즙 공장 4개 스테이지와 세 번째 고양이 간부를 구현하고, 보스 처치 후 수평 돌진 스킬을 해금한다.

## Decision Summary

- 월드 3은 육즙 파이프, 압력솥, 컨베이어, 고기 상자와 위험한 생산 라인을 사용한다.
- 물기는 근거리 적 처리와 스위치 물기 상호작용을 제공하지만, 잘못 문 물체가 튕겨나가거나 압력 장치를 발동할 수 있다.

## Implementation

### I01. 월드·스테이지 데이터

- Related Files:
  - src/game/data/worlds/world-03.ts :: WORLD_03_DEFINITION — new
  - src/game/data/stages/world-03.ts :: WORLD_03_STAGES — new
  - src/game/data/bosses/siamese.ts :: SIAMESE_BOSS — new

#### Details

- Stage IDs and titles:
  - world-03-stage-1: 육즙 공장 입구
  - world-03-stage-2: 고기 컨베이어 구역
  - world-03-stage-3: 압력솥 통로
  - world-03-stage-4: 왕갈비뼈 포장 라인
  - world-03-stage-boss: 품질관리실
- 일반 스테이지는 heat vent, conveyor, dripping grease, moving crate, fake switch를 조합하고 checkpoint 1개와 수집품 3개를 넣는다.
- 일부 스위치는 bite로만 활성화되며, wrong bite target은 압력솥·컨베이어·육즙 폭발을 일으킨다.

### I02. 샴 고양이 보스

- Related Files:
  - src/game/data/bosses/siamese.ts :: SiameseBossController — new

#### Details

- 보스는 품질관리 도장과 컨베이어 방향을 바꿔 arena geometry를 변형한다.
- Phase 1은 short-range bite punish, phase 2는 육즙 압력 분출, phase 3은 가짜 안전 벨트가 플레이어를 반대 방향으로 운반한다.
- 보스 처치 보상은 dash이며, 다음 월드의 폭풍 바람과 긴 낙하 구간을 돌파하는 데 필수다.

## Acceptance Criteria

- [ ] 4개 공장 스테이지와 샴 고양이 보스가 완주 가능하다.
- [ ] bite가 적 공격과 환경 스위치 상호작용에 모두 쓰인다.
- [ ] 잘못된 상호작용이 즉사 또는 심각한 knockback으로 이어진다.
- [ ] dash 해금이 저장되고 월드 4에서 사용 가능하다.

## Validation

- npm run lint — world 3 data와 boss phase 타입 통과
- npm run build — factory assets/data registry 통과
- npm run dev — conveyor, grease, pressure trap, Siamese boss, dash reward 수동 확인

## Commit Message

~~~text
feat(content): build world three infinite juice factory

Plan: 2026-09-21-legendary-rib-corgi
Phase: P04-campaign-content
Task: T03-world03-juice-factory

- Add factory hazards, bite switches and pressure traps
- Add Siamese quality-control boss and dash reward
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
