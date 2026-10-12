# Task: T01 월드 1 보스전의 노란 기본 코인 제거

## Status: done

## Goal

사용자 화면에서 보인 노란 원을 월드 1 보스전에서 제거한다. 화면만 숨기지 않고 해당 코인의 생성/획득 판정도 없앤다.

## Decision Summary

- 원의 원인은 `createSegment`가 보스에도 넣는 코인 3개다. 월드 1 보스에 한정해 데이터에서 제거한다.
- 일반 간식, 지갑 적립/사망 후 재획득, 다른 월드 데이터는 유지한다. 보스 바닥 미커밋 수정도 보존한다.

## Implementation

### I01. 월드 1 보스의 segment 코인 목록 비우기

- Related Files:
  - `src/game/data/worlds.ts` :: `createSegment`, `STAGE_DEFINITIONS`; modify
  - `src/game/core/contentTypes.ts` :: `StageSegment`; read-only
  - `src/game/stages/StageRuntime.ts` :: `buildFromSegments`; read-only
  - `src/game/stages/StageEntityFactory.ts` :: `createCoin`; read-only
  - `src/game/scenes/StageScene.ts` :: 현재 보스 바닥/코인 overlap; read-only

#### Details

- **Signatures & Types**: 기존 `createSegment(stageId: StageId, segmentNumber: number, isBoss: boolean, length: number): StageSegment`를 유지한다. `StageSegment.coins`의 기존 문자열 ID 목록 타입도 유지한다.
- **Data & Schema Fields**: `stageId === "world-01-stage-boss" && isBoss`이면 `coins`는 빈 배열이다. 그 외에는 기존 `segmentId + "-coin-1/2/3"` 3개를 유지한다. 저장 모델/자산 변경은 없다.
- **Execution Flow / Logic**:
  1. 현재 보스는 Tiled 실맵 대신 segment fallback을 사용한다. 코인 목록이 있으면 `StageRuntime.buildFromSegments`가 x=180/252/324, y=450에 만든다.
  2. 기본 `createCoin`은 `appearance="legacy"`에서 18×18, `0xf0b95f` 타원을 생성한다. 이 공용 렌더러는 다른 월드에도 쓰이므로 삭제하거나 전역 숨김 처리하지 않는다.
  3. 월드 1 보스 데이터에서만 목록을 비워 runtime에 coin entity가 0개가 되게 한다. 코인 overlap도 대상이 없어지므로 숨은 적립이 발생하지 않는다.
  4. 플랫폼, 보스 spawn, collectibles, exit, 맵 폭 1920과 최근 추가한 타일 바닥은 유지한다. 보스 arena 축소는 별도 옛 계획에 있다.
- **Error & Exception Handling**: 빈 코인 목록은 정상 데이터다. 하드코딩한 ID를 렌더 단계에서 예외 처리하거나 로드 실패를 삼키지 않는다.
- **State Transition & Return**: stage/진행 상태 전이는 기존과 같으며 코인 원인은 데이터 레벨에서 제거된다.

### I02. 데이터와 실제 보스 화면 확인

- Related Files:
  - `scripts/boss-stage-content.test.mjs` :: 월드 1 보스 코인 회귀; new
  - `scripts/bowl-defense.test.mjs` :: TypeScript 로딩 방식 참고; read-only
  - `scripts/world01-maps.mjs` :: 일반 맵 간식/체크포인트 검증; read-only

#### Details

- 기존 테스트의 `createRequire` + `typescript.transpileModule` 훅으로 `worlds.ts` 데이터를 읽는다. Phaser 렌더러를 가짜 구현해서 출력 문자열만 비교하는 테스트는 만들지 않는다.
- `STAGE_DEFINITIONS`에서 월드 1 보스 segment 전체의 `coins.length` 합계가 0인지 검사한다. 다른 월드 보스의 기존 코인 목록은 유지되는지도 확인한다.
- `world01:maps:check`로 일반 맵의 기존 간식 구성과 체크포인트 배치를 검증한다. 브라우저에서는 보스 입장/재입장 시 원이 없고 runtime coin 수가 0인지 확인한다.
- 제거한 위치를 지나도 지갑이 늘지 않는다. 일반 구간 진짜 간식 획득은 적립되고 가짜 간식의 기존 동작은 유지된다.

## Acceptance Criteria

- [x] 월드 1 보스 segment 코인 목록과 runtime coin entity가 모두 0이다.
- [x] 보스전 입장/재입장에 노란 원이 없고, 원래 위치에서 숨은 코인이 적립되지 않는다.
- [x] 일반 구간 간식, 보스 타일 바닥, 다른 월드 콘텐츠가 유지된다.

## Validation

- `node --test scripts/boss-stage-content.test.mjs` — 보스 데이터 회귀 통과.
- `npm.cmd run world01:maps:check` — 일반 맵 간식/체크포인트 데이터 통과.
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- 실행 중인 개발 서버가 있으면 재사용하고, 없다면 `npm.cmd run dev`로 보스 화면을 확인한다. 사용자 서버를 종료하지 않는다.

## Commit Message

```text
fix(world01): 보스전의 노란 기본 코인을 제거한다

Plan: 2026-10-12-world01-pause-music-checkpoints
Phase: P01-feedback-and-audio
Task: T01-boss-coin-cleanup

- 월드 1 보스 segment에서 기본 코인 생성 데이터를 제거
- 일반 구간 간식과 다른 월드 데이터를 보존하고 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

자동 2건, 일반 맵 검사, 타입 검사 통과. 브라우저 보스 입장·재입장 모두 코인0개, 지갑10 유지, 바닥 존재, 일반 구간 코인 유지 확인.
