# Task: T04 원자적 저장·최고 기록·회차 초기화

## Status: pending

## Goal

한 번의 확정 저장에서 현재 진행과 달성 당시 최고 기록이 일치하고, 재전송·초기화·세션 경쟁으로 기록이 중복되거나 되살아나지 않게 한다.

## Decision Summary

- 클라이언트는 이벤트 순간 전체 snapshot을 보내되 진행·사망·소유권을 서버가 검증한다. 서버 시뮬레이션·전면 anti-cheat를 추가하지 않는다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 구현

- Related Files:
  - `api/src/services/save.ts` :: `saveProgress, resetProgress` — 본 Task의 계약·서비스·구성; new
  - `api/src/services/transitions.ts` :: `applySaveEvent, validateProgressTransition` — 본 Task의 계약·서비스·구성; new
  - `api/src/requestHash.ts` :: `hashRequest` — 본 Task의 계약·서비스·구성; new
  - `api/src/functions/game.ts` :: `save/reset handlers` — 본 Task의 계약·서비스·구성; modify
  - `api/src/repository.ts` :: `commit and receipt read` — 본 Task의 계약·서비스·구성; modify
  - `src/game/cloud/progression.ts` :: `milestoneFor, canEnterStage` — 본 Task의 계약·서비스·구성; read-only
  - `scripts/cloud-test-support.mjs` :: `conflict/failure injection` — 본 Task의 계약·서비스·구성; modify
  - `package.json` :: `test:api-save` — 본 Task의 계약·서비스·구성; modify

#### Details

- **Signatures & Types**:
```ts
export function saveProgress(id:Identity,input:SaveRequest,repo:GameRepository,now:()=>Date):Promise<SaveAck>;
export function resetProgress(id:Identity,input:ResetRequest,repo:GameRepository,now:()=>Date):Promise<SaveAck>;
export function applySaveEvent(current:CurrentState,event:SaveEvent,next:ProgressState):CurrentState;
export function validateProgressTransition(previous:ProgressState,next:ProgressState,event:SaveEvent):void;
export function hashRequest(id:Identity,input:SaveRequest|ResetRequest|AcquireRequest):string;
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

```ts
interface DocBase { id:string; playerId:string; schemaVersion:1; namespace:Namespace; updatedAt:string }
interface ProfileDoc extends DocBase { kind:"profile"; displayName:string; createdAt:string }
interface CurrentDoc extends DocBase, CurrentState { kind:"current" }
interface BestDoc extends DocBase { kind:"best"; displayName:string; eligible:boolean; record:BestRecord|null }
interface SessionDoc extends DocBase, Lease { kind:"session" }
interface ReceiptDoc extends DocBase {
 kind:"receipt"; requestHash:string; sessionId:string; generation:number;
 ack:SaveAck|Bootstrap; ttl:604800;
}
type AccountDoc = ProfileDoc|CurrentDoc|BestDoc|SessionDoc|ReceiptDoc;
interface Versioned<T> { value:T; etag:string }
interface AccountSnapshot {
 profile:Versioned<ProfileDoc>; current:Versioned<CurrentDoc>;
 best:Versioned<BestDoc>; session:Versioned<SessionDoc>;
}
type WriteOperation =
 | {type:"create";doc:AccountDoc}
 | {type:"replace";doc:AccountDoc;etag:string};
