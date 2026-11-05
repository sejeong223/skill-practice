# Task: T04 실제 Standard 앱 생성과 운영 설정

## Status: done

## Goal

로컬 준비가 완료된 뒤 실제 게임 전용 Standard SWA를 생성하고, 이미 만든 Entra/DB를 연결하여 운영 설정의 실제 Verify를 통과시킨다.

## Decision Summary

- T01~T03 완료/커밋/로컬 검증이 필수 선행 조건. 사용자 Standard 선택은 이미 확정됐으므로 같은 요금제 승인을 다시 묻지 않는다. 부족한 로그인·비밀 입력·실제 설정 정보만 요청한다.
- 다른 앱·DB·계정 설정 보존, computer-use 금지. 비밀은 사용자 직접 입력. 미완료 외부 확인을 done 처리하지 않는다.

## Implementation

### I01. 기존 리소스 재확인과 Standard 생성

- Related Files:
  - `scripts/azure-game-resources.ps1` :: `Inspect/Create/Verify` — T02 도구 실행; read-only unless failure fix
  - `scripts/azure-game-apps.ps1` :: `Finalize` — 실제 origin·공개 서버 설정; read-only unless failure fix
  - `scripts/azure-game-resources.test.mjs`, `scripts/azure-game-apps.test.mjs` :: `guards` — 수정 시 재검증; read-only unless failure fix
  - `.memory/phases/2026-11-05-azure-standard-release/P01-standard-release/T04-standard-resources.md` :: `Progress` — 실제 리소스/검증 증거; modify
  - `.env.local` :: `local public configuration` — 기존 localhost 값 보존; read-only

#### Details

- **Signatures & Types**:
```powershell
# 아래 실제 공개 값만 사용; 매 호출 명시 subscription은 스크립트가 붙인다.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-resources.ps1 -Mode Inspect -TenantId 69c1e470-4528-435a-a1ae-de98e0aac738 -SwaLocation eastasia
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-resources.ps1 -Mode Create -TenantId 69c1e470-4528-435a-a1ae-de98e0aac738 -ApiServicePrincipalObjectId f02b1a27-859d-4872-8549-99ad95927132 -SwaLocation eastasia
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-apps.ps1 -Mode Finalize
```
- **Data & Schema Fields**:
  - subscription=`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, tenant=`69c1e470-4528-435a-a1ae-de98e0aac738`, RG=`grill-me-edu`, SWA=`legendary-rib-corgi`, sku=Standard, desired location=eastasia.
  - web client=`e467e8bc-c900-4d08-88be-7f0a5fce2474`, API client=`a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`, API SP=`f02b1a27-859d-4872-8549-99ad95927132`, scope GUID=`d36060b6-6582-45d3-a95f-5b1b8b742883`. 조직 전용 AzureADMyOrg, API requestedAccessTokenVersion=2, scope api://{apiClient}/access_as_user, implicit grant 꺼짐.
  - Cosmos endpoint=`https://maze-rescue-ms-b7af62a9.documents.azure.com:443/`, DB=`legendary-rib-corgi`, container=`game-data`, partition=/playerId, 컨테이너 전용 manual400RU, TTL-1, DB 공유 처리량 없음.
  - API SP 데이터 역할: account resource ID 뒤 `/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002`, scope `/dbs/legendary-rib-corgi`. 계정 공용키/관리면Contributor/다른DB 접근 없음.
  - 기존 `.git/azure-game-resources.json` plan=`2026-11-04-entra-login-cloud-save-leaderboard`와 DB/container IDs·accountBefore·otherDatabasesBefore 보존. T02가 추가하는 standardRelease 증거만 신규 기록. `.git/azure-game-apps.json`의 실제 앱/SP ID를 Graph와 대조한다.
  - Progress 출력 schema: `{subscription,tenantId,swaId,swaHostname,swaLocation,sku,apiClientId,webClientId,apiServicePrincipalObjectId,roleScope,throughputRU,sharedResourcesPreserved,credentialKeyId,credentialExpiresAt,verifiedAt}`. credential 정보는 공개 metadata만, 아직 없으면 null/미완료. 비밀 값/토큰 저장 금지.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01/T02/T03 status done·commit·검증 결과 확인. preflight manifest가 없거나 관련 코드가 이후 바뀌었으면 Node22 `npm.cmd run build:release -- --mode preflight`로 재검증. 이 확인 전 Azure Create/Finalize 없음.
  2. CLI 실제 account show의 subscription/tenant/Enabled 확인. 캐시 로그인 만료·다른 구독이면 사용자에게 `az login --tenant 69c1e470-4528-435a-a1ae-de98e0aac738`을 직접 수행하도록 안내한다. 에이전트가 로그인 화면을 조작하지 않는다.
  3. Inspect로 기존 DB/컨테이너/400RU/DB-throughput없음/partition/index/TTL·공유metadata·실제 Standard count·지원지역 확인. 2026-11-04의7DB/3400RU/Standard2개를 현재값이라고 단정하지 않는다. 현재 DB나 앱이 없거나 소유증거·공유metadata가 다르면 자동재생성·복구·baseline교체 없이 차이를 설명한다.
  4. Create 실행: 이번 허용 변경은 Standard SWA1개 생성. 기존 앱·DB·권한은 read-only 재사용. 표준 한도100/정책/권한 오류는 다른앱삭제·구독교체·유료부가기능·처리량확대로 우회하지 않는다. 명시적 source/repo 자동CI 연결 없음.
  5. 성공 응답의 실제 id/host/Standard/region·증거파일 확인 후 Finalize 실행. 운영 root+auth/redirect 및 localhost두주소, API scope·위임권한을 검증한다. Graph는 고정 앱 object ID에만 PATCH하며 기존 추가 redirect는 보존한다.
  6. Error & Exception Handling: SWA 실패 시 이미 만든DB/앱삭제없음. 구독/지역/tenant/권한이 다르면 정확한 미완료 항목 기록. 스크립트 결함은 최소수정하고 해당 mock 테스트 재실행한 뒤 재시도한다.
  7. State Transition & Return: 생성 단계만 성공해도 Task done이 아니다. 아래 서버 설정과 실제 Verify까지 통과해야 완료한다.

