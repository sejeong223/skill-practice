# Task: T02 Next 정적 내보내기와 Functions 배포 산출물

## Status: pending

## Goal

정적 프런트와 독립 Functions 패키지를 재현 가능하게 만들고 SWA Free 크기·라우팅·비밀 분리를 검증한다.

## Decision Summary

- Next서버가필요없는out와api배포묶음. 사전빌드skip옵션을사용하여managed API 빌드가부모src를찾지못하는문제를피한다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 실행 구성과 외부 연동

- Related Files:
  - `next.config.ts` :: `output export, images.unoptimized` — 준비·배포·검증 대상; modify
  - `public/staticwebapp.config.json` :: `runtime and routes` — 준비·배포·검증 대상; new
  - `scripts/package-game-api.mjs` :: `packageGameApi` — 준비·배포·검증 대상; new
  - `scripts/check-game-release.mjs` :: `validateStaticOutput, validateApiPackage` — 준비·배포·검증 대상; new
  - `scripts/build-game-api.mjs` :: `esbuild output validation` — 준비·배포·검증 대상; modify
  - `package.json` :: `start, build:release, check:release, test:release-config` — 준비·배포·검증 대상; modify
  - `package-lock.json` :: `static server test dependency if needed` — 준비·배포·검증 대상; modify
  - `.gitignore` :: `deployment output and local settings` — 준비·배포·검증 대상; modify
  - `eslint.config.mjs` :: `generated deployment output ignore` — 준비·배포·검증 대상; modify
  - `src/app/page.tsx` :: `static client boundary` — 준비·배포·검증 대상; read-only
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` :: `installed guide` — 준비·배포·검증 대상; read-only

#### Details

- **Signatures & Types**:
```ts
// scripts/package-game-api.mjs
export async function packageGameApi({sourceDir,outputDir}:{sourceDir:string;outputDir:string}):Promise<void>;
// scripts/check-game-release.mjs
export async function validateStaticOutput(root:string):Promise<{files:number;bytes:number}>;
export async function validateApiPackage(root:string):Promise<void>;
// next.config.ts: {output:"export",images:{unoptimized:true}}

```

- **Data & Schema Fields**:

- Subscription=`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, RG=`grill-me-edu`, 기존 Cosmos=`maze-rescue-ms-b7af62a9`.
- 새 DB=`legendary-rib-corgi`, container=`game-data`, partition=/playerId, 컨테이너 전용 manual400 RU/s, database throughput 없음. Existing freeTier=true/총3400RU/s/KoreaCentral/모든네트워크는 사용자 확인값이며 preflight에서 실제값을 재확인한다.
- 다른DB·컨테이너·계정지역·방화벽·auth·freeTier·account throughput limit 변경 금지. account key 사용 금지. 처리량상한이막으면자동증가하지않는다. 대상구독을조회못하면다른구독대체금지.
- SWA=`legendary-rib-corgi` Free, 관리형 Functions Node22. 지원 아시아 API지역 확인 필요. managed identity/KeyVault참조/별도AppService 미사용.

