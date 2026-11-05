# Task: T02 Standard 준비 도구와 보존 검사

## Status: done

## Goal

기존 미커밋 Azure 준비 도구를 Standard 재개에 맞추고, 이미 만든 앱·DB를 중복 생성하지 않는지 외부 부작용 없는 테스트로 검증한다.

## Decision Summary

- 본 Task는 로컬 코드/대역 검사만 수행한다. 실제 Create/Finalize 호출은 T04까지 금지한다. Standard 신규 SWA1개, 기존 게임 DB400RU·Entra 앱 재사용.
- 기존 미커밋 준비 파일은 이전 작업의 연속 산출물로 편입하고 게임/아트 변경은 보존한다. 테스트 scripts/ 바로 아래, 결과는 본 Progress. computer-use 금지.

## Implementation

### I01. SKU·구독·생성 증거와 기존 리소스 검사

- Related Files:
  - `scripts/azure-game-resources.ps1` :: `Invoke-Azure/Read-Account/Read-OtherDatabases/Assert-Container/Read-App/Save-Evidence/Inspect/Create/Verify` — 기존 로컬 파일 재사용·수정; modify
  - `scripts/game-cosmos-index.json` :: `index policy` — 기존 미커밋 파일을 그대로 편입; read-only content
  - `scripts/azure-game-resources.test.mjs`, `scripts/azure-game-resources.mock.ps1` :: `mock Azure port` — 기존7그룹 확장; modify
  - `.env.example` :: `public build configuration` — 기존 bridge/빌드시주입 설명 편입; modify

#### Details

