# Task: T02 Functions 실행 구성과 Entra 토큰 검증

## Status: done

## Goal

관리형 Functions 패키지를 독립 빌드하고 검증된 조직 액세스 토큰만 게임 API까지 도달시키는 공통 경계를 만든다.

## Decision Summary

- Node22 / Functions v4 / TypeScript. SWA 플랫폼 role 대신 API 내부 jose 검증을 모든 경로에 적용한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 구현

- Related Files:
  - `api/package.json` :: `dependencies, engines, main` — 본 Task의 계약·서비스·구성; new
  - `api/package-lock.json` :: `API dependency lock` — 본 Task의 계약·서비스·구성; new
  - `api/host.json` :: `version, extensions.http.routePrefix` — 본 Task의 계약·서비스·구성; new
  - `api/tsconfig.json` :: `isolated API typecheck` — 본 Task의 계약·서비스·구성; new
  - `api/src/config.ts` :: `loadServerConfig, ServerConfig` — 본 Task의 계약·서비스·구성; new
  - `api/src/auth.ts` :: `authenticate, createAccessTokenVerifier` — 본 Task의 계약·서비스·구성; new
  - `api/src/http.ts` :: `ApiError, withIdentity, errorResponse, readJsonBody` — 본 Task의 계약·서비스·구성; new
  - `api/src/functions/game.ts` :: `app.http registrations` — 본 Task의 계약·서비스·구성; new
  - `scripts/build-game-api.mjs` :: `buildGameApi` — 본 Task의 계약·서비스·구성; new
  - `api/local.settings.example.json` :: `non-secret placeholders` — 본 Task의 계약·서비스·구성; new
  - `.gitignore` :: `api/node_modules, api/dist, api/local.settings.json` — 본 Task의 계약·서비스·구성; modify
  - `tsconfig.json` :: `exclude api and generated output` — 본 Task의 계약·서비스·구성; modify
  - `eslint.config.mjs` :: `ignore api/dist api/node_modules` — 본 Task의 계약·서비스·구성; modify
  - `package.json` :: `esbuild, build:api, typecheck:api, test:api-auth` — 본 Task의 계약·서비스·구성; modify
  - `package-lock.json` :: `root lock` — 본 Task의 계약·서비스·구성; modify

#### Details

