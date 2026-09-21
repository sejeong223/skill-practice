# Task: T01 World 5 캣타워 공성전 일반 맵

## Status: pending

## Goal

World 5를 캣타워 외벽에서 우두머리의 옥좌까지 올라가는 공성전으로 구현한다. 이전 4개 월드의 대표 기믹을 냥아치 방어시설로 개조해 마지막 일반 스테이지들에 종합 배치한다.

## Decision Summary

- 장소명은 캣타워 공성전이며 네 스테이지는 캣타워 외벽, 하층 방어선, 중층 공성 구역, 상층 회랑이다.
- 핵심 기믹은 회전 발판, 층별 방어선, 장난감 발사기, 밥그릇 경보, 이전 월드 기믹의 개조판이다.
- 캣타워의 수직 구간은 mapHeight 1,152까지 허용하되, main path는 double-jump 없이도 존재해야 한다.

## Implementation

### I01. World 5 테마 에셋과 종합 registry

- Related Files:
  - src/game/data/worldMaps.ts :: world-05 theme and reused catalogs; modify
  - src/game/data/worlds.ts :: world-05 blueprint; modify
  - src/game/assets/assetManifest.json :: world-05 entries; modify
  - public/assets/pixel/tiles/world-05/world-05-tileset.png; new
  - public/assets/pixel/backgrounds/world-05/*; new
  - public/assets/pixel/props/world-05/*; new

#### Details

- 검정·짙은 보라색 벽, 금색 장식, 붉은 경보, 고양이 깃발을 팔레트로 사용한다.
- 타일셋에 캣타워 외벽, 캣워크, 층 경계, 왕실 문, 금속 발판, 깃발 기둥을 포함한다.
- world-01부터 world-04의 hazard variant를 참조하는 composite chain group을 정의한다.

### I02. 네 일반 맵과 공성 chain

- Related Files:
  - public/assets/pixel/maps/world-05/world-05-stage-1.json; new
  - public/assets/pixel/maps/world-05/world-05-stage-2.json; new
  - public/assets/pixel/maps/world-05/world-05-stage-3.json; new
  - public/assets/pixel/maps/world-05/world-05-stage-4.json; new
  - src/game/data/worldMaps.ts :: world-05 object and chain catalog; modify

#### Details

- stage-1 캣타워 외벽: 회전 발판과 이전 뒷산 낙석을 외벽 장치로 변형한다.
- stage-2 하층 방어선: 장난감 발사기, 밥그릇 경보, 놀이터 시소 변형을 사용한다.
- stage-3 중층 공성 구역: 고물상 자석 크레인, 닫히는 문, moving platform을 함께 사용한다.
- stage-4 상층 회랑: 이전 월드 핵심 체인을 종합하되 192px 안전 탈출 구간과 출구는 보장한다.
- 총 6개 핵심 composite 기믹과 각 3~5개 variant를 등록하고, optional collectible은 가장 위험한 보조 루트에 둔다.

## Acceptance Criteria

- [ ] World 5 네 맵이 캣타워 타일셋과 하위 장소 이름을 사용한다.
- [ ] 이전 4개 월드의 대표 기믹이 최소 1종씩 composite chain으로 재사용된다.
- [ ] 수직 캣타워 구간에서 camera vertical follow가 작동한다.
- [ ] main path는 skill unlock 상태와 무관하게 존재하고 exit 전 안전 구간을 가진다.

## Validation

- npm run lint
- npm run build
- World 1~4 hazard catalog가 World 5 맵에서 정상 해석되는지 확인
- 1,152px 캣타워 구간과 320px 왼쪽 카메라 위치 확인

## Commit Message

feat(map): build world five cat tower siege stages

Plan: 2026-09-21-world-map-design
Phase: P06-world05-cat-tower-siege
Task: T01-world05-maps

- Add cat tower tiles and final siege stages
- Combine reused hazard catalogs into final composite chains

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
