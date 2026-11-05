# Task: T01 대상 구독·앱 등록·게임 DB·SWA 준비

## Status: superseded

> 실행 기록 보존용. 준비 도구는 [새T02](../../2026-11-05-azure-standard-release/P01-standard-release/T02-standard-tooling.md), 실제 Standard 설정은 [새T04](../../2026-11-05-azure-standard-release/P01-standard-release/T04-standard-resources.md)로 대체됐다. 아래 Free 명령을 그대로 재실행하지 않는다.

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
  - `scripts/azure-game-apps.ps1` :: `Create/Finalize Entra and public SWA settings` — 사용자 후속 요청에 따라 CLI 자동화; new
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

- 2026-11-04 실제 구독 조회: subscription `b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, tenant `69c1e470-4528-435a-a1ae-de98e0aac738`, state `Enabled`. 최초 CLI에는 대상 구독이 없었으나 사용자 로그인 후 정상 확인했다. computer-use는 사용하지 않았다.
- 최초 Inspect 성공: 기존 다른 DB 7개, 총 3400 RU/s, provisioned NoSQL/free tier/Korea Central/모든 네트워크 일치. 당시 `legendary-rib-corgi` DB·SWA 없음, 추가 컨테이너 처리량 400 RU/s, SWA 지원 지역 East Asia(`eastasia`). 계정 capacity의 totalThroughputLimit 값은 null로 조회되었다.
- 최초 Graph 읽기에서 앱 등록이 없었고 수동 등록을 안내했으나, 사용자의 “직접 만들어야 하는가” 후속 요청에 따라 연결된 CLI로 자동 등록했다. `scripts/azure-game-apps.ps1`은 고정 tenant/subscription, 앱 이름 충돌 검사, 로컬 생성 증거를 사용하며 비밀을 생성하거나 읽지 않는다. Finalize는 실제 SWA SPA URI와 공개 서버 설정을 연결한다.
- 실제 Entra 생성 완료: web client ID `e467e8bc-c900-4d08-88be-7f0a5fce2474`(app object `aacb102c-4dbb-4cbc-b056-58b4fed0e674`, SP `11ff15d3-5d72-4bbc-9d66-51bbcc31a06b`), API client ID `a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`(app object `bd092a7c-ad3c-4fe4-8475-7ec70769be73`, SP `f02b1a27-859d-4872-8549-99ad95927132`). API scope GUID `d36060b6-6582-45d3-a95f-5b1b8b742883`, scope `api://a2e3f4fa-56e5-4ab5-ba41-43cb974b8722/access_as_user`. 두 앱 조직 전용, v2 API, 위임 권한, 암시적 grant 꺼짐. `.git/azure-game-apps.json`에 공개 생성 증거 기록. 앱 ID만 담은 로컬 `.env.local`을 준비했다(Git 제외).
- 스크립트: Inspect/Create/Verify, 모든 Azure 호출의 명시적 subscription, 실재 tenant·API SP 검증, DB/컨테이너/SWA 이름 충돌 거절, 수동400·DB공유처리량없음·index·TTL·DB 범위 역할·기존 metadata 보존을 구현했다. 생성 증거는 로컬 `.git/azure-game-resources.json`에 남겨 해당 실행이 만든 리소스만 재사용한다. quota 실패 시 cap 변경/삭제 rollback 없음.
- CLI 호환: 설치된 `az ad`는 --subscription 인자를 받지 않아 Graph 읽기는 `az rest --subscription ...`로 수행한다. Windows az.cmd가 Graph 필터의 괄호를 재해석하므로 스크립트는 동일 설치본의 python.exe -IBm azure.cli를 인자 배열로 호출한다. 테스트만 mock function az를 사용한다. PowerShell 실행 정책은 프로세스 단위 `-ExecutionPolicy Bypass`로만 적용하며 영구 변경하지 않는다.
- 대역 검증 최종7개 그룹 통과: 잘못된 구독/tenant/region/기존 DB/서비스주체/광범위 역할/앱 범위에서 쓰기0; 전용400 생성; Verify·재실행 쓰기0; quota 중단·부분 생성 재개; 다른 DB metadata 변경/파티션/DB처리량/SPA bridge/서버 설정 누락 거절. SWA Free 개수 한도에서는 기존 준비 리소스를 보존하고 한도 해소 후 SWA만 생성하는 회귀 사례도 통과했다. 실제 Azure 생성·Verify 성공과는 구분한다. PowerShell 앱 스크립트 구문 검사 및 해당 JS 린트 통과.
- 서버 예시 `api/local.settings.example.json`은 이미 필요한 GAME_* 이름과 빈 비밀 값을 갖추고 있어 유지했다. `.env.example`에는 MSAL bridge URI 및 빌드 시 NEXT_PUBLIC_* 주입 설명을 추가했다.
- 실제 Azure 생성: DB `legendary-rib-corgi`, 컨테이너 `game-data`(partition `/playerId`, manual400 RU/s, TTL -1, 지정 index), DB 공유 처리량 없음. API SP `f02b1a27-859d-4872-8549-99ad95927132`에 Cosmos DB Built-in Data Contributor를 정확히 `/dbs/legendary-rib-corgi` 범위로 부여했고 별도 재조회로 확인했다. `.git/azure-game-resources.json`에 DB/컨테이너 생성 증거가 있다.
- **현재 미완료 원인**: SWA Free 생성은 Azure의 `(BadRequest) Sku is invalid. This subscription has too many static sites with SKU: Free.`로 거절되었다. 후속 show는 ResourceNotFound, 구독 목록은 Free10/Standard2개이며 이 저장소에 연결된 앱은 없다(일부 repositoryUrl은 null이므로 소유권은 추정하지 않음). 다른 앱 삭제·재사용·유료 전환은 하지 않았다. 사용자에게 관리자 정리 후 Free 신규 생성 또는 본인 소유 기존 SWA 이름을 요청했다.
- 생성 후 실제 Inspect 재실행 exit0: `createDatabase=false`, `createContainer=false`, `additionalRU=0`, `createSwa=true`. 생성 전 증거와 비교하여 기존 계정 설정과 타인 DB7개 metadata/3400RU 보존을 확인했다. 합계는 새 게임400을 더한3800RU/s. SWA가 없으므로 운영 SPA URI·서버 환경 변수·비밀 설정·최종 Verify·배포는 미완료다. 완료 커밋/다음 Task 전진 없음.
- 2026-11-04 사용자 후속 요청 “그럼 일단 이건 추후 계획으로 미뤄줘.”에 따라 Status를 deferred로 변경하고 current의 활성 Task를 비웠다. 생성한 Entra 앱·DB·권한 및 미커밋 준비 스크립트는 보존한다. 재개 요청 전 SWA 생성·다른 앱 정리·설정·배포를 진행하지 않는다.

