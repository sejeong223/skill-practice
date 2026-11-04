# Task: T04 실제 인증·기기 전환·데이터 격리 검증

## Status: pending

## Goal

실제배포에서계정격리·저장복구·TOP10·기기이어하기를확인하고검증결과와제한을남긴다.

## Decision Summary

- CLI/HTTP/API자동검사와사용자수동게임확인을조합. computer-use금지,미확인항목을추정통과하지않는다.
- 이전 구현 Task가 있는 경우 그 산출물을 전제로 하되 아래 계약만으로 작업 범위를 판단한다. 현재 작업 트리의 기존 변경은 보존하고 본 Task hunk만 선별 커밋한다.
- 구현 전 Next 관련 변경은 설치본 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`와 관련 가이드를 읽는다. computer-use/자동 UI 조작 금지; 필요하면 사용자에게 수동 확인 경로를 안내한다.
- 테스트는 기존 `scripts/` 바로 아래, 결과는 이 파일 Progress. 별도 tests/ 및 .memory/test-plans 금지. 미실행 외부 확인은 통과로 쓰지 않는다.

## Implementation

### I01. 실행 구성과 외부 연동

- Related Files:
  - `scripts/cloud-release-smoke.mjs` :: `runHttpSmoke, runCosmosSmoke` — 준비·배포·검증 대상; new
  - `scripts/cloud-regression.test.mjs` :: `cross-layer contract regression` — 준비·배포·검증 대상; new
  - `package.json` :: `test:cloud, smoke:cloud` — 준비·배포·검증 대상; modify
  - `.memory/phases/2026-11-04-entra-login-cloud-save-leaderboard/P03-azure-release/T04-release-validation.md` :: `Progress: evidence and manual check list` — 준비·배포·검증 대상; modify
  - `src/game/cloud/contracts.ts` :: `shared contract` — 준비·배포·검증 대상; read-only
  - `api/src/services/save.ts` :: `save/reset service` — 준비·배포·검증 대상; read-only
  - `api/src/services/session.ts` :: `fencing` — 준비·배포·검증 대상; read-only
  - `src/game/persistence/cloud/CloudSaveCoordinator.ts` :: `retry and cache` — 준비·배포·검증 대상; read-only

#### Details

- **Signatures & Types**:
```ts
export async function runHttpSmoke(baseUrl:string):Promise<{passed:string[];failed:string[]}>;
export async function runCosmosSmoke(config:ServerConfig):Promise<{passed:string[];failed:string[]}>;
// CLI: --base-url <SWA URL> [--cosmos]
// 서버비밀은ignored local config/환경에서만읽고출력하지않음.
```

- **Data & Schema Fields**:

- Subscription=`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`, RG=`grill-me-edu`, 기존 Cosmos=`maze-rescue-ms-b7af62a9`.
- 새 DB=`legendary-rib-corgi`, container=`game-data`, partition=/playerId, 컨테이너 전용 manual400 RU/s, database throughput 없음. Existing freeTier=true/총3400RU/s/KoreaCentral/모든네트워크는 사용자 확인값이며 preflight에서 실제값을 재확인한다.
- 다른DB·컨테이너·계정지역·방화벽·auth·freeTier·account throughput limit 변경 금지. account key 사용 금지. 처리량상한이막으면자동증가하지않는다. 대상구독을조회못하면다른구독대체금지.
- SWA=`legendary-rib-corgi` Free, 관리형 Functions Node22. 지원 아시아 API지역 확인 필요. managed identity/KeyVault참조/별도AppService 미사용.

- 자동smoke결과는caseID/status/evidence만,token·secret·타인의progress없음.
- 실제testpartition=서버testnamespace+테스트용UUID oid,생성문서ID목록을명시추적. 직접SDK검증fixture는eligible=false. 운영prod파트삭제/업서트금지.
- 수동확인표는이Task Progress안에case/사용계정별칭(실명없음)/기기A·B/결과/시각/증거메모. 비밀번호/액세스토큰/계정원문저장은요구하지않음.


- **Execution Flow / Logic**:

1. Precondition & Validation: 실제SWA URL과source SHA/P03완료값,노출된환경에동일게임API가연결됨확인. 사용자수동확인이필요한시점에한번에과도한질문대신관련동작묶음으로단계를안내. 계정/로그인정보를대신입력하지않음.
2. Core Processing:
   - HTTP: root200/html,JS/이미지assets200, 없는asset404,미인증/API위조Bearer→401/403 JSON(no-store), /api/game/bootstrap이index.html로fallback되지않음,localsettings/env/서버dist 공개경로404,API500stack비밀누출0.
   - 실제Cosmos SDK:게임전용서비스주체credential로고정DBread/배치save가능;작은testnamespace문서로원자적batch·412rollback·중복receipt·leasefence·resetbest보존확인. account전체DB열거는권한거절(403)이어야하며성공하면범위과다로실패처리;다른사람data문서조회없음. 이검사는직접SDK이며실제사용자API로그인검증과구분.
   - SDK 테스트 데이터를 정리할 때는 이번 실행에서 생성한 test playerId+docID 목록을 확인한 뒤 해당 문서만 point delete한다. 컨테이너·DB·namespace 전체 삭제는 금지한다. 실패하면 남은 테스트 문서 수와 안전한 재시도 방법을 기록하고 운영 데이터를 변경하지 않는다.
   - 사용자수동A: 실제조직멤버로그인→W1새게임(legacy저장미이전)→닉네임/coins/구매/그림판/keybind 저장→실제CP및death기록→랭킹순위·데스·위치확인. 초대guest가능하면별도확인;미초대다른tenant접근거절은실제계정이없으면자동auth음성검증과구분해미확인표기.
   - 사용자수동B: 같은계정다른브라우저/기기접속시자동탈취안함→여기서이어하기→A정지/B에서서버확정CP재개→A재전송거절. 다른계정은독립새저장. 복원된CP가새best를만들지않음.
   - 사용자수동장애: 네트워크offline→진행정지·메뉴닫기/Escape로풀리지않음→online저장확정후재개;토큰만료재로그인;CP저장Ack직후browserreload/보스중종료에서해당worldCP/없으면시작. 초기화는새run진행/보유품/death초기화,최고기록/닉네임보존. 사용자가의도한테스트계정에서수행하며실제운영기록임의초기화금지.
   - 랭킹:동점경계150명/Korean정렬·TOP10은자동테스트로재현하고실제공용DB에가짜prod점수를넣지않음. 배포UI는실제등록행/빈결과/실패재시도,320px/키보드focus를사용자가확인. 개발local-devW4에서운영저장/랭킹요청0.
   - 정상W1플레이부터실제완주가장시간필요하면본Task를완료로포장하지않고사용자확인진행을기록. 기존월드3인트로문제가확인을막으면원래별도범위를설명하고자동해결Task를추가하지않음.
   - root test:cloud는신규cloud/API/unit/DOM테스트목록을명시실행;모든기존브라우저스크립트실행명령을넣지않음. 관련기존stage/development회귀도실행.
3. Error & Exception Handling: actual권한/토큰/리소스오류는해당P01/P02/P03구현파일을최소수정후관련검증재실행. 수동미응답은성공아님. 치트완전방지/모든월드완주/모든기기호환을증거없이주장하지않는다.
4. State Transition & Return: 필수항목증거완료후Task done,phase3 4/4,전체14/14,current Active Task없음/계획완료. 전체URL/성공SHA/검증범위/남은원래별도문제를사용자에게보고. 과거미완료계획자동재개금지.

### I02. 실행 전후 검증

- Related Files:
  - `scripts/cloud-regression.test.mjs` :: `node:test cases` — 외부 부작용 없는 설정·계약 검증; new

#### Details

- 실제HTTP라우팅,제한된Cosmosidentity,batch실패원자성,같은account다중writer,identity별namespace,best와reset,클라이언트retry의서버idempotency. dryrun fixture이외운영게임data조작없음.
- 새 리소스·실제배포·실제로그인 확인은 대역 결과와 구분하여 Progress에 기록한다.
- `<...>` 값은 본 Task에서 확보한 공개 식별자·URL·run ID로 치환한다. secret을 명령행 문자열에 직접 넣거나 문서에 기록하지 않는다.
- 실행 권한/사용자 수동 입력이 없으면 정확한 미완료 항목을 남기고 포인터를 다음 Task로 넘기지 않는다.

## Acceptance Criteria

- [ ] 필수실제인증/기기전환/복구/랭킹확인증거를각각기록했다.
- [ ] 다른DB및계정설정보존,secret미노출,운영데이터임의변경없음을확인했다.
- [ ] 아래 검증 결과·실제 리소스 상태·필요한 사용자 확인을 기록한다.

## Validation

- `npm run test:cloud` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run build:release` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `node scripts/cloud-release-smoke.mjs --base-url <실제SWA URL>` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `node scripts/cloud-release-smoke.mjs --base-url <실제SWA URL> --cosmos` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run lint` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npx tsc --noEmit` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.
- `npm run typecheck:api` — exit 0; 설정·산출물·대상 리소스/실제 실행 결과가 청사진과 일치.

## Commit Message

```text
test(azure): 실제 인증·기기 전환·데이터 격리 검증

Plan: 2026-11-04-entra-login-cloud-save-leaderboard
Phase: P03-azure-release
Task: T04-release-validation

- 실제배포에서계정격리·저장복구·TOP10·기기이어하기를확인하고검증결과와제한을남긴다.
- 대상 리소스 보존과 실행 검증 결과를 기록한다
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 공개 식별자·실행 URL·source SHA·검증 결과: 실행 시 기록
- 사용자 수동 확인/미완료 입력: 실행 시 기록

