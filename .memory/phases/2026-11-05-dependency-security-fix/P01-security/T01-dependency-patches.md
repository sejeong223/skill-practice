# Task: T01 심각·높음 의존성 갱신과 호환성 검증

## Status: done

## Goal

root의 next/sharp/source-map-js/zod 취약 버전을 갱신하여 전체 의존성 audit의 critical/high를0으로 만들고, Node22에서 기존 게임·로그인·저장·랭킹·이미지 처리·빌드를 검증한 잠금 파일을 다음 Standard 정적 패키징 Task에 넘긴다.

## Decision Summary

- 사용자 확정 범위는 심각·높음4개 패키지. 보통8개와 월드3 인트로는 후속 작업이며 Next/ESLint16 유지, API·게임 규칙 유지. Next/eslint-config-next를16.4.5로 맞춘다.
- computer-use 금지, Azure/GitHub 쓰기 없음. 사용자 미커밋 변경 보존. 검증 결과는 이 Task Progress, 새 테스트 폴더/test-plans 없음. 이 Task는 계획만 작성됐고 구현은 아직 시작하지 않았다.

## Implementation

### I01. 직접·간접 의존성을 수정 버전으로 해결

- Related Files:
  - `package.json` :: `dependencies.next`, `devDependencies.eslint-config-next` — 직접 버전 정합성; modify
  - `package-lock.json` :: `packages` — root 및 중첩 사본/플랫폼 패키지의 재현 버전·integrity; modify
  - `api/package.json`, `api/package-lock.json` :: `dependencies` — 독립 API 의존성, 이번 수정 대상 아님; read-only
  - `eslint.config.mjs` :: `eslintConfig` — core-web-vitals/typescript flat config와 기존 ignore 확인; read-only
  - `next.config.ts` :: `nextConfig` — 현재 빈 설정, 정적 export 변경은 다음 배포 Task; read-only
  - `node_modules/next/dist/docs/01-app/01-getting-started/18-upgrading.md` :: `Upgrading` — 갱신 전후 설치본 지침; read-only
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` :: `Static exports` — 다음 배포 방식 호환 확인; read-only

#### Details

- **Signatures & Types**: 새 앱 함수/API는 만들지 않는다. 변경할 manifest의 정확한 부분 스키마는 아래와 같다. 나머지 필드와 scripts는 유지한다.

```json
{
  "dependencies": { "next": "16.4.5" },
  "devDependencies": { "eslint-config-next": "16.4.5" }
}
```

- **Data & Schema Fields**:
  - root package: `dependencies.next:string`와 `devDependencies.eslint-config-next:string`은 필수/non-null/정확 버전 문자열. React/react-dom19.2.8, Phaser, Tone, MSAL 등 관련 없는 직접 버전은 유지한다.
  - lock: `lockfileVersion:number`, `packages:Record<string, PackageEntry>` 기존 형식 유지. `packages[""].dependencies/devDependencies`는 manifest와 일치해야 한다.
  - `PackageEntry.version:string`, `resolved?:string`, `integrity?:string`, `dependencies?:Record<string,string>`, `optionalDependencies?:Record<string,string>`, `dev?:boolean`, `optional?:boolean`은 npm이 생성한다. resolved/integrity를 손으로 조작하지 않는다.
  - 목표: next16.4.5/eslint-config-next16.4.5, sharp>=0.35.5 <0.36.0, source-map-js>=1.2.2 <2.0.0, zod>=4.6.6 <5.0.0. 실제 해결 버전과 중첩 설치 경로를 Progress에 기록한다.
  - 현재 sharp0.35.4는 Next optional dependency. Next16.4.5의 optionalDependencies.sharp는 `^0.35.5`다.
  - source-map-js1.2.1은 root PostCSS/Next 내부 PostCSS/@tailwindcss/node/css-tree가 `^1.2.1`로 요구한다. 이 모든 부모 경로에서 취약 사본을 없앤다.
  - zod4.6.5는 eslint-plugin-react-hooks7.1.1의 `^3.25.0 || ^4.0.0` 의존성으로 들어온다. 현재4.x를 유지해 수정 버전을 해결한다. 다른 경로의3.x가 발견되면 전역4.x override로 호환성을 무시하지 않는다.

- **Execution Flow / Logic**:
  1. Precondition & Validation: `git status --short`, root/API manifest와 lock의 diff를 기록한다. 이미 존재하는 게임·아트 변경을 되돌리거나 커밋에 섞지 않는다. Node22에서 아래 기존 검증의 기준 결과를 먼저 확보한다. 로컬 시스템은 계획 시점 Node24이므로 Node22 명령을 사용한다. Next 설치본 가이드를 읽는다.
  2. 변경 전 `npm.cmd audit --json`에서 날짜·패키지별 severity/via/nodes·총계를 기록한다. 계획 시 critical1/high3/moderate8; `npm audit`의 취약점 발견 exit1은 예상 결과다. registry/네트워크 오류를 취약점0으로 간주하지 않는다. `npm.cmd view next@16.4.5 version engines peerDependencies optionalDependencies --json`, `npm.cmd view eslint-config-next@16.4.5 version dependencies --json`으로 후보를 확인한다.
  3. root에서 `npm.cmd install --save-exact --package-lock-only --ignore-scripts next@16.4.5`, 이어서 `npm.cmd install --save-dev --save-exact --package-lock-only --ignore-scripts eslint-config-next@16.4.5`를 실행한다. 마지막에 `npm.cmd update sharp source-map-js zod --package-lock-only --ignore-scripts`로 부모 semver 범위 내 간접 의존성을 갱신한다. root에 Zod/source-map-js를 불필요한 직접 의존성으로 추가하지 않는다.
  4. manifest/lock diff와 모든 대상 중첩 사본을 확인한다. 잠금 파일을 삭제해 전체 재생성하거나 `npm update` 무인자 전체 갱신을 하지 않는다. Next의 @next/env/@next/swc 및 동일 버전 ESLint 플러그인 등 필수 하위 변경은 포함하고, unrelated package 이동은 필요한 원인을 설명한다. lock의 다른 OS 선택적 패키지를 임의 삭제하지 않는다.
  5. `npm.cmd ci`로 수정된 lock에서 실제 재설치한다. 최종 설치에서 `--ignore-scripts`, `--omit=optional`로 native sharp/SWC 로딩 문제를 숨기지 않는다. API 검증용 의존성은 기존 lock의 `npm.cmd ci --prefix api`로 설치하되 API manifest/lock이 변경되지 않았는지 확인한다.
  6. Error & Exception Handling: ERESOLVE/engine/native 모듈 오류, 대상 취약 사본 잔존, 신규 critical/high가 있으면 완료를 보류한다. 전체 강제 수정/`--force`/`--legacy-peer-deps`/Next15 하향/전역 major override로 우회하지 않는다. 현재 audit는 보통 경고에 eslint-config-next15.5.29 하향을 제시하므로 이를 적용하지 않는다. 범위를 벗어나는 직접 버전/major 변경이 필요하면 구체적 차이와 이유를 사용자에게 알린다.
  7. State Transition & Return: 실제 설치 트리와 lock의 대상 버전이 일치하고 root audit critical/high0인 상태로 I02 검증을 진행한다. 보통 경고는 별도 목록과 원인을 남긴다. 통과 전 Status는 done이 아니다.

### I02. 기존 동작 검증과 배포 계획 인계

- Related Files:
  - `scripts/cloud-contracts.test.mjs`, `scripts/api-auth.test.mjs`, `scripts/api-session.test.mjs`, `scripts/api-save.test.mjs`, `scripts/api-ranking.test.mjs` :: `node:test cases` — DTO·인증·세션·저장·랭킹; read-only
  - `scripts/cloud-auth.test.mjs`, `scripts/cloud-save-client.test.mjs`, `scripts/cloud-resume.test.mjs`, `scripts/cloud-game.test.mjs`, `scripts/ranking-ui.test.mjs`, `scripts/development-start.test.mjs` :: `node:test cases` — MSAL/React 클라이언트·이어하기·게임 진입·랭킹; read-only
  - `scripts/corgi-pirouette-art.test.mjs` :: `raw`, `node:test cases` — sharp로 실제 PNG 디코딩/알파/치수 검증; read-only
  - `scripts/build-game-api.mjs` :: `buildGameApi` — 기존 API 번들 검증; read-only
  - `.memory/phases/2026-11-05-dependency-security-fix/P01-security/T01-dependency-patches.md` :: `Progress` — 전후 audit·버전·검증·한계·커밋; modify
  - `.memory/phases/2026-11-05-dependency-security-fix/P01-security/phase.md`, `.memory/plans/2026-11-05-dependency-security-fix.md` :: `Status/Progress` — 완료1/1; modify
  - `.memory/current.md` :: `Active Plan/Phase/Task/Status/Next Step` — 기존 배포 계획으로 인계; modify

#### Details

- **Signatures & Types**: 기존 테스트와 앱 함수의 시그니처를 유지한다. 결과 기록은 `command:string`, `nodeVersion:string`, `exitCode:number`, `passed:number|null`, `failed:number|null`, `notes:string`의 정보를 Markdown으로 남긴다. 실행하지 않은 항목은 통과0으로 위장하지 않고 미실행으로 쓴다.
- **Data & Schema Fields**: audit 기록은 `critical:number`, `high:number`, `moderate:number`, `total:number`, `checkedAt:string`(실행 일시), `remainingPackages:string[]`를 포함한다. 비밀/토큰/실사용자 저장 문서는 기록하지 않는다.
- **Execution Flow / Logic**:
  1. 전체 root 검사에는 dev dependencies를 포함한다. `--omit=dev` 결과만으로 완료하면 Zod 경고를 놓친다. 전체와 생산용 audit 결과는 따로 기록하고 `--audit-level=high`로 남은 보통 경고와 실패 기준을 구분한다.
  2. 로그인 게이트/redirect/silent refresh, 계정 격리·세션 전환·클라우드 저장/이어하기, TOP10 진행도→데스→이름 정렬을 기존11개 테스트로 확인한다. 실제 Entra 로그인 성공 증거로 간주하지 않는다. 실서비스 검증은 기존 배포 T06에서 사용자가 수행한다.
  3. sharp는 src에서 직접 import하지 않아도 이미지 스크립트가 사용한다. 실제 PNG를 읽는 기존 아트 테스트를 실행한다. 스프라이트 제작 스크립트를 실행해 사용자 이미지 산출물을 덮어쓰지 않는다. CSS/source-map 호환은 Next build, Zod/ESLint 호환은 기존 lint로 검증한다.
  4. 로컬 Next build 성공을 정적 export/SWA 운영 검증으로 보고하지 않는다. 현재 next.config.ts는 빈 설정이며 export와 실제 배포 검사는 다음 Standard T01부터 구현한다. next/og/use cache/Server Actions/remotePatterns 사용이 없고 이미지에 unoptimized가 있어도 업데이트 검증을 생략하지 않는다.
  5. 새 lint/타입/테스트 실패가 발생하면 변경 전과 비교한다. 경고 suppress/테스트 삭제/기대값 완화로 통과시키지 않는다. 앱 코드 수정이 필요한 구체적 회귀는 파일·원인·필요 변경을 기록하고 청사진 범위를 먼저 조정한다. 기존 월드3 문제나 사용자 미커밋 아트 변경에서 온 실패를 보안 변경으로 임의 수정하지 않는다. 미해결 실패가 있으면 해당 검증 미통과를 명시하고 Task를 done으로 넘기지 않는다.
  6. 성공 후 이 Task의 Status/Progress, Phase1/1, Plan complete를 기록하고 관련 변경만 아래 한국어 메시지로 커밋한다. 전체 `git add .`/`git reset --hard`/사용자 파일 복원은 금지한다.
  7. current.md를 다음 값으로 바꾼다: Active Plan=`./plans/2026-11-05-azure-standard-release.md`; Active Phase=`./phases/2026-11-05-azure-standard-release/P01-standard-release/phase.md`; Active Task=`./phases/2026-11-05-azure-standard-release/P01-standard-release/T01-static-package.md`. 기존 배포 Phase는 in_progress/active T01, 완료0/6으로 전환한다. 보안 완료1/1과 commit/audit 결과를 current에 남긴다. 다음 행동은 Next 정적 출력·독립 API 패키지 로컬 구현이다.

## Acceptance Criteria

- [x] Next/eslint-config-next16.4.5가 일치하고 모든 sharp/source-map-js/zod 사본이 목표 범위에 있다. npm ls에서 invalid/missing 없음.
- [x] npm ci 이후 잠금 파일이 재현되며 root audit critical0/high0, 남은 보통 경고가 명시돼 있다.
- [x] Node22의 지정 lint/타입/클라우드11개/PNG 처리/Next·API 빌드가 통과한다. 전후 실패와 미확인 범위를 사실대로 기록한다.
- [x] API manifest/lock·사용자 게임/아트·DB/로그인/랭킹 계약을 불필요하게 바꾸지 않았다.
- [x] 관련 변경만 한국어 커밋하고 보안1/1 완료 후 기존 Standard 배포 T01로 포인터를 전진한다.

## Validation

아래는 구현 때 실행할 명령이다. Windows/PowerShell, 저장소 루트 기준. 현재 없는 `test:cloud`/`build:release` 스크립트를 이 Task에서 호출하지 않는다. Linux CI에서는 npm/npx에서 `.cmd`만 뺀다.

- `npx.cmd --yes --package=node@22 -- node --version` — v22.x. 아래 npm/npx/node 검증도 모두 같은 Node22 환경에서 실행한다. Windows의 npm.cmd는 옆에 있는 시스템 node.exe를 우선할 수 있으므로 PATH 래퍼만으로 npm 실행 버전을 보장하지 않는다. `npx.cmd --yes --package=node@22 -- node -p process.execPath`로 Node22 실행 파일을 찾은 뒤, npm 명령은 그 파일로 `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`를 직접 실행한다. child 명령용 PATH에도 해당 node.exe의 디렉터리를 앞에 둔다. npm 실제 위치가 다르면 Get-Command npm.cmd의 디렉터리 아래 node_modules/npm/bin/npm-cli.js를 사용한다.
- `npm.cmd ci`, `npm.cmd ci --prefix api` — exit0. 적용된 manifest/lock과 설치 트리가 동일, API lock 변경 없음.
- `npm.cmd ls next eslint-config-next sharp source-map-js zod --all` — exit0, 모든 부모 경로·실제 버전 기록. root 한 사본만 확인하지 않는다.
- `npm.cmd audit --json` — JSON의 critical/high0 확인, moderate와 남은 패키지 기록. 보통 잔존이면 이 명령 자체는 exit1일 수 있다.
- `npm.cmd audit --audit-level=high`, `npm.cmd audit --omit=dev --audit-level=high` — 둘 다 exit0. 전자가 필수이며 후자만으로 대체하지 않는다. registry 실패는 미확인/실패다.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run typecheck:api` — 각각 exit0. 설치 전 기준과 비교해 새 lint 규칙 오류 확인.
- `node --import tsx --test scripts/cloud-contracts.test.mjs scripts/api-auth.test.mjs scripts/api-session.test.mjs scripts/api-save.test.mjs scripts/api-ranking.test.mjs scripts/cloud-auth.test.mjs scripts/cloud-save-client.test.mjs scripts/cloud-resume.test.mjs scripts/cloud-game.test.mjs scripts/ranking-ui.test.mjs scripts/development-start.test.mjs` — 실패0, 실제 브라우저/Azure 호출 없음.
- `node --test scripts/corgi-pirouette-art.test.mjs` — 실패0, sharp PNG 디코딩과 치수/투명도 검사. 자산 생성 없음.
- `npm.cmd run build`, `npm.cmd run build:api` — 각각 exit0. 빌드 중 Next가 생성한 AGENTS.md 변경은 해당 설치본 지침에 따라 확인하며 무조건 삭제하지 않는다.
- `git diff --check`, `git diff -- package.json package-lock.json api/package.json api/package-lock.json` — 공백 오류 없음, API 변경 없음, 직접 버전/lock 정합성 검토. 기존 사용자 diff와 이번 수정분을 구분한다.

