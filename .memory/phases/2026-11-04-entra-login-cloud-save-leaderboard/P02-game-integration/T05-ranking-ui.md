# Task: T05 랭킹 메뉴와 접근 가능한 TOP 10 대화상자

## Status: done

## Goal

기존 게임 메뉴에서 현재 TOP10을 조회하고 닫은 뒤 남은 정지 사유를 존중한다.

## Decision Summary

- 항상 표시하는 사이드바/새닉네임수정UI/가짜데이터 없음. 순위·닉네임·데스·클리어위치만 표시한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 게임 연결

- Related Files:
  - `src/components/game/LeaderboardDialog.tsx` :: `LeaderboardDialog, LeaderboardState` — 이 Task에서 다룰 연결·상태·설정; new
  - `src/components/game/GameShell.tsx` :: `leaderboardOpen, open/close, logout account control` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/GameOverlay.tsx` :: `onOpenLeaderboard props` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/components/game/Hud.tsx` :: `ranking menu button` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/systems/gameMenuAvailability.ts` :: `SharedMenuState.leaderboardOpen` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/app/globals.css` :: `ranking dialog and responsive menu` — 이 Task에서 다룰 연결·상태·설정; modify
  - `src/game/persistence/cloud/GameApiClient.ts` :: `leaderboard` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `src/game/bridge/PauseReasons.ts` :: `leaderboard reason` — 이 Task에서 다룰 연결·상태·설정; read-only
  - `package.json` :: `test:ranking-ui` — 이 Task에서 다룰 연결·상태·설정; modify

#### Details

- **Signatures & Types**:
```ts
type LeaderboardState=
 {status:"loading";rows:[];error:null}|
 {status:"ready";rows:LeaderboardRow[];error:null}|
 {status:"error";rows:[];error:string};
interface LeaderboardDialogProps {
 load:(signal:AbortSignal)=>Promise<LeaderboardResponse>; onClose:()=>void;
}
export function LeaderboardDialog(props:LeaderboardDialogProps):ReactElement;
// HudProps/GameOverlayProps: onOpenLeaderboard:()=>void
// SharedMenuState: leaderboardOpen:boolean
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

1. Precondition & Validation: 기존공유메뉴진입조건canOpenSharedMenu에leaderboardOpen반영. cloud유효세션의메뉴버튼에서open. local-dev에서는버튼비활성+개발모드안내, production API를사용하지않음.
2. Core Processing:
   - 열기→leaderboard pause이유추가→매open서버GET. 같은account/run에서UI결과재사용으로최신조회생략하지않음. fetch중언마운트/닫기abort, 늦은응답state변경금지.
   - semantic table 열=순위/닉네임/데스 수/클리어 위치. server정렬그대로, 클라이언트재sort/가짜행추가없음. 최대10행확인. 0명은"아직 등록된 기록이 없어요." 로딩/오류/재시도는서로구분.
   - dialog role=dialog,aria-modal=true,labelledby,초기focus닫기,Tabfocus순환,Escape닫기,닫은뒤원래랭킹버튼focus복구. 배경inert는dialog까지포함하지않도록포털또는형제배치. nickname은Reacttext로만렌더,HTML삽입금지.
   - close는leaderboard이유만삭제. 저장실패/세션상실/수동pause는유지. 401이면authpause와재로그인,403은권한메시지,429/503은조회재시도이며기존저장내용을건드리지않음.
   - 20자한글닉네임·긴클리어label·작은화면320px·데스크톱에가로넘침/기존메뉴겹침이없게CSS. 기존모바일메뉴display/position media query확인하고새버튼도접근가능. 텍스트 "랭킹" 버튼으로충분하며새이미지제작범위없음.
3. Error & Exception Handling: 조회실패를빈랭킹과구분, 개인정보·serverstack노출없음. retry중복요청1개,닫기abort후error노출없음.
4. State Transition & Return: 게임화면점유는모달열렸을때만. 이름중복을허용하므로Reactkey는response rank 등해당조회행키사용(닉네임단독key금지).

### I02. 상태·회귀 검증

- Related Files:
  - `scripts/ranking-ui.test.mjs` :: `node:test cases` — API/시간 대역과 실제 순수 상태 전이, 필요한 React DOM 검증; new

#### Details

- loading/empty/1/10/error/retry, 11행불량응답거절, 이름중복키, 닉네임HTML문자text표시, escape/focus복귀, 닫기후save-error이유유지, callbackabort, 개발모드조회0. 실제320px/키보드/포커스확인은P03-T04에서사용자수동체크.
- React DOM 검사는 P02-T01의 jsdom/Testing Library로 수행한다. 브라우저 자동 조작은 사용하지 않는다.
- 소스 문자열 검사만으로 기능 검증을 대체하지 않는다. 수동 항목은 P03 실제 검증과 구별하여 Progress에 남긴다.

## Acceptance Criteria

- [x] 메뉴에서 실데이터 TOP10을 상태별로 표시하고 개인정보를 노출하지 않는다.
- [x] 대화상자 닫기와 재시도가 저장·세션 정지를 풀지 않는다.
- [x] 기존 게임·키 입력·저장 경로의 관련 회귀 검증이 통과한다.

## Validation

- `node --import tsx --test scripts/ranking-ui.test.mjs scripts/cloud-game.test.mjs` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npx tsc --noEmit` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run lint` — exit 0; 동작·타입·린트·빌드 오류 없음.
- `npm run build` — exit 0; 동작·타입·린트·빌드 오류 없음.

## Commit Message

```text
feat(game): 랭킹 메뉴와 접근 가능한 TOP 10 대화상자

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P02-game-integration
Task: T05-ranking-ui

- 기존 게임 메뉴에서 현재 TOP10을 조회하고 닫은 뒤 남은 정지 사유를 존중한다.
- 저장·세션·계정 전환의 회귀 검증을 기록한다
```

## Progress

- 서버 순서를 유지하는 semantic TOP 10 table, 로딩/빈 기록/권한·요청 제한·연결 오류/재시도를 구현했다. 응답을 다시 검증하여 11행·추가 개인정보 필드를 거절하고 이름은 React text로만 표시한다.
- body 포털로 모달을 렌더하고 게임 배경은 inert 처리한다. 초기 닫기 focus, Tab 순환, Escape, 원래 버튼 복귀, abort와 늦은 응답 무시를 검증했다. 강제 정지 발생 시 모달 입력을 막고 상위 연결 안내를 사용한다.
- 기존 상점과 같은 Escape 처리 충돌을 막기 위해 StageScene에 leaderboard-state-changed 입력 guard를 추가했다. close는 leaderboard 이유만 제거한다. local-dev 랭킹 버튼은 비활성이고 API 호출은 없다.
- 긴 이름/위치의 줄바꿈, 작은 화면의 상태·랭킹 버튼 별도 행을 CSS로 반영했다. 실제 320px·모바일·키보드/포커스 육안 확인은 computer-use 금지에 따라 P03 사용자 수동 확인으로 남긴다. HUD·CSS·StageScene의 기존 변경은 선별 스테이징으로 보존했다.

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 트레일러 커밋으로 조회
- 검증 결과: 랭킹·게임 통합·기존 메뉴 27/27, 변경 후 랭킹 7/7 재검증, TypeScript·린트·Next 빌드 통과. 실제 320px/모바일/브라우저 포커스는 P03 사용자 수동 확인 대상.

