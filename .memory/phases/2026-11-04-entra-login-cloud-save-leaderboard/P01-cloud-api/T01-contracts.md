# Task: T01 저장 계약과 실제 진행 지점 정의

## Status: done

## Goal

서버와 게임이 같은 저장 DTO·진행 순서·닉네임·최고 기록 비교를 사용하고, 잘못된 저장이 기본값으로 숨겨지지 않게 한다.

## Decision Summary

- 운송 스키마 1과 기존 ProgressState v5를 분리한다. Phaser를 import하지 않는 순수 모듈로 정의하고 월드 2 stage4·가짜 CP를 배제한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 계약과 구현

- Related Files:
  - `src/game/cloud/contracts.ts` :: `Identity, Bootstrap, SaveRequest, SaveEvent, ResumeState, ApiErrorBody` — 본 Task의 계약·서비스·구성; new
  - `src/game/cloud/progression.ts` :: `MILESTONES, PLAYABLE_PATH, milestoneFor, canEnterStage, isBetterRecord` — 본 Task의 계약·서비스·구성; new
  - `src/game/cloud/validation.ts` :: `parseSaveRequest, parseBootstrap, validateProgress, validateCheckpoint, normalizeNickname` — 본 Task의 계약·서비스·구성; new
  - `src/game/core/types.ts` :: `ProgressState, StageId, WorldSelectionRequest` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/core/constants.ts` :: `createDefaultProgressState, DEFAULT_KEYBINDS` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/core/runtimeTypes.ts` :: `MapRuntimeSnapshot, CheckpointSnapshot` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/data/worlds.ts` :: `WORLDS, stage checkpointIds` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/data/world01Maps.ts` :: `world01Checkpoint` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/data/marketCatalog.ts` :: `MARKET_PRODUCTS` — 본 Task의 계약·서비스·구성; read-only
  - `src/game/persistence/migrations.ts` :: `migrateSave, sanitizeCustomOutfits` — 본 Task의 계약·서비스·구성; read-only
  - `package.json` :: `devDependencies.tsx, scripts.test:cloud-contracts` — 본 Task의 계약·서비스·구성; modify
  - `package-lock.json` :: `locked dependencies` — 본 Task의 계약·서비스·구성; modify

#### Details

- **Signatures & Types**:
```ts
export function normalizeNickname(value:string):string;
export function validateProgress(value:unknown):ProgressState;
export function validateCheckpoint(value:unknown,stageId:StageId):CloudCheckpoint;
export function parseSaveRequest(value:unknown):SaveRequest;
export function parseBootstrap(value:unknown):Bootstrap;
export function milestoneFor(event:SaveEvent):{id:string;rank:number;label:string}|null;
export function canEnterStage(current:CurrentState,target:StageId):boolean;
export function isBetterRecord(candidate:BestRecord,previous:BestRecord|null):boolean;
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

1. Precondition & Validation: shared 파일은 type-only import와 순수 데이터만 참조. API/React/Phaser/DOM 의존을 끌어오지 않는다. 요청 최대256 KiB, Progress JSON192 KiB, checkpoint48 KiB. 모든 숫자는 finite이며 카운터·버전·순번·seed는 safe integer다. 좌표와 장면 시각은 유한 실수를 허용하고 x/y는 유효 맵 범위, seed=1..2147483647, mapSnapshotVersion≥0.
2. Core Processing:
   - PLAYABLE_PATH: W1 1,2,3,4,boss → W2 1,2,3,boss → W3/4/5 각1,2,3,4,boss. stage4(W2)는 알려진 legacy ID지만 새 cloud clearedStages/이벤트에서 거절.
   - 진행 rank는 월드 번호×100+step. W1 start=100, CP(stage2)=101, CP(stage4)=102, clear=199. W2 start=200, CP(stage1/2/3)=201/202/203, clear=299. W3/4/5 start=300/400/500, CP(stage1~4)=301..304/401..404/501..504, clear=399/499/599. ID는 world-0N:start / world-0N:checkpoint-K / world-0N:clear. 라벨은 월드 N 시작 / 월드 N 체크포인트 K / 월드 N 클리어.
   - CP ID는 해당 stageId+"-checkpoint". worlds.ts의 실제 checkpointIds 및 world01Checkpoint와 대조하는 테스트를 둔다. 보스 진입/일반맵 클리어/복원 origin=restored는 rank 없음. 월드 시작은 stage1 실제 진입, 월드 클리어는 해당 boss 완료.
   - canEnterStage는 동일 현재 stage, 현재 stage 완료 후 정상 next, W2 stage2→1 및3→2, 서버 resume.stageId로의 재개만 허용한다. 월드 선택은 별도 검증된 명령에서 cursor를 변경. 마지막 world5 boss의 다음 stage=null.
   - isBetterRecord는 progressRank 큰 값, 동일 값 deaths 작은 값만 교체. runId는 달성 사건의 회차. 시간·현재 총사망을 과거 best에 덧붙이지 않는다.
   - 배열 최대: clearedStages24, skills5, customOutfits3, deathsByStage24, collection/string-ID 배열 각8192/원소128자, seenCutscene/discovered 각256, key code1..64자. 카탈로그 ID·중복·소유/장착 관계 검사. coins/deaths는0..Number.MAX_SAFE_INTEGER; deathsTotal=sum(deathsByStage). 부족/추가 필드·알 수 없는 schema는 오류. 실제 카탈로그 크기가 이 기본 상한을 넘는다면 임의 삭제하지 말고 상한 근거를 수정한다.
   - 닉네임 표시값은 기존 규칙 유지, 정렬키만 normalize("NFC"). keybinds 모든 InputAction 필수. 서버 신규 저장만 createDefaultProgressState를 쓰며 API 오류에 migrateSave fallback을 쓰지 않는다.