- Static artifact=`out/`; API artifact=`build/game-api/`의 host.json, package.json/package-lock.json, dist/functions/game.js, node_modules(운영 의존성).
- build/game-api/package.json main=dist/functions/*.js, type=module, engines.node=22.x. build/는ignore.
- public/staticwebapp.config.json: platform.apiRuntime="node:22"; /api/* Cache-Control=no-store; 불필요한SPA전역rewrite 없음(앱은루트경로와redirect루트사용). 모든 /api 요청은 API로가야하며 index.htmlfallback 금지.
- 정적자산은공개; MSAL API토큰검증이데이터보호. SWA allowedRoles=["authenticated"]는사용하지않음(MSAL세션은플랫폼세션아님). custom auth/provider비밀없음.


- **Execution Flow / Logic**:

1. Precondition & Validation: 설치본Next static export가이드와현재next/image사용확인. 별도Nextroute handler/server action/middleware/쿠키요청의존추가금지. 사용자확인된공개Entra값으로빌드하되 테스트에서는구문유효한dummy ID를주입하고실제인증성공으로간주하지않음.
2. Core Processing:
   - next.config output=export, images.unoptimized=true(기존Image개별unoptimized와호환). next build가out생성. start는next start가정적export에서동작하지않으므로 `npx --no-install serve out -l 3000`로변경하고serve를rootdev에고정. -s catchall은API404까지HTML로숨길수있어사용하지않음.
   - public 설정은outroot에복사됐는지확인. 런타임node:22명시,Static/Function요청기본분리. loginredirect는root이므로새routingfallback설정필요없음; 자산없는URL은정상404.
   - root build:release=`npm run build && npm run build:api && node scripts/package-game-api.mjs && node scripts/check-game-release.mjs`; check:release=node scripts/check-game-release.mjs. Node22에서실행.
   - packageGameApi는실제절대경로output이workspace/build/game-api안인지검증후그경로만생성/갱신. 원본api/src나작업트리삭제금지. host/package/lock/dist를copy하고별도output안에서npm ci --omit=dev로Linux runner용runtime node_modules설치. 원본api/node_modules에서운영용prune하지않아localtests손상방지. api/local.settings.json/.env/test/source map의비밀파일은포함하지않음.
   - API esbuild가root공유모듈을bundle했는지검사. output에../../src 같은실행import가남거나Phaser/React/MSAL서버dependency가있으면실패. Functions등록코드를실제 import하여 app.http 발견,서버env없는상태에서secret읽기/log노출없음.
   - Static 검사: 전체out byte≤262144000(250MiB한도),file count≤15000, config존재/내용일치. public만세지않음. 브라우저JS에GAME_COSMOS_CLIENT_SECRET/서버credential패턴·api서버소스가없는지검사(비밀실제값을로그하지않음). config/manifest는공개값만.
   - release manifest는sourceCommit/buildtime/publicSwaHost를기록하는build/game-release.json. 실제게임UI에git정보표시하지않음.
3. Error & Exception Handling: 빌드/크기초과/SSR Phaser import/설정누락은배포전실패. 제한초과시자동SWAStandard상향없음. .env.local/APIlocalsettings는ignored검사. API루트를유효한앱으로인식하지못하면해결전배포완료로기록하지않음.
4. State Transition & Return: out와build/game-api를GitHub배포Action에그대로넘길수있는상태. 로컬정적serve는/api를호스팅하지않음; 실제연동은SWA배포검증으로완료하며로컬401/404를DB문제로오인하지않는다.

### I02. 실행 전후 검증

- Related Files:
  - `scripts/release-config.test.mjs` :: `node:test cases` — 외부 부작용 없는 설정·계약 검증; new

#### Details

- staticconfigapiRuntime/routeguard, outputpath탈출거절,serverlocalsettings비포함,원본node_modules보존,250MiB/15000 경계, API순수bundleimport, 없는asset/API가index.html로대체되지않는배포HTTP검사입력준비.
- 새 리소스·실제배포·실제로그인 확인은 대역 결과와 구분하여 Progress에 기록한다.
- `<...>` 값은 본 Task에서 확보한 공개 식별자·URL·run ID로 치환한다. secret을 명령행 문자열에 직접 넣거나 문서에 기록하지 않는다.
- 실행 권한/사용자 수동 입력이 없으면 정확한 미완료 항목을 남기고 포인터를 다음 Task로 넘기지 않는다.

## Acceptance Criteria

- [ ] SWA용정적산출물과독립API패키지가한명령으로재현된다.
- [ ] 출력크기·Node런타임·라우팅·비밀분리를검증했다.
- [ ] 아래 검증 결과·실제 리소스 상태·필요한 사용자 확인을 기록한다.

## Validation

- `node --test scripts/release-config.test.mjs` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run build:release` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run check:release` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run typecheck:api` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npx tsc --noEmit` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run lint` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.

## Commit Message

```text
feat(azure): Next 정적 내보내기와 Functions 배포 산출물

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P03-azure-release
Task: T02-static-package

- 정적 프런트와 독립 Functions 패키지를 재현 가능하게 만들고 SWA Free 크기·라우팅·비밀 분리를 검증한다.
- 대상 리소스 보존과 실행 검증 결과를 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 공개 식별자·실행 URL·source SHA·검증 결과: 실행 시 기록
- 사용자 수동 확인/미완료 입력: 실행 시 기록

