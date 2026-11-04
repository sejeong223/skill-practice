# Task: T01 MSAL 로그인과 계정 진입 게이트

## Status: done

## Goal

조직 로그인·토큰 갱신·로그아웃을 게임 생명주기와 분리한 인증 게이트를 준비한다.

## Decision Summary

- SPA에는 공개 ID만, 서버 앱 비밀은 없음. 이 Task는 인증 컴포넌트를 독립 검증하고 페이지/GameShell 연결은 P02-T04에서 한 번에 전환한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 게임 연결

- Related Files:
  - `src/auth/msal.ts` :: `getMsalClient, loadAuthConfig` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/auth/AuthProvider.tsx` :: `AuthProvider, useGameAuth` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/components/game/LoginGate.tsx` :: `LoginGate` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/persistence/cloud/GameApiClient.ts` :: `GameApiClient, ApiClientError` — 이 Task에서 다룰 연결·상태·설정; new
  - `.env.example` :: `public Entra configuration placeholders` — 이 Task에서 다룰 연결·상태·설정; new
  - `.gitignore` :: `allow .env.example only` — 이 Task에서 다룰 연결·상태·설정; modify
  - `package.json` :: `@azure/msal-browser, test:cloud-auth` — 이 Task에서 다룰 연결·상태·설정; modify
  - `package-lock.json` :: `MSAL lock` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/cloud/contracts.ts` :: `Bootstrap and errors` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `package.json` :: `@testing-library/react, @testing-library/user-event, jsdom dev dependencies` — 이 Task에서 다룰 연결·상태·설정; modify

#### Details

