# Task: T01 월드1 마지막 깃발에서 맵 간 부활

## Status: done

## Goal

월드1 맵 경계를 넘은 뒤에도 실제 마지막 깃발로 복귀한다. 체크포인트가 없으면 월드 시작점으로 돌아간다. 깃발/맵 상태 복원, 코인·사망 기록, 재접속이 함께 일치해야 한다.

## Decision Summary

- 현재 CheckpointSystem은 씬 종료 시 초기화되고 RestartController는 현재 맵 spawn으로 fallback한다. 월드1에만 공유 복귀 정책을 연결한다.
- 보스 고정4단계 복귀를 실제 저장 지점 기반으로 통합한다. 실제로 밟지 않은 깃발은 활성화하지 않는다. 보스 패배의900ms 지연은 유지한다.

## Implementation

### I01. 저장과 복귀 정책

- Related Files:
  - `src/game/core/types.ts` :: ProgressState, World01CheckpointStageId — 저장 필드; modify.
  - `src/game/core/constants.ts` :: createDefaultProgressState — null 기본값; modify.
  - `src/game/systems/world01Respawn.ts` :: isWorld01CheckpointStageId, getWorld01Respawn — Phaser 없는 정책; new.
  - `src/game/persistence/migrations.ts` :: migrateSave — 기존v2 호환/잘못된 체크포인트만 무시; modify.
  - `src/game/persistence/AutoSaveCoordinator.ts` :: constructor — checkpoint-activated 즉시 저장; modify.
  - `src/game/scenes/PreloadScene.ts` :: create — 월드1 미완료 이어하기에서 공유 정책 사용; modify.

#### Details

- **Signatures & Types**:

  ```typescript
  type World01CheckpointStageId = "world-01-stage-2" | "world-01-stage-4";
  // ProgressState 필수 런타임 필드; 옛 저장 입력에는 없어도 된다.
  world01CheckpointStageId: World01CheckpointStageId | null;
  function isWorld01CheckpointStageId(value: unknown): value is World01CheckpointStageId;
  function getWorld01Respawn(progress: Pick<ProgressState, "world01CheckpointStageId">): {
    stageId: "world-01-stage-1" | World01CheckpointStageId;
    resumeCheckpointId?: string;
  };
  ```

- **Data & Schema Fields**: null→1단계 시작, stage2/4→동일 stage의 `${stageId}-checkpoint`. 숫자 좌표는 저장하지 않고 현재 맵의 안전 좌표를 사용한다. schemaVersion2/기존 저장 key 유지, 유효하지 않은 값은 null로 정규화하며 다른 기록을 초기화하지 않는다.
- **Execution Flow / Logic**:
  1. 실제 깃발 활성화 성공 후, 완료/코인 이벤트 전에 진행 정보에 checkpoint stage를 저장하고 checkpoint-activated를 보낸다.
  2. AutoSave는 이 이벤트를 즉시 flush한다. 일반 맵 완료/다음 맵 시작으로 checkpoint stage를 갱신하지 않는다.
  3. Preload의 기존 보스 클리어 분기를 보존한다. firstUncleared가 월드1이면 getWorld01Respawn으로 시작한다. 다른 월드에는 이전 동작 유지.
  4. 옛 저장의 clearedStages로 체크포인트를 추정하지 않는다. 코인/이름/스킬/사망/완료 기록 보존을 테스트한다.

### I02. 다른 맵으로 사망 복귀 및 스냅샷 유지

- Related Files:
  - `src/game/scenes/StageScene.ts` :: create, activateCheckpoint, handleCalicoThirdHit, 새 restartAtWorldCheckpoint/restoreCheckpoint — 공유 복귀와 씬 생명주기; modify.
  - `src/game/systems/CheckpointSystem.ts` :: 새 restore — 같은 맵의 체크포인트 스냅샷 무음 복구; modify.
  - `src/game/systems/RestartController.ts` :: constructor, restartAtCheckpointOrSpawn — 외부 맵 전환 callback; modify.
  - `src/game/systems/DeathSystem.ts` :: handleDeath — 기존 카운트/중복 방어 유지; read-only.
  - `src/game/maps/MapInteractionSystem.ts`, `src/game/systems/MapGimmickSystem.ts` — 기존 reset와 안전한 가짜 간식 복원 사용; read-only.

#### Details

- **Signatures & Types**:

  ```typescript
  // RestartController 생성자 끝에 선택 인자 추가
  onRestartElsewhere?: () => boolean;
  // CheckpointSystem
  public restore(snapshot: CheckpointSnapshot): boolean;
  // StageScene
  private restartAtWorldCheckpoint(): boolean;
  private restoreCheckpoint(checkpointId: string): void;
  ```

