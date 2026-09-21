# Task: T02 World 1 냥아치 초소 보스 맵

## Status: pending

## Goal

World 1의 보스 장소를 냥아치 초소 전용 아레나로 만들고, 턱시도 고양이의 보스 패턴과 World 2 놀이터 진입을 연결한다. 왕갈비뼈는 보스전 도구가 아니라 배경의 목표물로만 표시한다.

## Decision Summary

- 보스 맵은 약 1,920px 전용 아레나, 진입·전투·마무리 3구역, checkpoint 없음이다.
- 보스 패턴은 주거지 사물과 냥아치 초소 방어시설을 이용한다.
- 처치 후 rewardSkill은 기존 순서대로 bark이며, 다음 월드로 선형 이동한다.

## Implementation

### I01. 보스 아레나 맵과 환경 오브젝트

- Related Files:
  - src/game/data/worlds.ts :: world-01 boss stage and boss definition; modify
  - public/assets/pixel/maps/world-01/world-01-boss.json; new
  - public/assets/pixel/props/world-01/tuxedo-outpost/*; new
  - src/game/data/cutscenes/worlds.ts :: world-01 boss transition; modify if required

#### Details

- boss stage title은 냥아치 초소, mapWidth는 1920, checkpointIds는 빈 배열로 유지한다.
- arena sections는 boss-entry, boss-fight, boss-clear이며 fight section에만 lethal environmental chain을 둔다.
- 턱시도 보스 뒤쪽이나 옥상 배경에 legendary rib prop을 배치하되 collision과 pickup interaction을 만들지 않는다.
- 공통 아레나 골격에 낮은 발판, 담벼락, 실외기, 닫히는 초소문, 낙하 간판을 배치한다.

### I02. 보스 패턴과 완료 연결

- Related Files:
  - src/game/data/worlds.ts :: BOSS_DEFINITIONS world-01; modify
  - src/game/scenes/StageScene.ts or boss runtime integration; modify
  - src/game/data/cutscenes/worlds.ts :: intro and clear beats; modify

#### Details

- phase 1은 예측 가능한 것처럼 보이는 3-hit combo, phase 2는 arena-wide cat ambush로 정의한다.
- 보스 환경 체인은 hit event → outpost sign shake → platform state change처럼 한 번에 하나의 주요 이동 방해만 발생하게 한다.
- boss clear event는 bark 해금과 world-02-stage-1 이동을 요청하며, arena의 rib prop은 변하지 않는다.
- 보스 사망 후 checkpoint나 current-stage coin을 일반 맵 규칙으로 생성하지 않는다.

## Acceptance Criteria

- [ ] 냥아치 초소 보스 맵이 1,920px 전용 아레나로 렌더링된다.
- [ ] checkpoint가 없고 세 구역의 보스 연출이 실행된다.
- [ ] 턱시도 phase 1·2와 환경 체인이 동작한다.
- [ ] 왕갈비뼈는 보이기만 하고 전투·획득·스킬 입력에 사용되지 않는다.
- [ ] 보스 처치 후 bark 해금과 World 2 연결이 기존 progression event를 통해 발생한다.

## Validation

- npm run lint
- npm run build
- World 1 네 일반 맵에서 boss map으로 진입하는 수동 흐름 확인
- boss intro, phase transition, boss clear, bark unlock 이벤트 확인

## Commit Message

feat(map): add world one tuxedo outpost arena

Plan: 2026-09-21-world-map-design
Phase: P02-world01-back-alley
Task: T02-world01-boss

- Add tuxedo outpost arena and residential boss chains
- Connect boss clear to bark unlock and world two entry

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