3. Error & Exception Handling: ContractError extends Error에 code와 fieldPath를 두고 malformed payload→400; 서버 저장 불량→503으로 호출자가 변환. 검증은 값의 깊은 복사 반환, 입력 변경 금지. 악의적 __proto__/constructor key는 거절하고 Map 또는 Object.create(null) 사용.
4. State Transition & Return: 이 Task는 순수 계약/검증만 추가하며 기존 GameShell 저장 동작을 바꾸지 않는다. npm test:cloud-contracts는 node --import tsx --test scripts/cloud-contracts.test.mjs로 설정.

### I02. 동작·경계 검증

- Related Files:
  - `scripts/cloud-contracts.test.mjs` :: `node:test cases` — 실제 함수·핸들러/저장소 대역 검증; new

#### Details

- 구현 문자열 존재만 확인하지 않고 입출력·에러·경쟁 결과를 검증한다.
- 기본 저장의 모든 필드 round-trip, 그림판 1792cells·null, 잘못된 enum/없는 필드/NaN/음수/너무 큰 JSON 거절, CP 매핑 17개(2+3+4+4+4), 월드 시작5·클리어5, W2 stage4 제외, 한국어 이름 정규화, 최고 기록의 데스·회차 짝 보존, restore가 점수 후보를 만들지 않음.
- 검증 대역은 운영 인증을 우회하는 runtime 플래그로 노출하지 않는다.

## Acceptance Criteria

- [x] 계약·기본값·진행 지점이 코드와 일치하고 API에서 Phaser 없이 import 가능하다.
- [x] 기존 로컬 v5 저장·개발 시작 코드를 변경하지 않는다.
- [x] 아래 검증이 통과하고 기존 작업 변경을 보존한다.

## Validation

- `npm run test:cloud-contracts` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npx tsc --noEmit` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.
- `npm run lint` — exit 0; 관련 동작 검사·타입·빌드·린트 오류 없음.

## Commit Message

```text
feat(cloud): 저장 계약과 실제 진행 지점 정의

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P01-cloud-api
Task: T01-contracts

- 서버와 게임이 같은 저장 DTO·진행 순서·닉네임·최고 기록 비교를 사용하고, 잘못된 저장이 기본값으로 숨겨지지 않게 한다.
- 경계 사례 검증과 Task 진행 기록을 추가한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 트레일러 커밋으로 조회
- 검증: cloud-contracts 25/25, TypeScript, ESLint(경고 0) 통과. 기존 v5 저장·개발 모드 파일 변경 없음.
- 범위 밖 발견: 기존 Next 16.3.5를 포함한 npm audit 경고 20개(critical 1). use cache/cacheComponents 사용은 발견되지 않았으며 보안 의존성 갱신은 이번 Task에 섞지 않음. 배포 전 별도 검토 권장. 근거: https://github.com/advisories/GHSA-673q-mjm6-r5xr