- **Data & Schema Fields**: Phaser registry `world01CheckpointSnapshot`에 CheckpointSnapshot 복사본을 유지한다. stageId/checkpointId/randomSeed/안전한 mapSnapshot 포함. 씬 종료에서 로컬 체크포인트만 초기화하고 공유 복사본은 보존한다. 다른 월드에서 사용하지 않는다.
- **Execution Flow / Logic**:
  1. RestartController는 외부 재시작 callback이 true이면 기존 현재 맵 teleport를 실행하지 않는다. 다른 월드/같은 맵은 false로 기존 로컬 복귀를 유지한다.
  2. 월드1의 복귀 stage가 현재와 다르면 상태를 dying으로 바꾸고, 중복 전환 latch 및 body 정지 후 StageScene을 목표 stage/resumeCheckpointId로 시작한다. 일반 사망은 씬 전환, 보스는900ms 뒤 전환. 카운트는 DeathSystem에서 기존대로 사망한 맵에 한 번 기록한다.
  3. handleCalicoThirdHit는 death-requested만 발행한다. 별도 고정4단계 이동 타이머를 제거한다. 같은 사망에 이중 전환/카운트가 없도록 한다.
  4. create의 resumeCheckpointId 제한을 실제 해당 맵 체크포인트 검증으로 바꾼다. registry 복사본의 stage/id가 일치하면 restore하고 map/gimmick reset을 실행한다. 복사본이 없는 재접속은 깃발 좌표에서 silent activate한다. 복원은 차임을 내지 않는다.
  5. CheckpointSystem.restore는 다른 stage/가짜 체크포인트를 거절하고 깊은 복사본으로 runtime checkpointId/used/seed/version을 복구한다. 반환된 맵의 Player.resetTo와 camera.follow로 안전한 좌표·body history를 맞춘다.
  6. 깃발을 다시 밟아도 이미 활성화된 로컬 snapshot 때문에 새 차임/저장 갱신은 없다.4단계 새 깃발은2단계 공유 복사본을 교체한다.
  7. Error & Exception Handling: 현재 맵에 없는 복원 ID를 임의 활성화하지 않는다. 저장 입력 정규화로 존재하지 않는 맵/깃발을 거절한다. 씬 전환 직전 dying이 다음 프레임 사망/완료를 막는다.
  8. 월드2 진입은 이전 월드의 깃발로 돌아가지 않는다. 코인 잔액/clearedStages를 되돌리지 않으며 기존 완료 문구 정책과 보스 승리 연출을 유지한다.

### I03. 회귀 테스트와 브라우저 검증

- Related Files:
  - `scripts/world01-respawn.test.mjs` — 복귀 정책/저장 호환/스냅샷 복원/즉시 저장 테스트; new.
  - `scripts/checkpoint-feedback.test.mjs`, `scripts/death-system.test.mjs`, `scripts/checkpoint-gimmick-state.test.mjs` 등 기존 자동 테스트; read-only unless obsolete expectation.
  - `.memory/test-plans/2026-10-13-world01-cross-map-checkpoint.md`, `assets/world01-cross-map-checkpoint.json` — 실제 측정 결과; new.
- 실제 Chromium 별도 저장 컨텍스트로 검증한다. 사용자 저장 초기화 금지. fixture 이동 후 실제 깃발 overlap/오른쪽 끝 통과/실제 DeathSystem 경로로 사망한다.
- 필수:1→2 깃발 전 사망→1 시작,2 깃발→3 사망→2 깃발,2 깃발→4 새 깃발 전 사망→2 깃발,4 새 깃발→보스 패배→4 깃발. 반복 사망에서도 카운트 각각1회이며 시작점/깃발 좌표에 고정된다.
- 깃발 복원 뒤 차임0회·새 깃발 최초 차임1회, 복사본 맵 상태 유지·불꽃 효과 반복 사망0회, 맵 끝 낙하 없음과 완료 문구0개를 확인한다.
- 새로고침 후 마지막 깃발 복귀, 코인 잔액/사망/완료 기록 보존, 보스 승리 후 기존 클리어 화면과 월드2 이동 확인. 월드2 사망은 월드1로 돌아가지 않는다.

## Acceptance Criteria

- [x] 월드1 일반 맵 진입으로 마지막 깃발이 바뀌지 않는다.
- [x] 맵 간 사망은 마지막 깃발 또는 월드 시작점으로 복귀하고 카운트가1회 증가한다.
- [x] 새 깃발·무음 복원·안전한 스냅샷·재접속 저장이 일치한다.
- [x] 기존 코인/클리어 기록·맵 끝·보스 승리·월드2 정책을 보존한다.

## Validation

- `$testFiles = @(rg --files scripts -g '*.test.mjs'); node --experimental-strip-types --test @testFiles`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run world01:maps:check`
- 실제 Chromium 경계→사망→이전 맵 깃발 복귀/재접속/보스/월드2 검증, pageerror0건.
- `git -c core.autocrlf=false diff --check`

## Commit Message

```text
fix(checkpoint): 맵을 넘어도 월드1의 마지막 깃발에서 부활하게 한다

Plan: 2026-10-13-world01-cross-map-checkpoint
Phase: P01-checkpoint
Task: T01-world-checkpoint

- 실제 깃발을 저장하고 맵 경계와 재접속에도 유지한다
- 사망 복귀와 보스 패배를 같은 정책으로 연결하고 회귀를 검증한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

- [검증 기록](../../../test-plans/2026-10-13-world01-cross-map-checkpoint.md): 자동53건·타입·lint·빌드·맵 검사 통과. 실제 경계 뒤 사망/3단계 가시 충돌→2단계 깃발, 새4단계 깃발→보스 패배 복귀, 미활성 깃발 거절, 반복 사망·재접속·코인 보존·월드2 회귀 확인. pageerror0건.
- 복귀 정보를 맵 완료 기록과 분리하고 실제 깃발만 저장한다. 맵 간 복귀는 현재 맵 순간이동보다 먼저 처리하며, 보스 고정 복귀를 같은 규칙으로 통합했다.
- 구형 저장의 깃발은 추정하지 않으므로 최초 이어하기는 월드 시작점이다. 코인/클리어/스킬 등 다른 기록은 유지한다. 세션 스냅샷과 영구 깃발 참조의 차이는 검증 기록에 명시했다.
- 요청 범위 밖 발견: 특이사항 없음.
