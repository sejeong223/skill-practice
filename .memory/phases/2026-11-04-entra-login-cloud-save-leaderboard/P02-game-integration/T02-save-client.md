# Task: T02 계정 캐시와 순차 저장·복구 클라이언트

## Status: done

## Goal

이벤트 순간의 진행을 순서대로 저장하고 실패한 요청을 계정·회차·세션에 묶어 중복 없이 재시도한다.

## Decision Summary

- 서버가 원본. 로컬 캐시는 확인된 저장과 미확정 요청을 분리하며 legacy key는 읽기/삭제/이전하지 않는다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 게임 연결

- Related Files:
  - `src/game/persistence/cloud/AccountCache.ts` :: `AccountCache, CacheEnvelope` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/persistence/cloud/CloudSaveCoordinator.ts` :: `CloudSaveCoordinator, SaveStatus` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/persistence/cloud/CloudSessionClient.ts` :: `CloudSessionClient` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/persistence/cloud/GameApiClient.ts` :: `existing transport` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `src/game/cloud/contracts.ts` :: `SaveRequest, SaveAck` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `src/game/persistence/ProgressStore.ts` :: `legacy key behavior` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `package.json` :: `test:cloud-save-client` — 이 Task에서 다룰 연결·상태·설정; modify

#### Details

- **Signatures & Types**:
```ts
type SaveStatus="idle"|"saving"|"reconnecting"|"reauth-required"|"session-lost"|"conflict"|"storage-error";
interface Observation { requestId:string; event:SaveEvent; progress:ProgressState }
interface CacheEnvelope {
 schemaVersion:1; playerId:string; sessionId:string; generation:number; runId:string;
 confirmed:Bootstrap; inFlight:SaveRequest|null; queued:Observation[]; savedAt:string;
}
interface CoordinatorOptions {
 api:GameApiClient; cache:AccountCache; bootstrap:Bootstrap; sessionId:string;
 onStatus:(status:SaveStatus)=>void; onAck:(ack:SaveAck)=>void;
 now:()=>number;
}
class AccountCache {
 constructor(storage:Storage|null);
 read(playerId:string,sessionId:string):CacheEnvelope|null;
 write(value:CacheEnvelope):void;
 removePending(playerId:string,sessionId:string):void;
}
class CloudSaveCoordinator {
 constructor(options:CoordinatorOptions);
 observe(event:SaveEvent,progress:ProgressState):void;
 flush():Promise<void>;
 retry():Promise<void>;
 reset():Promise<Bootstrap>;
 dispose():void;
}
class CloudSessionClient {
 constructor(api:GameApiClient,onLost:(code:ApiErrorCode)=>void);
 acquire(sessionId:string,takeover:boolean):Promise<Bootstrap>;
 start(lease:Lease):void;
 ensureValid():Promise<Lease>;
 release():Promise<void>;
 dispose():void;
}
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

1. Precondition & Validation: bootstrap과 같은 소유자의 lease를 받아 생성한다. cache key=`legendary-rib-corgi:cloud:v1:{playerId}:session:{sessionId}`, 확인된 표시 캐시는 `...:{playerId}:confirmed`다. tokens/secret은 넣지 않는다. 생성자는 cache의 playerId/runId/sessionId/generation이 서버와 같은 경우에만 inFlight/queued를 복원한다. head는 expectedVersion/body/requestId를 그대로 유지하여 서버의 중복 확인을 받는다. 캐시를 읽었다고 기본 진행을 업로드하지 않는다. Storage 실패는 memory buffer와 storage-error로 처리한다.
2. Core Processing:
   - observe는 즉시 structuredClone, UUID requestId 부여. state 이벤트만100ms debounce 가능, 새 구조(stage-enter/complete/world-select/CP) 이벤트 전에 직전 state를 먼저 고정한다. milestone snapshot은 뒤 death·coin으로 변경하지 않는다. 진행 이벤트 순서 그대로 FIFO.
   - 전송은 동시에1개. head에 현재runId/sessionId/generation/expectedVersion/lastSequence+1을 한 번 부여한 SaveRequest를 먼저 캐시에 기록한 후POST. retry에 ID/sequence/body를 재생성하지 않는다. Ack가 일치하면 confirmed version/sequence/best 갱신, head 제거, 다음 요청으로.
   - 429/503/network/offline은 즉시 reconnecting; pending 보존 및 1,2,4,8,15초 backoff(+0~250ms jitter), Retry-After 최소대기 준수. retry 전에 ensureValid heartbeat. token401은 reauth-required,403/400/409 version/run/sequence는 자동재적용 금지하고 오류/재로드 선택. SESSION_LOST는 기존queue를 격리하고 자동takeover 금지.
   - 네트워크 복구 후 heartbeat가 같은 owner/generation이면 pending을 원본 그대로 재전송. lease가 바뀌었으면 server bootstrap을 기준으로 재시작하고 오래된queue를 합치지 않는다. confirmed.version이 오래됐다는 이유만으로 새default를업로드하지 않는다.
   - 최대 큐128개 또는 serialized cache4MiB가 되면 추가 플레이를 멈추고 flush; state coalesce는 아직 전송 전의 연속 state끼리만, milestone 사이 넘어 합치기 금지. localStorage 쓰기 실패는 메모리에 최신immutable요청을 보존하고 재시도 가능 표시. 브라우저 닫힘까지 보존된다고 약속하지 않는다.
   - heartbeat는15초,expiresAt60초 기준; 네트워크에러 즉시정지. visibility hidden에서 타이머가 지연되면 visible 때 heartbeat 성공까지 정지. duplicate callbacks 겹치지 않도록 한 번씩 수행. release는 현재generation만, 실패해도 lease만료로 회수.
   - reset은 입력정지→queue.flush→같은fence의 ResetRequest를 캐시/전송→Ack의새run 확인→bootstrap 재조회→해당세션 pending 정리. reset lostresponse에는 원래request 재전송. reset 후인 ack/receipt가 현재run과달라도 서버confirmed전환 결과로 처리하며 옛 관찰을 새run으로 옮기지 않음.
   - dispose는 타이머/abortcontroller 해제, pending은 보존. beforeunload는 로컬 동기기록만 보장; async 저장완료를 주장하지 않고 sendBeacon(Authorization 부재)로 우회하지 않는다.
