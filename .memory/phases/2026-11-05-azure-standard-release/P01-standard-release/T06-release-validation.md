# Task: T06 실제 로그인·저장·기기 전환 검증

## Status: in_progress

## Goal

배포된 Standard 사이트의 HTTP/API/제한된 DB 신원과 사용자의 실제 로그인·저장·계정 전환을 확인하여 운영 동작과 남은 한계를 증거로 남긴다.

## Decision Summary

- T05 실제 URL/sourceSHA/run success가 선행 조건. 자동 HTTP/격리SDK 검사와 사용자 실제 브라우저 확인을 구분한다. computer-use/자동로그인 없음.
- 가짜 prod점수/운영진행 초기화/다른DB 문서 조회 금지. 테스트문서만정리. 테스트 scripts/ 바로아래, 결과는 본Progress. 보안업그레이드/월드3인트로수정은별도범위다.

## Implementation

### I01. 실제 HTTP와 격리된 Cosmos 검사

- Related Files:
  - `scripts/cloud-release-smoke.mjs` :: `runHttpSmoke/runCosmosSmoke` — 실제검사 CLI; new
  - `scripts/cloud-release-smoke.test.mjs` :: `guard/cleanup fixtures` — 외부부작용없는검사기테스트; new
  - `scripts/cloud-regression.test.mjs` :: `cross-layer regression` — 기존계약을묶은음성검증; new
  - `scripts/cloud-test-support.mjs` :: `InMemoryGameRepository/activeAccount/fakeClock` — 기존순수테스트도구; read-only
  - `api/src/config.ts`, `api/src/repository.ts`, `api/src/documents.ts` :: `loadServerConfig/CosmosGameRepository/parseDocument` — 실제SDK/계약; read-only unless defect fix
  - `api/src/services/account.ts`, `session.ts`, `save.ts` :: `bootstrapAccount/acquireSession/saveProgress/resetProgress` — 검증대상; read-only unless defect fix
  - `src/game/cloud/contracts.ts`, `src/game/cloud/progression.ts` :: `Identity/SaveRequest/milestoneFor` — 계약; read-only
  - `package.json` :: `smoke:cloud/test:release-smoke/test:cloud` — 명령; modify

#### Details

