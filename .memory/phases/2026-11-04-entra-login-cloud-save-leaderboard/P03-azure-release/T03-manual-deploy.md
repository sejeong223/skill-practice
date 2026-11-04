# Task: T03 GitHub 수동 배포와 기본 브랜치 등록

## Status: pending

## Goal

Run workflow로 선택한 소스 커밋을 빌드·검증해 실제 새SWA에배포하고 실행URL/SHA를기록한다.

## Decision Summary

- workflow_dispatch만,기본source_ref=dev. workflow는GitHub실제기본브랜치에등록하고배포코드의정확한SHA를해석해고정한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 실행 구성과 외부 연동

- Related Files:
  - `.github/workflows/deploy-legendary-rib-corgi.yml` :: `workflow_dispatch, build/deploy jobs` — 준비·배포·검증 대상; new
  - `scripts/check-game-workflow.mjs` :: `validate manual-only workflow` — 준비·배포·검증 대상; new
  - `package.json` :: `test:workflow, YAML parser dev dependency` — 준비·배포·검증 대상; modify
  - `package-lock.json` :: `YAML lock` — 준비·배포·검증 대상; modify
  - `.memory/phases/2026-11-04-entra-login-cloud-save-leaderboard/P03-azure-release/T03-manual-deploy.md` :: `Progress: default branch bootstrap/deployment evidence` — 준비·배포·검증 대상; modify

#### Details

- **Signatures & Types**:
```text
# workflow inputs
source_ref: {description:"배포할 브랜치 또는 커밋", required:true, default:"dev", type:string}
# root script
export function validateWorkflow(document:unknown):string[]; // 위반 목록, []이면통과
```

- **Data & Schema Fields**:

