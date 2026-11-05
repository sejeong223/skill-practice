# Task: T03 로컬 GitHub 수동 workflow와 검증

## Status: pending

## Goal

정확한 소스 커밋으로 Standard 운영 산출물을 빌드·검증해 배포할 수 있는 수동 workflow를 로컬에서 완성한다. 이 Task에서는 push/PR/dispatch/배포를 하지 않는다.

## Decision Summary

- GitHub `workflow_dispatch`만, 기본 source_ref=dev, 실행 workflow는 기본 브랜치, 실제 배포소스 SHA는 별도로 고정한다.
- 기존 T01 산출물 계약을 사용한다. 실제 SWA URL/비밀은 T04~T05에서 설정한다. scripts/ 테스트·선별 커밋·computer-use 금지 유지.

## Implementation

### I01. Workflow와 소스 SHA·산출물 경계

- Related Files:
  - `.github/workflows/deploy-legendary-rib-corgi.yml` :: `workflow_dispatch/build-deploy` — 수동 workflow; new
  - `scripts/check-game-workflow.mjs` :: `validateWorkflow` — YAML 계약 검사; new
  - `scripts/game-workflow.test.mjs` :: `workflow cases` — 동작 가능한/거절 YAML fixture; new
  - `package.json`, `package-lock.json` :: `test:workflow/test:cloud/YAML parser` — 로컬 및 CI 명령; modify
  - `scripts/build-game-release.mjs`, `scripts/check-game-release.mjs` :: `production gate` — T01 산출물 소비; read-only

#### Details

- **Signatures & Types**:
```ts
export function validateWorkflow(document: unknown): string[]; // []=valid; stable error codes
// workflow input: source_ref required string, default "dev"
// command: node scripts/check-game-workflow.mjs [path]
// default path=.github/workflows/deploy-legendary-rib-corgi.yml
```
- **Data & Schema Fields**:
  - repository=`sejeong223/skill-practice`, workflow name=`Deploy legendary-rib-corgi`, 파일은 위 deploy-legendary-rib-corgi.yml. on에는 workflow_dispatch만 허용한다. source_ref는 `dev` 또는40자리16진수 커밋 SHA만 허용하고 다른 ref는 명시 오류로 거절한다.
  - runner=ubuntu-latest; Node22; permissions contents:read; concurrency group=legendary-rib-corgi-production,cancel-in-progress=false. PR/push/schedule 없음.
  - Variables: GAME_TENANT_ID=`69c1e470-4528-435a-a1ae-de98e0aac738`, GAME_WEB_CLIENT_ID=`e467e8bc-c900-4d08-88be-7f0a5fce2474`, GAME_API_CLIENT_ID=`a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`, GAME_REDIRECT_URI=`https://{실제SWAhost}/`.
  - 각 GAME_* 공개값을 해당 NEXT_PUBLIC_GAME_*로 빌드 env에 매핑; NEXT_PUBLIC_GAME_MODE=cloud. 서버 GAME_COSMOS_CLIENT_SECRET는 어떤 job/build env에도 전달하지 않는다.
  - GitHub Secret=`AZURE_STATIC_WEB_APPS_API_TOKEN_LEGENDARY_RIB_CORGI`; upload step에서만 사용. 실제 secret 없이 YAML/로컬 검증 가능.
  - T01 release manifest: schemaVersion1,mode production,sourceCommit40hex,dirtyfalse,builtAt ISO,swaOrigin실제HTTPS,tenantId/webClientId/apiClientId 고정값,skuStandard,apiRuntime node:22,static{directory:out,files,bytes},api{directory:build/game-api,entrypoint:dist/functions/game.js}.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01/T02 완료. 실제 원격상태는 이 Task에서 바꾸지 않는다. YAML은 duplicate keys를 거절하는 parser(yaml 패키지 devDependency 정확버전 lock)를 사용한다.
  2. Workflow 실행 ref가 github.event.repository.default_branch인지 먼저 확인한다. inputs.source_ref는 action with/ref 또는 환경변수로만 전달하고 run shell 문자열에 직접 삽입하지 않는다. ref 허용형식을 검증한 뒤 checkout으로 가져와 git rev-parse HEAD로40hex SHA를 얻고 detached checkout을 고정한다. 이후 브랜치를 다시 checkout하지 않는다.
  3. actions/checkout@v4, actions/setup-node@v4, Azure/static-web-apps-deploy@v1은 공식 저장소의 해당 태그 commit을 확인해서 가능하면40hex로 고정하고 대응 tag를 주석에 기록한다. 임의 SHA를 추측하지 않는다. 빌드 소스와 workflow 실행 ref를 혼동하지 않는다.
  4. Node22/cache(root와api lockfile) → npm ci → npm ci --prefix api → root `npm audit --audit-level=high` → lint/tsc/typecheck:api/test:cloud/test:release-config/test:workflow → `npm run build:release -- --mode production` → `npm run check:release -- --mode production` 순서. GitHub Variables 누락·다른ID·localhost URI·dirty/sourceSHA mismatch는 배포 전에 실패한다. 보안 검사는 dev dependencies도 포함하며 `--omit=dev`, `continue-on-error`, `|| true`로 우회하지 않는다. 보통만 남으면 진행할 수 있고 critical/high 또는 registry 실패는 배포 전에 중단한다. 보안 수정은 별도 선행 계획에서 완료한 lock을 사용한다.
  5. Azure Action은 action=upload, app_location=out, output_location="", api_location=build/game-api, skip_app_build=true, skip_api_build=true, production_branch=`github.event.repository.default_branch`. 임의 deployment_environment 없음. .github 실행 ref와 배포 source SHA가 다른 점을 명시적으로 유지한다. repo_token은 PR 댓글 기능이 필요 없으므로 생략 가능.
  6. 배포토큰은 upload step env로 주입하여 존재 여부를 값 출력 없이 검사한다. missing secret을 성공 skip하는 SKIP_DEPLOY_ON_MISSING_SECRETS=true는 금지. pipeline 어느 실패도 성공으로 덮지 않는다.
  7. summary에 공개 source SHA, workflow ref, manifest의 origin, 결과URL을 남긴다. 정적manifest를 웹에 노출할 필요는 없다. 토큰·서버 env dump·set-x 금지.
  8. 커밋될 소스만으로도 preflight가 성공하는지 확인한다. 별도 임시 worktree에 선행 Task 커밋과 본 Task에 선별할 파일 변경만 적용해 Node22 preflight를 실행한다. 원래 작업 트리의 다른 미커밋 게임/아트 파일이나 .env.local을 복사하지 않는다. 미커밋 사용자 변경에 의존하는 실패가 있으면 필요한 파일·이유를 설명하고 범위를 확정한 후 해결한다. 이 문제를 남긴 채 유료 SWA를 먼저 생성하지 않는다.
  9. Error & Exception Handling: workflow 기본branch 미등록/토큰미입력은 아직 T05 작업이며 T03 완료에 요구하지 않는다. YAML/소스검증 실패는 수정 후 관련 대역 재실행. 실제 dispatch로 테스트하지 않는다.
  10. State Transition & Return: 검증된 YAML과 로컬 검증 명령만 완성, Azure 쓰기0/GitHub 쓰기0. T04 리소스 생성으로 이동할 준비가 된다.

