# Task: T05 기본 브랜치 등록과 운영 수동 배포

## Status: in_progress

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
  - `scripts/package-game-api.mjs`, `scripts/release-config.test.mjs` :: `portable runtime package` — npm 실행 링크 없는 패키지 및 실제 로드 검증; verified fix
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
- T04 실제 Verify 및 커밋32a1f21 완료 후 시작. 실제 원격 HEAD는 main(`e1dac5818cb191145ba4d077a96f273ffe38dad7`), origin/dev=`e7b36ecfa7192cccc28bc795231452ee549d9d44`. main/dev 모두 workflow 없음. 소스 HEAD는 origin/dev의 정상 후손(원격만의 커밋0/로컬39)으로 기존 게임과 로그인·저장·랭킹/보안/배포 이력이 포함된다. 관계없는 미커밋 게임/아트는 포함하지 않는다.
- 배포 source SHA=`32a1f21ebf3988796bdcfdaba383537c493be83a`로 선택하고 `%TEMP%/corgi-production-release-20261105`에 clean detached checkout을 만들어 실제 운영 origin으로 Node22 production 검증 중.
- 기본 브랜치 등록용 별도 worktree `%TEMP%/corgi-workflow-registration-20261105`, branch=`release/register-corgi-workflow-20261105`, commit=`6a5425c96c8a81f8761f9d061d357cfa5365ce2e`. main에서 workflow 파일1개만 추가했고 YAML CLI 검증 통과. 아직 push/PR/병합/dispatch 없음.
- GitHub CLI는 인증되지 않아 repo view exit4. 사용자에게 `gh auth login --hostname github.com --git-protocol https --web --scopes workflow` 직접 로그인 요청. 토큰/인증코드 요청 없음. 권한·브랜치 보호·Secret 이름 조회와 외부 쓰기는 인증 완료 후 이어간다.
- 2026-11-05T04:53:03.220Z Node22.23.4 clean source32a1f21 운영 build/check exit0. manifest mode=production, dirty=false, origin=`https://polite-rock-0f80d2a00.5.azurestaticapps.net`, static284개/64,920,975bytes, API7개 경로 독립 로드. static SHA256=`6498dc0587c8e1be929205f8fafe94a00668ad3972fbbf9d066163277b015296`, API SHA256=`e9285fbfd0628652bf7721d2f4cc2d4d065533cfb6ea71e9db8aa3ac4e65fc91`. workflow9/9 및 YAML CLI 재통과. 두 별도 worktree 모두 clean.
- 사용자 GitHub 로그인 완료 후 ADMIN 권한 확인. main protected=false, 적용 rules=[]이며 보호 우회 없이 진행. source32a1f21을 dev에 정상 push했고 등록용 branch도 push했다. [PR #1](https://github.com/sejeong223/skill-practice/pull/1)은 workflow1개만 추가, head6a5425c 일치·MERGEABLE/CLEAN 확인 후 일반 merge. 병합시각2026-11-05T04:56:07Z, workflow 기본 브랜치 commit=`8fc22d795d8325e0ebee8920b2448a086f87032a`, workflow ID407722033.
- GitHub 공개 Variables4개(tenant/web/API/운영redirect) 설정 및 재조회 일치. 사용자 배포 Secret 등록 완료 응답 후 이름 `AZURE_STATIC_WEB_APPS_API_TOKEN_LEGENDARY_RIB_CORGI`와 updatedAt=2026-11-05T04:57:35Z만 확인. 값 조회/출력 없음.
- remote main workflow 내용이 로컬 검증 파일과 일치하고 workflow commit8fc22d7·source32a1f21 원격 접근을 재확인한 뒤 main에서 source_ref32a1f21로 실제 dispatch. [첫 배포 run41971017172](https://github.com/sejeong223/skill-practice/actions/runs/41971017172) 결과 관찰 중. 실제 HTTP 검증 전이므로 T05 미완료.
- 비밀: 이름과설정완료여부만기록,값금지
- 설치된 Next16.4.5 CLI/TypeScript 문서에 따라 `npx next typegen`을 `tsc --noEmit` 앞에 추가하고 workflow 검증기/회귀 검사에 누락 거절을 반영했다. 별도 신규 checkout `%TEMP%/corgi-clean-types-20261105`에서 .next/next-env.d.ts가 없는 것을 확인한 뒤 Node22 root/API npm ci → next typegen → tsc exit0, git clean 확인. workflow9/9·YAML CLI·대상 ESLint 통과. 게임 소스32a1f21은 바꾸지 않으며 실행 workflow만 보완한 [PR #2](https://github.com/sejeong223/skill-practice/pull/2)는 YAML1줄 변경이다. source에 포함된 원래 workflow와 실행 main workflow의 버전 차이는 각각 검증한 공개 SHA로 기록한다.
- PR #2 병합 commit=`03456f99372de9b8d6e9a5d715d098d227f5fa9c`, 2026-11-05T05:05:14Z. 최종 배포 workflow는 이 main 커밋이다. source32a1f21의 run41971017172/41971764315는 업로드 전 검사에서 종료되어 실제 배포 결과로 사용하지 않는다.
- Functions 런타임은 패키지 CLI 실행 링크가 필요 없어 패키징의 npm ci에 `--bin-links=false`를 적용했다. symlink 거절 검사는 그대로 유지한다. 실제 API build→독립 npm ci→실행 링크 없음→7개 route 로드 및 원본 API 의존성 보존을 검증하는 회귀 테스트 추가, release14/14·대상 ESLint 통과. npm의 플랫폼별 bin-links 동작은 [공식 문서](https://docs.npmjs.com/cli/v11/commands/npm-ci/#bin-links)로 확인했다.
- 이 패키징 변경을 포함한 고정 소스 커밋으로 Linux CI를 실행하기 위해 T05 커밋을 후보 브랜치에 먼저 게시한다. 실제 성공/HTTP 검증 후 완료 기록을 같은 로컬 T05 커밋에 반영하고 dev를 정상 전진시킨다. 후보 브랜치는 원래 소스 SHA 증거를 보존하며 기존 원격 커밋을 덮어쓰지 않는다.