## Commit Message

```text
fix(deps): 심각·높음 의존성 취약점을 수정한다

Plan: 2026-11-05-dependency-security-fix
Phase: P01-security
Task: T01-dependency-patches

- Next와 린트 설정을 맞추고 취약한 간접 의존성을 갱신한다
- Node22 회귀 검증과 보안 재검사 후 Standard 배포 계획으로 연결한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `2aa6cbc`
- 2026-11-05 MEA 실행 시작. 기존 비메모리 변경91개 경로의 해시/삭제 상태를 `.git/mea-baseline-2026-11-05.json`에 보관했다. Node22.23.4로 변경 전 검증을 수행한다.
- 변경 전 기준 검증(Node22.23.4): 클라우드11개 파일159/159, PNG3/3, lint, root/API 타입 검사, Next16.3.5 build, API build 모두 exit0. root audit는 critical1/high3/moderate8이었다.
- 잠금 파일 갱신: Next/ESLint 설정16.4.5, sharp0.35.5/libvips1.3.4, source-map-js1.2.2, zod4.6.7. Zod는 부모의4.x 허용 범위 안에서 최신 수정 버전으로 해결됐다. 직접 의존성은 Next/ESLint 설정 두 항목만 바꿨다. sharp 하위 semver7.8.6과 npm이 보완한 기존 Tailwind WASM 선택적 의존성 경로도 lock에 포함됐으며 Tailwind 직접 버전은 유지했다.
- 계획 시 읽기 전용 확인(2026-11-05): critical1/high3/moderate8, next16.3.5/sharp0.35.4/source-map-js1.2.1/zod4.6.5. 수정 후보 배포 확인만 완료했으며 설치·코드 변경·검증 통과를 뜻하지 않는다.

- 최종 검증(2026-11-05, Node22.23.4/npm11.17.0): root/API clean ci, npm ls, lint, root/API TypeScript, 클라우드159/159, PNG3/3, Next16.4.5 build, API build 모두 성공. API manifest/lock 변경 없음. Windows npm.cmd 대신 Node22로 npm-cli.js를 직접 실행해 엔진을 고정했다.
- 최종 root audit: critical0/high0/moderate8/total8; 전체 및 omit=dev high 기준 검사 exit0. 운영 의존성 audit total0. 남은 패키지는 minimatch, @typescript-eslint/eslint-plugin/parser/type-utils/typescript-estree/utils, typescript-eslint, eslint-config-next. 보통 경고는 사용자 결정대로 후속 유지.
- 회귀 검증은 로컬 자동 검사이며 실제 Entra/SWA 검증은 아님. 기존 변경91개 경로 보존 확인. 강제 수정·major 하향·API 버전 변경·이미지 재생성·Azure/GitHub 쓰기 없음.
