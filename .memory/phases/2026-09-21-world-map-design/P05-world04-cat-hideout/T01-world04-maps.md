# Task: T01 World 4 냥아치 아지트 일반 맵

## Status: pending

## Goal

World 4를 버려진 고물상에서 시작해 냥아치 아지트 내부로 침투하는 4개 일반 맵으로 구현한다. 고철 장치와 방어시설이 서로 연쇄 작동하며 통로를 봉쇄하는 고밀도 억까를 제공한다.

## Decision Summary

- 장소명은 냥아치 아지트이며 네 스테이지는 고물상 외곽, 폐차 처리장, 냥아치 작업장, 아지트 내부다.
- 핵심 기믹은 폐차, 고철 더미, 자석 크레인, 가짜 문, 감시 카메라, 압축기·경보 장치다.
- World 1~3의 대표 기믹 일부를 고철 장치의 변형으로 재사용한다.

## Implementation

### I01. World 4 테마 에셋

- Related Files:
  - src/game/data/worldMaps.ts :: world-04 theme; modify
  - src/game/data/worlds.ts :: world-04 blueprint; modify
  - src/game/assets/assetManifest.json :: world-04 entries; modify
  - public/assets/pixel/tiles/world-04/world-04-tileset.png; new
  - public/assets/pixel/backgrounds/world-04/*; new
  - public/assets/pixel/props/world-04/*; new

#### Details

- 회색 고철, 주황 경고등, 검은 아지트 벽, 청록 기계광을 팔레트로 사용한다.
- 타일셋에 폐차 바닥, 철판, 고철 벽, 사슬, 압축기 벽, 감시선, 경보등을 포함한다.
- foreground에는 매달린 케이블과 고철 판넬을 두되 collision은 gameplay object와 분리한다.

### I02. 네 일반 맵과 방어 chain

- Related Files:
  - public/assets/pixel/maps/world-04/world-04-stage-1.json; new
  - public/assets/pixel/maps/world-04/world-04-stage-2.json; new
  - public/assets/pixel/maps/world-04/world-04-stage-3.json; new
  - public/assets/pixel/maps/world-04/world-04-stage-4.json; new
  - src/game/data/worldMaps.ts :: world-04 hazard catalog; modify

#### Details

- stage-1 고물상 외곽: 굴러오는 폐차, 가짜 문, World 1 쓰레기통 변형을 소개한다.
- stage-2 폐차 처리장: 자석 크레인과 무너지는 고철 더미를 이동 발판과 낙사 방지처럼 보이게 배치한다.
- stage-3 냥아치 작업장: 압축기, 감시 카메라, 경보로 적을 호출하고 퇴로를 막는다.
- stage-4 아지트 내부: 이전 월드의 놀이기구·자연물·고철 기믹을 종합하고, exit 전 안전 구간은 유지한다.
- 각 맵에 경보 chain, 고정 lethal trap, randomized cat patrol을 함께 배치한다.

## Acceptance Criteria

- [ ] World 4 네 맵이 고철 아지트의 공용 타일셋과 하위 장소 이름을 사용한다.
- [ ] 고철 핵심 기믹 6종과 3~5개 variant가 등록된다.
- [ ] 카메라 경보·고철 이동·고양이 spawn chain이 checkpoint restore에서 초기화된다.
- [ ] dash 해금 여부와 무관하게 main path가 존재한다.

## Validation

- npm run lint
- npm run build
- 자석 크레인·압축기·경보 연쇄와 foreground occlusion 확인
- checkpoint 이후 고철 상태가 동일 seed로 복구되는지 확인

## Commit Message

feat(map): build world four cat hideout stages

Plan: 2026-09-21-world-map-design
Phase: P05-world04-cat-hideout
Task: T01-world04-maps

- Add scrapyard tiles and four cat hideout stages
- Combine reused world hazards with defensive junkyard chains

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
