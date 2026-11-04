# Task: T03 전 월드 체크포인트 스냅샷과 재개 경로

## Status: pending

## Goal

서버가 보낸 현재 월드 저장점에서 재개하고 실제 CP 도달과 복원을 구분하는 Phaser 연결을 제공한다.

## Decision Summary

- 기존 local 개발 경로는 유지하고 cloud entry가 있을 때만 우선한다. 복원 이벤트는 새 순위 기록으로 취급하지 않는다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 게임 연결

- Related Files:
  - `src/game/cloud/resume.ts` :: `buildCloudEntry, toCloudCheckpoint, restoreCloudCheckpoint` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/cloud/GameCloudBridge.ts` :: `GameCloudBridge, collectObservation` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/components/game/PhaserGame.tsx` :: `PhaserGameProps.cloudEntry` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/config.ts` :: `CreateGameOptions, createPhaserConfig, registry keys` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/scenes/PreloadScene.ts` :: `create cloud entry branch` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/scenes/StageScene.ts` :: `create, restoreCheckpoint, activateCheckpoint, rememberWorld02Visit` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/stages/stageEvents.ts` :: `checkpoint-activated, world-selection-committed, cloud-resume-changed` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/stages/StageRuntime.ts` :: `complete ordering` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `src/game/systems/CheckpointSystem.ts` :: `getSnapshot, restore` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `src/game/systems/MapGimmickSystem.ts` :: `reset, getSnapshotStates` — 기존 CP 기믹 복원 동작; read-only
  - `src/game/systems/checkpointGimmickState.ts` :: `toCheckpointGimmickState` — 소비된 간식과 지연 사망의 기존 복원 규칙; read-only
  - `src/game/data/world02Travel.ts` :: `World02TravelState` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `src/game/systems/developmentStart.ts` :: `local-only entry` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `package.json` :: `test:cloud-resume` — 이 Task에서 다룰 연결·상태·설정; modify

#### Details

- **Signatures & Types**:
```ts
interface CloudEntry { progress:ProgressState; resume:ResumeState; activeStageId:StageId }
export function buildCloudEntry(bootstrap:Bootstrap):CloudEntry;
export function toCloudCheckpoint(snapshot:CheckpointSnapshot,capturedAt:number):CloudCheckpoint;
export function restoreCloudCheckpoint(snapshot:CloudCheckpoint,spawn:{x:number;y:number},now:number):CheckpointSnapshot;
class GameCloudBridge {
 constructor(bus:GameEventBus,getProgress:()=>ProgressState,getRuntime:()=>{seed:number;world02Travel:World02TravelState},onObservation:(event:SaveEvent,progress:ProgressState)=>void);
 destroy():void;
}
// StageEventMap 확장: 기존 리스너 payload 호환성 유지
type CheckpointActivatedPayload={
 stageId:StageId;checkpointId:string;origin:"reached"|"restored";snapshot:CloudCheckpoint;
};
type WorldSelectionCommittedPayload={worldId:SelectableWorldId;selection:WorldSelectionRequest};
type CloudResumeChangedPayload={resume:ResumeState};
```

- **Data & Schema Fields**:

```ts
type Namespace = "prod"|"test"; // 서버 oid allowlist로만 결정
interface Identity { tenantId: string; objectId: string; playerId: string; namespace: Namespace }
interface CloudCheckpoint {
  checkpointId: string; stageId: StageId; x: number; y: number; facing: 1|-1;
  randomSeed: number; mapSnapshotVersion: number; contentVersion: 1; capturedAt: number; mapSnapshot: MapRuntimeSnapshot|null;
}
interface ResumeState {
  worldId: WorldId; stageId: StageId; checkpoint: CloudCheckpoint|null;
  worldSeed: number; world02Travel: World02TravelState; completed: boolean;
}
interface BestRecord { milestoneId: string; progressRank: number; deaths: number; runId: string }
interface CurrentState {
  runId: string; version: number; lastSequence: number; activeStageId: StageId;
  pendingCheckpointId: string|null; progress: ProgressState; resume: ResumeState;
}
interface Lease { sessionId: string|null; generation: number; expiresAt: string }
interface Bootstrap {
  schemaVersion: 1; playerId: string; displayName: string;
  current: CurrentState; best: BestRecord|null; lease: Lease; serverTime: string;
}
interface MutationBase {
  requestId: string; sessionId: string; generation: number; runId: string;
  expectedVersion: number; sequence: number;
}
type SaveEvent =
 | { kind:"state"; stageId:StageId }
 | { kind:"stage-enter"; stageId:StageId; seed:number; world02Travel:World02TravelState }
 | { kind:"stage-complete"; stageId:StageId }
 | { kind:"world-select"; selection:WorldSelectionRequest }
 | { kind:"checkpoint"; stageId:StageId; origin:"reached"|"restored"; snapshot:CloudCheckpoint };
