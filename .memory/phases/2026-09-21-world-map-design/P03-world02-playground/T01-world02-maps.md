# Task: T01 World 2 놀이터 일반 맵

## Status: pending

## Goal

World 2를 놀이기구가 자체적으로 배신하는 놀이터 월드로 구현한다. World 1에서 재사용한 가짜 바닥·낙하·고양이 매복 규칙을 놀이기구 오작동과 결합하되, 4개 일반 스테이지는 각각 다른 놀이기구 하위 장소를 사용한다.

## Decision Summary

- 장소명은 놀이터이며 네 스테이지는 그네 광장, 뒤집힌 미끄럼틀, 정글짐 미로, 놀이터 뒤편이다.
- 핵심 기믹은 그네, 미끄럼틀, 시소, 모래밭, 정글짐, 스프링 놀이기구다.
- stage-1은 새 놀이기구 규칙을 소개하고 stage-4는 World 1의 일부 함정과 놀이기구를 종합한다.

## Implementation

### I01. World 2 테마 에셋과 맵 등록

- Related Files:
  - src/game/data/worldMaps.ts :: world-02 theme; modify
  - src/game/data/worlds.ts :: world-02 blueprint; modify
  - src/game/assets/assetManifest.json :: world-02 entries; modify
  - public/assets/pixel/tiles/world-02/world-02-tileset.png; new
  - public/assets/pixel/backgrounds/world-02/*; new
  - public/assets/pixel/props/world-02/*; new

#### Details

- 팔레트는 밝은 놀이공원 색과 보라색 그림자, 금속·고무·모래 재질을 사용한다.
- 공용 타일셋에 그네 지지대, 미끄럼틀 곡면, 시소 축, 모래 가장자리, 정글짐 격자, 스프링 바닥을 포함한다.
- background-far에는 아파트와 놀이터 외곽, background-mid에는 나무와 가로등, foreground에는 흔들리는 체인·나뭇잎을 둔다.

### I02. 네 일반 맵과 놀이기구 변형

- Related Files:
  - public/assets/pixel/maps/world-02/world-02-stage-1.json; new
  - public/assets/pixel/maps/world-02/world-02-stage-2.json; new
  - public/assets/pixel/maps/world-02/world-02-stage-3.json; new
  - public/assets/pixel/maps/world-02/world-02-stage-4.json; new
  - src/game/data/worldMaps.ts :: map object and hazard catalog entries; modify

#### Details

- stage-1 그네 광장: 그네가 밀쳐내는 방향과 고양이 호출 variant를 소개한다.
- stage-2 뒤집힌 미끄럼틀: 미끄럼틀의 진행 방향 반전, 출구처럼 보이는 낙하, World 1 맨홀 변형을 사용한다.
- stage-3 정글짐 미로: 시소 발판, 정글짐 내부 매복, 모래밭 감속과 랜덤 출구를 조합한다.
- stage-4 놀이터 뒤편: 모든 놀이기구를 chain으로 연결하고, 마지막 192px은 완전 안전하게 둔다.
- 각 맵은 3,840px, 5구간, checkpoint 1개, optional collectible route 1개 이상을 가진다.

## Acceptance Criteria

- [ ] World 2의 네 스테이지가 새 놀이터 이름·팔레트·타일셋 키를 사용한다.
- [ ] 놀이기구 6종마다 3개 이상의 variant 또는 chain rule이 존재한다.
- [ ] World 1에서 재사용한 기믹은 최소 2종 이상 다른 동작으로 변형된다.
- [ ] safe-entry/safe-exit와 checkpoint 규칙이 자동 검증된다.

## Validation

- npm run lint
- npm run build
- World 2 네 맵의 그네·미끄럼틀·시소·정글짐 충돌 확인
- 랜덤 seed를 바꿔도 main exit path가 유지되는지 확인

## Commit Message

feat(map): build world two playground stages

Plan: 2026-09-21-world-map-design
Phase: P03-world02-playground
Task: T01-world02-maps

- Add playground tiles, four ride-failure stages, and reused alley hazards
- Register world two map variants and collectibles

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
