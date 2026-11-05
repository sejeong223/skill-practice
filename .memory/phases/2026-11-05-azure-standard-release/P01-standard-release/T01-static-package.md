# Task: T01 로컬 정적 패키지와 빌드 모드 분리

## Status: pending

## Goal

Azure 리소스 없이 Next 프런트와 독립 Functions 패키지를 재현 가능하게 빌드하고, 로컬 검증용 산출물이 운영에 배포되지 않도록 모드를 구분한다.

## Decision Summary

- 선행 조건: [보안 수정 T01](../../2026-11-05-dependency-security-fix/P01-security/T01-dependency-patches.md)의 done/검증/커밋 확인. Next와 eslint-config-next16.4.5 및 수정된 sharp/source-map-js/zod 잠금 파일에서 시작한다. 보안 수정 전16.3.5로 정적 패키징을 먼저 완료하지 않는다.
- SWA Standard/관리형 Functions Node22, 로컬 준비 우선. 이 Task는 Azure/GitHub 쓰기·배포 없음. 기존 로그인·저장·랭킹 코드는 유지한다.
- 기존 작업 트리의 사용자 게임/아트 변경 보존, Task hunk만 선별 커밋. 테스트는 scripts/ 바로 아래, 결과는 이 Progress. 설치본 Next static-exports 가이드 먼저 읽기. computer-use 금지.

## Implementation

### I01. 정적 라우팅과 독립 API 패키지

