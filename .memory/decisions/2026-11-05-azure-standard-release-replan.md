# Decisions: Azure Static Web Apps Standard 배포 재계획

- Date: 2026-11-05
- Status: Confirmed
- Stage: grill-me 인터뷰 완료. 다음 memory-plan에서 남은 작업 청사진을 재구성한다.
- Previous decisions: [Entra 로그인·저장·랭킹 결정](./2026-11-04-entra-login-cloud-save-leaderboard.md)
- Previous plan: [10/14 완료 후 보류된 계획](../plans/2026-11-04-entra-login-cloud-save-leaderboard.md)
- Scope: 기존 구현과 생성된 게임 리소스를 재사용하고, 남은 Azure 배포 작업을 Standard와 로컬 준비 우선 순서로 다시 계획한다.

## D01. 게임 전용 SWA를 Standard로 신규 생성

- **Chosen**: 같은 구독·리소스 그룹에 `legendary-rib-corgi` Static Web App 1개를 Standard 요금제로 새로 만든다. [사용자 직접 선택]
- **Rationale**: 2026-11-04 실제 생성 시 Free 앱 개수 한도로 거절되었다. 2026-11-05 확인한 공식 문서상 구독당 Free 한도는10개, Standard 한도는100개다. 기존 다른 사람의 앱을 바꾸지 않고 게임 전용 앱을 마련할 수 있다.
- **Target**: subscription `b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, tenant `69c1e470-4528-435a-a1ae-de98e0aac738`, resource group `grill-me-edu`.
- **Region**: 기존에 지원을 확인한 East Asia(`eastasia`)를 우선 유지하고 실행 시 지원 여부를 재조회한다. 기존 Cosmos의 Korea Central 지역은 변경하지 않는다. [기존 결정 유지]
- **Supersedes**: 이전 결정 D02/D20 및 P03 청사진·준비 스크립트의 SWA Free 전제와 Free만 허용하는 검사. 공용 Cosmos 계정의 `enableFreeTier=true`는 별도 설정이므로 변경하지 않는다.
- **Billing**: 사용자는 유료 Standard 선택을 확정했다. Standard는 시간 기준으로 과금되며 포함 트래픽을 넘으면 초과 요금이 발생할 수 있다. 실제 청구액은 계약·통화·사용량에 따라 달라지고, 공식 가격 페이지의 동적 금액이 확인되지 않아 월 고정 금액을 임의로 기록하지 않는다. 새 Cosmos 처리량·별도 App Service·추가 유료 부가 기능은 이번 변경에 포함하지 않는다.
- **Execution boundary**: 이번 인터뷰에서는 리소스를 생성·변경하지 않았다. Standard 실제 생성은 아래 로컬 준비를 완료한 후 실행 단계에서 진행한다.

## D02. 로컬 준비를 먼저 완료하고 유료 리소스를 생성

- **Chosen**: 로컬 정적 빌드·API 패키징·자동 검증을 먼저 완료한 뒤 Standard 앱을 생성한다. 실제 앱 URL과 운영 설정을 반영하여 최종 빌드·수동 배포·실서비스 검증을 진행한다. [사용자 선택: 추천안1]
- **Rationale**: 빌드 문제를 해결하는 동안 새 Standard 앱이 먼저 과금되는 기간을 줄인다. 실제 앱 URL이 필요한 최종 빌드와 운영 인증 검증은 생성 후 수행해야 한다.
- **Sequence**:
  1. 기존 완료 코드와 미커밋 준비 작업을 확인하고, 배포 산출물·Standard 대상 검사·수동 배포 workflow를 로컬에서 준비·검증한다. Azure 조회가 필요하면 읽기만 수행한다.
  2. 구독/tenant, 기존 앱·DB·권한, Standard 한도·지역·동일 이름 충돌을 재확인한 뒤 게임 전용 Standard 앱을 생성한다.
  3. 실제 SWA URL의 로그인 복귀 주소, API 서버 환경 변수, 필요한 비밀·배포 설정을 연결한다.
  4. 실제 운영 공개 값으로 다시 빌드·검증하고 GitHub 수동 배포를 실행한다.
  5. 실제 로그인·클라우드 저장·계정 격리·다른 PC 이어하기·랭킹을 검증한다.
- **Local verification**: 생성 전 검증에서는 명시적으로 구분한 테스트용 공개 설정/localhost 주소를 사용할 수 있다. 이를 실제 로그인이나 운영 준비 완료로 보고하지 않는다. 운영 배포는 실제 HTTPS SWA URL을 사용한 최종 산출물만 허용한다.
- **Plan consequence**: 기존 P03-T01이 끝나야 T02를 시작하도록 한 의존 관계를 그대로 재개하면 안 된다. 다음 계획에서 로컬 준비와 Azure 실행을 분리·재배치한다. [선택에 따른 설계 구체화]

## D03. 완료된 구현·리소스 재사용

- **Chosen**: 기존 P01/P02의 완료 Task10개와 커밋을 유지하고 재구현하지 않는다. 생성된 Entra 앱2개, 서비스 주체, API scope, 게임 DB/컨테이너, 게임 DB 범위 데이터 권한을 검증 후 재사용한다. [기존 결정 및 실행 기록으로 확정]
- **Rationale**: 중단 원인은 SWA 신규 생성 한도였다. 이미 작성한 인증·저장·게임 연결·TOP10 코드를 중복 구현하거나 DB를 다시 만들 이유가 없다.
- **Recorded public identifiers**:

| 항목 | 값 |
| --- | --- |
| 웹 client ID | `e467e8bc-c900-4d08-88be-7f0a5fce2474` |
| API client ID | `a2e3f4fa-56e5-4ab5-ba41-43cb974b8722` |
| API 서비스 주체 object ID | `f02b1a27-859d-4872-8549-99ad95927132` |
| API scope | `api://a2e3f4fa-56e5-4ab5-ba41-43cb974b8722/access_as_user` |
| Cosmos 계정 | `maze-rescue-ms-b7af62a9` |
| 데이터베이스 / 컨테이너 | `legendary-rib-corgi` / `game-data` |
| 파티션 / 처리량 | `/playerId` / 컨테이너 전용 수동400 RU/s |