- **Signatures & Types**:
```ts
interface SmokeResult { passed: string[]; failed: string[]; remainingTestDocuments: number }
export async function runHttpSmoke(baseUrl: string): Promise<SmokeResult>;
export async function runCosmosSmoke(config: ServerConfig): Promise<SmokeResult>;
// CLI: node --import tsx scripts/cloud-release-smoke.mjs --base-url <실제HTTPSorigin> [--cosmos]
// 로컬 env/ignored api/local.settings.json에서만 서버 자격증명 읽기; 값/토큰 출력 금지
```
- **Data & Schema Fields**:
  - 고정 tenant=`69c1e470-4528-435a-a1ae-de98e0aac738`, APIclient=`a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`, webclient=`e467e8bc-c900-4d08-88be-7f0a5fce2474`; endpoint=`https://maze-rescue-ms-b7af62a9.documents.azure.com:443/`, DB=`legendary-rib-corgi`, container=`game-data`.
  - ServerConfig 필수env: GAME_TENANT_ID/API_CLIENT_ID/WEB_CLIENT_ID/COSMOS_ENDPOINT/COSMOS_CLIENT_ID(=APIclient)/COSMOS_CLIENT_SECRET, GAME_TEST_OBJECT_IDS JSON[] 기본. 실제고정ID외/키인증/다른DB는거절한다.
  - Identity=`{tenantId,objectId,namespace:"test",playerId:"test:"+tenantId+":"+objectId}`. objectId는실행마다새UUID(실제사용자oid와별개 SDKfixture). 실행소유UUID·docIDs를메모리에추적하고잔여정리목록은ignored build/cloud-smoke-cleanup.json에공개식별자만기록한다. prod playerId는검사실행전에거절한다.
  - 계정문서IDs profile/current/best/session; receipt:{UUID}, TTL604800. schemaVersion1, namespace test. BestDoc.eligible는test이므로false이어야하며공개랭킹에노출시키지않는다. 문서는기존bootstrap/service/parseDocument로생성/검증하고독자적느슨한스키마를만들지않는다.
  - mutation입력: requestId/sessionId UUID,generation정수,runId UUID,expectedVersion정수,sequence=lastSequence+1,schemaVersion1. SaveRequest추가event(기존유효 stage-enter/state/checkpoint 등)+progress(v5); ResetRequest에는event/progress없음. 최신bootstrap에서값을얻어조립한다. Lease60초/heartbeat15초, takeover시generation증가.
  - SmokeResult는caseID만기록,응답원문/token/secret/타인progress는출력하지않는다. 실패는원인을분류한안전한코드로반환,전체CLI exit1. missingcredential은skip/pass가아닌명확한미완료다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 실제origin은T05기록및조회와동일 HTTPS azurestaticapps.net,rootpath/credentials/query/hash없음. 요청timeout10초,redirect는같은origin만허용. arbitraryhost의응답을해당게임검증으로인정하지않는다.
  2. HTTP: root200/html;첫대표 _next JS와pixel이미지200;bridge `/auth/redirect/`200/no-store/COOP없음;존재하지않는asset404;GET /api/game/bootstrap 무인증과위조Bearer 각각401(JSON/no-store);POST /api/game/save 위조Bearer401;index.html fallback없음;/.env,/api/local.settings.json,/api/src/config.ts,/build/game-api/package.json,/api/dist/functions/game.js는원본비밀/서버파일로공개되지않음(404검증). malformedtoken도본문에반사하지않는다.
  3. --cosmos는사용자가환경에직접설정한같은게임API앱 ClientSecretCredential로실행한다. operator CLI신원/계정키로대체하지않는다. 필요한경우사용자에게ignored api/local.settings.json의Values에직접입력하도록안내;내용을cat하거나Git추가하지않는다. 코드에서는loadServerConfig로검증하고@azureSDK는api/package.json 기준해결(createRequire 등)하여root에중복의존성을추가하지않는다.
  4. 새testIdentity에서bootstrapAccount→acquireSession→유효state/stage이벤트저장→동일request재전송동일ACK·version1회증가 확인. 기존유효fixture생성규칙을사용하고임의불가능진행을API가허용하도록수정하지않는다. 테스트best를생성하는유효milestone후reset새run/최고기록보존을확인한다.
  5. 직접SDK batch의실패원자성:본실행문서1개를현재ETag로읽은뒤첫replace에명확한staleETag와두번째본실행용receipt/create를같은partitionbatch에넣는다. 실패412와다른작업424를확인하고두번째문서부재·첫문서내용불변확인. SDK서비스의자동재시도성공과구분한다.
  6. 두session경쟁은기존서비스 acquireSession(takeoverfalse)409→true로전환→이전generation저장409/SESSION_LOST 및변경없음. 이SDK검사는실제웹사용자로그인검증을대체하지않는다.
  7. 게임DB범위역할을ARMmetadata로확인하고,같은앱신원으로계정전체DB목록요청은403을기대한다. 성공하거나다른결과면범위검증실패로기록하고다른DB문서를읽거나앱권한을확장하지않는다.
  8. finally정리는이번실행에서생성한test playerId+docID만point delete. 삭제전DB/container/namespace/실행소유목록을다시검증한다. 컨테이너/DB삭제와전체namespace쿼리삭제없음. 실패시잔여수·정확한소유목록을남기고재실행이그목록을안전검증하여정리할수있게한다.
  9. Error & Exception Handling:401/403/429/503을구분하고전체서버응답/stack를출력하지않는다. 타인DB읽기·관리권한실행으로통과시키지않는다. 발견된배포연동결함은관련파일만최소수정하고해당테스트와필요한production재배포로검증한다.
  10. State Transition & Return: 자동검사와사용자확인증거를함께충족해야완료. --cosmos 미실행이나정리실패는미완료항목이다.

### I02. 사용자 수동 검증과 완료 판정

- Related Files:
  - 본 Task :: `Progress manual matrix` — 사용자응답·증거; modify
  - `src/game/persistence/cloud/CloudSaveCoordinator.ts`, `CloudGameController.ts`, `src/components/game/LeaderboardDialog.tsx` :: `game integration` — 문제발생시만최소수정; read-only by default
  - `scripts/cloud-regression.test.mjs` :: `cross-layer negatives` — 실제환경없이기존handler/client계약검증; new

#### Details

