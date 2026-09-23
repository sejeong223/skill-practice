# Task: T01 World 1 기믹 계약과 카탈로그

## Status: done

## Goal

현재 `MapObjectDefinition`과 단순 `TrapDefinition`으로 표현할 수 없는 World 1의 방향 조건, 무힌트 즉사, 입력 통제불능, 100회 연타 탈출, 가짜 보상·가짜 체크포인트를 데이터로 표현하고, World 1에 최소 54개의 고유 배치 ID와 파훼 조건을 등록한다.

## Decision Summary

- 기믹은 맵 오브젝트의 시각 정보와 분리된 `WorldGimmickDefinition`으로 관리한다.
- `hintPolicy`는 World 1에서 항상 `none`이며, validator가 힌트용 telegraph/audio/cue 등록을 오류로 처리한다.
- lethal 기믹도 고정 seed로 재현되며, 재시작 시 같은 좌표·같은 조건을 사용한다.

## Implementation

### I01. 기믹 모델과 이벤트 계약

- Related Files:
  - `src/game/core/contentTypes.ts` :: `GimmickKind`, `GimmickTrigger`, `GimmickCounterplay`, `GimmickOutcome`, `WorldGimmickDefinition`, `StageMapDefinition`; modify
  - `src/game/core/runtimeTypes.ts` :: `GimmickRuntimeState`, `MapRuntimeSnapshot`; modify
  - `src/game/core/events.ts` :: `gimmick-triggered`, `gimmick-counterplay-progress`, `gimmick-outcome`; modify
  - `src/game/stages/stageEvents.ts` :: map gimmick diagnostics event; modify

#### Details

- `GimmickKind`은 다음을 반드시 포함한다: `ant-trip`, `forward-jump-wall`, `ground-collapse`, `ground-rise`, `fake-bone-green`, `fake-bone-reverse`, `fake-bone-fire`, `fake-checkpoint`, `box-cat-arm`, `cloud-rain`, `revealed-white-spike`, `jump-pigeon`, `name-bubble-control-loss`.
- `GimmickTrigger`는 `walk-enter`, `forward-jump`, `jump-over`, `timed-after-enter`, `collect`, `checkpoint-touch`, `jump-in-zone`, `dialogue-enter`를 포함한다.
- `GimmickCounterplay`의 필드는 `action: "move-backward" | "avoid-jump" | "jump-before-zone" | "micro-forward-then-back" | "do-not-collect" | "jump-then-back" | "mash-jump" | "precision-movement"`, `requiredPresses?: number`, `windowMs?: number`, `notes: string`이다.
- `GimmickOutcome`의 필드는 `kind: "instant-death" | "forced-control-death" | "launch-death"`, `deathCause: "trap" | "scripted"`, `controlOverride?: "run-left" | "drift-backward" | "launch-up"`, `durationMs?: number`, `deathDelayMs?: number`이다.
- `WorldGimmickDefinition`은 다음 필드를 가진다: `id`, `worldId`, `stageId`, `sectionIndex: 2 | 3 | 4`, `objectId`, `kind`, `trigger`, `x`, `y`, `width`, `height`, `visualKey`, `variantKey?`, `hintPolicy: "none"`, `lethal: true`, `counterplay`, `outcome`, `seedGroup?`, `chainIds`.
- `StageMapDefinition`에 `gimmicks: readonly WorldGimmickDefinition[]`를 추가한다. 맵 object는 기믹 `objectId`를 참조하며, Tiled JSON의 properties와 데이터 카탈로그가 불일치하면 검증 오류가 된다.
- `GimmickRuntimeState`는 `gimmickId`, `status: "armed" | "triggered" | "escaped" | "dead"`, `startedAt`, `counterpresses`, `snapshotSeed`를 저장한다.
- `gimmick-triggered`는 `stageId`, `gimmickId`, `kind`, `trigger`, `now`를, `gimmick-counterplay-progress`는 `gimmickId`, `current`, `required`, `now`를, `gimmick-outcome`은 `gimmickId`, `outcome`, `deathCause`, `now`를 전달한다.

### I02. World 1 카탈로그 등록

- Related Files:
  - `src/game/data/world01Gimmicks.ts` :: `WORLD01_GIMMICKS`, `WORLD01_GIMMICK_COUNT`; new
  - `src/game/data/worlds.ts` :: World 1 stage metadata; modify
  - `src/game/data/worldMaps.ts` :: World 1 section vertical flags and object references; modify

#### Details

- `WORLD01_GIMMICKS`는 stage 1~4의 section 2~4에만 등록하며 최소 54개를 가진다.
- 계열별 최소 수량은 `ground-collapse: 8`, `ground-rise: 8`, `revealed-white-spike: 8`, `jump-pigeon: 8`, `fake-bone-green: 2`, `fake-bone-reverse: 2`, `fake-bone-fire: 2`, `fake-checkpoint: 3`, `box-cat-arm: 3`, `cloud-rain: 3`, `ant-trip: 2`, `forward-jump-wall: 3`, `name-bubble-control-loss: 2`이다.
- stage 1은 무법지대 뒷골목에서 개미·전방 점프 벽·땅 꺼짐·땅 솟음·가짜 코인·가짜 체크포인트를 처음 배치한다. stage 2는 빨래방 지붕길의 강제 상승 구간에 구름·비둘기·백색 가시를 집중한다. stage 3은 도둑고양이 통로의 상자·코인·말풍선 변형을 중첩한다. stage 4는 담벼락 추격전에서 이전 기믹을 동시에 재사용한다.
- `WORLD01_GIMMICK_COUNT`는 런타임에서 계산하지 않고 catalog length와 validator 양쪽에서 검사 가능한 상수로 둔다.

## Acceptance Criteria

- [ ] 13개 기믹 종류와 각 trigger·counterplay·outcome이 타입으로 표현된다.
- [ ] World 1 카탈로그가 최소 54개이며 section 1·5에 기믹이 없다.
- [ ] 모든 World 1 즉사 항목의 `hintPolicy`가 `none`이고 스킬·도구 의존성이 없다.
- [ ] 맵 스냅샷에 기믹 발동 상태와 연타 진행 상태를 저장할 수 있다.

## Validation

- `npm.cmd run lint` — 타입·이벤트 payload 오류가 없어야 한다.
- `npm.cmd run build` — 콘텐츠 레지스트리 초기화와 타입 검사가 통과해야 한다.
- `node` 또는 기존 registry diagnostic — World 1 gimmick count가 54 이상이고 계열별 최소 수량을 출력해야 한다.

## Commit Message

```text
feat(map): 월드1 억까 기믹 계약과 카탈로그 정의

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T01-gimmick-contract-and-catalog

- Add typed instant-death and control-loss gimmick contracts
- Register World 1 residential hazard catalog and counterplay metadata
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: `feat(map): 월드1 억까 기믹 계약과 카탈로그 정의`
