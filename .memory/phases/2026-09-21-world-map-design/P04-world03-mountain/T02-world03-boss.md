# Task: T02 World 3 산 정상 보스 맵

## Status: pending

## Goal

World 3의 산 정상 보스 아레나와 산악 환경 패턴을 구현하고, 처치 후 dash 해금과 냥아치 아지트 진입을 연결한다.

## Decision Summary

- 보스 맵은 1,920px, 3구역, checkpoint 없음이다.
- 보스 아레나는 정상 절벽, 통나무 발판, 낙석 경사면을 사용한다.
- World 1·2의 함정은 자연물에 붙은 변형으로만 재사용한다.

## Implementation

### I01. 산 정상 아레나와 보스 환경

- Related Files:
  - src/game/data/worlds.ts :: world-03 boss definition; modify
  - public/assets/pixel/maps/world-03/world-03-boss.json; new
  - public/assets/pixel/props/world-03/mountain-boss/*; new

#### Details

- boss title은 산 정상 고양이 초소로 지정하고, 산 정상 실루엣과 절벽 바람을 배경에 둔다.
- phase 1은 낙석과 통나무 platform pattern, phase 2는 arena-wide cliff collapse를 사용한다.
- 낙사 판정은 boss attack와 분리하고, 보스 전투 중 checkpoint를 생성하지 않는다.

### I02. progression 연결

- Related Files:
  - src/game/data/cutscenes/worlds.ts :: world-03 boss beats; modify
  - src/game/data/skills.ts :: dash unlock relation; read-only or modify if required

#### Details

- boss clear에서 dash unlock event와 world-04-stage-1 transition을 emit한다.
- 보스 맵의 왕갈비뼈 관련 소품은 배경 장식으로만 유지한다.

## Acceptance Criteria

- [ ] 산 정상 보스 아레나가 1,920px로 실행된다.
- [ ] 낙석·통나무·절벽 붕괴가 보스 phase와 연동된다.
- [ ] dash 해금과 World 4 진입이 정상 연결된다.

## Validation

- npm run lint
- npm run build
- World 3 일반 맵 → 산 정상 → dash 해금 → World 4 흐름 확인

## Commit Message

feat(map): add world three mountain boss arena

Plan: 2026-09-21-world-map-design
Phase: P04-world03-mountain
Task: T02-world03-boss

- Add mountain summit boss arena and collapse chains
- Connect boss clear to dash unlock and world four entry

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
