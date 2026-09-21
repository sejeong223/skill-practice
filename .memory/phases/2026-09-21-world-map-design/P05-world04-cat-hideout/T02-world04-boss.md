# Task: T02 World 4 간부실 보스 맵

## Status: pending

## Goal

World 4의 간부실 보스 아레나와 냥아치 방어시설 패턴을 구현하고, 처치 후 double-jump 해금과 캣타워 공성전 진입을 연결한다.

## Decision Summary

- 보스 맵은 1,920px, 3구역, checkpoint 없음이다.
- 아레나는 고물상 크레인·철판·경보등·압축기를 보스 패턴과 결합한다.
- World 5에서 이전 기믹을 종합할 수 있도록 world-04 chain의 reusable variant id를 남긴다.

## Implementation

### I01. 간부실 아레나와 환경 패턴

- Related Files:
  - src/game/data/worlds.ts :: world-04 boss definition; modify
  - public/assets/pixel/maps/world-04/world-04-boss.json; new
  - public/assets/pixel/props/world-04/office-boss/*; new

#### Details

- boss title은 냥아치 아지트 간부실로 지정한다.
- phase 1은 이동하는 철판과 고철 낙하, phase 2는 경보등이 켜진 arena-wide 압축기 패턴으로 구성한다.
- 보스 피해 판정과 environmental lethal zones를 별도 object group으로 둔다.

### I02. 월드 연결

- Related Files:
  - src/game/data/cutscenes/worlds.ts :: world-04 boss clear; modify
  - src/game/data/skills.ts :: double-jump relation; read-only or modify if required

#### Details

- boss clear에서 double-jump unlock event와 world-05-stage-1 transition을 emit한다.
- 다음 월드가 이전 hazard catalog를 참조할 수 있도록 world-04 variant key를 registry에 export한다.

## Acceptance Criteria

- [ ] 간부실 보스 아레나가 1,920px로 실행되고 checkpoint가 없다.
- [ ] 철판·크레인·압축기·경보등이 보스 phase와 연쇄 작동한다.
- [ ] double-jump 해금과 World 5 진입이 연결된다.

## Validation

- npm run lint
- npm run build
- World 4 boss clear 후 World 5 stage 1 진입과 skill event 확인

## Commit Message

feat(map): add world four hideout boss arena

Plan: 2026-09-21-world-map-design
Phase: P05-world04-cat-hideout
Task: T02-world04-boss

- Add cat hideout officer arena and defensive environment chains
- Connect boss clear to double-jump unlock and final world entry

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
