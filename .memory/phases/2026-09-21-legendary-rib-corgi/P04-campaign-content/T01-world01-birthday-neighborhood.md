# Task: T01 월드 1 생일 동네·도입부·턱시도 보스

## Status: pending

## Goal

도입부 컷신부터 첫 보스전까지 코기가 집을 나와 냥아치 연합의 행동대장 턱시도를 추격하는 첫 번째 월드를 완주 가능하게 만든다.

## Decision Summary

- 월드 1은 생일 동네의 뒷골목·놀이터·담벼락·고물상으로 구성한다.
- 기본 플레이어는 이동·점프·토끼 슬리퍼 공격·밥그릇 방어만 보유하고, 보스 처치 후 짖기 스킬을 해금한다.

## Implementation

### I01. 월드·스테이지 데이터

- Related Files:
  - src/game/data/worlds/world-01.ts :: WORLD_01_DEFINITION — new
  - src/game/data/stages/world-01.ts :: WORLD_01_STAGES — new
  - src/game/data/bosses/tuxedo.ts :: TUXEDO_BOSS — new
  - src/game/data/collectibles/world-01.ts :: WORLD_01_COLLECTIBLES — new

#### Details

- Stage IDs and titles:
  - world-01-stage-1: 무법지대 뒷골목
  - world-01-stage-2: 들썩들썩 놀이터
  - world-01-stage-3: 담벼락 지름길
  - world-01-stage-4: 냥아치 연합 아지트 (버려진 고물상)
  - world-01-stage-boss: 행동대장 턱시도
- 모든 일반 스테이지에는 checkpointIds 길이 1, 출구 trigger, current-stage coin route, 선택형 collectible 3개를 넣는다.
- stage 1은 intro completion 후 시작하고, stage 1 시작 시 코기는 rabbit-slipper를 입에 물고 있다.
- stage 4는 반복되는 고물 더미·가짜 안전 발판·고양이 경보선을 사용해 world 1의 패턴을 종합한다.

### I02. 보스와 보상

- Related Files:
  - src/game/data/bosses/tuxedo.ts :: TuxedoBossController — new
  - src/game/scenes/BossScene.ts :: boss runtime integration — modify

#### Details

- 턱시도 고양이는 짧은 실외기·담벼락·창문 발판을 이동하며 코기를 조롱한다.
- Boss phases:
  1. 담벼락 왕복 점프와 가짜 안전 바닥
  2. 실외기 바람으로 플레이어를 밀어냄
  3. 왕갈비뼈를 미끼처럼 보이게 하는 낚시 패턴
- 왕갈비뼈는 배경/연출에만 보이고 boss skill로 사용하지 않는다.
- 처치 후 rewardSkill은 bark이며, 보스 후 컷신에서 다음 월드 진입을 연출한다.

### I03. 도입부 연출 연결

- Related Files:
  - src/game/data/cutscenes/intro.ts :: INTRO_CUTSCENE — modify
  - src/game/data/cutscenes/worlds.ts :: WORLD_01_CUTSCENES — modify

#### Details

- 주인의 집 거실에서 시작해 검은 비닐봉지·왕갈비뼈 공개·전설 설명·기다려 명령·턱시도 강탈·도그 도어 탈출 순서로 실행한다.
- 나레이터 문장에 최악의 생일이라는 표현을 사용하지 않는다.
- 마지막 beat는 “그렇게 코기는 생일 선물을 되찾기 위한 추격을 시작했다.”와 stage 1 transition이다.

## Acceptance Criteria

- [ ] 도입부에서 집 내부 연출 후 무법지대 뒷골목 스테이지가 시작된다.
- [ ] 월드 1의 일반 4개와 보스 1개를 순서대로 클리어할 수 있다.
- [ ] 각 일반 스테이지에 체크포인트 1개와 수집품 3개가 있다.
- [ ] 턱시도 보스 처치 후 bark가 해금되고 다음 월드가 열린다.
- [ ] 왕갈비뼈가 최종 전까지 시각적 목표로만 유지된다.

## Validation

- npm run lint — world 1 data와 cutscene 타입 통과
- npm run build — world 1 registry validation 통과
- npm run dev — intro부터 tuxedo boss reward까지 수동 완주

## Commit Message

~~~text
feat(content): build world one birthday neighborhood campaign

Plan: 2026-09-21-legendary-rib-corgi
Phase: P04-campaign-content
Task: T01-world01-birthday-neighborhood

- Add intro, four neighborhood stages and tuxedo boss
- Unlock bark after the first boss and open world two
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