### I02. 서버 설정과 비밀 입력·실제 Verify

- Related Files:
  - `api/src/config.ts` :: `loadServerConfig` — 설정 계약; read-only
  - `api/local.settings.example.json`, `.env.example` :: `configuration names` — 이름/비밀분리 기준; read-only
  - 본 Task :: `Progress` — 사용자 입력·검증/갱신 절차; modify

#### Details

- **Data & Schema Fields**: SWA 서버 설정의 GAME_TENANT_ID=위tenant, GAME_API_CLIENT_ID=APIclient, GAME_WEB_CLIENT_ID=webclient, GAME_COSMOS_CLIENT_ID=APIclient, GAME_COSMOS_ENDPOINT=위endpoint, GAME_COSMOS_CLIENT_SECRET=사용자직접입력, GAME_TEST_OBJECT_IDS=JSON문자열[] 기본. 기존 명시allowlist는 보존하고 사용자 운영계정을 임의test로 전환하지 않는다.
- **Execution Flow / Logic**:
  1. 공개 설정은 Finalize CLI로 처리한다. 비밀이 없으면 Azure Portal → Microsoft Entra ID → 앱 등록 → legendary-rib-corgi-api → 인증서 및 암호 → 새 클라이언트 비밀 생성 → 값(Value)을 SWA legendary-rib-corgi → 설정/환경 변수 → GAME_COSMOS_CLIENT_SECRET에 사용자가 직접 입력하게 안내한다. Secret ID는 값 대신 사용할 수 없다.
  2. 채팅으로 값을 요청하지 않고 완료 여부만 받는다. CLI로 passwordCredentials keyId/endDateTime과 SWA secretPresent bool만 확인한다. 전체 appsettings 출력/CLI debug/envdump 금지. 조직이 scope사용에 관리자동의를 요구하면 해당 API 위임권한에 대한 동의만 요청하며 전역권한확장 안함.
  3. 유효 기간과 갱신 절차 기록: 새비밀생성→SWA값교체→실제API성공확인→기존비밀삭제. 실제 삭제는 이 Task에서 자동 수행하지 않는다.
  4. 실제 Verify 실행으로 모든 URI4개·공개값·비밀존재·DBschema·역할·Standard·공유보존 확인. 자격증명의 실제 사용과 사용자로그인은 T06에서 별도 확인한다.
  5. 로컬.env.local의 localhost 설정은 그대로 보존한다. 운영 NEXT_PUBLIC 값은 T05의 clean 빌드/GitHub Variables에 사용한다. SWA 서버환경만 바꿔 정적JS가 바뀌었다고 보고하지 않는다.

## Acceptance Criteria

- [x] T01~T03 완료 후 Standard SWA1개가 실제로 생성됐다.
- [x] 기존 게임 DB/Entra/권한 재사용과 다른 리소스 보존이 실제 조회로 확인됐다.
- [x] 운영URI·서버공개값·비밀존재/만료 metadata를 확인하고 Verify exit0.
- [x] 실제 host/ID·준비시각·남은 실제로그인검증을 Progress에 기록했다.

## Validation