interface SaveRequest extends MutationBase { schemaVersion:1; event:SaveEvent; progress:ProgressState }
interface ResetRequest extends MutationBase { schemaVersion:1 }
interface SaveAck {
  requestId:string; runId:string; version:number; sequence:number;
  best:BestRecord|null; committedAt:string;
}
interface AcquireRequest { requestId:string; sessionId:string; takeover:boolean }
interface LeaseRequest { sessionId:string; generation:number }
interface LeaderboardRow { rank:number; nickname:string; deaths:number; location:string }
interface LeaderboardResponse { rows:LeaderboardRow[]; generatedAt:string }
type ApiErrorCode =
 "INVALID_REQUEST"|"UNAUTHENTICATED"|"FORBIDDEN"|"SESSION_CONFLICT"|"SESSION_LOST"|
 "VERSION_CONFLICT"|"RUN_CONFLICT"|"SEQUENCE_CONFLICT"|"REQUEST_REUSED"|
 "THROTTLED"|"UNAVAILABLE"|"UNSUPPORTED_SAVE";
interface ApiErrorBody { error:{code:ApiErrorCode;message:string;retryAfterMs:number|null} }
```
- 모든 DTO의 위 필드는 required, `null`만 명시된 필드에서 허용. UUID 문자열=requestId/sessionId/runId, ISO UTC=expiresAt/serverTime/committedAt. sequence/version/generation은 안전한 정수≥0(요청 sequence는 ≥1). playerId=`namespace:lowercase(tid):lowercase(oid)`; 요청 본문으로 소유자를 받지 않는다.
- current 초기 version=0,lastSequence=0,activeStageId=world-01-stage-1,pendingCheckpointId=null; runId는 서버 UUID. resume는 world01/stage1/checkpoint=null/worldSeed=1/world02Travel={}/completed=false. best=null, lease sessionId=null,generation=0,expiresAt=epoch.
- MapRuntimeSnapshot은 `src/game/core/runtimeTypes.ts`의 checkpointId/randomSeed/activeObjectStates/movedObjectPositions/spawnedEntityIds/firedChainIds/objectStates/gimmickStates 전부. objectStates={active,x,y,collision,variant?}; gimmickStates={gimmickId,status,startedAt:number|null,counterpresses,snapshotSeed}. `World02TravelState`는 `src/game/data/world02Travel.ts`의 stage1~3→{seed,checkpointSnapshot:null|CheckpointSnapshot}. 저장 시 optional seed/version을 채워 JSON 안전한 값으로 만든다.
- capturedAt은 CP를 저장한 scene.time.now이며 유한한 0 이상 수다. 복원 시 gimmick.startedAt=null은 유지하고, 숫자는 새 scene.time.now - max(0, capturedAt - 이전 startedAt)로 재기준화한다. 새 startedAt은 음수일 수 있으며 경과 시간을 보존한다. 기존 toCheckpointGimmickState의 소비된 간식/지연 사망 정리 규칙을 먼저 적용한다. 체크포인트 좌표는 현재 맵의 검증된 respawnPosition으로 보정한다. 이 시각을 랭킹 정렬에 사용하지 않는다.
- 서버 오류는 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 409 나머지 충돌, 429 THROTTLED, 503 UNAVAILABLE/UNSUPPORTED_SAVE. 오류를 200/default 저장으로 바꾸지 않는다. API 응답에 Cache-Control:no-store. 공개 랭킹에 playerId/oid/이메일/원본 저장 금지.


- **Execution Flow / Logic**:

1. Precondition & Validation: cloudEntry는 parseBootstrap을 통과한 서버 값만 받는다. registry의 cloudEntry/cloudResume/cloudCheckpoint를 사용한다. 기존 WORLD01_CHECKPOINT_SNAPSHOT_KEY와 world02TravelState에는 호환 값을 주입하고, 다른 계정/새 run에서 이전 값을 재사용하지 않는다.
2. Core Processing:
   - PhaserGame → createGame → createPhaserConfig preBoot까지 cloudEntry를 전달한다. 저장마다 객체 참조를 바꿔 게임을 재생성하지 않는다. Preload.create는 에셋 확인 후 cloudEntry를 우선한다. onboarding=false는 기존 인트로/이름 입력, 일반 저장은 resume.stageId(+CP id/seed)로 시작한다.
   - resume.completed=true면 Preload에서 ending-finished를 발행하고 해당 씬을 종료하여 GameShell의 기존 EndingOverlay를 표시한다. 보스 보상을 다시 지급하거나 점수를 재등록하지 않는다. firstUncleared가 없다고 W1 완료 화면으로 보내지 않는다.
   - world 시작이고 해당 인트로를 보지 않았다면 기존 world02/03/04 진입 장면을 거친다. 실제 존재하는 getWorld03Entry/getWorld04Entry를 사용하며 W2는 World02EntranceScene으로 연결한다. 진행 중인 CP 재개에는 인트로를 다시 넣지 않는다.
   - StageScene의 seed는 cloud snapshot을 우선한다. 등록된 CP snapshot을 현재 맵의 검증된 respawnPosition으로 보정하고 object/gimmick/map 상태를 복원한다. 코인 ledger는 최신 progress를 유지한다. 저장 시 capturedAt=this.time.now를 기록한다. 기존 toCheckpointGimmickState 정리 후 null이 아닌 startedAt을 새 now-max(0,capturedAt-oldStartedAt)으로 변환하여 CP 당시 경과 시간을 보존한다. snapshot 원본은 변경하지 않는다. 장면 시각을 벽시계 시각이나 랭킹 시간으로 사용하지 않는다.
   - contentVersion=1은 저장 포맷/맵 복원 호환성 표식이고 mapSnapshotVersion은 기존 런타임 카운터다. contentVersion 불일치, 존재하지 않는 오브젝트/CP는 오류로 진입을 멈춘다. 다른 위치로 조용히 바꾸지 않는다.
   - 실제 activateCheckpoint 성공에만 origin=reached와 깊은 복사 snapshot을 발행한다. create/restoreCheckpoint에서 되살린 CP는 origin=restored다. 기존 checkpoint-activated의 모든 생산자를 갱신하고 fakeCheckpoint 필터를 유지한다.
   - cloudResume에는 현재 world, 마지막 CP, seed, W2 방문 상태를 보존한다. 같은 world의 일반맵/보스 진입에서 CP를 지우지 않는다. world 변경은 이전 CP를 지운다. W2 후퇴는 같은 world이며 방문별 seed/CP를 유지한다. 복원 이벤트로 마지막 CP를 과거 지점으로 되돌리지 않는다.
   - world-selection-committed에 실제 selection을 포함한다. 서버가 합법적인 W1 CP/boss 선택을 확인하고, 선택 후 복원 snapshot이 pendingCheckpointId를 해소하도록 한다. 선택/복원으로 새 점수를 만들지 않는다.
   - GameCloudBridge는 stage-started→stage-enter, stage-completed→stage-complete, checkpoint-activated→checkpoint, world-selection-committed→world-select로 연결한다. 구조 이벤트마다 progress를 즉시 깊은 복사한다. stage-enter에는 현재 seed와 W2 방문 상태의 깊은 복사도 담는다.
   - StageScene은 runtime.start()가 stage-started를 발행하기 전에 registry cloudResume를 갱신한다. GameCloudBridge.getRuntime은 이 값을 읽는다. CP snapshot 변환은 contentVersion=1을 채운다. 클라이언트가 전달한 방문 데이터 자체를 서버 랭킹으로 신뢰하지 않는다.
   - coin/death/구매/장착/이름/keybind/컷신/그림판의 보조 저장은 microtask 끝에서 snapshot을 만든다. Economy.commitStageClear는 stage-completed보다 먼저 coin-changed를 발행하므로 그 중간 상태를 먼저 전송하면 안 된다. 같은 tick의 마지막 구조 snapshot과 동일하면 보조 state는 생략한다. 다른 snapshot이면 그 구조 사건 뒤에 순서대로 보낸다.
   - hydrate/restore는 새 달성으로 바뀌지 않게 하고, bridge의 중복 구독을 막는다. 모든 저장 관찰은 FIFO Coordinator 한 곳으로 보낸다.
3. Error & Exception Handling: 필수 snapshot/맵 내용 불일치는 진입 오류와 재조회로 처리한다. 정상 서버 값을 기본 저장으로 덮지 않는다. 종료할 때 구독/registry를 정리한다. 순수 resume 변환과 Phaser 연결을 분리하여 서버 bundle이 Phaser를 import하지 않게 한다.
4. State Transition & Return: cloudEntry 없는 기존 로컬 게임은 같은 동작을 유지한다. 이 Task는 bridge/resume props를 테스트 주입으로 검증하며, 운영 GameShell 연결은 P02-T04에서 한 번에 전환한다.

### I02. 상태·회귀 검증

- Related Files:
  - `scripts/cloud-resume.test.mjs` :: `node:test cases` — API/시간 대역과 실제 순수 상태 전이, 필요한 React DOM 검증; new

#### Details

- W1 CP2/4 실제맵좌표, W2 stage1~3왕복seed/CP, W3/4/5CP복원, 현재worldCP없음→worldstart, 보스중종료→CP, 다음worldoldCP폐기, 최종clear유지, restored→best후보0, checkpoint직후death의snapshot분리, coin-changed→stage-completed의같은tick순서, 개발W4기존경로 유지.
- React DOM 검사는 P02-T01의 jsdom/Testing Library로 수행한다. 브라우저 자동 조작은 사용하지 않는다.
- 소스 문자열 검사만으로 기능 검증을 대체하지 않는다. 수동 항목은 P03 실제 검증과 구별하여 Progress에 남긴다.

## Acceptance Criteria

- [ ] 모든 월드의 재개 snapshot이 JSON round-trip과 실제 엔트리 선택을 통과한다.
- [ ] 복원·개발 점프가 정상 달성 이벤트를 만들지 않는다.
- [ ] 기존 게임·키 입력·저장 경로의 관련 회귀 검증이 통과한다.

## Validation

- `node --import tsx --test scripts/cloud-resume.test.mjs scripts/stage-progression.test.mjs scripts/development-start.test.mjs` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npx tsc --noEmit` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run lint` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run build` — exit 0; 동작·타입·린트·빌드 오류 없음.

## Commit Message

```text
feat(game): 전 월드 체크포인트 스냅샷과 재개 경로

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P02-game-integration
Task: T03-resume-bridge

- 서버가 보낸 현재 월드 저장점에서 재개하고 실제 CP 도달과 복원을 구분하는 Phaser 연결을 제공한다.
- 저장·세션·계정 전환의 회귀 검증을 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과·미실행 수동 확인: 실행 시 기록