- **Signatures & Types**:
```ts
interface ServerConfig {
 tenantId:string; apiClientId:string; webClientId:string; scope:"access_as_user";
 cosmosEndpoint:string; cosmosTenantId:string; cosmosClientId:string; cosmosClientSecret:string;
 database:"legendary-rib-corgi"; container:"game-data"; testObjectIds:ReadonlySet<string>;
}
export function loadServerConfig(env:NodeJS.ProcessEnv):ServerConfig;
export function createAccessTokenVerifier(config:ServerConfig, jwks?:JWTVerifyGetKey):
 (authorization:string|undefined)=>Promise<Identity>;
export function withIdentity(handler:(req:HttpRequest,id:Identity)=>Promise<HttpResponseInit>):
 (req:HttpRequest,ctx:InvocationContext)=>Promise<HttpResponseInit>;
export async function readJsonBody(req:HttpRequest,maxBytes?:number):Promise<unknown>;
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

1. Precondition & Validation: API 의존성은 @azure/functions 4.x, @azure/cosmos, @azure/identity, jose; root dev는 esbuild, tsx. 구현 시 Node22 호환 공식 안정판을 확인해 lockfile에 고정하고 Next/React를 불필요하게 올리지 않는다. api package type=module, engines.node=22.x, main=dist/functions/*.js. host.json version=2.0, routePrefix=api. Functions와 Next 타입 검사는 분리.
2. Core Processing:
   - 서버 환경 이름: GAME_TENANT_ID, GAME_API_CLIENT_ID, GAME_WEB_CLIENT_ID, GAME_COSMOS_ENDPOINT, GAME_COSMOS_CLIENT_ID, GAME_COSMOS_CLIENT_SECRET, GAME_TEST_OBJECT_IDS(JSON UUID 배열, 기본[]). Cosmos tenant=GAME_TENANT_ID, database/container는 코드 고정. 비밀 값을 error/log에 넣지 않는다.
   - Entra API 앱 requestedAccessTokenVersion=2 전제. issuer=https://login.microsoftonline.com/{tid}/v2.0, JWKS=https://login.microsoftonline.com/{tid}/discovery/v2.0/keys, audience=API client GUID. RS256만, 서명·exp/nbf(60초 skew)·iss/aud/tid/oid UUID·scp의 access_as_user·azp=web client GUID 검증. 임의 토큰 issuer/jku로 JWKS URL 생성 금지. ID token/scp없는 앱토큰 거절.
   - 캐시 가능한 createRemoteJWKSet으로 키 교체를 지원. 잘못된 서명/만료/누락→401, 검증된 다른 조직/잘못된 scope/client→403(검증에 앞서 untrusted claim을 권한으로 사용하지 않음). testObjectIds에 있는 oid만 namespace=test; 나머지 prod.
   - app.http는 authLevel=anonymous(플랫폼 function key 미사용)지만 모든 handler가 withIdentity를 통과. 경로와 동사: GET game/bootstrap, POST game/session/acquire|heartbeat|release, POST game/save, POST game/reset, GET game/leaderboard. 아직 서비스 없는 경로는 인증 후 503 UNAVAILABLE; 빈 정상 저장을 반환하지 않는다.
   - API 경로에서는 x-ms-client-principal/body playerId를 신뢰하지 않는다. JSON 객체만 수신,256KiB 초과→400, invalidjson→400, 쓰기 content-type application/json 요구. 응답 no-store; 동사 불일치405. same-origin 앱이 기본, 불필요한 * CORS 미설정.
   - scripts/build-game-api.mjs: entry api/src/functions/game.ts → api/dist/functions/game.js, bundle=true, platform=node, target=node22, format=esm, packages=external, sourcemap 비공개. src/game/cloud의 순수 소스는 bundle에 포함, Phaser/React/MSAL import가 나오면 검사 실패. 모든 API 외부 dependency는 api/package.json에 선언.
   - root tsconfig.exclude에 api/** 추가, api tsconfig는 module=ESNext,moduleResolution=Bundler,target=ES2022,noEmit=true,strict=true, include src/**/*.ts 및 필요한 공용 TS. root scripts typecheck:api=tsc -p api/tsconfig.json; build:api=node scripts/build-game-api.mjs.
3. Error & Exception Handling: env 불완전은 fail-closed 503, 값 노출 없는 운영 로그(correlationId/errorCode). JWKS 일시 실패는503, 권한 부재는403; 토큰 검증 실패를 개발 bypass로 해결하지 않는다. source 또는 브라우저 번들에 client secret 넣지 않는다.
4. State Transition & Return: 인증된 Identity를 서비스에 주입하는 실행 가능한 API 골격. local.settings.example.json에는 IsEncrypted=false, Values의 FUNCTIONS_WORKER_RUNTIME=node와 공란 GAME_*만. 실제 local.settings.json은 ignore.

### I02. 동작·경계 검증

- Related Files:
  - `scripts/api-auth.test.mjs` :: `node:test cases` — 실제 함수·핸들러/저장소 대역 검증; new

#### Details

- 구현 문자열 존재만 확인하지 않고 입출력·에러·경쟁 결과를 검증한다.
- node crypto/jose로 생성한 테스트 RSA키·로컬 JWKS 대역 사용: 정상 멤버/게스트, wrong tid/iss/aud/azp/scp, ID token, 만료, 위조, missing oid, JWKS unavailable, 헤더 위조·payload playerId. 테스트키를 운영에 사용하지 않음. 신규 모든 경로가 동일 인증 wrapper 통과하는지 handler 호출로 확인.
- 검증 대역은 운영 인증을 우회하는 runtime 플래그로 노출하지 않는다.

## Acceptance Criteria

- [x] API 단독 빌드가 되고 게임 엔진·브라우저 코드가 번들에 들어가지 않는다.
- [x] 인증 실패·구성 실패가 운영 데이터 접근 이전에 차단된다.
- [x] 아래 검증이 통과하고 기존 작업 변경을 보존한다.

## Validation

- `npm ci --prefix api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run typecheck:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run build:api` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run test:api-auth` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npx tsc --noEmit` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run lint` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.

## Commit Message

```text
feat(cloud): Functions 실행 구성과 Entra 토큰 검증

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P01-cloud-api
Task: T02-api-auth

- 관리형 Functions 패키지를 독립 빌드하고 검증된 조직 액세스 토큰만 게임 API까지 도달시키는 공통 경계를 만든다.
- 경계 사례 검증과 Task 진행 기록을 추가한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 트레일러 커밋으로 조회
- 검증 결과: 인증 22/22(Node22 포함), API npm ci·타입·빌드, 루트 타입·린트 통과. 실제 Entra 로그인은 P03에서 확인.