- 위 Inspect/Create/Finalize 순차 실행, 각 exit0.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/azure-game-resources.ps1 -Mode Verify -TenantId 69c1e470-4528-435a-a1ae-de98e0aac738 -ApiServicePrincipalObjectId f02b1a27-859d-4872-8549-99ad95927132 -SwaLocation eastasia` → 실제 exit0.
- 스크립트 변경이 있으면 `node --test scripts/azure-game-resources.test.mjs scripts/azure-game-apps.test.mjs` → exit0.
- 비밀 입력·접근권한이 없으면 현재 Task를 유지하고 필요한 항목만 안내. 대역 성공으로 실제 Verify를 대체하지 않는다.

## Commit Message

```text
chore(azure): Standard 앱과 운영 연결 설정 검증

Plan: 2026-11-05-azure-standard-release
Phase: P01-standard-release
Task: T04-standard-resources

- 기존 Entra와 게임 DB를 재사용해 Standard 앱을 준비한다
- 실제 공개 식별자와 설정·보존 검증 증거를 기록한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 32a1f21
- 로컬 선행 Task 커밋/검증: T01 b625133, T02 27037b6, T03 aa8d71c. Node22 별도 checkout preflight 및 cloud159/workflow9/release13·린트·타입·audit 검증 통과. 기존 미커밋91개 경로 중 T02에 명시적으로 편입한 경로를 제외한 내용 변경0.
- 2026-11-05T03:43:39Z 실제 Inspect exit0: 고정 구독/tenant Enabled, Free10/Standard2, East Asia 지원, 게임 DB/container 재사용·추가RU0. 다른 DB7개/3400RU와 계정 metadata가 legacy 증거와 일치. 게임400RU·파티션·TTL·인덱스·고정 Entra 앱/SP/scope·DB 범위 역할 확인.
- 실제 ARM이 반환하는 기본 `/_etag/?` 또는 `/"_etag"/?` 제외 경로만 정규화하도록 검증기를 보완했다. [Microsoft 기본 인덱스 정책](https://learn.microsoft.com/en-us/cosmos-db/indexing-policies)에 따른 시스템 경로이며 DB 인덱스는 수정하지 않는다. 다른 사용자 경로 변경 거절을 유지하며 대역13/13·대상 ESLint·PS 구문0 통과.
- 실제 Create exit0, 생성시각 `2026-11-05T03:44:50.1271567Z`: `legendary-rib-corgi`, SKU Standard, East Asia, host `polite-rock-0f80d2a00.5.azurestaticapps.net`. SWA ID는 위 고정 ARM ID와 일치. 계정·다른DB metadata 재조회 보존 확인. `.git/azure-game-resources.json`의 legacy plan·기존 증거 유지 및 standardRelease 증거 추가.
- Finalize exit0: 웹 앱 redirect4개(운영 root/bridge와 localhost root/bridge)를 실제 재조회했고, 서버 공개 설정6개(고정 tenant/API/web/client/endpoint 및 testIds=[]) 적용·재조회 일치. 기존 추가 URI·allowlist를 보존하는 방식이다.
- 사용자 서버 비밀 설정 완료 응답 후 실제 Verify exit0(2026-11-05T04:47Z). secretPresent=true, credentialKeyId=`7a3aa0a9-3fc3-48f0-b4d4-5429c4c7eb5e`, credentialExpiresAt=`2027-05-04T04:43:11.296Z`. 비밀 값은 요청/출력/저장하지 않았다. 운영/localhost URI4개, 공개 서버값, 기존 DB400RU·파티션·TTL·인덱스, DB 범위 역할, Standard/East Asia와 공유 metadata 보존을 모두 실제 재조회했다. 자격증명의 실제 사용과 사용자 로그인은 배포 이후 T06에서 확인한다.
- 비밀 존재 조회는 Windows native 인수 전달에서도 따옴표 손실 없이 동작하도록 JMESPath의 null/빈문자열 비교를 사용한다. 실제 CLI가 공개 값과 secretPresent=false만 반환하는 것을 확인했다. 설치된 Azure CLI의 JMESPath 엔진으로 미설정/null/빈값/비어 있지 않은 sentinel4사례를 검증했고 값 노출0. 최종 resources8+apps5=13/13 대역 검사 재통과.
- T03의 임시 worktree는 검증 후 선택 파일5개가 완료 커밋의 파일과 같은지 해시로 확인하고 삭제했다. 검증 결과와 source SHA는 T03 Progress에 보존했다.
- 갱신 절차: 새 비밀 생성 → SWA 값 교체 → 실제 API 성공 확인 → 기존 비밀 삭제. 이 Task에서 기존 비밀을 임의 삭제하지 않는다.
- 실제 사용자 로그인: 아직 검증하지 않음(T06)