- **Signatures & Types**:
```powershell
param(
 [ValidateSet('Inspect','Create','Verify')][string]$Mode='Inspect',
 [Parameter(Mandatory=$true)][string]$TenantId,
 [string]$ApiServicePrincipalObjectId,
 [string]$SwaLocation
)
# SKU/구독/계정/DB/container/앱 ID를 임의 override하는 인자는 만들지 않는다.
```
- **Data & Schema Fields**:
  - 고정 subscription=`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, tenant=`69c1e470-4528-435a-a1ae-de98e0aac738`, RG=`grill-me-edu`.
  - account=`maze-rescue-ms-b7af62a9`, DB=`legendary-rib-corgi`, container=`game-data`, SWA name=DB, SKU=`Standard`, region=eastasia 우선/southeastasia 지원 대안. 다른 지역은 사용자 선택 필요.
  - accountId=`/subscriptions/{subscription}/resourceGroups/grill-me-edu/providers/Microsoft.DocumentDB/databaseAccounts/maze-rescue-ms-b7af62a9`; DB ARM ID=`{accountId}/sqlDatabases/legendary-rib-corgi`; container ID=`{dbId}/containers/game-data`.
  - 데이터 role scope=`{accountId}/dbs/legendary-rib-corgi`; roleDefinitionId=`{accountId}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002`. 관리면 Contributor와 다른 권한이다.
  - 고정 web client=`e467e8bc-c900-4d08-88be-7f0a5fce2474`, API client=`a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`, API SP=`f02b1a27-859d-4872-8549-99ad95927132`, scope GUID=`d36060b6-6582-45d3-a95f-5b1b8b742883`.
  - `.git/azure-game-resources.json` 기존 schema: plan,subscription,tenantId,startedAt,accountBefore,otherDatabasesBefore,databaseId,containerId,swaId(nullable). 이전 plan 문자열 `2026-11-04-entra-login-cloud-save-leaderboard`를 출처로 유지한다. 새 계획 ID로 치환하지 않는다. 새 필드 `standardRelease?:{plan:"2026-11-05-azure-standard-release",sku:"Standard",swaId:string,createdAt:string}`는 실제 성공 시에만 추가한다. 기존 속성/ID/기준 metadata 삭제 금지.
  - Inspect 출력에 sku=Standard, freeSiteCount:number, standardSiteCount:number, standardSiteLimit:100, createSwa:boolean, reusedDatabase:true, reusedContainer:true, additionalRU:0 추가. 정해진 숫자3400은 과거보고값일 뿐 실제 검증은 조회값으로 한다.
  - 기존 컨테이너: Hash partition paths=[/playerId], manual400/autoscale없음, database throughput없음, TTL-1; consistent automatic index 포함 `/kind/?`,`/namespace/?`,`/eligible/?`,`/record/progressRank/?`,`/record/deaths/?`,`/playerId/?`; root/* 제외. 예상하지 않은 추가 index/policy/container 거절.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 모든 Azure 명령 explicit --subscription. account show에서 고정 tenant/Enabled 검증. 계정 NoSQL/provisioned/KoreaCentral/freeTiertrue/기존 네트워크·지역·auth·cap 그대로 확인. 여기의 freeTier는 Cosmos 값으로 Standard 치환 대상이 아니다.
  2. 생성 증거와 실제 DB/container/Entra/SP/role을 재조회한다. 이번 재개에서는 앱/DB/container가 이미 있어야 하며 없으면 자동 재생성하지 않고 상황을 보고한다. 기존 코드의 DB/container 생성 분기를 이번 재개 경로에서는 제거하거나 명확히 실행 불가로 막는다. 역할이 없거나 범위가 넓으면 자동 권한확장 없이 차이를 보고한다.
  3. 역사 기준 metadata와 실제 값이 다르면 변경 항목을 비밀 없이 표시하고 중단한다. 다른 사용자가 바꾼 설정을 되돌리거나 baseline을 자동 덮어쓰지 않는다. 이 입력 문제는 실제 실행 T04에서 해결한다.
  4. `az staticwebapp list`의 공개 id/name/sku/region만 읽어 Standard100개 한도를 검사한다. Free10개는 Standard 생성 거절 이유가 아니다. 실제 서비스 quota/정책 오류도 정상 분류하고 다른 앱 삭제·Standard외 SKU·한도 증가는 하지 않는다.
  5. Inspect는 읽기/요약만, Graph/ARM write와 evidence write0. Create의 허용 쓰기는 새 게임 SWA1개 생성과 성공 evidence 기록만이다. 직전 show로 부재 재확인 후 `az staticwebapp create -g grill-me-edu -n legendary-rib-corgi --sku Standard --location <지원확인값>` 실행. repo/source 연결 옵션 없음. 응답 ID/SKU/region 검증 후 증거 저장. 실패 후 자동 삭제/rollback 없음.
  6. 기존 같은 이름 SWA는 증거 ID와 Standard SKU 일치일 때만 재사용한다. Free 앱이나 다른 증거 없는 앱을 자동 업그레이드/인수하지 않는다. 생성 성공 응답을 잃으면 충돌로 보고하고 외부 증거 없이 소유권을 추정하지 않는다.
  7. Verify는 DB/권한/앱·scope와 Standard/URI/서버 공개 설정/비밀 존재 여부, 실행 전후 공유 metadata를 모두 검사한다. API 앱의 유효 passwordCredentials는 keyId/endDateTime만 조회. GAME_COSMOS_CLIENT_SECRET 값은 query projection에서 bool만 반환한다.
  8. Error & Exception Handling: quota·permission·tenant/login·name collision을 구분한 안전한 메시지. 비밀을 포함할 수 있는 raw 응답 출력 금지. Windows az.cmd의 인자 재해석을 피하려고 설치 CLI의 python.exe -IBm azure.cli를 배열로 호출한다. 테스트 function az 포트는 유지하고 실제 CLI로 fallback하지 않는다.
  9. State Transition & Return: Create 재실행은 이미 만든 Standard 앱을 재사용하며 외부쓰기0. Verify 성공 출력에 실제 public ID/host/sku=Standard/400RU/DB범위/보존결과만 담는다.

### I02. 앱 Finalize도 Standard로 검증하고 대역 제공

- Related Files:
  - `scripts/azure-game-apps.ps1` :: `Azure/Graph/Find-App/Finalize` — Standard 대상과 공개 설정; modify
  - `scripts/azure-game-apps.mock.ps1`, `scripts/azure-game-apps.test.mjs` :: `mock Graph/ARM tests` — 로컬 대역; new
  - `scripts/azure-game-test-support.mjs` :: `fixture/setup/run/writes` — 두 도구의 고정 ID·legacy 증거·임시 작업 폴더·명령 추적을 공유; new

#### Details

- **Signatures & Types**: `param([ValidateSet('Create','Finalize')][string]$Mode='Create')` 유지. 실제 재개는 Finalize만 호출한다. Azure helper는 기존 resource 스크립트처럼 mock function az를 지원하고 Windows 실제 `.cmd`이면 bundled Python을 사용한다.
- **Data & Schema Fields**: `.git/azure-game-apps.json`의 tenantId/subscription/scopeId/api{id,appId}/web{id,appId}/apiPrincipal{id,appId}/webPrincipal{id,appId}는 기존 증거. API object=`bd092a7c-ad3c-4fe4-8475-7ec70769be73`, web object=`aacb102c-4dbb-4cbc-b056-58b4fed0e674`와 실제 ID 일치 확인. 새 앱/비밀을 만들지 않는다.
- **Execution Flow / Logic**:
  1. Finalize 전에 실제 두 앱 AzureADMyOrg, API v2/access_as_user/scopeGUID, 웹 위임 권한·implicit off, API SP/tenant 일치 확인. SWA는 정확한 resourceId+생성 증거+Standard SKU+공식host를 요구한다.
  2. 웹 SPA redirectUris를 기존 값과 합집합으로 보존하며 필수4개(`http://localhost:3000/`, localhost/auth/redirect/, 실제 HTTPS root, 실제/auth/redirect/)를 추가한다. 이미 같으면 PATCH하지 않는다. 새 임의 origin은 추가하지 않는다.
  3. GAME_TENANT_ID/API_CLIENT_ID/WEB_CLIENT_ID/COSMOS_CLIENT_ID/COSMOS_ENDPOINT를 고정 공개값으로 설정. endpoint=https://maze-rescue-ms-b7af62a9.documents.azure.com:443/. GAME_TEST_OBJECT_IDS는 없을 때만 문자열[] 설정, 기존 allowlist 보존. 비밀 값 및 기타 설정을 덮어쓰지 않는다. 응답은 공개 projection/개수만 반환한다.
  4. 권한·scope·evidence 불일치 시 쓰기0. 사용자 클라이언트 비밀 생성은 이 helper에 추가하지 않는다.
