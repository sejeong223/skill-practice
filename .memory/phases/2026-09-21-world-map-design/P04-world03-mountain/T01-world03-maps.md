# Task: T01 World 3 뒷산 일반 맵

## Status: pending

## Goal

World 3을 자연물과 등산로가 코기의 행동과 고양이의 개입에 반응하는 뒷산 월드로 구현한다. 수직 세트피스는 선택적으로 사용하되, 스킬을 필수 이동 능력으로 요구하지 않는다.

## Decision Summary

- 장소명은 뒷산이며 네 스테이지는 산길 입구, 흔들숲 오솔길, 절벽 등산로, 동굴 지름길이다.
- 핵심 기믹은 굴러오는 돌, 부러지는 나뭇가지, 기울어지는 통나무, 풀숲 매복, 무너지는 흙길, 동물 연쇄다.
- 수직 구간이 있는 맵은 최대 높이 1,152px과 vertical section metadata를 사용한다.

## Implementation

### I01. World 3 테마 에셋

- Related Files:
  - src/game/data/worldMaps.ts :: world-03 theme; modify
  - src/game/data/worlds.ts :: world-03 blueprint; modify
  - src/game/assets/assetManifest.json :: world-03 entries; modify
  - public/assets/pixel/tiles/world-03/world-03-tileset.png; new
  - public/assets/pixel/backgrounds/world-03/*; new
  - public/assets/pixel/props/world-03/*; new

#### Details

- 팔레트는 녹색·갈색 숲, 회색 바위, 흙길, 안개 하이라이트로 구성한다.
- 타일셋에 흙·바위·나무뿌리·통나무·동굴 벽·절벽 가장자리를 포함한다.
- 수직 section은 mapHeight 1,152를 사용하고 vertical=true로 표시한다.

### I02. 네 일반 맵과 자연물 chain

- Related Files:
  - public/assets/pixel/maps/world-03/world-03-stage-1.json; new
  - public/assets/pixel/maps/world-03/world-03-stage-2.json; new
  - public/assets/pixel/maps/world-03/world-03-stage-3.json; new
  - public/assets/pixel/maps/world-03/world-03-stage-4.json; new
  - src/game/data/worldMaps.ts :: world-03 hazard catalog; modify

#### Details

- stage-1 산길 입구: 굴러오는 돌과 가짜 흙길을 소개한다.
- stage-2 흔들숲 오솔길: 부러지는 가지, 풀숲 고양이, 움직이는 통나무를 섞는다.
- stage-3 절벽 등산로: 수직 세트피스, 낙석, 기울어진 발판, optional high collectible을 사용한다.
- stage-4 동굴 지름길: 어두운 배경, 무너지는 천장, 되돌아오는 돌, 이전 놀이터 기믹을 종합한다.
- section-5는 출구 전 192px 안전 구간이고, 동굴 안쪽 chain이 출구를 잠그지 않도록 한다.

## Acceptance Criteria

- [ ] 네 맵이 뒷산 타일셋과 자연물 오브젝트를 사용한다.
- [ ] 수직 맵에서 카메라 상하 추적과 physics bounds가 정상이다.
- [ ] 자연물 6종과 각 변형·chain rule이 등록된다.
- [ ] 스킬을 해금하지 않은 상태에서도 main exit path를 클리어할 수 있다.

## Validation

- npm run lint
- npm run build
- mapHeight 720과 1,152 두 종류를 모두 실행
- 낙석·통나무·흙길 chain과 checkpoint restore 확인

## Commit Message

feat(map): build world three mountain stages

Plan: 2026-09-21-world-map-design
Phase: P04-world03-mountain
Task: T01-world03-maps

- Add mountain tiles, vertical set pieces, and natural hazard chains
- Register four mountain stages and optional high routes

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
