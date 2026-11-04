# Task: T01 대상 구독·앱 등록·게임 DB·SWA 준비

## Status: pending

## Goal

허용된 구독과 기존 공용 계정 안에 게임 DB·제한된 API 신원·SWA만 준비하고 필요한 실제 ID와 설정을 확보한다.

## Decision Summary

- 준비 스크립트와 실행 전후 검증을 먼저 완성한다. 사용자 수동 Azure 확인은 메뉴 경로로 안내하고 비밀 값은 직접 환경에 입력하게 한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 실행 구성과 외부 연동

- Related Files:
  - `scripts/azure-game-resources.ps1` :: `Inspect/Create/Verify resource modes` — 준비·배포·검증 대상; new
  - `scripts/game-cosmos-index.json` :: `game-data indexing policy` — 준비·배포·검증 대상; new
  - `scripts/azure-game-resources.test.mjs` :: `target guard and plan tests` — 준비·배포·검증 대상; new
  - `api/local.settings.example.json` :: `server config names` — 준비·배포·검증 대상; modify
  - `.env.example` :: `public config names` — 준비·배포·검증 대상; modify
  - `api/src/config.ts` :: `server required config` — 준비·배포·검증 대상; read-only
  - `.memory/phases/2026-11-04-entra-login-cloud-save-leaderboard/P03-azure-release/T01-resource-setup.md` :: `Progress: actual public IDs and evidence` — 준비·배포·검증 대상; modify

#### Details

- **Signatures & Types**:
```powershell
# scripts/azure-game-resources.ps1
param(
 [ValidateSet('Inspect','Create','Verify')][string]$Mode='Inspect',
 [string]$TenantId,
 [string]$ApiServicePrincipalObjectId,
 [string]$SwaLocation
)
# 고정 subscription/RG/account/DB/container 외 인자 없음.
# 결과: 공개 resource IDs, SKU, location, throughput, 역할 scope 검증 요약.
# Entra 앱·비밀 생성/설정은 아래 사용자 포털 절차와 공개 ID 확인으로 연결.
```

- **Data & Schema Fields**:

