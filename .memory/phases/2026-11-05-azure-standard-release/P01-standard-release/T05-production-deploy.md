# Task: T05 기본 브랜치 등록과 운영 수동 배포

## Status: pending

## Goal

기본 브랜치에 수동 workflow를 등록하고 실제 SWA URL로 확정 소스 커밋을 다시 빌드·배포하여 URL/SHA/run 증거를 남긴다.

## Decision Summary

- T01~T03 로컬 준비와 T04 실제 Standard/운영 설정 Verify 완료가 선행 조건. `dev` 또는 전체SHA를 수동 배포하며 push 자동 배포 없음.
- 기존 dirty 작업 트리를 보존한다. 보호브랜치 우회/forcepush/관계없는 게임변경 통합 금지. computer-use 없음, 공개설정 CLI·비밀 사용자직접입력.

## Implementation

### I01. 소스 커밋과 기본 브랜치 workflow 등록

- Related Files:
  - `.github/workflows/deploy-legendary-rib-corgi.yml` :: `manual production workflow` — T03 파일을 default branch에 등록; modify only for verified fixes
  - `scripts/check-game-workflow.mjs`, `scripts/game-workflow.test.mjs` :: `workflow validation` — 변경 시 검사; read-only unless fix
  - `scripts/build-game-release.mjs`, `scripts/check-game-release.mjs` :: `production gate` — 최종 산출물 검사; read-only unless fix
  - 본 Task :: `Progress` — 공개 배포 증거; modify

#### Details

- **Signatures & Types**:
```text
gh repo view sejeong223/skill-practice --json defaultBranchRef
gh workflow run deploy-legendary-rib-corgi.yml --repo sejeong223/skill-practice --ref <실제기본브랜치> -f source_ref=<확정40hexSHA>
gh run view <실제runID> --repo sejeong223/skill-practice --json status,conclusion,url,headSha
```
- **Data & Schema Fields**:
  - repo=sejeong223/skill-practice, 기본 배포소스=dev, 실제 기본브랜치는 조회(main으로 추정하지 않음).
  - SWA ARM ID=`/subscriptions/b7af62a9-9a10-4deb-95fa-1690f7bbd33d/resourceGroups/grill-me-edu/providers/Microsoft.Web/staticSites/legendary-rib-corgi`, sku Standard, 고정tenant `69c1e470-4528-435a-a1ae-de98e0aac738`.
  - Release evidence: sourceCommit(40hex),workflowCommit(40hex),defaultBranch(string),sourceRef(string),runId(number),runUrl(https),swaOrigin(https 실제값),conclusion,verifiedAt ISO,manifest SHA/host/mode. workflow headSha는 게임 source SHA와 다를 수 있으므로 각각 기록한다.
  - production artifact: out/, build/game-api/, manifest mode=production,dirty=false,sku=Standard,node:22,sourceCommit=실제빌드SHA,swaOrigin=조회한실제origin. preflight/localhost/placeholder는 업로드하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T04 Progress의 실제host/Verify와 Azure 공개metadata를 대조. GitHub CLI로그인권한/기본branch/branch protection 조회. game release source에서 필요한 게임파일·신규 cloud 코드·배포스크립트가 실제커밋됐는지 clean checkout preflight로 확인한다. 로컬미커밋파일에만 의존하면 배포하지 않는다.
  2. 관련 Task 커밋만 정상 push한다. 이미 존재하는 사용자 변경을 임의 stage/commit/전체merge 하지 않는다. 배포에 필요한 사용자 미커밋 변경이 발견되면 어떤파일과 이유인지 구체적으로 설명하고 그 범위에 대해서만 지시를 받는다. 무관한파일 자동포함 없음.
  3. default branch에 workflow가 없으면 별도 worktree/브랜치에서 workflow파일만 준비하고 PR을 만든다. `--body-file`로 한국어 설명/검증/소스SHA선택방식 기록. main의 기존workflow가있다면diff검토후병합. 깨끗한 별도worktree 외 원래dirty branch전환없음. 기본브랜치 등록용 PR커밋과 작업브랜치의 본Task완료커밋은 목적/해시를 구분한다.
  4. 승인된 배포범위 내 권한이 있으면 등록을 완료한다. 보호정책/필수review가막으면 구체적인PR링크와 필요한조작만 안내하고 실제등록 전 성공처리하지 않는다. forcepush·보호해제 금지.
  5. Error & Exception Handling: 중복 workflow나 다른사이트배포token으로 대체하지 않는다. 원격branch의이동이있으면사용할sourceSHA를다시확정하고한실행내고정한다.
  6. State Transition & Return: default branch의 workflow존재와선택한sourceSHA접근을 실제확인한뒤 다음설정/dispatch로진행.