- **Evidence**: 상세 생성·검증 기록은 [이전 P03-T01 Progress](../phases/2026-11-04-entra-login-cloud-save-leaderboard/P03-azure-release/T01-resource-setup.md#progress)에 있다. 로컬 `.git/azure-game-apps.json`과 `.git/azure-game-resources.json`은 생성 증거이며 Git에 포함되지 않는다. 증거가 없거나 실제 리소스가 다르면 이름만 보고 덮어쓰지 않는다.
- **Freshness**: 위 값과 다른 DB7개/3400RU 보존 확인은 2026-11-04 실행 기록이다. 이번 인터뷰에서 Azure 현재 상태를 다시 조회한 결과로 표현하지 않는다.
- **Preservation**: 타인 DB/컨테이너, 공용 계정 설정·처리량 상한, 다른 SWA를 변경하지 않는다. 게임 DB의400RU/s도 그대로 유지한다.

## D04. 인증·API·게임 규칙 유지

- **Chosen**: 기존 MSAL(브라우저의 Microsoft 로그인 라이브러리), 조직 전용 Entra 앱, API의 액세스 토큰 검증, SWA 관리형 Azure Functions/Node22를 유지한다. [기존 결정·구현 확인]
- **Rationale**: Standard 선택만으로 인증 구현을 바꿀 필요는 없다. 기존 클라이언트와 API의 인증 계약을 유지해 변경 범위를 배포 작업으로 한정한다.
- **Frontend**: Next 정적 내보내기 `output: export`, 브라우저에서 Phaser 실행. 실제 설치본 Next 문서를 구현 전에 읽는다. 별도 Next 서버/하이브리드 호스팅/App Service는 추가하지 않는다.
- **Redirects**: 운영 origin의 `/`와 `/auth/redirect/`, localhost의 같은 두 주소를 SPA 리디렉션 URI에 등록한다. `/auth/redirect/`는 MSAL5의 조용한 토큰 갱신에 필요하며 캐시 금지와 COOP 헤더 부재 조건을 유지한다.
- **API protection**: `/api`는 기존 Bearer 토큰으로 인증한다. MSAL 로그인과 SWA 자체 로그인 세션은 다르므로 플랫폼 `authenticated` 역할을 그대로 덧붙이지 않는다.
- **Game rules**: 저장·초기화·계정당 활성 세션·개발/테스트 데이터 격리를 유지한다. 랭킹은 진행도 내림차순 → 해당 기록의 데스 수 오름차순 → 이름 가나다순, 최대10명과 기존 표시 필드를 유지한다.

## D05. Standard 기준 배포 검사

- **Chosen**: 생성 명령, 리소스 SKU 검증, 테스트 대역, 배포 크기 검사를 Standard 기준으로 일치시킨다. [코드·공식 문서 확인에 따른 필수 변경]
- **Rationale**: 현재 준비 스크립트는 생성뿐 아니라 재사용·최종 검증에서도 Free를 강제한다. 명령 한 줄의 요금제만 바꾸면 후속 설정이나 검증이 실패한다.
- **Affected preparation**: `scripts/azure-game-resources.ps1`, `scripts/azure-game-apps.ps1`, 관련 대역·검증 코드와 기존 P03 문구가 대상이다. 이 결정 단계에서는 코드를 수정하지 않는다.
- **Artifact limits**: 공식 Standard 환경당500MB, 전체 환경2GB, 파일15000개 기준을 새 청사진에 반영한다. 실제 `out/` 전체를 검사하며 기존 Free 환경당250MB 전제를 남기지 않는다. 운영 환경 하나를 기본으로 하고 별도 preview 환경 추가를 자동 도입하지 않는다.
- **Required validation**: 독립 API 패키지·Node22, `/api`의 HTML fallback 방지, 브라우저 산출물의 서버 비밀 미포함, 정확한 배포 소스 SHA, 운영 URL/redirect 일치를 유지한다. 자동 대역 검증과 실제 Azure 성공을 구분한다.

## D06. 배포·비밀·수동 확인 방식 유지

- **Chosen**: GitHub Actions의 `workflow_dispatch`(Run workflow로 수동 시작)와 기본 소스 `dev`/확정 커밋 SHA를 유지한다. push 자동 배포는 도입하지 않는다. [이전 사용자 선택 유지]
- **Rationale**: Standard는 호스팅 요금제 변경이며 배포 시점 선택 방식을 바꾸라는 요청은 아니다.
- **Repository**: `sejeong223/skill-practice`. 실행 시 실제 기본 브랜치를 확인하고 수동 workflow를 등록한다. 기존 미커밋 게임 변경을 임의로 기본 브랜치에 합치지 않는다.
- **Configuration**: 공개 Entra ID와 실제 redirect URI는 프런트 빌드 시 주입한다. 이미 빌드한 정적 파일은 SWA 서버 환경 변수만 바꿔도 수정되지 않으므로 최종 재빌드가 필요하다.
- **Secrets**: API용 클라이언트 비밀은 SWA 서버 설정, 배포 토큰은 GitHub Secrets에 사용자가 직접 입력하는 기존 방식을 유지한다. 비밀을 채팅·문서·브라우저 번들에 넣지 않는다. 공개 설정은 CLI로 처리할 수 있다.
- **User interaction**: computer-use 금지 유지. 실제 브라우저 로그인·모바일/다른 PC 검증은 필요한 시점에 사용자에게 구체적인 절차로 안내한다. 테스트 계정은 기존처럼 사용자가 선택한 뒤 서버 allowlist에 등록한다.

## D07. 계획·상태 처리

- **Chosen**: 기존 완료 기록은 보존하고, 다음 `/memory-plan`에서 남은 배포 작업의 청사진과 실행 포인터를 다시 만든다. [명시적으로 호출한 grill-me 단계에 따른 처리]
- **Rationale**: 이번에 확정한 로컬 준비 우선 순서는 이전 보류 Task 번호 순서와 다르다. 과거 Task를 완료로 바꾸거나 이전 T01부터 자동 실행하면 새로운 결정과 충돌한다.
- **Current status**: 인터뷰 결정만 완료했다. 활성 실행 Task는 아직 없음. 기존 미완료 P03을 done으로 처리하지 않는다.
- **Verification records**: 새 검증 파일은 기존 `scripts/` 바로 아래, 검증 결과는 해당 Task Progress에 기록한다. 별도 tests/나 `.memory/test-plans`를 만들지 않는다. 구현 시 기존 미커밋 변경을 보존하고 Task별 변경만 선별 커밋한다.

## 요청 밖 발견 사항 — 보고만 하며 자동 범위 확대하지 않음

- 후속 변경(2026-11-05): 아래 보안 보류 기록은 최초 인터뷰 시점이다. 이후 사용자가 보안 수정 계획 추가와 **심각·높음만 포함, 보통은 후속**을 선택했다. [추가 결정](./2026-11-05-dependency-security-fix.md)에 따라 보안 계획1개 Task를 배포보다 먼저 실행한다. 월드3 인트로 보류는 그대로다.
- 이전 P01-T01 기록에 npm audit 경고20개(critical1)가 남아 있다. 이는 과거 확인 기록이며 이번에 다시 검사하지 않았다. 의존성 업그레이드 작업을 이번 요금제 변경에 자동 포함하지 않으며, 배포 전 별도 검토가 필요하다는 기존 메모를 전달한다.
- 월드3 인트로 두 번째 자막 이후 자동 진행 중단은 기존 별도 후속 작업으로 유지한다.
- 로그인·클라우드 저장·랭킹은 이미 구현됐지만 실제 배포와 로그인·다른 PC 이어하기 검증은 미완료다. 재계획 시 구현 완료와 실서비스 검증 완료를 구분한다.

## 확인한 근거

- `.memory/current.md`, 이전 결정·계획·P03 Task 청사진, P01-T01 Progress, 최근 완료 커밋.
- `next.config.ts`: 아직 정적 export 설정 전. `api/package.json`: 관리형 Functions v4, Node22, 기존 API 의존성.
- `scripts/azure-game-resources.ps1`, `scripts/azure-game-apps.ps1`: 현재 Free 강제 생성·검증.
- [SWA 공식 한도](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas): Free10/Standard100, Standard 환경당500MB/전체2GB/파일15000.
- [SWA 요금제 기능](https://learn.microsoft.com/en-us/azure/static-web-apps/plans): Standard에서도 관리형 Functions 사용 가능.
- [SWA 공식 가격 안내](https://azure.microsoft.com/en-us/pricing/details/app-service/static/): 시간 기준 과금, 포함 대역폭과 초과 요금, 계약/통화에 따른 가격 차이.

공식 웹 자료 확인일: 2026-11-05. 이번 인터뷰에서 Azure/GitHub 쓰기, 의존성 설치, 코드 구현, 배포, Git 커밋을 실행하지 않았다.