- **Signatures & Types**:
```ts
type AuthStatus="initializing"|"signed-out"|"signing-in"|"signed-in"|"reauth-required"|"error";
interface AuthState { status:AuthStatus; accountKey:string|null; error:string|null }
interface GameAuth {
 state:AuthState; signIn():Promise<void>; signOut():Promise<void>;
 getAccessToken():Promise<string>;
}
interface AuthConfig { tenantId:string; webClientId:string; apiClientId:string; redirectUri:string }
export function loadAuthConfig():AuthConfig;
export function getMsalClient(config:AuthConfig):Promise<IPublicClientApplication>;
export function AuthProvider(props:{children:ReactNode}):ReactElement;
export function useGameAuth():GameAuth;
export function LoginGate(props:{children:ReactNode}):ReactElement;
class GameApiClient {
 constructor(getToken:()=>Promise<string>,fetchImpl?:typeof fetch);
 bootstrap(signal?:AbortSignal):Promise<Bootstrap>;
 acquire(input:AcquireRequest,signal?:AbortSignal):Promise<Bootstrap>;
 heartbeat(input:LeaseRequest,signal?:AbortSignal):Promise<Lease>;
 release(input:LeaseRequest):Promise<void>;
 save(input:SaveRequest,signal?:AbortSignal):Promise<SaveAck>;
 reset(input:ResetRequest,signal?:AbortSignal):Promise<SaveAck>;
 leaderboard(signal?:AbortSignal):Promise<LeaderboardResponse>;
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


- **Execution Flow / Logic**:

1. Precondition & Validation: 브라우저에서만 MSAL 초기화. NEXT_PUBLIC_GAME_TENANT_ID / NEXT_PUBLIC_GAME_WEB_CLIENT_ID / NEXT_PUBLIC_GAME_API_CLIENT_ID / NEXT_PUBLIC_GAME_REDIRECT_URI가 필수 공개 값. 운영 redirect는 실제 HTTPS SWA origin+"/", 로컬은 등록된 http://localhost:3000/. NEXT_PUBLIC_GAME_MODE는 local-dev|cloud(default cloud); local-dev는 NODE_ENV=development일 때만 허용. API_BASE는 same origin /api/game 고정.
2. Core Processing:
   - @azure/msal-browser PublicClientApplication singleton promise, authority=https://login.microsoftonline.com/{tenantId}, cacheLocation=sessionStorage, scopes=[api://{apiClientId}/access_as_user]. initialize→handleRedirectPromise를 페이지 생명주기당 한 번 처리하고 active account를 명시 선택. 기존 account 여러 개이면 임의 첫 계정 사용 대신 로그인 선택을 유도.
   - 로그인 버튼은 loginRedirect로 auth code+PKCE. signed-in은 목표tenant의 account로만 UI 설정하지만 최종 보안 판정은 서버. 취소/interaction 실패는 LoginGate에 오류·재시도. 초기화 중 로그인 호출 중복 방지.
   - getAccessToken은 acquireTokenSilent, InteractionRequiredAuthError면 reauth-required로 바꾸고 플레이 중 자동 redirect하지 않는다. UI 로그인 다시 하기의 명시 조작에서 재인증. GameApiClient는 Bearer accessToken만 붙이며 idToken 전송 금지.
   - 각 API 호출 전 token 취득, 401은 silent forceRefresh 한 번만 재시도 후 reauth; 403은 권한 오류로 고정하며 무한 로그인 반복 금지. 다른4xx/429/503은 코드·retryAfterMs 보존하여 상위Coordinator가 처리. 응답DTO를 검증하고 bootstrap503→defaults 금지.
   - signOut은 호출자가 진행 flush/release를 끝낸 후 logoutRedirect를 수행하는 함수; 이 Task는 AuthProvider 상태 초기화·msal 계정 cache 정리만 책임. token/secret을 account 저장 캐시에 넣지 않는다.
   - Provider+LoginGate는 children을 signed-in에서만 렌더. 초기화/로그인/재인증/실패 UI와 키보드 버튼을 제공. 기존 page.tsx/GameShell에 연결하지 않아 legacy 저장과 cloud를 어중간하게 섞지 않는다. 실제 연결은 T04 명시 범위.
3. Error & Exception Handling: env 누락은 구성 오류 화면(운영 guest fallback 금지), cancelled는 signed-out/재시도. MSAL 계정키 변경 시 소비자가 lifecycle를 새로 만들도록 accountKey=homeAccountId+tenantId. AbortError는 사용자 오류 toast로 표시하지 않는다. 토큰·oid·email을 로그나 화면 랭킹에 넣지 않는다.
4. State Transition & Return: 인증 모듈과 API transport를 export하고 pure state transition·대역 호출로 검증. .env.example에는 빈 공개값과 설명만, 실제 값은 .env.local. 프런트 번들에 GAME_COSMOS_* 이름/비밀을 참조하지 않는다.

### I02. 상태·회귀 검증

- Related Files:
  - `scripts/cloud-auth.test.mjs` :: `node:test cases` — API/시간 대역과 실제 순수 상태 전이, 필요한 React DOM 검증; new

#### Details

- MSAL 초기화/redirect Strict Mode 중복1회, token scope·Bearer 확인, IDtoken 미사용, cancel/retry, silent만료→재로그인 상태, 4011회 재시도/403 중단, Abort 이후 account 변경응답 무시할 계약, placeholder env의 fail-closed. 실제 Microsoft 로그인은 P03에서 사용자 수동으로 확인. React 컴포넌트 검증은 scripts/의 node:test에서 jsdom과 Testing Library를 사용하며 .mjs에는 createElement를 사용한다. MSAL 인스턴스는 주입 가능한 대역으로 분리한다.
- React DOM 검사는 P02-T01의 jsdom/Testing Library로 수행한다. 브라우저 자동 조작은 사용하지 않는다.
- 소스 문자열 검사만으로 기능 검증을 대체하지 않는다. 수동 항목은 P03 실제 검증과 구별하여 Progress에 남긴다.

## Acceptance Criteria

- [x] 목표 조직 토큰 흐름과 오류 의미를 재사용 가능한 모듈로 제공한다.
- [x] 새 인증 모듈 추가가 기존 개발 게임·저장 동작을 먼저 바꾸지 않는다.
- [x] 기존 게임·키 입력·저장 경로의 관련 회귀 검증이 통과한다.

## Validation

- `node --import tsx --test scripts/cloud-auth.test.mjs` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npx tsc --noEmit` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run lint` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run build` — exit 0; 동작·타입·린트·빌드 오류 없음.

## Commit Message

```text
feat(game): MSAL 로그인과 계정 진입 게이트

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P02-game-integration
Task: T01-auth-gate

- 조직 로그인·토큰 갱신·로그아웃을 게임 생명주기와 분리한 인증 게이트를 준비한다.
- 저장·세션·계정 전환의 회귀 검증을 기록한다
```

## Progress

- SDK 호환 보완: MSAL Browser 5.27.0의 silent iframe 갱신은 redirect bridge가 필요하므로 `src/app/auth/redirect/page.tsx`와 `AuthController.ts`, DOM 검증 도우미를 추가했다. 명시 로그인 root URI는 유지하고 acquireTokenSilent에만 `/auth/redirect/`를 지정한다. P03에서는 이 SPA URI도 등록하고 해당 정적 경로는 COOP 없이 Cache-Control:no-store로 제공한다. 근거: [Microsoft MSAL 5 migration](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/v4-migration.md#cross-origin-opener-policy-coop-support).
- API 401 재시도를 위해 `getAccessToken(forceRefresh?:boolean)` 및 `GameApiClient`의 선택적 재로그인 콜백을 추가했다. 응답 시점 계정 epoch와 AbortSignal을 검사해 이전 계정의 늦은 응답을 폐기한다.
- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 트레일러 커밋으로 조회
- 검증 결과: 認証