### 설정 절차와 현재 상태 (비밀 값은 채팅·Git에 기록하지 않음)

아래 1~4는 CLI로 완료했으므로 사용자가 앱을 다시 만들 필요가 없다. 5의 DB/컨테이너/역할도 완료했으며 SWA Free 개수 한도 해결이 먼저다. 이후 `azure-game-apps.ps1 -Mode Finalize`가 운영 SPA URI와 7의 공개 서버 값을 설정한다. 6의 비밀 값은 확정된 계획대로 사용자가 SWA에 직접 입력한다.

1. Entra ID → 앱 등록에서 `legendary-rib-corgi-api`와 `legendary-rib-corgi-web`을 각각 **이 조직 디렉터리만**으로 등록한다. 두 application/client ID를 기록한다.
2. api → API 표시(Expose an API) → 애플리케이션 ID URI를 `api://{apiClientId}`로 설정 → 범위 추가 `access_as_user`, 관리자 및 사용자 동의, 활성화. 동의 표시 이름은 “코기 게임 진행 저장 및 랭킹 조회”, 설명은 “로그인한 사용자의 게임 진행을 저장하고 랭킹을 조회합니다.”로 설정한다. Manifest의 `api.requestedAccessTokenVersion`을 2로 설정한다. scope GUID를 기록한다.
3. web → API 사용 권한 → 권한 추가 → 내 API → 위 api 앱 → 위임 권한 `access_as_user`. 조직 정책이 요구하면 관리자가 동의한다. 암시적 액세스/ID 토큰 발급은 켜지 않는다.
4. api 개요의 **로컬 디렉터리에서 관리되는 애플리케이션** 링크 → 엔터프라이즈 애플리케이션 개요 → 개체 ID를 확인한다. 앱 등록 자체의 object ID가 아닌 **서비스 주체 object ID**가 필요하다.
5. 위 공개 ID를 확인한 뒤 아래 Create를 실행한다. 성공한 실제 swaHostname이 나오면 web → 인증 → 플랫폼 추가 → SPA에 `https://{swaHostname}/`, `https://{swaHostname}/auth/redirect/`, `http://localhost:3000/`, `http://localhost:3000/auth/redirect/` 네 주소를 등록한다.
6. api → 인증서 및 암호 → 새 클라이언트 비밀. **값**은 SWA → 설정 → 환경 변수의 `GAME_COSMOS_CLIENT_SECRET`에 본인이 직접 입력한다. 이 앱에는 Cosmos 게임 DB 범위의 데이터 기여자 역할만 부여하며 관리면 Contributor는 부여하지 않는다. 문서에는 secret key ID와 만료일만 기록한다. 만료 전 새 비밀 생성→SWA 값 교체→실제 API 성공 확인→이전 비밀 삭제 순으로 갱신한다.
7. 같은 SWA 환경 변수에 `GAME_TENANT_ID=69c1e470-4528-435a-a1ae-de98e0aac738`, `GAME_API_CLIENT_ID={apiClientId}`, `GAME_WEB_CLIENT_ID={webClientId}`, `GAME_COSMOS_CLIENT_ID={apiClientId}`, `GAME_COSMOS_ENDPOINT=https://maze-rescue-ms-b7af62a9.documents.azure.com:443/`, `GAME_TEST_OBJECT_IDS=[]`를 입력한다. 실제 테스트 계정의 oid는 사용자 선택 확인 후 allowlist에 넣는다.
8. 웹용 NEXT_PUBLIC_*는 `.env.local`과 나중의 GitHub Variables에 입력한다. 이미 빌드한 정적 파일은 SWA 서버 환경 변수를 바꾸어도 바뀌지 않으므로 다시 빌드해야 한다. API 비밀을 NEXT_PUBLIC_*에 넣지 않는다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-resources.ps1 -Mode Inspect -TenantId 69c1e470-4528-435a-a1ae-de98e0aac738
# SWA Free 한도 해결 후 재개. 기존 게임 DB/컨테이너/역할은 생성 증거로 재사용한다.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-resources.ps1 -Mode Create -TenantId 69c1e470-4528-435a-a1ae-de98e0aac738 -ApiServicePrincipalObjectId f02b1a27-859d-4872-8549-99ad95927132 -SwaLocation eastasia
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-apps.ps1 -Mode Finalize
# 서버 비밀 직접 설정 이후
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-resources.ps1 -Mode Verify -TenantId 69c1e470-4528-435a-a1ae-de98e0aac738 -ApiServicePrincipalObjectId f02b1a27-859d-4872-8549-99ad95927132 -SwaLocation eastasia
```

- 근거: [SWA 생성 CLI](https://learn.microsoft.com/en-us/cli/azure/staticwebapp?view=azure-cli-latest#az-staticwebapp-create), [Cosmos 컨테이너 CLI](https://learn.microsoft.com/en-us/cli/azure/cosmosdb/sql/container?view=azure-cli-latest), [DB 범위 데이터 역할](https://learn.microsoft.com/en-us/cli/azure/cosmosdb/sql/role/assignment?view=azure-cli-latest), [관리형 Functions 제약](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions), [CLI DB 생성의 throughput=None 기본값](https://github.com/Azure/azure-cli/blob/dev/src/azure-cli/azure/cli/command_modules/cosmosdb/custom.py).

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 공개 식별자: 위 Entra/DB/SP/scope 기록. SWA URL은 아직 없음. 배포 미실행.
- 추후 재개 시 확인할 항목: SWA Free 개수 한도 해소 방식, 이후 서버 비밀 직접 입력 및 테스트 계정 선택. 지금은 답변을 요구하지 않는다.

