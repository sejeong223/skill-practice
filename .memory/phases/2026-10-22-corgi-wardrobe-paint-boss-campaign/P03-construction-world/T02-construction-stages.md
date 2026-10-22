# Task: T02 월드 3 네 스테이지의 공사장 플레이

## Status: done

## Goal

월드 3의 1~4 스테이지를 공사장 바닥 위에서 이동·점프·체크포인트·출구까지 실제 플레이 가능한 구간으로 완성한다.

## Decision Summary

- 사용자 결정: 월드 3 전체 맵을 공사장으로 변경한다. 기본 슬리퍼 플레이에서도 이후 보스로 갈 수 있어야 한다.
- 코드 사실: `createSegment`가 월드 3에 임시 false-floor/falling-object와 길이별 발판을 생성한다. `StageScene.createWorld02SandFloor`가 연속 바닥 시각화/충돌 검증의 선례다. 월드 3 맵 JSON은 없는 placeholder라 `StageBuilder`의 segment 경로를 사용한다.

## Implementation

### I01. 연속 바닥·구간 데이터

- Related Files:
  - `src/game/data/worlds.ts` :: `createSegment`, `createNormalStage`, `createStageMap`의 월드 3 분기. 임시 산길 trap/enemy를 월드 3에서 빼고 각 스테이지에 폭 3840px, 상단 y=504인 연속 발판 1개를 제공.
  - `src/game/data/world03Construction.ts` :: 신규 `World03ObstacleKind`, `World03ObstaclePlacement`, `getWorld03Obstacles(stageId)`.
  - `src/game/scenes/StageScene.ts` :: 월드 3 stage 1~4에서 `getWorld03StageTheme` 선택, `createWorld03ConstructionFloor` 시각층 생성·씬 종료 시 해제.
- **Signatures & Types**: `type World03ObstacleKind="traffic-cone"|"brick-stack"|"cement-bag"|"steel-pipe"`; `interface World03ObstaclePlacement { id:string; kind:World03ObstacleKind; x:number; width:number; height:number }`; `getWorld03Obstacles(stageId:StageId):readonly World03ObstaclePlacement[]`.
- **Data & Schema Fields**: 네 스테이지마다 고정 배치 8개(총 32개), 매번 같은 ID·위치. 사망 후 체크포인트 재시작에도 배열을 재현한다. 바닥 폭 `NORMAL_MAP_WIDTH=3840`, 충돌 상단 `y=504`; 장애물 세로 충돌 40px 이하, 가로 충돌 40px 이하. 시작 x 부근 300px, 체크포인트 x2496 양옆 150px, 출구 x3728 부근 150px는 비운다. 인접 장애물은 ≥300px 간격으로 둔다.
- **Execution Flow / Logic**: 첫 segment에 전폭 발판, 나머지 segment에 발판 중복 없음. tileSprite 바닥은 충돌면과 시각 요철 4px 이내 정렬. 장애물 종류/순서와 배경 중점 구역을 스테이지마다 달리하되 바닥 높이를 갑자기 바꾸지 않는다. 코인의 고유 ID와 기존 체크포인트/출구 map object를 유지한다.
- **Error & State Transition**: 월드 3 이외의 `createSegment` 동작은 그대로. 타일맵 파일을 새로 만들지 않으면 `TiledMapLoader`의 fallback segment 경로를 사용하고 충돌 발판이 중복되지 않도록 검사한다.

### I02. 장애물 충돌·재시작과 단계 이동

- Related Files:
  - `src/game/systems/World03ConstructionObstacles.ts` :: 신규 Phaser 장애물 생성/overlap/cleanup.
  - `src/game/scenes/StageScene.ts` :: `create`, restart, shutdown에서 장애물 시스템 수명 관리 및 `death-requested`/기존 사망 처리로 연결.
  - `scripts/world03-construction-stages.test.mjs` :: 신규, 4×8 배치·충돌 크기·시작/체크포인트/출구 안전 여백·연속 바닥 검사.
- **Signatures & Types**: `World03ConstructionObstacles(scene:Phaser.Scene,player:Player,stageId:StageId,eventBus:GameplayEventBus)`; `resetForAttempt():void`, `destroy():void`. 각 이미지에는 원본 투명 여백을 제외한 static body를 설정.
- **Execution Flow / Logic**: 코기가 닿으면 기존 장애물과 동일한 사망/체크포인트 재시작. 짖기로 장애물을 없애지 않는다. 씬 재시작 시 중복 이미지·콜라이더를 제거한다. stage 4 출구는 기존 `getNextStageId`로 월드 3 보스에 이어진다.
- **Error & State Transition**: 사망 이벤트 한 번에 중복 사망을 내지 않게 stage 상태를 확인한다. checkpoint 사망 후 재생성 위치가 장애물과 겹치지 않는다.

## Acceptance Criteria

- [x] 월드 3 네 구역을 바닥 틈 없이 끝까지 걸을 수 있고 장애물은 점프로 넘을 수 있다.
- [x] 장애물에 닿으면 죽고 체크포인트에서 정상 재시작한다.
- [x] 4번 스테이지 출구에서 고등어 보스 스테이지로 이동한다.

## Validation

- `node --test scripts/world03-construction-stages.test.mjs scripts/stage-progression.test.mjs` — 배치·진행.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 1~4 스테이지 시작→중간 체크포인트 사망→출구까지 실제 점프 플레이 검증.

## Commit Message

```text
feat(공사장): 월드 3 네 구역에 연속 바닥과 점프 장애물 배치

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P03-construction-world
Task: T02-construction-stages

- 공사장 바닥과 장애물 충돌을 네 스테이지에 연결
- 체크포인트 재시작과 보스 출구를 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 데이터 테스트 8건, 타입·린트·빌드, Chrome 네 구역 32회 점프·체크포인트 사망·출구 이동
- commit: 이 Task의 한국어 커밋
