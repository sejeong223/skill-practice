# Task: T04 자동 저장·세션·일시정지·초기화 통합

## Status: pending

## Goal

운영 게임은 로그인·계정 읽기·쓰기 세션 확인 후에만 시작하고, 연결 실패/전환/초기화 중에 진행이 새지 않게 한다.

## Decision Summary

- GameShell의 legacy AutoSave를 운영에서 cloud로 교체한다. Boolean pause 대신 이유 집합을 사용해 다른 창 닫기·Escape·씬 시작이 저장 보호를 풀지 못하게 한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 게임 연결

- Related Files:
  - `src/components/game/GameEntry.tsx` :: `GameEntry, CloudGameSession` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/components/game/CloudStatusOverlay.tsx` :: `CloudStatusOverlay` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/persistence/cloud/tabSession.ts` :: `claimTabSession, releaseTabSession` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/bridge/PauseReasons.ts` :: `PauseReasons` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/bridge/CloudPauseController.ts` :: `CloudPauseController` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/game/bridge/GameEventBus.ts` :: `pause reason state` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/stages/stageEvents.ts` :: `pause-reasons-changed` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/GameShell.tsx` :: `props, loading effect, autoSaveRef, reset, menu handlers` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/PhaserGame.tsx` :: `pause controller lifecycle` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/scenes/StageScene.ts` :: `setPaused, update Escape, create` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/cutscenes/CutsceneTimeline.ts` :: `pause, resume, remaining duration` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/cutscenes/CutsceneDirector.ts` :: `pause reason subscription, destroy` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/ResetProgressDialog.tsx` :: `pending and error props, preservation copy` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/PauseOverlay.tsx` :: `manual resume only` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/CutsceneOverlay.tsx` :: `external pause input guard` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/app/page.tsx` :: `render GameEntry` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/app/globals.css` :: `auth/cloud statuses and dialog` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/persistence/ProgressStore.ts` :: `optional storage key for isolated development` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: `local-only coordinator` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `package.json` :: `test:cloud-game` — 이 Task에서 다룰 연결·상태·설정; modify

#### Details

- **Signatures & Types**:
```ts
type PauseReason="manual"|"shop"|"catalog"|"paint"|"world-select"|"reset"|"leaderboard"|
 "bootstrap"|"save-error"|"auth"|"session-lost"|"conflict"|"hidden";
class PauseReasons {
 set(reason:PauseReason,active:boolean):void; has(reason:PauseReason):boolean;
 snapshot():ReadonlySet<PauseReason>; isPaused():boolean;
 subscribe(listener:(reasons:ReadonlySet<PauseReason>)=>void):()=>void;
}
interface CloudGameSession {
 bootstrap:Bootstrap; sessionId:string; api:GameApiClient;
 saves:CloudSaveCoordinator; sessions:CloudSessionClient;
}
type GameShellProps={initialStageId:StageId;onExit?:()=>void} &
 ({mode:"local";cloud?:never}|{mode:"cloud";cloud:CloudGameSession});
export function GameEntry():ReactElement;
export function claimTabSession(playerId:string):Promise<{sessionId:string;release:()=>void}>;
class CloudPauseController { constructor(game:Phaser.Game,bus:GameEventBus);destroy():void }
class CutsceneTimeline { pause():void; resume():void; /* 기존 play/advance/skip/cancel 유지 */ }
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