3. Error & Exception Handling: transport 타임아웃10초 후 abort 및 retry; 서버가 이미commit했을 수 있어 같은request 재시도. account lifecycle 세대/AbortSignal로 늦은 응답 무시. Cache 검증실패는 서버GET로 복구, 서버오류는 새게임으로 변환금지.
4. State Transition & Return: saving은 화면 표시만으로 매코인 gameplay를 정지하지 않음. reconnecting/reauth/session-lost/conflict/storage-error가 강제pause. pending 전부 ACK되고lease확인된 idle에서만 pause이유 해제. reset 반환Bootstrap을 상위에 전달하여 Phaser 재생성.

### I02. 상태·회귀 검증

- Related Files:
  - `scripts/cloud-save-client.test.mjs` :: `node:test cases` — API/시간 대역과 실제 순수 상태 전이, 필요한 React DOM 검증; new

#### Details

- CP snapshot 후death 증가에도 앞요청deepcopy 유지, 요청1응답유실→retry 한 번만DB반영, sequence채번순서, Retry-After와 fakeclock, offline/reauth/lease takeover, A계정늦은응답 B에미적용, quota실패·손상cache, reset중복후oldqueue거절, beforeunload는캐시만, heartbeat중복/hidden복귀.
- React DOM 검사는 P02-T01의 jsdom/Testing Library로 수행한다. 브라우저 자동 조작은 사용하지 않는다.
- 소스 문자열 검사만으로 기능 검증을 대체하지 않는다. 수동 항목은 P03 실제 검증과 구별하여 Progress에 남긴다.

## Acceptance Criteria

- [x] 저장 중복·실패 복구·계정 전환의 동작을 fake API와 clock으로 재현한다.
- [x] 클라이언트가 충돌된 기록을 임의 병합하거나 기본값으로 덮어쓰지 않는다.
- [x] 기존 게임·키 입력·저장 경로의 관련 회귀 검증이 통과한다.

## Validation

- `node --import tsx --test scripts/cloud-save-client.test.mjs scripts/cloud-auth.test.mjs` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npx tsc --noEmit` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run lint` — exit 0; 동작·타입·린트·빌드 오류 없음.

## Commit Message

```text
feat(game): 계정 캐시와 순차 저장·복구 클라이언트

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P02-game-integration
Task: T02-save-client

- 이벤트 순간의 진행을 순서대로 저장하고 실패한 요청을 계정·회차·세션에 묶어 중복 없이 재시도한다.
- 저장·세션·계정 전환의 회귀 검증을 기록한다
```

## Progress

- 복구 스키마 보완: CacheEnvelope에 `pendingReset:ResetRequest|null`을 명시해 초기화 응답 유실을 새로고침 이후에도 같은 requestId로 복구한다. 다른 세대/회차 캐시는 별도 quarantine 키에 남기고 재사용하지 않는다.
- SaveAck에는 전체 current/resume가 없으므로 저장 ACK 후 GET bootstrap까지 확인한 뒤 confirmed 캐시를 갱신한다. 그 GET이 실패하면 동일한 저장 요청을 재확인하며 새 sequence를 부여하지 않는다. 요청별 추가 읽기 비용은 P03 실제 RU 측정 대상이며, 클라이언트가 서버 재개 규칙을 중복 추측하지 않도록 한 선택이다.
- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 트레일러 커밋으로 조회
- 검증 결과: 저장 클라이언트·인증 28/28, TypeScript 및 전체 린트 통과. 응답 유실·재접속·초기화·계정 격리·저장 공간·타임아웃·heartbeat 검증. 실제 브라우저 네트워크/기기 확인은 P03 대상.