- 테스트: Free10+Standard2에서 Standard Create 허용; Standard100/다른tenant/무증거/Free동명이름 거절; 기존 DB/container/role에 쓰기0; 증거 legacy plan 보존·재실행쓰기0; quota 중단 후 재개; test[] 파싱; bridge4개/기존URI보존; secret sentinel출력0; 기존allowlist유지; mock 포트가 실제 Azure를 부르지 않음. 임시 파일은 OS temp의 이 테스트 prefix 경로만 검증 후 정리한다.

## Acceptance Criteria

- [x] Standard 생성·검증·Finalize가 동일 SKU를 요구한다.
- [x] legacy 생성 증거와 기존400RU/앱/범위권한을 보존하며 새 앱/DB 중복 생성 경로를 막았다.
- [x] 모든 실제 Azure 쓰기는0, 대역 검증으로 잘못된 대상/기존 데이터/비밀 보호를 확인했다.

## Validation

- `node --test scripts/azure-game-resources.test.mjs scripts/azure-game-apps.test.mjs` → exit0, 대역만 사용.
- `npx.cmd eslint scripts/azure-game-resources.test.mjs scripts/azure-game-apps.test.mjs` → exit0.
- PowerShell Parser.ParseFile로 수정 ps1 및 mock ps1의 parseErrors=0 확인(실행 아님).
- `git diff --check`는 본 Task 파일 범위에서 통과. unrelated 파일 오류는 별도 기록.
- 실제 `-Mode Create`, `-Mode Finalize`는 이 Task 검증 명령으로 실행하지 않는다.

## Commit Message

```text
feat(azure): 기존 리소스를 보존하는 Standard 준비 도구

Plan: 2026-11-05-azure-standard-release
Phase: P01-standard-release
Task: T02-standard-tooling

- Free 생성·검증을 Standard로 전환하고 legacy 증거를 보존한다
- 기존 게임 앱·DB·권한 재사용과 안전한 재실행을 검증한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 파일을 완료 처리한 Git 커밋의 Plan/Phase/Task 식별자로 조회
- 2026-11-05 Node22.23.4: resources7그룹+apps5그룹 총12/12 통과. 잘못된 tenant/등록/SP/scope, Standard100, Free 충돌, quota 재시도, metadata/파티션/인덱스/처리량 변경, 허용 목록, secret sentinel, 증거 보존 및 재실행 쓰기0을 검증했다.
- 수정한4개 PS1 Parser.parseErrors0, JS 테스트/공유 fixture ESLint 통과. 기존 준비 resources/apps/mock/test/index 및 .env.example 설명을 이 Task에 편입했다.
- DB/container/role 생성 코드를 제거했고 앱 helper의 legacy Create는 명시적으로 거절한다. 앱 Finalize는 필요한 URI의 합집합과 달라진 공개 설정만 적용한다. 실제 Azure 명령은 테스트 함수 포트가 전부 대체했으며 설치 CLI fallback은 없다.
- 실제 Azure 쓰기:0 (본 Task 범위)
