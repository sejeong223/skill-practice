# Task: T02 World 5 최종 보스와 엔딩 맵

## Status: pending

## Goal

캣타워 최상층의 우두머리의 옥좌 전용 아레나를 구현하고, 왕갈비뼈가 보이기만 하는 최종 보스전과 기존 엔딩 컷신·크레딧 흐름을 연결한다.

## Decision Summary

- 최종 보스는 전체 고양이 패거리의 우두머리다.
- 왕갈비뼈는 보스전에서 사용하지 않고 아레나 배경 prop으로만 보인다.
- 보스 맵은 1,920px, 3구역, checkpoint 없음이며, 보스 클리어 뒤 집으로 돌아가는 엔딩으로 연결된다.

## Implementation

### I01. 우두머리의 옥좌 아레나

- Related Files:
  - src/game/data/worlds.ts :: world-05 boss definition; modify
  - public/assets/pixel/maps/world-05/world-05-boss.json; new
  - public/assets/pixel/props/world-05/throne/*; new
  - src/game/data/cutscenes/worlds.ts :: final boss beats; modify

#### Details

- boss title은 우두머리의 옥좌, boss name은 우두머리로 지정한다.
- arena entry에는 캣타워 상층 회랑, fight에는 금색 왕좌와 composite hazard controls, clear에는 출구와 background rib prop을 둔다.
- phase 1은 이전 월드 기믹을 단일 패턴씩 보여주고, phase 2는 여러 chain을 시간차로 실행한다.
- 왕갈비뼈 prop은 visualKey와 depth만 갖고 collision, pickup, weapon action을 갖지 않는다.
- boss 피해와 map hazard를 분리하고 checkpoint나 current-stage coin route를 생성하지 않는다.

### I02. 최종 엔딩 연결

- Related Files:
  - src/game/data/cutscenes/ending.ts :: final leap and credits; modify if required
  - src/game/scenes/StageScene.ts :: final boss clear route; modify
  - src/game/data/worlds.ts :: nextStageId null behavior; modify

#### Details

- 우두머리 처치 후 world-05 boss clear event가 nextStageId null로 종료되고 기존 집 복귀 엔딩을 요청한다.
- 엔딩에서 주인이 왕갈비뼈를 던지는 장면과 창문 밖으로 코기가 뛰는 장면은 맵 pickup이나 보스 공격으로 재사용하지 않는다.
- TO BE CONTINUED...?와 크레딧에서 코기가 갈비뼈를 쫓는 별도 컷신을 유지한다.

## Acceptance Criteria

- [ ] 우두머리의 옥좌 아레나가 1,920px 전용 맵으로 실행된다.
- [ ] 왕갈비뼈는 화면에 보이지만 보스 공격·플레이어 도구·pickup으로 사용되지 않는다.
- [ ] 우두머리 phase 1·2가 이전 월드 composite chain과 연결된다.
- [ ] 최종 보스 클리어가 집 복귀 엔딩·크레딧·후속 문구로 이어진다.

## Validation

- npm run lint
- npm run build
- World 5 네 일반 맵 → 최종 보스 → 엔딩 전체 흐름 확인
- 왕갈비뼈에 physics body와 interaction listener가 없는지 확인

## Commit Message

feat(map): add final cat tower throne arena

Plan: 2026-09-21-world-map-design
Phase: P06-world05-cat-tower-siege
Task: T02-world05-final-boss

- Add leader throne arena with composite world hazards
- Connect visible-only rib prop to final ending and credits

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
