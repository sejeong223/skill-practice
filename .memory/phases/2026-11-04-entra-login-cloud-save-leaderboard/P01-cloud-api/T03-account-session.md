# Task: T03 계정 부트스트랩과 단일 쓰기 세션

## Status: pending

## Goal

같은 계정의 기본 문서를 원자적으로 만들고 새 기기가 명시적으로 전환한 뒤 이전 기기의 쓰기를 막는다.

## Decision Summary

- Cosmos DB 같은 playerId 파티션의 ETag 조건부 batch. lease 60초/heartbeat15초/세대 fencing; bootstrap 읽기만으로 기존 세션을 빼앗지 않는다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 구현

- Related Files:
  - `api/src/repository.ts` :: `GameRepository, CosmosGameRepository` — 본 Task의 계약·서비스·구성; new
  - `api/src/documents.ts` :: `AccountDoc, AccountSnapshot` — 본 Task의 계약·서비스·구성; new
  - `api/src/services/account.ts` :: `bootstrapAccount` — 본 Task의 계약·서비스·구성; new
  - `api/src/services/session.ts` :: `acquireSession, heartbeatSession, releaseSession` — 본 Task의 계약·서비스·구성; new
  - `api/src/functions/game.ts` :: `bootstrap and session handlers` — 본 Task의 계약·서비스·구성; modify
  - `src/game/cloud/contracts.ts` :: `existing DTOs` — 본 Task의 계약·서비스·구성; read-only
  - `scripts/cloud-test-support.mjs` :: `InMemoryGameRepository, fakeClock, identity fixtures` — 본 Task의 계약·서비스·구성; new
  - `package.json` :: `test:api-session` — 본 Task의 계약·서비스·구성; modify

#### Details

- **Signatures & Types**:
```ts
export function createCosmosRepository(config:ServerConfig):GameRepository;
export function bootstrapAccount(id:Identity,repo:GameRepository,now:()=>Date):Promise<Bootstrap>;
export function acquireSession(id:Identity,input:AcquireRequest,repo:GameRepository,now:()=>Date):Promise<Bootstrap>;
export function heartbeatSession(id:Identity,input:LeaseRequest,repo:GameRepository,now:()=>Date):Promise<Lease>;
export function releaseSession(id:Identity,input:LeaseRequest,repo:GameRepository,now:()=>Date):Promise<void>;
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

1. Precondition & Validation: 고정 DB/container만 사용. CosmosClient({endpoint,aadCredentials:new ClientSecretCredential(...)})를 재사용하고 요청 중 createIfNotExists/키 조회/리소스 생성을 하지 않는다. 읽기 소유자는 Identity.playerId. 네 문서가 전부 없을 때만 신규 계정.
2. Core Processing:
   - bootstrap 최초: profile/current/best/session 네 create를 동일 batch. 경쟁 create409이면 재조회. 새 UUID runId와 기본 progress, best=null. legacy localStorage와 연결 없음. best document는 명시 eligible=false.
   - bootstrap은 항상 읽고 현재 lease를 반환하며 acquire를 자동 호출하지 않는다. 같은 탭 sessionId는 브라우저 sessionStorage의 UUID.
   - acquire takeover=false: owner=null 또는 expiresAt≤서버now면 획득 가능. 다른 활성 세션이면409 SESSION_CONFLICT. takeover=true면 사용자가 누른 명시 요청으로 활성 session 교체. 새 owner일 때 generation+1; 같은 owner가 재시도하면 generation 유지. expiresAt=now+60s.
   - 실제 새로운 게임 mount 획득 시 current.activeStageId=resume.stageId, pendingCheckpointId=null, current.version+1; 기존 progress/best는 유지. 재개 snapshot은 여기에 포함한 Bootstrap 반환. pending 로컬 queue는 획득 전에 서버 확인·정리하고 다른 generation에 이식하지 않는다.
   - acquire requestId의 canonical body+identity SHA256 해시와 receipt를 batch에 저장한다. 같은 내용 재시도는 획득을 재적용하거나 current.version을 다시 올리지 않고 현재 Bootstrap을 읽어 반환한다. 다른 내용의 같은 ID는409 REQUEST_REUSED다. 현재 session이 receipt.sessionId/generation과 같은지 확인하여 takeover 뒤 오래된 성공을 반환하지 않는다. 만료한 동일 소유권은 이후 heartbeat에서 다시 확인한 뒤 게임을 재개한다.
   - heartbeat는 sessionId+generation 일치 시60초 갱신. 만료했어도 아직 같은 owner/generation이면 갱신 가능(오프라인 복구), 다른 owner로 교체됐으면409 SESSION_LOST. release는 같은 fencing 조건에서 owner=null,expiresAt=now; 다른 세션 종료 금지. 갱신/종료에도 session ETag 조건.
   - commit adapter는 container.items.batch의 create/replace/ifMatch를 지원. 요청 실패에 성공 로그 금지. 테스트 저장소는 ETag 비교·전체 rollback을 실제로 구현하는 작은 대역으로 scripts 바로 아래 둔다.
3. Error & Exception Handling: 경쟁 ETag→재조회 후 최대3회까지 lease 판단 재수행, 소유권이 바뀌면409. 요청 실패429→Retry-After, 네트워크/권한구성/부분문서→503. 만료/시간 판정에 브라우저 now 사용 금지. heartbeat는 current.version을 변경하지 않으며 저장 batch는 session ETag로 heartbeat와 충돌할 수 있음을 다음 Task에서 처리한다.
4. State Transition & Return: 프로필 생성으로 랭킹에 자동 참가시키지 않는다. GET bootstrap200, acquire200+Bootstrap, heartbeat200+Lease, release204. GET 자신의 진행 외 타인 data를 반환하는 API 없음.

### I02. 동작·경계 검증

- Related Files:
  - `scripts/api-session.test.mjs` :: `node:test cases` — 실제 함수·핸들러/저장소 대역 검증; new

#### Details

- 구현 문자열 존재만 확인하지 않고 입출력·에러·경쟁 결과를 검증한다.
- 두 concurrent bootstrap 정확히4문서·한 runId, 기존progress/best 유지, read503 시쓰기0회, 다른Identity파티션격리, 신규tab takeoverfalse거절, 명시전환 generation증가, staleheartbeat/release 거절, 만료후동일owner복구 vs 새owner경쟁, requestId재사용과 lostresponse 재시도, batch412 전부 rollback.
- 검증 대역은 운영 인증을 우회하는 runtime 플래그로 노출하지 않는다.

## Acceptance Criteria

- [ ] 명시적 전환 없이 활성 세션을 빼앗지 않는다.
- [ ] 실제 DB가 없어도 race와 rollback이 대역 테스트로 검증된다.
- [ ] 아래 검증이 통과하고 기존 작업 변경을 보존한다.

## Validation

- `node --import tsx --test scripts/api-session.test.mjs` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run typecheck:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run build:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run lint` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.

## Commit Message

```text
feat(cloud): 계정 부트스트랩과 단일 쓰기 세션

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P01-cloud-api
Task: T03-account-session

- 같은 계정의 기본 문서를 원자적으로 만들고 새 기기가 명시적으로 전환한 뒤 이전 기기의 쓰기를 막는다.
- 경계 사례 검증과 Task 진행 기록을 추가한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과·미실행 외부 확인: 실행 시 기록