### I02. 운영 값·비밀 설정·수동 실행과 HTTP 확인

- Related Files:
  - `.github/workflows/deploy-legendary-rib-corgi.yml` :: `vars/secrets/upload` — T03 계약; read-only unless fix
  - 본 Task :: `Progress` — 운영 입력·실행 결과; modify

#### Details

- **Data & Schema Fields**:
  - GitHub Actions Variables: GAME_TENANT_ID=`69c1e470-4528-435a-a1ae-de98e0aac738`, GAME_WEB_CLIENT_ID=`e467e8bc-c900-4d08-88be-7f0a5fce2474`, GAME_API_CLIENT_ID=`a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`, GAME_REDIRECT_URI=`https://{실제SWAhost}/`.
  - Secret=`AZURE_STATIC_WEB_APPS_API_TOKEN_LEGENDARY_RIB_CORGI`; API 서버비밀은 SWA에만 있고 프런트빌드/GitHub Variables로옮기지않는다.
  - workflow: workflow_dispatch only,permissions contents:read,ubuntu/Node22,concurrency취소false,defaultbranch실행,source_ref=dev또는40hex. npm ci(root/api)→lint/typechecks/cloud/release/workflowtests→productionbuild/check→upload. app_location=out,api_location=build/game-api,output_location빈문자열,skip_app_build/skip_api_build=true,production_branch=기본branch.
- **Execution Flow / Logic**:
  1. 공개Variables는 `gh variable set ... --repo sejeong223/skill-practice --body <공개값>`으로설정하고이름/공개값만검증. 실제SWAhost는T04기록+조회에서얻는다.
  2. 사용자에게 Azure Portal→게임SWA→배포토큰관리→값을GitHub repo Settings→Secrets and variables→Actions→위Secret이름으로직접저장하도록안내. 값출력·채팅전달·스크린샷요청없음. 에이전트는 `gh secret list`로이름존재만확인한다.
  3. production 빌드는 깨끗한선택SHA환경에서실제NEXT_PUBLIC설정을주입한다. 별도worktree로로컬최종검증가능하나 원래.env.local을복사하지않는다. Ubuntu CI에서운영node_modules를새로설치하고최종manifest를확인한다.
  4. 실행사용자가이미배포를지시했고필수입력이충족되면위gh workflow run을실행한다. 해당run을ID/입력SHA/시간으로식별하고결과까지관찰한다. API token실제사용은upload step에만허용. 실패로그는secret을마스킹해원인을해결하고필요한검증후재시도한다.
  5. 성공후HTTP GET `/`200/html,대표JS와이미지200,`/auth/redirect/`200/no-store/COOP없음,`/api/game/bootstrap`미인증401/JSON/no-store 확인. index.html fallback/Functions미배포를성공으로보고하지않는다. 실제로그인은T06.
  6. 롤백이필요하면기록된이전성공sourceSHA를같은workflow로재배포한다. DB/앱을삭제하지않고스키마호환성을확인한다. 첫배포는이전성공SHA가없으므로임의다른버전을대체하지않는다.
  7. State Transition & Return: 실제run success,배포URL/SHA/manifest/HTTP증거가모두있어야완료. 기록문서를작업branch에한국어Task커밋한다.

## Acceptance Criteria

- [ ] 실제기본branch workflow와배포소스SHA를독립적으로확인했다.
- [ ] 실제URL로재빌드한production산출물만배포했고run success를확인했다.
- [ ] 공개URL/SHA/run 및root/bridge/API HTTP증거가있고secret노출없음.

## Validation

- `node scripts/check-game-workflow.mjs`, `npm.cmd run test:workflow` → exit0.
- clean checkout/Node22/공개운영env에서 `npm.cmd run build:release -- --mode production`, `npm.cmd run check:release -- --mode production` → exit0(최종 CI 실행 기록으로도 검증).
- `gh workflow view deploy-legendary-rib-corgi.yml --repo sejeong223/skill-practice` 및 위 run view → 실제 default등록/run success.
- HTTP 자동조회 root200/bridge200/API401, API content-typeJSON 및no-store. 사용자로그인으로대체검증하지않는다.

## Commit Message

```text
chore(deploy): Standard 운영 수동 배포와 실행 증거 기록

Plan: 2026-11-05-azure-standard-release
Phase: P01-standard-release
Task: T05-production-deploy

- 기본 브랜치 수동 workflow와 운영 공개 설정을 연결한다
- 확정 소스 SHA의 배포 성공과 HTTP 검증을 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- workflow 등록PR/기본branch/workflowSHA/sourceSHA: 실행 시 기록
- 실제SWAorigin/manifest/runURL/status/HTTP결과: 실행 시 기록
- 비밀: 이름과설정완료여부만기록,값금지
