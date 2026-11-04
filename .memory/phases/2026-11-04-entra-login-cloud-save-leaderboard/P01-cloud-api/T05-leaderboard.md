# Task: T05 한국어 동점 정렬 TOP 10 API

## Status: pending

## Goal

등록 계정 수와 동점 수에 관계없이 지정 정렬 순서의 정확한 최대10명만 공개 필드로 반환한다.

## Decision Summary

- 공용 DB 파티션 전체 중 prod best eligible=true만 projection·페이지 조회. 이름 비교는 Intl.Collator('ko')를 적용하고 경계 후보를 임의 제한하지 않는다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 구현

- Related Files:
  - `api/src/services/leaderboard.ts` :: `getLeaderboard, compareBestRows` — 본 Task의 계약·서비스·구성; new
  - `api/src/repository.ts` :: `scanBest` — 본 Task의 계약·서비스·구성; modify
  - `api/src/functions/game.ts` :: `leaderboard GET` — 본 Task의 계약·서비스·구성; modify
  - `src/game/cloud/contracts.ts` :: `LeaderboardRow, LeaderboardResponse` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/cloud/progression.ts` :: `milestone labels` — 본 Task의 계약·서비스·구성; read-only
  - `package.json` :: `test:api-ranking` — 본 Task의 계약·서비스·구성; modify

#### Details

- **Signatures & Types**:
```ts
export function compareBestRows(a:BestDoc,b:BestDoc):number;
export function getLeaderboard(id:Identity,repo:GameRepository,now:()=>Date):Promise<LeaderboardResponse>;
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


- **Execution Flow / Logic**:

1. Precondition & Validation: withIdentity를 통과한 조직 사용자에게만 GET. 클라이언트 limit/order/filter/namespace 파라미터를 받지 않는다. test 계정도 운영 공개 TOP10을 읽을 수 있으나 test 문서는 노출되지 않는다.
2. Core Processing:
   - SQL은 kind="best" AND namespace="prod" AND eligible=true AND record != null 조건으로 displayName/record/playerId만 읽는다. 모든 continuation page를 마지막까지 처리하며 페이지 size는100, 총조회 건수에 임의 cap을 두지 않는다. 개별progress나profile을 N+1 조회하지 않는다.
   - 진행 rank 내림차순 → deaths 오름차순 → Intl.Collator("ko",{usage:"sort",sensitivity:"variant",numeric:false}).compare(name.normalize("NFC"),other...) → 내부playerId의 고정 코드포인트 오름차순.
   - 전체 적격 행을 읽는 동안 정렬된 최대10개만 메모리에 유지한다. 모든 입력에 comparator를 적용한 후에만 탈락시키므로 동점자100명 이상에서도 올바른 이름순 TOP10. 단순 SQL TOP10 후 이름sort 금지.
   - rank=1..rows.length, nickname=현재best.displayName, deaths=record.deaths, location=서버milestone표의label. 알 수 없는 best schema/rank 불일치는 운영 데이터 오류로503; 잘못된 행을 조용히 숨겨 성공으로 표시하지 않는다.
   - 전체 스캔은 사내 초기 규모에서 단순성과 정확성을 위한 선택. 고정400RU이므로 페이지 간429 Retry-After를 존중하되 API 전체 deadline30초. timeout/남은 continuation이면503, 부분TOP10 반환 금지. queryRU/행수/소요시간만 진단, 신원·토큰 로그 없음. 이후 규모 최적화는 별도 요구.
3. Error & Exception Handling: 인증401/403, DB429 및 retryAfter, deadline/장애503. empty result는rows=[]200, 가짜10개 채우기 없음. HTTP no-store; 일관성은 요청 처리 중 읽은 committed 기록 기준이며 모든 사용자에 대한 전역시점 snapshot을 보장한다고 주장하지 않는다.
4. State Transition & Return: read-only, 최대10개 공개 열만 반환. 같은 이름은 표시 중복 허용, playerId는 내부 비교 후 응답에서 제거.

### I02. 동작·경계 검증

- Related Files:
  - `scripts/api-ranking.test.mjs` :: `node:test cases` — 실제 함수·핸들러/저장소 대역 검증; new

#### Details

- 구현 문자열 존재만 확인하지 않고 입출력·에러·경쟁 결과를 검증한다.
- 0/1/9/10/11/200명, 10위 경계 동점150명을 역순 페이지로 입력, 가/나/다·한글 조합형NFC, 같은 이름의 다른 계정 순서 고정, 진행 우선/데스 우선/시간 무시, test 제외, 타인 저장·oid 누출 없음, 중간429/timeout에서 부분 성공 금지, 닉네임 갱신 후 정렬.
- 검증 대역은 운영 인증을 우회하는 runtime 플래그로 노출하지 않는다.

## Acceptance Criteria

- [ ] 10위 동점 전체에 한국어 이름순이 적용된다.
- [ ] 빈 결과·DB 장애가 서로 다른 응답이며 개인정보를 노출하지 않는다.
- [ ] 아래 검증이 통과하고 기존 작업 변경을 보존한다.

## Validation

- `node --import tsx --test scripts/api-ranking.test.mjs scripts/api-save.test.mjs` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run typecheck:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run build:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run lint` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.

## Commit Message

```text
feat(cloud): 한국어 동점 정렬 TOP 10 API

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P01-cloud-api
Task: T05-leaderboard

- 등록 계정 수와 동점 수에 관계없이 지정 정렬 순서의 정확한 최대10명만 공개 필드로 반환한다.
- 경계 사례 검증과 Task 진행 기록을 추가한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과·미실행 외부 확인: 실행 시 기록