### I02. CI 테스트 집합과 workflow 검증

- Related Files:
  - `package.json` :: `test:cloud/test:workflow` — 실제 검증할 파일 목록 고정; modify
  - `scripts/game-workflow.test.mjs` :: `validateWorkflow cases` — 잘못된 workflow 거절; new

#### Details

- `test:cloud`는 `node --import tsx --test` 뒤 아래11개 기존 테스트를 명시한다: scripts/cloud-contracts.test.mjs, api-auth.test.mjs, api-session.test.mjs, api-save.test.mjs, api-ranking.test.mjs, cloud-auth.test.mjs, cloud-save-client.test.mjs, cloud-resume.test.mjs, cloud-game.test.mjs, ranking-ui.test.mjs, development-start.test.mjs. 각 경로에 scripts/ 접두사를 둔다. browser-*.mjs와 실제 Azure ps1은 glob으로 포함하지 않는다.
- `test:workflow="node --test scripts/game-workflow.test.mjs"`. 검사기 CLI는 계약위반마다 안전한 error code/name만 반환, exit1; 정상은 exit0.
- 테스트: manual-only, dev default, input shell injection 거절, default branch guard, SHA고정 이후 ref재checkout거절, 공개변수4개와 mode 매핑, server secret 격리, production 모드/manifest 검사, out+API 동시배포, skip빌드/runtime 계약, production_branch/ref 정합, missing secret skip금지, contents권한 최소값, concurrency 취소없음. fake YAML 문자열만으로 실행하고 실제 Actions 실행 안함.

## Acceptance Criteria

- [ ] 수동 workflow가 빌드/업로드 전에 전체 root audit를 high 기준으로 검사하며 검사 생략·실패 무시·dev 제외를 검증기가 거절한다. 기존 YAML fixture에 audit 단계 누락/`continue-on-error`/`--omit=dev` 거절 사례를 추가한다.
- [ ] 수동 workflow와 SHA/production 게이트 검사 완료.
- [ ] 배포 비밀 없이 모든 로컬 검사·preflight가 성공한다.
- [ ] 선행 커밋과 본 Task 변경만 담은 별도 checkout에서도 preflight가 성공하여 미커밋 사용자 파일 의존이 없다.
- [ ] 저장소 push·기본 브랜치 등록·workflow dispatch·SWA생성은 하지 않았다.

## Validation

- Node22에서 `npm.cmd audit --audit-level=high` → exit0. 개발 의존성 포함, 보통 경고는 로그에 남으며 통과와 구분한다.
- Node22에서 `npm.cmd run test:workflow`, `node scripts/check-game-workflow.mjs` → exit0.
- `npm.cmd run test:cloud`, `npm.cmd run test:release-config` → exit0.
- `npm.cmd run build:release -- --mode preflight`, `npm.cmd run check:release -- --mode preflight` → exit0.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run typecheck:api` → exit0.

## Commit Message

```text
ci(azure): Standard 수동 배포 workflow와 사전 검증

Plan: 2026-11-05-azure-standard-release
Phase: P01-standard-release
Task: T03-manual-workflow

- 기본 브랜치에서 확정 소스 SHA의 운영 산출물만 배포한다
- 공개 빌드 설정과 배포 비밀을 분리하고 로컬 계약을 검증한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- Actions pin 근거/로컬검증/한계: 실행 시 기록
- 실제 외부 쓰기:0
