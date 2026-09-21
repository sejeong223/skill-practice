# Task: T02 World 2 놀이터 관리실 보스 맵

## Status: pending

## Goal

World 2의 전용 보스 장소인 놀이터 관리실을 구현하고, 고등어 보스가 놀이기구 전원과 경보 시스템을 조작하도록 만든다. 보스 처치 후 bite 해금과 뒷산 진입을 연결한다.

## Decision Summary

- 보스는 1,920px, 진입·전투·마무리 3구역, checkpoint 없음이다.
- 보스 아레나는 관리실 내부의 제어 패널, 고장난 놀이기구, 닫히는 안전문을 사용한다.
- World 1의 일부 사물 배신을 관리실의 스위치·경보 변형으로 재사용한다.

## Implementation

### I01. 관리실 아레나와 고등어 패턴

- Related Files:
  - src/game/data/worlds.ts :: world-02 boss definition; modify
  - public/assets/pixel/maps/world-02/world-02-boss.json; new
  - public/assets/pixel/props/world-02/management-office/*; new

#### Details

- boss stage title은 놀이터 관리실, arenaStageId는 world-02-stage-boss로 유지한다.
- phase 1은 제어 패널을 건드릴 때마다 그네·시소·미끄럼틀 중 하나가 켜지는 패턴으로 만든다.
- phase 2는 관리실 전체 경보와 닫히는 안전문을 사용하되, 보스 피해 판정과 이동 방해를 분리한다.
- 배경 소품으로 World 2의 놀이기구와 World 1의 맨홀 표식을 보여주지만 상호작용 대상은 명시된 object만 둔다.

### I02. 월드 연결과 reward skill

- Related Files:
  - src/game/data/cutscenes/worlds.ts :: world-02 boss clear; modify
  - src/game/data/skills.ts or progression integration :: bite reward; modify only if required
  - src/game/scenes/StageScene.ts :: boss completion route; modify only if required

#### Details

- boss clear는 bite 해금 이벤트를 emit하고 world-03-stage-1로 이동한다.
- 보스 맵에서 collectible과 checkpoint는 만들지 않는다.
- 관람 가능한 왕갈비뼈 관련 소품은 보스 사용 도구가 아니며 pickup collider를 만들지 않는다.

## Acceptance Criteria

- [ ] 놀이터 관리실 보스 아레나가 1,920px로 실행된다.
- [ ] 고등어 phase 1·2가 놀이기구와 경보를 연쇄 작동시킨다.
- [ ] 처치 후 bite 해금과 World 3 진입이 연결된다.
- [ ] 보스 아레나에 checkpoint가 생성되지 않는다.

## Validation

- npm run lint
- npm run build
- World 2 일반 스테이지 → 관리실 → bite 해금 → World 3 흐름 확인

## Commit Message

feat(map): add world two management office arena

Plan: 2026-09-21-world-map-design
Phase: P03-world02-playground
Task: T02-world02-boss

- Add mackerel boss arena with playground control chains
- Connect boss clear to bite unlock and world three entry

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