interface GameRepository {
 readAccount(identity:Identity):Promise<AccountSnapshot|null>;
 readReceipt(playerId:string,requestId:string):Promise<ReceiptDoc|null>;
 commit(playerId:string,operations:WriteOperation[]):Promise<void>;
 scanBest(namespace:Namespace,deadlineMs:number):AsyncIterable<BestDoc>;
}
```
- 고정 id=profile/current/best/session, receipt id=`receipt:${requestId}`; 모든 문서 동일 playerId 파티션. DB `legendary-rib-corgi`, container `game-data`, /playerId. best는 최초 eligible=false,record=null. eligible는 namespace=prod + 실제 정상 플레이 기록 유무로 서버 계산.
- _etag는 Cosmos 반환값만 repository가 다루며 본문/클라이언트에서 받지 않는다. 조건부 replace+receipt create를 하나의 transactional batch로 제출. 응답 status와 각 operation 실패(412/409/424 포함)를 검사해 전체 실패로 처리.
- 404는 실제 계정 없음만 나타낸다. 일부 문서만 없음/알 수 없는 schema/JSON 오류는 503이며 기본값 재생성 금지.
- 컨테이너 defaultTtl=-1, receipt에만 ttl=604800. TTL 경과 뒤에도 current.lastSequence/version 검사로 중복 적용 방지. receipt는 mutation은 작은 Ack, acquire만 Bootstrap을 저장하며 요청 전체/토큰/비밀을 저장하지 않는다.

```ts
// src/game/core/types.ts 의 기존 타입을 공용으로 사용. Cloud schema는 별도 1, progress.version은 5.
interface ProgressState {
  version: number; onboardingCompleted: boolean; playerName: string;
  clearedStages: StageId[]; selectedWorldId: "world-01"|"world-02"|null;
  world01BossReplayActive: boolean;
  world01CheckpointStageId: "world-01-stage-2"|"world-01-stage-4"|null;
  unlockedSkills: SkillId[]; ownedToolIds: ToolId[]; ownedCosmeticIds: CosmeticId[];
  equippedAttackToolId: ToolId; equippedDefenseToolId: ToolId;
  equippedOutfitId: CosmeticId|null; customOutfits: CustomOutfitDesign[];
  equippedCustomOutfitId: CustomOutfitId|null; equippedAccessoryId: CosmeticId|null;
  bankedCoins: number; collectedCoinIds: string[]; collectedItems: string[];
  deathsTotal: number; deathsByStage: Partial<Record<StageId,number>>;
  seenCutsceneIds: string[]; discoveredDrawbackIds: string[];
  keybinds: Record<InputAction,string>;
}
```
- 타입의 ID union은 `src/game/core/types.ts` 그대로 사용. 월드 1~5, stage 1~4/boss 중 W2 stage4는 운영 경로에서 제외.
- 기본값: version=5, name="코기", onboarding=false, 모든 배열=[], deaths/coins=0, deathsByStage={}, nullable=null, replay=false. ownedToolIds=["rabbit-slipper","upside-down-bowl"], 장비도 각 기본 도구. keybinds=DEFAULT_KEYBINDS(left/right/up/down=Arrow*, jump=Space, attack=KeyQ, dash=Digit1, bark=KeyW, bite=KeyE, pause=Escape).
- customOutfits는 최대 3개, id=custom-outfit-1/2/3, cells=(#RRGGBB|null)[] 길이1792(56×32), updatedAt=유효 ISO 문자열. 중복 ID 금지. 착용 도구·의상은 소유/슬롯 검증, 그린 의상과 기본 의상 동시 착용 금지.
- API 입력은 strict 검증. `migrateSave`의 오류→기본값 반환은 legacy 로컬 전용이며 서버 읽기·쓰기 검증에 재사용하지 않는다. 이름만 기존 규칙 `trim().replace(/[<>]/g,"").slice(0,20)||"코기"`로 정규화.


- **Execution Flow / Logic**:

1. Precondition & Validation: 인증 → strict DTO → 계정 읽기 → 동일 sessionId/generation 및 유효 lease → receipt 순서로 검사한다. body의 rank/best/playerId나 자체 dev 플래그는 받지 않는다. 같은 lease에서 같은 hash receipt가 있으면 오래된 expectedVersion이어도 저장된 Ack를 반환한다. 다른 hash는409, receipt가 없으면 runId/expectedVersion 일치와 sequence=lastSequence+1이 필수다.
2. Core Processing:
   - 키 순서를 고정한 canonical JSON(Identity와 본문 전체)의 SHA256을 receipt에 기록한다. 확정 요청 객체는 후속 이벤트로 변경하지 않는다.
   - state는 현재 stage의 보조 진행 값만 바꾼다. clearedStages 추가는 stage-complete에서 해당 stage 하나만 허용하고 삭제는 금지한다. 이미 클리어한 stage의 재주행은 허용한다. stage-complete는 activeStageId 일치와 합법적인 전방 경로를 확인한다. 보스 완료 때 해당 world의 collectedCoinIds를 비우는 기존 coinLedger 동작은 허용한다.
   - stage-enter는 같은 stage, 직전 stage 클리어 후 next, W2의 합법적 후퇴, 서버가 확정한 resume만 허용한다. 세계가 바뀌면 resume를 새 world 시작으로 바꾸고 이전 checkpoint/world02Travel을 삭제한다. 미해금 월드로 건너뛰기는 거절한다. 일반맵 경계는 랭킹 지점이 아니다.
   - stage-enter의 seed는1..2147483647, world02Travel은 W2 stage1~3의 유효 방문/체크포인트만 받는다. 현재 world와 일치할 때 resume.worldSeed와 방문 상태를 보존한다. 다른 world 방문 데이터는 거절한다. 방문 스냅샷 제출만으로 best나 resume의 달성 CP를 변경하지 않는다.
   - world-select는 기존 isWorldSelectionUnlocked와 같은 W1 boss 클리어 조건을 검사하고 W1(start/CP1/CP2/boss) 또는 W2만 허용한다. W1 CP 재방문은 pendingCheckpointId를 설정하고 복원 snapshot 확인 전에는 world 시작을 재개점으로 둔다. 선택만으로 best를 갱신하지 않는다. 보스 선택은 새 저장점을 만들지 않고 같은 world의 이전 실제 CP 또는 world 시작을 유지한다.
   - checkpoint reached는 현재 stage의 정식 CP ID·유한 snapshot·contentVersion=1을 검사해 resume의 마지막 CP를 갱신한다. W2면 해당 방문 snapshot/seed도 갱신한다. restored는 기존 resume와 같으면 보존만 하고, pendingCheckpointId의 합법적 리플레이 복원일 때만 resume 갱신 후 pending=null로 만든다. restored는 rank 후보가 아니다.
   - world5 boss 완료는 resume.completed=true와 최종 clear 후보를 만든다. 다음 world는 만들지 않는다. world1~4 boss 완료 시에는 현재 world를 유지하고, 실제 다음 world stage-enter에서 다음 시작 지점으로 전진한다.
   - deathsTotal과 각 stage 카운터는 같은 run 안에서 단조 증가하며 합계가 같아야 한다. 증가는 현재 stage에만 허용한다. coins는 비음수 안전 정수, 소유/장비/customOutfits/keybinds는 공통 schema로 검증한다. 모든 경제 행동의 서버 재시뮬레이션은 범위 밖이다. skills는 SKILL_DEFINITIONS.unlockAfterBossId의 world-N-boss를 world-N-stage-boss 클리어와 대응하여 해금 조건을 검사하고, 기존 해금은 삭제하지 않는다.
   - 후보는 수락된 world 시작/실제 CP/boss 완료 snapshot.deathsTotal과 current.runId의 조합이다. best는 진행 rank가 크거나 같은 rank에서 deaths가 작을 때만 교체한다. 이름 변경은 profile과 best.displayName에 반영하지만 best.record 점수는 유지한다. 실제 정상 prod 기록만 eligible=true, test는false다.
   - current(version+1,lastSequence=sequence), profile, best, session(ETag 조건과 now+60s), receipt create를 같은 batch로 저장한다. rank와 resume는 서버에서 계산한다.
   - reset도 같은 fence/receipt 규칙과 옛 runId/expectedVersion/sequence를 검사한다. 새 서버 UUID runId, version+1,lastSequence=0,기본 진행+W1 재개점으로 교체한다. profile.displayName/identity/best는 보존한다. 새 progress.playerName=profile.displayName, onboarding=false로 기존 인트로/이름 입력을 재사용한다. Ack는 새 runId/sequence0이다. 옛 run의 대기 요청은409다.
3. Error & Exception Handling: heartbeat 때문에 session ETag만 바뀐 경우 current.version/owner를 다시 확인하고 최대3회 batch 재시도한다. 실제 save 경쟁은409 VERSION_CONFLICT다. batch 실패에서 일부 문서만 전진시키지 않는다. 429/503은 같은 requestId로 재시도한다. receipt TTL이 지나도 sequence 검사로 중복 적용을 막는다.
4. State Transition & Return: save/reset200+SaveAck만 확정 성공이다. reset 후 GET bootstrap으로 서버의 새 run을 받아 게임을 다시 만든다. best/run 생성 시각은 순위 비교에 쓰지 않는다.

### I02. 동작·경계 검증

- Related Files:
  - `scripts/api-save.test.mjs` :: `node:test cases` — 실제 함수·핸들러/저장소 대역 검증; new

#### Details

- 구현 문자열 존재만 확인하지 않고 입출력·에러·경쟁 결과를 검증한다.
- CP 도달 death3→이후 death7이어도 best3, 더 높은 진행 death20이 낮은 진행 death0보다 우선, 같은 진행은 적은 데스만 개선, 다른 run의 위치와 데스를 조합하지 않음, reset 후 best 보존, 중복 request 동일 Ack/다른 body409, receipt TTL 후 sequence 거절, takeover 직후 batch 충돌 전체 rollback, heartbeat만 변한 경쟁 재시도, 옛 run 지연 요청 거절, W2 후퇴/재주행/가짜 CP/복원/최종 클리어.
- 검증 대역은 운영 인증을 우회하는 runtime 플래그로 노출하지 않는다.

## Acceptance Criteria

- [ ] current·best·fence·receipt가 단일 batch로 확정된다.
- [ ] 초기화·지연·동시 요청에도 최고 기록의 위치·데스 조합을 보존한다.
- [ ] 아래 검증이 통과하고 기존 작업 변경을 보존한다.

## Validation

- `node --import tsx --test scripts/cloud-contracts.test.mjs scripts/api-session.test.mjs scripts/api-save.test.mjs` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run typecheck:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run build:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run lint` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.

## Commit Message

```text
feat(cloud): 원자적 저장·최고 기록·회차 초기화

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P01-cloud-api
Task: T04-save-reset

- 한 번의 확정 저장에서 현재 진행과 달성 당시 최고 기록이 일치하고, 재전송·초기화·세션 경쟁으로 기록이 중복되거나 되살아나지 않게 한다.
- 경계 사례 검증과 Task 진행 기록을 추가한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과·미실행 외부 확인: 실행 시 기록