- Subscription=`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, RG=`grill-me-edu`, 기존 Cosmos=`maze-rescue-ms-b7af62a9`.
- 새 DB=`legendary-rib-corgi`, container=`game-data`, partition=/playerId, 컨테이너 전용 manual400 RU/s, database throughput 없음. Existing freeTier=true/총3400RU/s/KoreaCentral/모든네트워크는 사용자 확인값이며 preflight에서 실제값을 재확인한다.
- 다른DB·컨테이너·계정지역·방화벽·auth·freeTier·account throughput limit 변경 금지. account key 사용 금지. 처리량상한이막으면자동증가하지않는다. 대상구독을조회못하면다른구독대체금지.
- SWA=`legendary-rib-corgi` Free, 관리형 Functions Node22. 지원 아시아 API지역 확인 필요. managed identity/KeyVault참조/별도AppService 미사용.

- 공개 실행 입력: TenantId UUID, webClientId UUID, apiClientId UUID, apiServicePrincipalObjectId UUID(앱의 objectId와 다름), API scope GUID, SwaLocation, swaHostname. 실제 확인 전 placeholder를 운영 값으로 취급하지 않는다.
- API scope=`api://{apiClientId}/access_as_user`, requestedAccessTokenVersion=2, signInAudience=AzureADMyOrg. 앱 표시 이름=legendary-rib-corgi-web / legendary-rib-corgi-api.
- 서버값: GAME_TENANT_ID, GAME_API_CLIENT_ID, GAME_WEB_CLIENT_ID, GAME_COSMOS_ENDPOINT(https://maze-rescue-ms-b7af62a9.documents.azure.com:443/), GAME_COSMOS_CLIENT_ID(=apiClientId), GAME_COSMOS_CLIENT_SECRET, GAME_TEST_OBJECT_IDS(JSON[], 기본[]).
- 웹값: NEXT_PUBLIC_GAME_TENANT_ID, NEXT_PUBLIC_GAME_WEB_CLIENT_ID, NEXT_PUBLIC_GAME_API_CLIENT_ID, NEXT_PUBLIC_GAME_REDIRECT_URI, NEXT_PUBLIC_GAME_MODE=cloud.
- 인덱스: consistent/automatic=true, includedPaths=/kind/? /namespace/? /eligible/? /record/progressRank/? /record/deaths/? /playerId/?; excludedPaths=/*, snapshot/cells 전체 인덱싱 안함. TTL default=-1, receipt만604800.


- **Execution Flow / Logic**:

1. Precondition & Validation:
   - 먼저 `az account show --subscription b7af62a9-9a10-4deb-95fa-1690f7bbd33d --query "{id:id,tenantId:tenantId,state:state}" -o json`으로실제target확인. 기존CLI다른구독로그인을그대로사용하지않음.
   - 불가하면사용자에게 Azure Portal → 우측프로필/디렉터리전환 → dexconsulting.net → Microsoft Entra ID → 개요의테넌트ID, 구독→지정ID 접근확인을요청. 필요시사용자가터미널에서 `az login --tenant <TenantId>` 수행. 에이전트가브라우저로그인클릭을하지않는다.
   - `az cosmosdb show --subscription ... -g grill-me-edu -n maze-rescue-ms-b7af62a9`로kind/locations/freeTier/capabilities/publicNetworkAccess/capacity한도확인. listKeys명령없음. 다른DB는이름·리소스metadata/throughput만읽고개별사용자data는읽지않음.
2. Core Processing:
   - Inspect는생성대상diff만출력,Create는정확한target검증후작동,Verify는비교. PowerShell실행중stdout에credential없음, Azure명령모두명시--subscription. 명령배열과리터럴인자를사용해문자열shell조립금지.
   - DB없을때만 `az cosmosdb sql database create --subscription <고정ID> -g grill-me-edu -a maze-rescue-ms-b7af62a9 -n legendary-rib-corgi` (throughput옵션없음).
   - container없을때만 `az cosmosdb sql container create --subscription <고정ID> -g grill-me-edu -a maze-rescue-ms-b7af62a9 -d legendary-rib-corgi -n game-data --partition-key-path /playerId --throughput 400 --ttl -1 --idx @scripts/game-cosmos-index.json`. 기존이름존재는본Task가만든resource증거와schema동일성이있을때만read-only재사용,그외충돌로중단. create가기존resourceupdate도할수있으므로exists검사필수.
   - 데이터역할은 `az cosmosdb sql role assignment create`: principal-id=API서비스주체objectId, role-definition-id=accountResourceId+/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002(Cosmos DB Built-in Data Contributor), scope=accountResourceId+/dbs/legendary-rib-corgi. 관리면Contributor를앱에할당하지않음. 기존scope루트역할을새로부여하지않음.
   - SWA지원위치는 `az provider show --namespace Microsoft.Web --subscription <ID> --query "resourceTypes[?resourceType=='staticSites'].locations"`에서조회. 지원아시아지역중DB와가까운East Asia를우선,지원안하면Southeast Asia,둘다불가하면사용자에게지원목록으로확인. Korea Central을지원한다고가정하지않음. `az staticwebapp create --subscription <ID> -g grill-me-edu -n legendary-rib-corgi --sku Free --location <검증위치>`로repo자동CI없이생성,URL기록.
   - 앱등록사용자절차: Microsoft Entra ID→앱등록→새등록→두표시이름각각/이조직디렉터리만. web→인증→플랫폼추가→Single-page application→실제SWA https origin+"/",http://localhost:3000/ 추가. 암시적grant체크안함. api→API노출→applicationID URI api://{ID}→access_as_user 위임scope,관리자·사용자동의문구설정. manifest api.requestedAccessTokenVersion=2. web→API사용권한→내API→api앱→위임access_as_user,정책이요구하는관리자동의. 로그인가능한초대guest는해당tenant에서발급받도록authority고정.
   - API→관리되는앱/엔터프라이즈앱의objectId를서비스주체ID로확인. API→인증서및암호→새클라이언트비밀. 값은사용자가SWA→설정→환경변수에 GAME_COSMOS_CLIENT_SECRET으로직접입력. 채팅으로받지않음. ID·만료일만Progress기록,비밀값없음. 실제secret만료갱신절차도여기에기록.
   - SWA환경변수에서서버GAME_* 설정. 공개Next값은로컬.env.local/GitHubVariables에설정(빌드시주입); SWA서버환경에만NEXT_PUBLIC설정해도이미빌드된정적파일은바뀌지않음을안내. SWA기본인증역할/Standardcustomauth설정안함.
   - test용실제조직사용자oid는사용자선택확인후GAME_TEST_OBJECT_IDS에등록하여namespace test로격리. 운영게임이용계정을임의test로옮기지않음. 새유료testDB없음.
3. Error & Exception Handling: 권한·정책·quota·이름충돌시대상외수정없이중단하고정확한portal항목/권한부족을요청. secret노출없이원인기록. 생성중실패해도다른DB리소스를삭제하는자동rollback없음. 사용자사전동의된400RU이외증설금지.
4. State Transition & Return: Verify로400manual/dbthroughput없음/partition/TTL/index/RBAC범위/SWAFree/원래계정설정보존확인. 실제ID와미완료입력을이Task Progress에기록. 사용자가설정을아직안했다면대역테스트만통과시켜Task done처리하지않음.

### I02. 실행 전후 검증

- Related Files:
  - `scripts/azure-game-resources.test.mjs` :: `node:test cases` — 외부 부작용 없는 설정·계약 검증; new

#### Details

- 스크립트Plan/명령생성을대역az로검증:잘못된tenant/subscription에서쓰기0,이미존재하는타인DB중단,400RU전용container1개,account설정업데이트0,scope제한,quota실패상한변경0,secret출력0. 실제검증은생성전후metadata비교이며타인문서를읽지않음.
- 새 리소스·실제배포·실제로그인 확인은 대역 결과와 구분하여 Progress에 기록한다.
- `<...>` 값은 본 Task에서 확보한 공개 식별자·URL·run ID로 치환한다. secret을 명령행 문자열에 직접 넣거나 문서에 기록하지 않는다.
- 실행 권한/사용자 수동 입력이 없으면 정확한 미완료 항목을 남기고 포인터를 다음 Task로 넘기지 않는다.

## Acceptance Criteria

- [ ] 실제 게임 DB400RU와DB범위API권한,조직앱등록·SWAFree가 준비되었다.
- [ ] 다른DB와계정설정미변경을증거로남기고미확인값을완료로보고하지않는다.
- [ ] 아래 검증 결과·실제 리소스 상태·필요한 사용자 확인을 기록한다.

## Validation

- `node --test scripts/azure-game-resources.test.mjs` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `powershell -NoProfile -File scripts/azure-game-resources.ps1 -Mode Inspect -TenantId <확인된TenantId>` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `powershell -NoProfile -File scripts/azure-game-resources.ps1 -Mode Verify -TenantId <확인된TenantId> -ApiServicePrincipalObjectId <확인된서비스주체ObjectId> -SwaLocation <검증위치>` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.

## Commit Message

```text
feat(azure): 대상 구독·앱 등록·게임 DB·SWA 준비

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P03-azure-release
Task: T01-resource-setup

- 허용된 구독과 기존 공용 계정 안에 게임 DB·제한된 API 신원·SWA만 준비하고 필요한 실제 ID와 설정을 확보한다.
- 대상 리소스 보존과 실행 검증 결과를 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 공개 식별자·실행 URL·source SHA·검증 결과: 실행 시 기록
- 사용자 수동 확인/미완료 입력: 실행 시 기록