- 테스트계정의실제oid는사용자가선택한뒤서버 GAME_TEST_OBJECT_IDS에추가한다. 운영계정을임의test로전환/초기화하지않는다. test계정은운영TOP10에노출되지않으므로수동test랭킹은빈목록일수있으며이를결함으로오인하지않는다.
- 수동매트릭스 필드=`caseId,accountAlias,deviceAlias,expected,actual,status(pending/pass/fail/unavailable),checkedAt,evidenceNote`；실명/원문token없음. 한꺼번에질문폭탄을보내지않고관련단계를묶어차례로요청한다.
- 필수사례:
  - M01 조직멤버로그인→정상W1새게임. 기존로컬저장가져오기없음. 실제닉네임/코인/구매/그림판/키바인딩이저장후재접속에서도유지.
  - M02 실제W1체크포인트도달·death후저장완료→새로고침,보스중종료→동일world최근CP/없으면world시작복원. 복원된CP를새최고기록으로계산하지않음.
  - M03 같은계정기기A/B:자동세션탈취없음→B의명시적이어하기→A정지·B서버확정점복원·A오래된저장거절. 두번째독립계정은독립저장.
  - M04 사용자테스트계정에서offline→저장불가정지→Esc/메뉴닫기로필수정지해제불가→online ACK후재개;재로그인이필요한토큰만료경로확인.
  - M05 사용자선택테스트계정초기화:새run/진행·소지품·death초기화,닉네임·best유지. 운영기록임의reset없음.
  - M06 랭킹팝업열기/닫기·다른메뉴중첩·키보드Tab/Escape/포커스복귀·320px화면·빈목록·조회오류재시도확인. 실제점수가있으면닉네임/데스/위치만최대10개표시. 가짜prod점수를넣어채우지않는다.
- 초대guest로그인/다른tenant실계정거절은계정이있으면확인하고없으면unavailable로기록;자동JWT음성검사통과와구분한다. 별도guest계정발급을자동요구하지않는다.
- 한국어동점150명/10위경계·개발모드API0·testnamespace제외는기존api-ranking/cloud게임테스트로검증. prod/test계정을바꿔운영랭킹을오염시키지않는다. SDKfixture eligible=false와공개prod TOP10 테스트의역할을구분한다.
- `cloud-regression.test.mjs`는InMemoryGameRepository/실제서비스·클라이언트테스트포트를재사용하여계정격리,동일요청중복,오래된generation거절,resetbest보존의경계를검증한다. 단순구현복사테스트는추가하지않는다.
- package scripts: `smoke:cloud="node --import tsx scripts/cloud-release-smoke.mjs"`, `test:release-smoke="node --import tsx --test scripts/cloud-release-smoke.test.mjs scripts/cloud-regression.test.mjs"`; 기존test:cloud명시목록에새회귀파일만추가(실제smoke CLI는포함하지않음).
- 수동필수M01~M06중미응답/실패가있으면전체완료로표시하지않는다. 월드3인트로가검증을막으면별도문제와미검증범위를기록하고사용자가유지하기로한범위밖수정을자동추가하지않는다. 전체완주·모든기기·완전치트방지성공을증거없이주장하지않는다.

## Acceptance Criteria

- [ ] 자동HTTP·제한앱신원SDK·test정리완료와관련회귀검증이통과했다.
- [ ] 필수M01~M06 실제확인증거가있고추가guest/타tenant검증가능여부를구분했다.
- [ ] 다른리소스/운영데이터를변경하지않았고비밀노출없음.
- [ ] 실제URL/sourceSHA/run·한계와별도문제를기록하고새계획6/6을완료한다.

## Validation

- Node22 `npm.cmd run test:cloud`, `npm.cmd run test:release-smoke`, `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run typecheck:api` → exit0.
- `npm.cmd run smoke:cloud -- --base-url <T05실제origin>` → HTTP exit0.
- 사용자직접로컬자격증명입력후 `npm.cmd run smoke:cloud -- --base-url <T05실제origin> --cosmos` → exit0/remainingTestDocuments0.
- 배포수정시clean sourceSHA에서production build/check·수동재배포후새URL/SHA/run증거갱신.
- 필수수동표확인전Task done 금지. 완료시phase6/6·plancomplete·current Active Task없음으로전환,구계획이나별도문제자동재개없음.

## Commit Message

```text
test(release): Standard 실제 인증과 저장·기기 전환 검증

Plan: 2026-11-05-azure-standard-release
Phase: P01-standard-release
Task: T06-release-validation

- 실제 HTTP와 제한된 앱 신원으로 격리된 저장 경계를 확인한다
- 사용자 로그인·재개·랭킹 증거와 검증 한계를 기록한다
```

