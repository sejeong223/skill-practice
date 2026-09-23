# Task: T03 World 1 일반 맵과 기믹 연쇄

## Status: done

## Goal

World 1의 무법지대 뒷골목·빨래방 지붕길·도둑고양이 통로·담벼락 위의 추격전 4개 일반 맵을 실제 3840px Tiled 맵으로 교체하고, section 2~4에 World 1 카탈로그의 최소 66개 기믹을 단일 메인 루트로 배치한다.

## Decision Summary

- 맵에는 실제 갈림길과 지름길이 없다. stage 2와 4의 상승은 하나의 메인 루트 안에서만 일어난다.
- section 1·5는 각각 192px이며 장식·NPC·도착 연출만 가진다. 모든 lethal/forced/blocking object는 section 2~4에 둔다.
- Tiled object의 `gimmickId`, `chainId`, `seedGroup`, `counterplayAction` properties는 `WORLD01_GIMMICKS`와 일치해야 한다.
- 전체 4개 스테이지에서 땅 꺼짐·땅 솟음·백색 가시는 각각 최소 10회이며, runtime에 맞춰 12회로 배치한다. 최고 이동속도 기준 함정 간 간격은 8초를 넘지 않는다.
- 맵 디자인 개요는 사용자 검토를 거쳐 승인되었다. 각 스테이지의 평지 기준 자동 통과 시간은 약 17.5초이며, 상승 루트는 여기에 수직 이동 시간이 더해진다.

## Implementation

### I01. Stage map metadata

- Related Files:
  - `src/game/data/worldMaps.ts` :: World 1 section and theme definitions; modify
  - `src/game/data/worlds.ts` :: World 1 stage map metadata; modify
  - `src/game/data/world01Maps.ts` :: `WORLD01_STAGE_MAPS`; new

#### Details

- `WORLD01_STAGE_MAPS`는 4개 `StageMapDefinition`을 `stageId`로 제공한다.
- 모든 map은 `tileWidth: 16`, `tileHeight: 16`, `mapWidth: 3840`, sections width `192/1152/1152/1152/192`, true checkpoint 1개를 갖는다.
- stage 2와 stage 4는 `mapHeight: 1152`와 `section.vertical: true`인 상승 section을 사용한다. stage 1과 stage 3은 `mapHeight: 720`이다.
- section 4 시작 경계에 진짜 checkpoint를 하나 두고, 가짜 checkpoint object는 `properties.fakeCheckpoint: true`와 별도 gimmickId를 가진다. 밟으면 활성화될 가시 오브젝트는 별도 ID로 둔다.
- 각 stage의 `objectDefinitions`와 `gimmicks`는 section 1·5가 비어 있는지, exit가 safe-exit에 있는지 검증 가능해야 한다.

### I02. Tiled JSON 레이어와 단일 루트 타일 배치

- Related Files:
  - `public/assets/pixel/maps/world-01/world-01-stage-1.json` :: new
  - `public/assets/pixel/maps/world-01/world-01-stage-2.json` :: new
  - `public/assets/pixel/maps/world-01/world-01-stage-3.json` :: new
  - `public/assets/pixel/maps/world-01/world-01-stage-4.json` :: new
  - `src/game/assets/assetManifest.json` :: four map entries; modify
  - `src/game/maps/TiledMapLoader.ts` :: map-level/object custom properties; modify if required

#### Details

- 각 JSON에는 `background-far`, `background-mid`, `gameplay`, `foreground` tile layer와 `gimmicks`, `entities` object layer를 둔다.
- gameplay collision은 메인 바닥·필수 발판만 담당하고, lethal 결과는 기믹 runtime trigger가 담당한다. 시각 오브젝트와 lethal trigger 영역을 한 객체에 섞지 않는다.
- stage 1에는 개미→전방 점프 벽→땅 꺼짐→땅 솟음→가짜 코인→가짜 깃발→상자 팔→구름 폭우→백색 가시 순서를 흩어 배치한다.
- stage 2에는 빨랫줄·실외기 배경 위에서 땅 꺼짐·땅 솟음·백색 가시·비둘기를 반복하고, 수직 section의 카메라 추적을 사용한다.
- stage 3에는 같은 상자·구름·코인 visualKey를 각각 다른 trigger와 chain으로 재사용하고, 뒤로 밀기 코인·불붙는 코인·이름 말풍선을 중첩한다.
- stage 4에는 개미·투명 벽·땅 계열·백색 가시·비둘기·가짜 checkpoint를 앞뒤 퇴로 압박으로 재사용하되, exit 직전 192px은 반드시 안전하게 둔다.
- 총 66개 기믹 오브젝트를 카탈로그 ID와 1:1로 배치한다. 땅 꺼짐·땅 솟음·백색 가시는 월드 전체에 각 12개, 비둘기는 8개를 배치한다.
- 데이터 기반 맵 생성·검증 스크립트를 제공하고, 최대 함정 공백 8초·안전 구간·object ID·기믹 최소 개수를 검사한다.

### I03. Chain rule authoring

- Related Files:
  - `src/game/data/world01Chains.ts` :: `WORLD01_CHAIN_RULES`; new
  - `src/game/data/world01Maps.ts` :: stage chain references; modify

#### Details

- 최소 2개 chain은 `object-enter → object-move → enemy-spawn` 순서를 사용한다.
- `forward-jump-wall`은 `player-jump` trigger로만 활성화되고, `ground-rise`는 `timed-after-enter` 1000ms 후 collision을 켠다.
- fake checkpoint는 `checkpoint-touch → activate-object(spikes) → death`를 실행하며, 실제 체크포인트와 별도 객체로 유지한다.
- name bubble은 `dialogue-enter → force-control(run-left)` 이후 `input-mash → clear-control` 또는 `timer-expired → scripted death`로 나뉜다. 입력 목표는 100회다.
- 모든 chain은 `hintPolicy: none`, deterministic seedGroup, target object 존재를 만족해야 한다.

## Acceptance Criteria

- [x] 4개 Tiled 맵이 3840px, 5개 section, 안전 진입·탈출, true checkpoint 1개를 만족한다.
- [x] World 1 gimmick catalog 66개와 Tiled object ID가 1:1로 연결된다.
- [x] 기믹은 section 2~4에만 있고 실제 분기·지름길이 없다.
- [x] 땅 꺼짐·땅 솟음·백색 가시가 각각 12회이며, 함정 간 이동 공백이 8초를 넘지 않는다.
- [x] 단일 루트의 gameplay collision과 기믹 trigger 영역이 분리되어 있다.
- [x] map validator가 World 1 4개 일반 맵에 오류 0을 보고한다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run world01:maps:check`
- `validateCampaignMaps(CONTENT_REGISTRY)`에서 World 1 normal 4개 `errors.length === 0`
- Tiled JSON의 layer/object count와 catalog count를 출력하는 진단 커맨드에서 66개/12개 반복 함정 확인

## Commit Message

```text
feat(map): 월드1 뒷골목 일반 맵과 기믹 연쇄 배치

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T03-world01-maps-and-chains

- Author four single-route back alley Tiled maps
- Place residential instant-death gimmicks and deterministic chains
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (`lint`, `build`, maps check, campaign validator)
- commit: pending (기능 커밋 생성 후 기록)
