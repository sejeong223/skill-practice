# Task: T04 철근 명중·착지에 충돌음 연결

## Status: done

## Goal

낙하 철근이 코기에 맞거나 바닥에 닿는 정확한 프레임에 T03의 금속 `꽝!` 소리를 한 번 재생하고, 철근 사망에 기존 카툰 사망음이 겹치지 않게 한다.

## Decision Summary

- 철근 1개당 코기 명중 또는 바닥 착지 중 먼저 확정된 결과만 충돌음을 낸다. 코기 명중이 바닥 착지와 같은 프레임에 일어나면 명중이 우선한다.
- 일시정지 중에는 낙하와 소리가 함께 멈춘다. 명중 직후 재시작해도 이미 시작한 충돌음 꼬리는 허용하지만, 이전 시도에서 두 번째 소리가 나서는 안 된다.

## Implementation

### I01. 철근 충돌 사건과 사망 식별자

- Related Files:
  - `src/game/core/events.ts` :: `GameplayEventMap` — 새 `world03-steel-impact` 이벤트 타입; modify
  - `src/game/systems/World03SteelBeamDropSystem.ts` :: `World03SteelBeamDropSystem.update`, `BeamRuntime`, `resetForAttempt` — 충돌·착지 순간 한 번 발행; modify
  - `src/game/systems/DeathSystem.ts` :: `DeathSystem.handleDeath` — `gimmickId`를 `death`로 전달하는 현행 흐름 확인만; read-only
  - `src/game/scenes/StageScene.ts` :: `new World03SteelBeamDropSystem(...)` — 기존 `GameplayEventBus`를 그대로 전달하는지 확인만; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface GameplayEventMap {
    "world03-steel-impact": {
      beamId: string;
      surface: "player" | "floor";
      now: number;
    };
  }
  // 기존 death-requested: { stageId, cause: "trap", checkpointId, gimmickId?: string, now }
  ```
- **Data & Schema Fields**:
  - `beamId`: `World03SteelBeamDefinition.id`와 동일한 `${stageId}-steel-beam-${index + 1}`, null 없음.
  - `surface`: 낙하 중 `sweptAabbOverlap` 명중 시 `"player"`, 명중하지 않고 `LANDED_CENTER_Y` 도달 시 `"floor"`.
  - `now`: `scene.time.now` 밀리초. `death-requested.gimmickId`에는 명중한 철근의 `beamId`를 넣는다. 추가 저장 상태·세이브 스키마는 없다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `destroyed`, `deathPending`, `!canHandleContact()`이면 기존처럼 즉시 반환하여 소리도 내지 않는다. `elapsed`가 0이거나 정지 중에는 착지 분기로 가지 않는다.
  2. Core Processing: `falling`에서 swept 충돌이 참이면 먼저 `deathPending = true`, 이어 `world03-steel-impact({beamId, surface:"player", now})`을 한 번 발행한 뒤 `death-requested({..., gimmickId:beamId})`를 발행하고 `return`한다. 충돌이 없고 `nextY >= LANDED_CENTER_Y`면 `status = "landed"`, 300ms 타이머를 설정한 뒤 `surface:"floor"`를 한 번 발행한다.
  3. Error & Exception Handling: 같은 프레임 명중·착지가 모두 가능할 때 명중 분기가 우선해서 floor 이벤트는 발생하지 않는다. 이벤트 리스너의 동기 재시작이 중복 발행을 만들지 않도록 명중 `deathPending`, 착지 `status`를 이벤트 발행 전에 바꾼다. `finished`, `skipped` 철근과 폐기된 시스템은 소리를 내지 않는다.
  4. State Transition & Return: 기존 `armed → falling → landed → finished`와 체크포인트 이전 `skipped` 상태를 유지한다. 사망 후 `resetForAttempt`는 기존처럼 앞쪽 철근만 다시 무장한다.

### I02. 실제 효과음 재생과 사망음 정리

- Related Files:
  - `src/game/audio/AudioManager.ts` :: `AudioManager.constructor`, `playSfx`, `playFeedbackSound` — 사건 구독, 철근 사망의 카툰음 생략; modify
  - `src/game/audio/audioManifest.ts` :: `FEEDBACK_AUDIO["world-03-steel-impact"]` — T03에서 등록한 키를 사용; read-only
  - `scripts/audio-pause.test.mjs` :: `harness`, `world03-steel-impact 이벤트 재생` — 이벤트·음량·일시정지·죽음 중복 방지 검사; modify

#### Details

- **Signatures & Types**:
  ```typescript
  gameplayBus.on("world03-steel-impact", () => this.playSfx("world-03-steel-impact"));
  gameplayBus.on("death", (payload) => {
    const steelBeamDeath = payload.stageId.startsWith("world-03-stage-") &&
      payload.gimmickId?.startsWith(`${payload.stageId}-steel-beam-`);
    if (!steelBeamDeath) this.playSfx("death-cartoon");
  });
  ```
- **Data & Schema Fields**:
  - `scripts/audio-pause.test.mjs`의 mock 바이너리 캐시에 `"feedback-world-03-steel-impact": 8`을 추가한다. T03의 `gain:0.52`, `duckMusic:true`에 따라 재생 중 배경음악 음량은 기존 `0.38`로 낮아지고 소리가 끝나면 1로 복원된다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `AudioManager`가 `GameplayEventBus`를 받은 스테이지에서만 새 이벤트를 구독한다. T03의 파일과 바이너리 캐시 키가 이미 있어야 한다.
  2. Core Processing: `world03-steel-impact` 발생 시 `playSfx`를 한 번 호출한다. `death`의 `gimmickId`가 동일 스테이지의 철근 ID면 기존 `death-cartoon`을 생략한다. 다른 함정·낙사·보스 사망은 기존 효과음을 유지한다.
  3. Error & Exception Handling: 오디오가 꺼져 있거나 일시정지·장면 폐기 중이면 `playSfx`의 현행 가드와 `effectsGeneration`을 통해 새 소리를 예약하지 않는다. 이미 재생 중인 충돌음은 장면을 폐기하면 정지한다. 체크포인트 재시작으로 같은 철근이 재발동할 때는 새로운 충돌 사건에서만 다시 소리를 낸다.
  4. State Transition & Return: 일반 진행에서는 낙하 철근 1개마다 `player`/`floor` 중 단 한 번 0.52 gain의 소리가 나오고, BGM은 재생 중에만 낮아진다.

### I03. 사건 순서와 체감 검증

- Related Files:
  - `scripts/world03-steel-beams.test.mjs` :: `direct hit`, `landing`, `pause`, `restart` — 새 이벤트 수·순서와 중복 부재 검증; modify
  - `.memory/test-plans/2026-10-28-world03-beam-drum-sequence-impact.md` :: `T04 최종 확인` — 실제 플레이 음색·타이밍 기록; modify

#### Details

- **Signatures & Types**:
  ```javascript
  // 명중 로그 순서: world03-steel-impact(surface: "player"), death-requested(gimmickId: beamId)
  // 무명중 로그: world03-steel-impact(surface: "floor") 단 한 번
  ```
- **Data & Schema Fields**:
  - 로그에는 `beamId`, `surface`, `now`, 사망의 `gimmickId`를 검증한다. 단순 총 이벤트 수 대신 사건 종류별 카운트를 비교해 추가 음향 이벤트 때문에 기존 사망 테스트가 잘못 통과하지 않도록 한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01의 새 좌표와 T03의 WAV가 있는 상태에서 테스트를 갱신한다.
  2. Core Processing: 전진 명중, 왼쪽 회피 후 바닥 충돌, 같은 프레임 명중/착지, 300ms 잔상, 일시정지, 체크포인트 재시작, 폐기 각각에서 이벤트 수를 확인한다. `AudioManager` mock에서는 새 바이너리 ID 8, gain 0.52, BGM duck/복원, 철근 사망 cartoon 0회, 다른 사망 cartoon 1회를 확인한다.
  3. Error & Exception Handling: `death-requested` 뒤 재시작해도 같은 시도에서 floor 충돌음이 추가되지 않아야 한다. 정지 중 이벤트가 없고, 해독이 늦어도 `destroy()` 뒤 소리가 새로 시작되지 않아야 한다.
  4. State Transition & Return: 실제 월드 3에서 드럼통을 넘은 뒤 철근에 맞으면 명중음 1회, 돌아서 피하면 바닥음 1회로 들린다. 스테이지 1~4 모두 같은 규칙이다.

## Acceptance Criteria

- [x] 명중·착지의 정확한 프레임에 같은 금속 충돌음이 한 번만 재생되고, 철근 사망에 카툰 사망음이 겹치지 않는다 (자동 검증).
- [x] 기존 무예고 낙하·뒷걸음질 회피·체크포인트 재시작과 다른 원인 사망음이 유지된다 (자동 검증).
- [x] BGM duck/복원, 정지·폐기, 소리 없는 환경에서 오류 없이 동작한다 (자동 검증). 실제 플레이 청취는 환경 제약으로 미실시했으며 검증 기록에 남겼다.

## Validation

- `node --test scripts/world03-steel-beams.test.mjs scripts/world03-steel-impact-audio.test.mjs scripts/audio-pause.test.mjs scripts/death-system.test.mjs` — 사건·재생·사망 회귀 통과.
- `node scripts/generate-world03-steel-impact.mjs --check` — 오디오 파일 원본 일치.
- `node scripts/validate-assets.mjs` — 필수 자산 누락 없음.
- `npx.cmd tsc --noEmit` — 이벤트·오디오 타입 오류 없음.
- `npm.cmd run lint` — 오류 없음.
- `npm.cmd run build` — 배포 번들 생성.
- `npm.cmd run dev` — 월드 3 일반 스테이지에서 명중·회피·정지·재시작의 충돌음과 BGM을 직접 듣고 검증 기록에 남김. 인트로가 멈추는 세션에서는 T01에 적은 격리 테스트 저장의 기존 스테이지 직접 시작 경로를 사용하며, 인트로 코드는 수정하지 않음.

## Commit Message

```text
feat(world03): 철근 명중과 착지에 금속 충돌음 연결

Plan: 2026-10-28-world03-beam-drum-sequence-impact
Phase: P01-beam-sequence-impact
Task: T04-impact-playback

- 철근별 첫 충돌 사건을 발행하고 효과음을 한 번 재생
- 철근 사망의 카툰 효과음 중복을 없애고 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (실제 청취·조작 한계는 검증 기록 참조)
- commit: Task 커밋에 포함