## Progress

- [x] 구현 완료
- [ ] 검증 통과
- commit: T06 수정 배포용 후보를 먼저 보존하고 수동 검증 완료 시 같은 Task 기록을 마무리한다. 아직 완료 커밋으로 간주하지 않는다.
- 2026-11-05T05:36Z: Node22 cloud164/164, release-smoke12/12, lint/root TypeScript/API TypeScript 통과. 실제 HTTP14/14 및 제한 앱 신원 Cosmos9/9 통과, remainingTestDocuments=0. 비밀/원문 토큰/타인 문서는 기록하지 않았다.
- 실제 HTTP: root/JS/PNG/bridge200, bridge no-store/COOP 없음, 없는 asset/서버 파일5종404, 미인증·위조 GET/POST401 JSON/no-store. 초기 배포 source=`c1e56c67f2c9b169de4cc9474d23fd2cecaedab4`, workflow=`03456f99372de9b8d6e9a5d715d098d227f5fa9c`, run41972324270, origin=`https://polite-rock-0f80d2a00.5.azurestaticapps.net`.
- 실제 Cosmos: 동일 API 앱 ClientSecretCredential로 실행. 계정 DB목록403, 게임DB 내 정상 저장, 동일 요청 ACK/버전 불변, 유효 CP101·death2 최고기록 생성 후 reset 보존, test best eligible=false, raw batch stale ETag 결과412/424 및 내용/receipt 원상 유지, 명시적 takeover와 이전 generation409/SESSION_LOST 확인. 생성한 test partition의 정확한 소유 문서만 point delete/404 재확인; 정리 manifest runs=[] 확인. 400RU 내 검증을 위해 요청 간격350ms를 두었고 처리량/권한을 늘리지 않았다.
- ARM 재확인: API SP `f02b1a27-859d-4872-8549-99ad95927132`의 Built-in Data Contributor(00000000-0000-0000-0000-000000000002)는 `/dbs/legendary-rib-corgi` 범위 한 건이다. 타 DB 문서 조회나 변경 없음.
- 사용자 직접 입력: ignored `api/local.settings.json`에 기존 서버 비밀을 설정했다. 값은 출력/Git 추가하지 않았다. 사용자 선택으로 CLI 계정(alias manual-A, oid 끝 cf5fa6c2)만 GAME_TEST_OBJECT_IDS에 추가하고 JSON 값 재확인. 운영 TOP10 제외, 사용자 초기화는 아직 실행하지 않았다.
- M01 최초 사용자 화면에서 “서버에 연결하지 못했습니다.” 확인. `GameApiClient`가 브라우저 fetch를 인스턴스 메서드로 호출하는 결함을 receiver 검증 대역으로 재현했고 `.call(globalThis, ...)`로 보완했다. Node fetch가 허용하는 호출이어서 기존 Node 검사로 잡히지 않았던 경계다.
- 실제 SDK 추가 결함: `item.read()`의 404는 예외 대신 statusCode=404 응답으로 반환된다. 신규 receipt 부재를 정상 null로 처리하도록 `CosmosGameRepository.readReceipt`를 수정하고 resolved/thrown404·429·잘못된200 회귀 검증을 추가했다. 정리 검사도 같은 SDK 계약을 따른다.
- M01~M06 필수 실제 확인은 미완료. 위 두 연동 수정의 production 재배포 후 사용자가 다시 확인해야 한다. 현재 계획5/6을 유지하며 수동 증거 전에 done으로 바꾸지 않는다.

| caseId | accountAlias/deviceAlias | expected | actual | status | checkedAt/evidenceNote |
| --- | --- | --- | --- | --- | --- |
| M01 | manual-A/device-A | 조직로그인·저장항목유지 | 인증 후 연결 오류 화면; 코드 수정 후 재배포·재확인 대기 | fail | 2026-11-05 사용자 제공 화면. 실명·토큰 없음 |
| M02 | 미정 | 실제CP·death·reload/보스재개 | 미실행 | pending | - |
| M03 | 미정 | 기기A/B전환·다른계정격리 | 미실행 | pending | - |
| M04 | 미정 | offline/재로그인·필수정지 | 미실행 | pending | - |
| M05 | 미정 | 초기화와최고기록보존 | 미실행 | pending | - |
| M06 | 미정 | 랭킹UI·키보드·320px | 미실행 | pending | - |