1. Precondition & Validation: page는 GameEntry를 렌더한다. local-dev는 NODE_ENV=development에서만 허용하고 production 빌드에서는 거절한다. 기본 cloud 모드는 로컬에서도 정상 W1부터 시작하며 prepareDevelopmentProgress/getDevelopmentEntry를 호출하지 않는다. querystring으로 운영 모드를 우회하지 못한다.
2. Core Processing:
   - AuthProvider/LoginGate → bootstrap GET → 탭 session 확보 → 기존 pending 확인 → acquire 순서다. 로컬 pending의 playerId/runId/sessionId/generation이 서버와 같으면 heartbeat로 같은 소유권을 확인하고 원래 요청을 먼저 재전송한다. flush 후 bootstrap을 다시 읽고 acquire한다. acquire가 먼저 current.version을 올려 복구 요청을 충돌시키지 않게 한다. 다른 owner/generation/run의 pending은 격리하며 이식하지 않는다.
   - 비활성 lease는 acquire(false), 다른 활성 owner가 있으면 "다른 화면에서 플레이 중입니다"/"여기서 이어하기"를 표시한다. 클릭할 때만 acquire(true). acquire 결과와 heartbeat를 확인한 뒤 progress/resume/lease를 게임에 넘긴다. 읽기401/503에서 게임이나 기본 저장을 만들지 않는다.
   - 탭 sessionId는 sessionStorage의 UUID다. 탭 복제는 같은 sessionStorage를 가져올 수 있으므로 navigator.locks의 account/sessionId 이름으로 ifAvailable lock을 페이지 생명주기 동안 유지한다. 충돌하면 새 UUID를 만든다. Web Locks가 없으면 항상 새 UUID를 발급하고 기존 lease가 있을 때 명시적 전환을 요청한다. 이전 세션의 pending을 새 세션에 자동 이식하지 않는다.
   - Strict Mode setup/cleanup과 늦은 응답을 lifecycle 번호/AbortController로 구분한다. 인증 계정이 바뀌면 이전 게임·저장기·heartbeat·bus를 종료하고 늦은 callback을 무시한다. 이전 pending은 이전 계정 키에 남기며 새 계정으로 복사하지 않는다.
   - cloud GameShell은 bootstrap.progress를 공유 progressRef에 한 번 적용하고 runtime/economy/bridge/coordinator를 연결한다. 운영에서는 legacy load/save/clear와 prepareDevelopmentProgress를 호출하지 않는다. local-dev만 기존 AutoSave를 쓰고 legendary-rib-corgi:development:progress:v1에 저장한다. 옛 legendary-rib-corgi:progress:v1은 보존한다.
   - 이름은 공용 normalizeNickname 후 저장한다. 구매/그림판/keybind/컷신/death/coin을 기존 도메인 이벤트에서 받아 누락 없이 저장한다. 저장 성공 문구는 Ack 이후에만 표시한다. 동일 기능을 새 경제/사망 시스템으로 다시 만들지 않는다.
   - reset 대화상자는 진행·보유품·데스 초기화와 최고 기록 보존을 알린다. 처리 중 버튼을 비활성화한다. coordinator.reset이 성공한 Bootstrap을 반환한 다음 새 run key로 GameShell을 다시 만든다. 실패하면 현재 게임을 유지한다. store.clear/window.reload로 먼저 지우지 않는다.
   - 로그아웃은 입력 정지→flush→release→Phaser 종료→MSAL logout 순서다. flush 실패는 정지/재시도를 유지한다. 이미 인증이 만료되면 pending을 보존하고 재로그인한다. 기존 상태/설정 영역에 로그아웃 버튼을 추가한다.
   - PauseReasons는 React와 Phaser가 공유한다. 기존 pause-requested는 manual 이유만 바꾸고, 각 메뉴는 자기 이유만 추가/제거한다. stage-started, setPaused(false), Escape가 강제 정지를 풀지 못하게 한다. pause-state-changed는 관찰 결과이며 ledger를 초기화하지 않는다.
   - CloudPauseController는 bootstrap/save-error/auth/session-lost/conflict/hidden/reset에서 활성 씬을 멈추고 자신이 멈춘 씬만 복원한다. 새 씬 시작도 ledger를 먼저 확인한다. 씬 timer/tween/input/physics를 멈춘다. 일반 manual/menu 정지는 기존 StageScene 흐름을 보존한다.
   - CutsceneTimeline의 native setTimeout은 scene.pause만으로 멈추지 않는다. pause는 deadline-now를 저장하고 timer를 취소한다. resume는 남은 시간만 예약하고, pause 중 advance/skip은 거절한다. CutsceneDirector가 강제 pause를 구독하고 destroy에서 해제한다. React의 death overlay900ms/씬 전환 callback도 보호 이유를 제거하지 못하게 한다. 기존 월드3 인트로 오류의 별도 수정은 포함하지 않는다.
   - CloudStatusOverlay는 저장 중(비차단), 재연결 중(차단), 재로그인 필요, 다른 화면으로 전환됨, 충돌/설정 오류를 구분한다. runId/ETag/RU 같은 구현 정보는 제품 화면에 표시하지 않는다. queue 전체 Ack와 lease 확인 이후 save-error만 제거하고 다른 manual/menu 이유가 남으면 계속 멈춘다.
3. Error & Exception Handling: 불량 캐시는 서버 조회로 복구한다. 서버 조회 실패는 게임 진입을 막는다. 운영 오류를 개발 모드 우회로 해결하지 않는다. unmount 정리는 캡처한 sessionId/generation만 종료하여 새 세션을 해제하지 않는다.
4. State Transition & Return: 운영은 로그인→읽기→활성 세션→게임, 실패는 정지→저장/lease 복구→남은 정지 이유 판단이다. 로컬 개발 W4 편의 동작은 유지하되 운영 API 호출은0회다.

### I02. 상태·회귀 검증

- Related Files:
  - `scripts/cloud-game.test.mjs` :: `node:test cases` — API/시간 대역과 실제 순수 상태 전이, 필요한 React DOM 검증; new

#### Details

- 로그인전Phaser생성0, bootstrap503때legacy쓰기0, 신규계정W1, devW4의API호출0, tab복제session분리, strictmount중복정리, takeoveroldwriter즉시/heartbeat감지정지, reset실패시진행유지, save실패중메뉴닫기/Escape/stage-started/죽음timer가재개못함, native컷신timer정지/남은시간복원, account변경늦은응답무시.
- React DOM 검사는 P02-T01의 jsdom/Testing Library로 수행한다. 브라우저 자동 조작은 사용하지 않는다.
- 소스 문자열 검사만으로 기능 검증을 대체하지 않는다. 수동 항목은 P03 실제 검증과 구별하여 Progress에 남긴다.

## Acceptance Criteria

- [ ] 운영 첫 게임과 계정 전환은 인증·저장 읽기·세션 확인 뒤에 시작한다.
- [ ] 모든 강제 정지 사유가 풀려야만 플레이가 재개된다.
- [ ] 기존 게임·키 입력·저장 경로의 관련 회귀 검증이 통과한다.

## Validation

- `node --import tsx --test scripts/cloud-game.test.mjs scripts/cloud-save-client.test.mjs scripts/cloud-resume.test.mjs scripts/development-start.test.mjs` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npx tsc --noEmit` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run lint` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run build` — exit 0; 동작·타입·린트·빌드 오류 없음.

## Commit Message

```text
feat(game): 자동 저장·세션·일시정지·초기화 통합

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P02-game-integration
Task: T04-cloud-game

- 운영 게임은 로그인·계정 읽기·쓰기 세션 확인 후에만 시작하고, 연결 실패/전환/초기화 중에 진행이 새지 않게 한다.
- 저장·세션·계정 전환의 회귀 검증을 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과·미실행 수동 확인: 실행 시 기록

