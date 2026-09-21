# Task: T01 25개 캠페인 맵 통합 검증

## Status: pending

## Goal

World 1~5의 일반 20개와 보스 5개를 하나의 캠페인 레지스트리로 순회하며, 맵 파일·타일셋·구간·체크포인트·출구·chain 참조·랜덤 시드·월드 진행 연결을 자동 검증한다.

## Decision Summary

- 캠페인은 5개 월드 × 5개 스테이지, 선형 진행이며 이전 스테이지로 돌아가지 않는다.
- 일반 맵은 3,840px 5구간, 보스 맵은 1,920px 3구역이다.
- 체크포인트는 일반 맵마다 1개이며 3구간과 4구간 사이에 있다.

## Implementation

### I01. 전체 레지스트리 검사

- Related Files:
  - src/game/data/validateMaps.ts :: validateCampaignMaps; modify
  - src/game/data/index.ts :: campaign diagnostics export; modify
  - src/game/data/worlds.ts :: final 25-stage registry; read and fix only when required

#### Details

- STAGE_IDS 순서가 world-01 stage 1~4, boss부터 world-05 boss까지 선형인지 확인한다.
- 각 stage의 worldId, themeId, mapKey, mapFile, asset manifest key, boss arena id를 상호 검증한다.
- 일반 맵의 checkpoint section, safe sections, exit, collectible route를 검사하고 보스 맵의 checkpoint 없음·collectible 없음 계약을 검사한다.
- stage transition nextStageId가 마지막 보스에서 null인지, 그 외에는 정확한 다음 ID인지 검사한다.

### I02. 도달성과 시드 검증

- Related Files:
  - src/game/maps/MapReachability.ts :: validateMainPath; new
  - src/game/random/StageRandom.ts :: deterministic assertions; read or modify
  - src/game/maps/MapInteractionSystem.ts :: resolved chain diagnostics; modify

#### Details

- main path는 시작점에서 checkpoint, checkpoint에서 exit까지 gameplay collision graph로 연결되어야 한다.
- optional collectible route는 main path와 분리되어도 되지만 collectible 자체가 고립되어서는 안 된다.
- fixed object와 randomized object를 같은 seed로 두 번 resolve했을 때 결과가 같아야 한다.
- 다른 attempt seed에서는 randomized group이 최소 한 번은 다른 variant를 선택할 수 있어야 한다.
- checkpoint restart는 current randomSeed와 variant 결과가 같고, full stage restart는 attempt와 seed가 달라지는지 검사한다.

## Acceptance Criteria

- [ ] 25개 스테이지가 모두 registry와 실제 map asset을 갖는다.
- [ ] 20개 일반 맵과 5개 보스 맵의 크기·구간·checkpoint 규칙이 전부 통과한다.
- [ ] 모든 일반 맵에서 시작→checkpoint→exit의 main path가 존재한다.
- [ ] stage seed와 checkpoint seed 규칙이 자동 검증된다.
- [ ] 누락·오타·고아 chain/object가 오류로 보고된다.

## Validation

- npm run lint
- npm run build
- 개발용 campaign validation 명령 또는 data import를 실행해 errors 0 확인
- seed A/B와 checkpoint restart 시나리오 결과 비교

## Commit Message

test(map): validate complete campaign map registry

Plan: 2026-09-21-world-map-design
Phase: P07-validation-release
Task: T01-campaign-map-validation

- Validate all 25 maps, transitions, paths, assets, and seeds
- Add deterministic reachability diagnostics

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