- Subscription=`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, RG=`grill-me-edu`, 기존 Cosmos=`maze-rescue-ms-b7af62a9`.
- 새 DB=`legendary-rib-corgi`, container=`game-data`, partition=/playerId, 컨테이너 전용 manual400 RU/s, database throughput 없음. Existing freeTier=true/총3400RU/s/KoreaCentral/모든네트워크는 사용자 확인값이며 preflight에서 실제값을 재확인한다.
- 다른DB·컨테이너·계정지역·방화벽·auth·freeTier·account throughput limit 변경 금지. account key 사용 금지. 처리량상한이막으면자동증가하지않는다. 대상구독을조회못하면다른구독대체금지.
- SWA=`legendary-rib-corgi` Free, 관리형 Functions Node22. 지원 아시아 API지역 확인 필요. managed identity/KeyVault참조/별도AppService 미사용.

- repo=`sejeong223/skill-practice`; 작업branch=dev; 관찰된origin/HEAD=main이나 `gh repo view --json defaultBranchRef`로실제값재확인.
- GitHub Variables: GAME_TENANT_ID, GAME_WEB_CLIENT_ID, GAME_API_CLIENT_ID, GAME_REDIRECT_URI(공개). 빌드 env NEXT_PUBLIC_*로명시mapping, NEXT_PUBLIC_GAME_MODE=cloud.
- GitHub Secret=`AZURE_STATIC_WEB_APPS_API_TOKEN_LEGENDARY_RIB_CORGI`. SWA서버secret은GitHub프런트빌드로전달하지않음.
- Workflow permissions=contents:read, concurrency group=legendary-rib-corgi-production,cancel-in-progress=false. pull_request/push/schedule트리거없음.


- **Execution Flow / Logic**:

1. Precondition & Validation: P03-T01 실제SWA/공개ID/서버env와T02빌드산출물준비. `gh repo view sejeong223/skill-practice --json defaultBranchRef` 확인. 워크플로파일만dev에있다는이유로Runworkflow준비완료라고하지않음.
2. Core Processing:
   - workflow_dispatch source_ref(defaultdev)를 actions/checkout ref 입력으로안전하게전달. shell에 "${{ inputs.source_ref }}"를직접삽입하지않음. ref를Git으로검증하여정확한SHA로해석후같은SHA를checkout하고manifest/job summary기록. 빌드중branch이동으로다른코드배포되지않게함.
   - runner ubuntu-latest, setup-node22, root/api 두lockfile기준cache. npm ci 및 npm ci --prefix api, npm run lint, npx tsc --noEmit, npm run typecheck:api,새cloud/API회귀테스트들, npm run build:release. test glob은scripts내신규파일목록을명시하여실제Azure변경스크립트를시험삼아실행하지않음.
   - deployment uses Azure/static-web-apps-deploy@v1(공식Action의검증된SHA로pin 권장), action=upload, app_location=out, output_location="", api_location=build/game-api, skip_app_build=true, skip_api_build=true. token은위GitHubsecret. runtime설정은out/staticwebapp.config.json. API가필수이므로api_location누락검사.
   - workflow실행ref는실제defaultbranch만허용(if github.ref_name == github.event.repository.default_branch). source_ref는dev/명시SHA를독립선택. production_branch=github.event.repository.default_branch로설정하여checkout된source와workflow실행ref차이가뜻하지않은preview배포를만들지않게함. deployment_environment 임의preview명미설정.
   - 자격증명사용전모든빌드검증완료,배포결과URL과manifest SHA/job URL요약. secrets/logset-x금지,token없으면명확히실패. workflow권한을불필요하게write로늘리지않음.
   - 기본브랜치최초등록: 기존dirty dev checkout을전환하지말고origindefault기준별도worktree에서workflow파일만commit/PR준비. 기존게임미커밋변경을default로전부복사/merge금지. 모든코드가source_ref에commit/push됐고workflow의default등록이완료됐는지확인. 보호branch/merge권한없으면구체적인PR과등록필요이유를안내하고사용자조작을받는다; 무단forcepush금지.
   - 사용자포털절차: SWA개요→배포토큰관리→값을GitHub Settings→Secrets and variables→Actions에직접저장. 출력/채팅으로받지않음. Variables4개도설정. Actions→해당workflow→Run workflow(defaultbranch,source_ref=dev또는SHA).
   - 사용자의실행지시에실제배포가포함되어있고권한이있다면 `gh workflow run deploy-legendary-rib-corgi.yml --ref <defaultbranch> -f source_ref=<확정SHA>` 실행. 이미승인된범위에중복승인요구하지않음. 권한없으면사용자가동일Runworkflow를실행하도록구체값제공.
3. Error & Exception Handling: 기본branch에workflow없음/secret없음/빌드실패는미완료. 배포실패시logs에서비밀을마스킹하고원인해결;실패배포를완료로기록하지않음. 기존DB리소스를배포실패rollback으로삭제하지않음. 되돌리기는이전성공SHA를동일workflow로재배포하며schema호환성확인.
4. State Transition & Return: 배포된URL, sourceSHA,workflowrun URL/status,정적루트200/API미인증401의HTTP증거를Progress. 브라우저는조작하지않는다. 실제토큰로그인검증은T04.

### I02. 실행 전후 검증

- Related Files:
  - `scripts/game-workflow.test.mjs` :: `node:test cases` — 외부 부작용 없는 설정·계약 검증; new

#### Details

- YAML파싱으로on=workflow_dispatch만,source_ref기본dev,scope변수mapping/serversecret프런트미전달,defaultref/productionbranch정합성,정확한산출물경로,신뢰할수없는ref를shell직접삽입하지않음. secret없는대역은deployment부분실행하지않음.
- 새 리소스·실제배포·실제로그인 확인은 대역 결과와 구분하여 Progress에 기록한다.
- `<...>` 값은 본 Task에서 확보한 공개 식별자·URL·run ID로 치환한다. secret을 명령행 문자열에 직접 넣거나 문서에 기록하지 않는다.
- 실행 권한/사용자 수동 입력이 없으면 정확한 미완료 항목을 남기고 포인터를 다음 Task로 넘기지 않는다.

## Acceptance Criteria

- [ ] 실제기본브랜치에서수동버튼을사용할수있고정확한커밋이실제SWA에배포된다.
- [ ] dev push자동배포가없고API/프런트설정이올바르게분리된다.
- [ ] 아래 검증 결과·실제 리소스 상태·필요한 사용자 확인을 기록한다.

## Validation

- `node --test scripts/game-workflow.test.mjs` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run build:release` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `gh repo view sejeong223/skill-practice --json defaultBranchRef` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `gh run view <해당runId> --json status,conclusion,url,headSha` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.

## Commit Message

```text
feat(azure): GitHub 수동 배포와 기본 브랜치 등록

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P03-azure-release
Task: T03-manual-deploy

- Run workflow로 선택한 소스 커밋을 빌드·검증해 실제 새SWA에배포하고 실행URL/SHA를기록한다.
- 대상 리소스 보존과 실행 검증 결과를 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 공개 식별자·실행 URL·source SHA·검증 결과: 실행 시 기록
- 사용자 수동 확인/미완료 입력: 실행 시 기록