- Related Files:
  - `next.config.ts` :: `nextConfig` — 현재 빈 설정에 export/trailingSlash/images 설정; modify
  - `public/staticwebapp.config.json` :: `platform/routes` — SWA 라우팅·헤더; new
  - `scripts/package-game-api.mjs` :: `packageGameApi` — 독립 API 배포 폴더; new
  - `scripts/build-game-api.mjs` :: `buildGameApi` — 공유 TS 번들 경계 검사; modify
  - `api/package.json`, `api/package-lock.json`, `api/host.json` :: `runtime package` — 복사 원본; read-only
  - `api/src/functions/game.ts` :: `GAME_ROUTES` — HTTP7개 등록; read-only
  - `src/app/auth/redirect/page.tsx`, `src/auth/msal.ts` :: `AuthRedirectPage/silentRedirectUri` — 기존 MSAL bridge; read-only
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` :: `Static exports` — 설치본 지침; read-only

#### Details

- **Signatures & Types**:
```ts
export async function packageGameApi(options: {
  sourceDir?: string; outputDir?: string; // defaults api, build/game-api
}): Promise<{ outputDir: string; entrypoint: string }>;
// nextConfig: output="export", trailingSlash=true, images.unoptimized=true
// api package: type="module", main="dist/functions/*.js", engines.node="22.x"
```
- **Data & Schema Fields**:
  - `out/`: index.html, auth/redirect/index.html, _next/, public assets, staticwebapp.config.json. `trailingSlash=true`가 bridge 디렉터리 정적 파일을 보장한다.
  - `build/game-api/`: host.json(`version:2.0`, http.routePrefix=api), package.json/package-lock.json, dist/functions/game.js, 운영 node_modules. 원본 API는 @azure/functions4.17.0, @azure/cosmos4.10.1, @azure/identity4.14.1, jose6.2.15.
  - static config: `platform.apiRuntime="node:22"`; `/auth/redirect/*`는 Cache-Control=no-store, Cross-Origin-Opener-Policy 빈 문자열(제거). `/api/*`는 rewrite/redirect/allowedRoles 없음. API no-store는 기존 api/src/http.ts 응답이 담당하며 globalHeaders만으로 보장하지 않는다. navigationFallback과401/403→HTML responseOverride 없음. API를 정적 index.html로 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: Node22에서 root/API lockfile 설치. Next 서버 route handler/server action을 새로 추가하지 않는다. Phaser의 기존 client boundary 유지.
  2. Core Processing: `build:api`는 api/src/functions/game.ts를 api/dist/functions/game.js로 esbuild bundle, node22/esm/packages external/sourcemap false. 공유 src/game/cloud 모듈은 번들에 포함, Phaser/React/MSAL과 실행 시 ../../src import는 금지. export한 함수 import가 즉시 빌드를 실행하지 않도록 CLI 진입 조건을 분리한다.
  3. packageGameApi는 realpath/정규화한 출력이 정확히 workspace/build/game-api 또는 그 내부임을 확인하고 링크·경로 탈출을 거절한다. 해당 출력만 갱신하며 원본 api/node_modules를 prune/delete하지 않는다. allowlist 파일만 복사 후 출력 폴더에서 `npm ci --omit=dev` 실행. Windows 로컬 패키지는 로컬 검증용이고 Linux CI에서 운영 패키지를 다시 만든다.
  4. Error & Exception Handling: 컴파일/의존성 설치 실패, 누락 main, 외부 소스 import, 경로 탈출은 exit1. 실제 secret/local.settings.json/.env/.map 또는 테스트 소스가 복사되면 실패. 실패 산출물은 배포 가능으로 표시하지 않는다.
  5. State Transition & Return: 정적 프런트와 부모 src 없이 로드 가능한 API 폴더 반환. Functions 등록7개는 bootstrap GET, session/acquire·heartbeat·release POST, save·reset POST, leaderboard GET이며 routePrefix=api와 중복시키지 않는다.

### I02. 빌드 모드·manifest·크기와 비밀 검사

- Related Files:
  - `scripts/build-game-release.mjs` :: `buildRelease` — 빌드 오케스트레이션; new
  - `scripts/check-game-release.mjs` :: `validateStaticOutput/validateApiPackage/validateRelease` — 배포 게이트; new
  - `scripts/release-config.test.mjs` :: `release tests` — 모드·경로·라우팅·경계 검증; new
  - `package.json`, `package-lock.json` :: `release scripts/serve` — 명령과 정적 서버; modify
  - `.gitignore`, `eslint.config.mjs` :: `generated output ignores` — 기존 out/build/api/dist ignore 확인; modify only if needed

#### Details

- **Signatures & Types**:
```ts
type ReleaseMode = "preflight" | "production";
interface ReleaseManifest {
  schemaVersion: 1; mode: ReleaseMode; sourceCommit: string; dirty: boolean;
  builtAt: string; swaOrigin: string; tenantId: string; webClientId: string; apiClientId: string;
  sku: "Standard"; apiRuntime: "node:22";
  static: { directory: "out"; files: number; bytes: number };
  api: { directory: "build/game-api"; entrypoint: "dist/functions/game.js" };
}
export async function buildRelease(options: { mode: ReleaseMode; env?: NodeJS.ProcessEnv }): Promise<ReleaseManifest>;
export async function validateStaticOutput(root: string): Promise<{ files: number; bytes: number }>;
export async function validateApiPackage(root: string): Promise<void>;
export async function validateRelease(options: { mode: ReleaseMode; expectedOrigin?: string }): Promise<ReleaseManifest>;
// CLI build/check: --mode preflight|production (default preflight)
```
- **Data & Schema Fields**:
  - Manifest `build/game-release.json`만 기록(웹 UI/정적 공개 파일에 넣지 않음). sourceCommit은 git rev-parse HEAD의40hex, builtAt ISO UTC, dirty는 tracked와 배포 관련 untracked 여부. preflight는 dirty 허용, production은 빌드 시작 시 깨끗한 checkout 필수. ignore된 .env.local이 production에 개입하면 실패.
  - 환경: `NEXT_PUBLIC_GAME_TENANT_ID=69c1e470-4528-435a-a1ae-de98e0aac738`, `NEXT_PUBLIC_GAME_WEB_CLIENT_ID=e467e8bc-c900-4d08-88be-7f0a5fce2474`, `NEXT_PUBLIC_GAME_API_CLIENT_ID=a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`, `NEXT_PUBLIC_GAME_MODE=cloud`, `NEXT_PUBLIC_GAME_REDIRECT_URI`.
  - preflight는 위 공개 ID+`http://localhost:3000/`를 명시 주입하고 현재 프로세스·.env.local의 값에 의존하지 않는다. 테스트 fixture에는 다른 구문 유효 UUID를 쓸 수 있다.
  - production은5개 공개 env를 명시 요구, 실제 UUID와 동일한지 확인. redirect는 `https://{실제}.azurestaticapps.net/` 루트로 search/hash/auth 없음, expectedOrigin과 동일. localhost/fixture/누락값 거절. 다음 Task가 실제 호스트를 제공한다.
  - `maxBytes=500000000`, `maxFiles=15000` 포함 경계. 문서의500MB를 보수적인 십진수 바이트로 해석. 파일 전체를 재귀 lstat 집계, symlink/junction 거절, source map/server config/secret 파일명 금지. 크기 검사는 public만 세지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 모드를 빌드 시작 전에 확정한다. 현재 환경에 서버용 GAME_COSMOS_CLIENT_SECRET가 있더라도 프런트 child env에 전달하지 않는다. 토큰·비밀 이름과 값은 로그에 출력하지 않는다.
  2. Core Processing: buildRelease가 Next build → buildGameApi → packageGameApi → 출력 검사 → manifest 원자적 저장 순서 실행. 실패 시 이전 manifest를 성공 결과로 재사용하지 않는다. Node 실행 파일과 npm 인자는 배열로 호출, 문자열 shell 조립 금지.
  3. `validateApiPackage`는 패키지 안에서 환경 비밀 없이 entrypoint를 import하고 @azure/functions 등록을 포착하여7개 method/route/authLevel anonymous를 확인한다(API가 직접 JWT 검증하므로 anonymous가 맞음). 패키지 main/lock/module/runtime/의존성·번들 import를 검사한다.
  4. `validateRelease`는 manifest 모드/SHA/환경과 실제 폴더/config/수치를 재계산한다. preflight manifest를 production으로 검사하면 실패. Browser JS/HTML에 서버 비밀 키 이름·테스트용 비밀 sentinel·서버 모듈이 포함되면 실패하되 값은 출력하지 않는다. 이 검사가 모든 가능한 비밀을 탐지한다는 주장은 하지 않는다.
  5. Error & Exception Handling: 빈 출력·없는 bridge·Phaser SSR·비밀 포함·용량 초과·production dirty/localhost는 exit1, manifest 성공 기록 없음. 수정 실패를 Azure 생성으로 우회하지 않는다.
  6. State Transition & Return: preflight 완료는 로컬 산출물 검증만 의미. 실제 로그인/API 연결 완료 아님. local serve는 /api를 호스팅하지 않아404가 정상이다.
- package scripts: `start="serve out -l 3000"`(serve devDependency로 설치 버전 정확히 pin; catch-all -s 금지); `build:release="node scripts/build-game-release.mjs"`; `check:release="node scripts/check-game-release.mjs"`; `test:release-config="node --test scripts/release-config.test.mjs"`. 변경된 lockfile 유지.
- 테스트: 500000000/15000 이하 통과·초과 실패(거대 실제 파일 대신 집계 포트), 출력경로 탈출·링크 거절, API 원본 deps 보존, 브라우저 secret sentinel, bridge/no-store/COOP 제거, API fallback 없음, production/preflight 모드·host·dirty 충돌, Functions7개 등록. 없는 자산404 정적 HTTP 확인은 Node fetch와 정적 서버로만 수행한다.

## Acceptance Criteria

- [ ] Node22에서 Azure 설정/비밀 없이 preflight 산출물과 manifest를 생성한다.
- [ ] bridge 정적 파일·API 독립 로드·Standard 크기·비밀 분리·production 거절 조건을 검증했다.
- [ ] 실제 Azure/GitHub 쓰기 없이 코드와 본 Task 진행만 선별 커밋한다.

## Validation

- Node22 PATH: `npx.cmd --yes --package=node@22 -- node --version` → v22.x. 이후 npm/npx도 같은 Node22 환경에서 실행.
- `npm.cmd run test:release-config` → exit0.
- `npm.cmd run build:release -- --mode preflight` 및 `npm.cmd run check:release -- --mode preflight` → exit0, manifest preflight.
- `npm.cmd run check:release -- --mode production` → preflight 산출물이므로 의도한 exit1; 테스트가 이 거절을 검증.
- `npm.cmd run typecheck:api`, `npx.cmd tsc --noEmit`, `npm.cmd run lint` → exit0.
- 브라우저 조작 없이 정적 서버 HTTP로 `/`, `/auth/redirect/` 200, 없는asset404 확인. 실제 로그인은 미검증 기록.

## Commit Message

```text
feat(release): Standard 정적 패키지와 빌드 모드 분리

Plan: 2026-11-05-azure-standard-release
Phase: P01-standard-release
Task: T01-static-package

- Next 정적 출력과 Node22 API 독립 패키지를 구성한다
- preflight와 production 산출물 및 크기·비밀 검사를 분리한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 실제 실행 명령/Node 버전/결과/한계: 실행 시 기록
- Azure/GitHub 쓰기: 없음 (본 Task 범위)
