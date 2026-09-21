# Task: T01 World 1 뒷골목 일반 맵

## Status: pending

## Goal

World 1을 기존 생일 집 앞 프로토타입에서 뒷골목 캠페인의 첫 4개 일반 스테이지로 교체한다. 따뜻한 주거지 팔레트와 16px 타일셋을 만들고, 평범한 사물이 다른 위치와 상황에서 서로 다른 억까를 일으키도록 Tiled 맵과 chain rule을 작성한다.

## Decision Summary

- World 1 장소는 뒷골목이며 스테이지는 무법지대 뒷골목, 빨래방 지붕길, 도둑고양이 지름길, 담벼락 추격전이다.
- 일반 맵은 3,840px, 5개 구간, 192px 안전 진입·탈출, 3↔4구간 경계 checkpoint다.
- 핵심 기믹은 맨홀·가짜 바닥, 굴러오는 쓰레기통, 빨랫줄, 에어컨 실외기, 울타리·대문, 고양이 미끼다.
- 스킬과 도구는 맵 진행을 열지 않고 전투에서만 사용한다.

## Implementation

### I01. World 1 테마와 픽셀 에셋

- Related Files:
  - src/game/data/worldMaps.ts :: world-01 theme; modify
  - src/game/assets/assetManifest.json :: world-01 assets; modify
  - public/assets/pixel/tiles/world-01/world-01-tileset.png :: new generated asset
  - public/assets/pixel/backgrounds/world-01/* :: new generated assets
  - public/assets/pixel/props/world-01/* :: new generated assets

#### Details

- palette는 따뜻한 주거지 바닥, 벽돌·콘크리트, 해 질 녘 그림자, 빨간 경고 포인트를 사용한다.
- 4개 레이어용 먼 배경·중경·게임플레이 타일·전경 장식을 준비한다.
- 타일셋은 바닥, 벽, 맨홀, 골목 펜스, 지붕, 배수관, 빨랫줄 지지대, 에어컨 실외기 받침을 포함한다.
- 큰 props는 쓰레기통, 빨래, 간판, 대문, 고양이 상자, 실외기이며 모두 픽셀 아트 기준 시트에서 파생한다.
- 깨짐·낙하·흔들림 프레임은 동일 visualKey의 animation variant로 만들고 physics body는 별도 정의한다.

### I02. 일반 4개 Tiled 맵과 기믹 체인

- Related Files:
  - src/game/data/worlds.ts :: WORLD_BLUEPRINTS world-01 entry; modify
  - src/game/data/worldMaps.ts :: world-01 map metadata; modify
  - public/assets/pixel/maps/world-01/world-01-stage-1.json; new
  - public/assets/pixel/maps/world-01/world-01-stage-2.json; new
  - public/assets/pixel/maps/world-01/world-01-stage-3.json; new
  - public/assets/pixel/maps/world-01/world-01-stage-4.json; new

#### Details

- stage titles and route:
  - world-01-stage-1: 무법지대 뒷골목
  - world-01-stage-2: 빨래방 지붕길
  - world-01-stage-3: 도둑고양이 지름길
  - world-01-stage-4: 담벼락 추격전
- section-1 and section-5에는 장식·NPC·장소 소개만 둔다. section-2부터 section-4에만 trap, enemy spawn, chain rule을 둔다.
- stage-1은 맨홀과 굴러오는 쓰레기통을 소개하고, stage-2는 빨랫줄 낚시와 실외기 낙하를 확장한다.
- stage-3은 같은 쓰레기통이 안전 발판, rolling hazard, cat spawn container로 변형된다.
- stage-4는 울타리·대문·고양이 경보·유기견 군중으로 앞뒤 퇴로를 압박하되 exit 직전 192px은 안전하게 둔다.
- 월드당 핵심 6종과 각 3~5개 variant를 등록하고, 적어도 2개 chain은 object-enter → object-move → enemy-spawn 순서를 사용한다.
- 각 맵에 숨겨진 collectible 1개 이상을 optional 위험 루트에 배치한다.

## Acceptance Criteria

- [ ] WORLD_DEFINITIONS와 STAGE_DEFINITIONS가 World 1의 새 장소명과 subtitle을 반환한다.
- [ ] 4개 Tiled 맵이 3,840px·5구간·checkpoint 1개·safe-entry/safe-exit 규칙을 만족한다.
- [ ] 각 맵에 월드 1 핵심 기믹 6종과 변형·연쇄 규칙이 등록된다.
- [ ] 전투 외 맵 이동은 스킬·도구에 의존하지 않는다.
- [ ] 수집품 루트는 선택 사항이고 main exit path를 막지 않는다.

## Validation

- npm run lint
- npm run build
- P01-T05 campaign map validation에서 world-01 4개 보고서가 오류 0인지 확인
- 네 맵을 순서대로 실행해 안전 진입·checkpoint·안전 탈출을 수동 확인

## Commit Message

feat(map): build world one back alley stages

Plan: 2026-09-21-world-map-design
Phase: P02-world01-back-alley
Task: T01-world01-maps

- Add back alley tiles, four stage maps, and residential hazard chains
- Replace generic world one stage titles and map metadata

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
