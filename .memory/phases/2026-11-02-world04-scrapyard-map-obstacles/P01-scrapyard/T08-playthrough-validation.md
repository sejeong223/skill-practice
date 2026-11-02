# Task: T08 실제 통과 경로·재도전·회귀 검증

## Status: done

## Goal
월드 4의 네 일반맵을 기본 이동·점프·대시만으로 실제 통과할 수 있음을 확인하고, 숨은 함정·즉사·체크포인트·일시정지가 확정된 규칙대로 작동하도록 필요한 수치를 조정한다.

## Decision Summary
- 테스트 폴더나 test-plans 문서를 만들지 않는다. 검증 코드만 기존 scripts/ 아래에 두고 결과·조정 근거·미확인 항목은 이 Task의 Progress에 기록한다.
- 월드3 인트로 문제는 사용자 선택에 따라 별도 작업이다. 검증 편의를 위해 보스·인트로·개발 시작 설정·월드 선택 UI를 수정하지 않는다.

## Implementation

### I01. 독립 브라우저 검증 도구
- Related Files:
  - scripts/browser-world04-scrapyard.mjs :: main,connect,prepareStage,runRoute — new
  - scripts/world04-playthrough.test.mjs :: 경계·복원·입력 사례 — new
  - src/game/systems/World04HazardSystem.ts :: getDebugState — read-only
  - src/game/scenes/StageScene.ts :: 실제 Scene lifecycle — read-only, 오류 수정이 필요할 때만 modify
  - src/game/core/constants.ts :: createDefaultProgressState — read-only
  - src/game/persistence/saveTypes.ts :: PROGRESS_STORAGE_KEY — read-only

#### Details
- **Signatures & Types (CLI contract)**:
```typescript
// .mjs에서 구현할 타입 계약
interface BrowserOptions {
  url:string;                    // 기본 http://127.0.0.1:3000
  cdp:string;                    // 기본 http://127.0.0.1:9229
  screenshots:boolean;           // 기본 false
  launch:boolean;                // 기본 false, --launch이면 전용 Chrome 시작
  chromePath:string|null;        // --chrome으로 지정, 기본 null이면 아래 후보 확인
}
interface RouteInput {
  atMs:number;
  action:"left"|"right"|"jump"|"dash";
  pressed:boolean;
}
interface RouteCase {
  stageId:"world-04-stage-1"|"world-04-stage-2"|"world-04-stage-3"|"world-04-stage-4";
  name:string;
  prepareX:number;
  inputs:readonly RouteInput[];
  expected:"pass"|"death";
}
export async function main(options:BrowserOptions):Promise<void>;
```
- **Data & Schema Fields**: 위 옵션 필드는 모두 파싱 후 존재해야 한다. chromePath만 nullable이며 빈 문자열은 거절한다. RouteCase의 입력 시각은0이상의 유한수·오름차순이며 stageId/name/prepareX/inputs/expected는 모두 필수다.
- **Execution Flow / Logic**:
  1. 이미 존재하는 Node 내장 fetch/WebSocket으로 Chrome DevTools Protocol에 연결한다. 새 Playwright 패키지나 테스트 프레임워크를 추가하지 않는다. 연결 실패에는 cdp URL을 포함한 오류를 출력한다.
  2. 사용자 평소 브라우저의 진행 저장을 건드리지 않도록 별도의 검증용 Chrome 세션/프로필을 사용한다. --launch이면 chromePath 또는 PROGRAMFILES/Google/Chrome/Application/chrome.exe, LOCALAPPDATA/Google/Chrome/Application/chrome.exe 중 실제 존재하는 파일을 선택한다. 없으면 --chrome 경로를 요구하는 오류로 종료한다. os.tmpdir() 아래 mkdtemp로 브라우저 프로필만 만들고 spawn(executable,["--headless=new","--remote-debugging-port=9229","--user-data-dir="+profilePath,"--no-first-run",options.url],{windowsHide:true})로 실행한다. cdp URL의 포트를 파싱해 실제 launch 인수에 사용한다. headless가 아닌 눈으로 보는 검수는 전용 Chrome UI 세션에서 별도로 한다. 저장소에는 profile/screenshots/results 등의 검증 폴더를 만들지 않는다.
  3. cdp /json/list에서 지정 url의 전용 page를 선택하고 Runtime/Network/Page 이벤트를 수집한다. 요청 타임아웃10초,장면 대기30초를 두며 실패 시 열린 소켓과 누른 키를 finally에서 해제한다.
  4. 이 저장소 PhaserGame은 전역 game을 공개하지 않는다. 기존 로컬 검증 방식처럼 canvas.parentElement의 __reactFiber$ hook tree에서 current.scene.getScene을 가진 ref를 찾아 Phaser.Game을 얻는다. 이는 전용 검증 세션의 테스트 도구에서만 사용하며 프로덕션 전역 API를 추가하지 않는다. 못 찾으면 구조 오류로 중단한다.
  5. 테스트 메모리 progress는 createDefaultProgressState를 복제하고 onboardingCompleted=true,clearedStages에1~3월드 보스,unlockedSkills에 bark/bite/dash만 넣는다. 더블 점프·무적·추가 체력을 넣지 않는다. React 경제 상태의 참조를 유지하도록 registry progressState에 Object.assign으로 복제 값을 적용한 뒤 StageScene을 stageId/seed1로 시작한다. 실제 사용자 프로필/저장소를 수정하지 않는다.
  6. 각 사례 준비 시 player.resetTo({x:prepareX,y:504}),속도0,world04Hazards.resetForAttempt(prepareX),world04PreviousCenterX 동기화를 수행할 수 있다. 입력 시작 이후 텔레포트·스킬 쿨타임 강제 초기화·물리 비활성화는 금지다.
  7. Input.dispatchKeyEvent로 기본 ArrowLeft/ArrowRight/Space/Digit1 키의 down/up을 보낸다. Page의 실제 프레임 시간과 body 위치·사망 수·checkpoint·hazard debug를 읽어 판단한다.
  8. 각 맵의 전체 통과 사례는 prepareX=96에서 시작하고 출구까지 실제 입력으로만 진행한다. 중간 teleport로 출구에 도달한 결과를 클리어 검증으로 세지 않는다.
  9. --screenshots가 있을 때만 os.tmpdir()의 개별 world04-<stage>-<case>.png에 저장한다. JSON 결과는 stdout으로 내보내고 요약을 이 Task Progress에 복사한다. 별도 보고서/결과 디렉터리를 생성하지 않는다.
  10. Runtime.exceptionThrown,콘솔 error,asset404를 실패로 집계한다. 실행 후 눌린 키·테스트 Scene·소켓과 직접 시작한 Chrome child만 정리한다. 임시 프로필 삭제가 필요하면 실제 절대 경로가 os.tmpdir() 아래 이번 mkdtemp 결과와 일치하는지 확인한 뒤 같은 프로세스의 fs.rm으로 처리한다. 임의의 Chrome 프로세스나 사용자의 프로필을 종료/삭제하지 않는다.
- **Route authoring**: 아래 사례에 맞는 입력 시각을 실제 테스트에서 측정해 RouteCase 배열에 고정한다. 자동 물리 계산만으로 통과를 선언하지 않는다. 지연 허용 범위를 가진 위치 기반 준비 조건을 사용해 브라우저 스케줄링 오차와 함정 논리 실패를 구분한다.

### I02. 필수 사례와 초기 수치의 조정 범위
- Related Files:
  - scripts/world04-playthrough.test.mjs — new
  - src/game/data/world04Scrapyard.ts :: 배치/수치 — 필요한 경우 modify
  - src/game/systems/world04TerrainState.ts,world04GroundState.ts,world04AirState.ts — 확인된 결함만 modify
  - src/game/input/InputManager.ts :: DEFAULT_KEYBINDS,toKeybindMap — 실제 Phaser 숫자 키 정규화 오류 수정
  - src/game/systems/World04AirSystem.ts,World04GroundSystem.ts :: update,resetForAttempt — 대시 종료 프레임 판정 수정
  - src/game/systems/world04Geometry.ts :: overlapRect,segmentInRect — 부동소수점 경계 수정
  - src/game/scenes/StageScene.ts :: shutdown의 이전 gimmickSystem 참조 해제 — 재진입 오류 수정
  - scripts/keybind-migration.test.mjs — Phaser ONE 기대값 수정
  - scripts/world04-layout.test.mjs,world04-terrain.test.mjs,world04-ground.test.mjs,world04-air.test.mjs — 필요한 기대값/회귀 추가; modify

#### Details
| 사례 | 기대 결과 |
| --- | --- |
| 맵1~4 전체 진행 | 시작96→출구,더블 점프 없이 각각 최소1회 성공,최종4→기존 턱시도 보스 진입 |
| 대시 통로 | 기본 보행/점프 우회 실패,대시로 실제 몸 전체 통과 성공 |
| 무전조 상승 | 발동 전 그림·움직임·경고0,갑자기 앞판이 솟음,후퇴하여 생존 |
| 상승 실패 | 제자리/계속 전진/점프/전방 대시 각각 실패,대시 무적도 방어 불가 |
| 상승 재방문 | 내려온 뒤 같은 시도에 재작동0,사망 후 재도전에는 다시1회 |
| 꺼지는 바닥 | 접근 시 실제 구멍,점프 성공,놓치면 낙사,원래 통바닥 잔여0 |
| 타이어·기름·컨베이어 | 도약1회,공중 대시 착지 가능,제동/운반 변화,벗어나면 기본 제어 |
| 전기·추·톱 | 평상시 접촉 사망,대시 통과,투명 모서리·체인 접촉 생존 |
| 압축기·크레인 화물 | 대시 중에도 접촉 사망,안전한 순간/위치에서 통과 가능 |
| 압력판·문 | 제한 시간 통과,닫힐 때 끼면 사망,실패 후 다시 밟아 재시도 가능 |
| 체크포인트 | 깃발 이전 사망→96,이후 사망→2496,공중/대시 획득,복원 직후 안전 |
| pause/resume | 각 상승 단계·문 개방 중1초 정지에도 상태/남은 시간/그림이 그대로 |
| 사망·장면 반복 | 같은 프레임 사망1회,코인 경제 보존,재진입3회 후 collider/타이머 중복0 |
| 기존 월드 | 월드1·2·3 대표 장면과 월드4 보스의 지형/대시/보상 흐름 유지 |
| 화면 크기 | 1280×720과 좁은 화면에서 코기·위험·깃발 가림/자산누락 없음 |

- **Timing sensitivity**: 60fps 기본,30fps에서도 필수 통과/후퇴 사례를 확인한다. 상승 초기 반응700ms·앞판320px·뒤쪽80px는 실제 후퇴가 가능한지 검증한다. 바로 앞에서 전방 대시를 이미 시작한 잘못된 선택까지 반드시 구제할 필요는 없지만, 정상 달리기 진입 후 상황을 보고 후퇴하는 경로는 있어야 한다.
- **Allowed tuning**: 발판 간격/기계 주기/압력판 거리/작동 후 반응 시간. 변경 전후 값과 실패한 사례를 기록하고 T01 데이터 validator 및 관련 단위 테스트를 함께 수정한다.
- **Invariants**: 상승의 사전 경고0·후퇴만·1회성,사물7+3과별도바닥2,대시필수,위험분류,체크포인트1개,동일재도전패턴은 유지한다. 테스트를 통과시키려고 장애물 삭제/대시 무적 확대/더블 점프 해금을 하지 않는다.
- **Unit integration**: 실제 PlayerController와 상태 모듈을 사용해 브라우저에서 확인된 입력/주기 경계의 회귀 사례를 scripts/world04-playthrough.test.mjs에 추가한다. 가짜로 항상 성공하는 이동 모델이나 소스 문자열 검사만으로 통과를 판정하지 않는다.
- **Error handling**: 브라우저를 실행하지 못했거나 실제 통과가 확인되지 않으면 미검증을 명확히 남기고 Task를 done으로 표시하지 않는다. 테스트/빌드의 기존 unrelated 실패도 별도로 기록한다.

### I03. 사용자 지정 출력·커밋·메모리 정리
- Related Files:
  - .memory/phases/2026-11-02-world04-scrapyard-map-obstacles/P01-scrapyard/T08-playthrough-validation.md :: Progress — modify
  - .memory/phases/2026-11-02-world04-scrapyard-map-obstacles/P01-scrapyard/phase.md :: Progress — modify
  - .memory/plans/2026-11-02-world04-scrapyard-map-obstacles.md :: Progress — modify
  - .memory/current.md :: 완료 포인터 — modify

#### Details
- 검사 결과는 이 Task에 커맨드/exit code/브라우저 사례/조정 값/미확인 사항으로 기록한다. 별도 검증 문서나 폴더를 생성하지 않는다.
- 새 scripts 테스트/자동화 파일은 제품 변경의 검증 자산이므로 관련 파일과 함께 커밋한다. OS 임시 PNG/Chrome 프로필/빌드 산출물은 커밋하지 않는다.
- 모든 필수 검증을 실제로 마친 후 Task status done,8/8 완료,다음 Active Task 없음으로 정리한다. 이전 월드 계획을 자동으로 재개하지 않는다.

## Acceptance Criteria
- [x] 네 일반맵 전체의 실제 입력 통과와4→보스 연결이 확인된다.
- [x] 무전조·후퇴 전용·즉사·대시 예외·체크포인트 사례가 모두 검증된다.
- [x] 타입/린트/빌드/관련 회귀가 통과하고 남은 한계를 사실대로 기록한다.
- [x] 별도 테스트 폴더·test-plans 문서를 생성하지 않는다.
- [x] 기존 미커밋 작업과 제외한 인트로/보스/메뉴 기능을 임의로 변경하지 않는다.

## Validation
- node --experimental-strip-types --test scripts/world04-layout.test.mjs scripts/world04-background-assets.test.mjs scripts/world04-obstacle-assets.test.mjs scripts/world04-terrain.test.mjs scripts/world04-surface-motion.test.mjs scripts/world04-ground.test.mjs scripts/world04-air.test.mjs scripts/world04-runtime.test.mjs scripts/world04-campaign.test.mjs scripts/world04-playthrough.test.mjs — 전체 신규 검사.
- node --experimental-strip-types --test scripts/dash-movement.test.mjs scripts/dash-invulnerability.test.mjs scripts/world03-collapsing-floor.test.mjs scripts/world03-checkpoint-respawn.test.mjs scripts/world03-construction-stages.test.mjs scripts/world02-stage-hazards.test.mjs scripts/world01-box-open.test.mjs scripts/stage-progression.test.mjs scripts/boss-stage-content.test.mjs — 인접 회귀.
- node scripts/build-world04-backgrounds.mjs --check — 배경 재현성.
- node scripts/build-world04-obstacles.mjs --check — 사물 재현성.
- node scripts/validate-assets.mjs — 필수 자산.
- npx tsc --noEmit
- npm run lint
- npm run build
- npm run dev -- --hostname 127.0.0.1 — 실행 중인 같은 작업 서버가 없다면 별도 세션에서 시작한다. 이미 있으면 재사용한다.
- node scripts/browser-world04-scrapyard.mjs --url http://127.0.0.1:3000 --cdp http://127.0.0.1:9229 — 전용 Chrome 세션이 준비된 상태에서 실제 입력 검사. URL/포트가 다르면 실행 값을 Progress에 기록한다.
- node scripts/browser-world04-scrapyard.mjs --launch --url http://127.0.0.1:3000 --cdp http://127.0.0.1:9229 — 전용 세션이 없으면 임시 Chrome 프로필로 실행한다. 포트가 이미 다른 용도로 사용 중이면 기존 프로세스를 종료하지 않고 다른 포트를 명시한다.
- 최종 수치 수정 뒤에는 영향받는 사례와 자동 검증을 다시 실행한다. 변경 없는 검사를 이유 없이 반복하지 않는다.

## Commit Message
```text
test(world04): 고물상 통과 경로와 재도전 회귀 검증

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T08-playthrough-validation

- 실제 입력으로 네 맵과 후퇴 함정의 통과 경로 검증
- 재도전과 일시정지 및 기존 월드 회귀 확인과 수치 조정
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 식별자를 가진 커밋
- 완료일: 2026-11-02. 새 검증 파일은 기존 scripts/ 바로 아래에 두었고 별도 테스트 폴더·test-plans·보고서 파일을 만들지 않았다.

### 자동 검증 결과
- 다음 명령 exit 0, 61/61 통과: `node --experimental-strip-types --test scripts/world04-layout.test.mjs scripts/world04-background-assets.test.mjs scripts/world04-obstacle-assets.test.mjs scripts/world04-terrain.test.mjs scripts/world04-surface-motion.test.mjs scripts/world04-ground.test.mjs scripts/world04-air.test.mjs scripts/world04-runtime.test.mjs scripts/world04-campaign.test.mjs scripts/world04-playthrough.test.mjs scripts/keybind-migration.test.mjs scripts/dash-movement.test.mjs scripts/dash-invulnerability.test.mjs scripts/world03-collapsing-floor.test.mjs scripts/world03-checkpoint-respawn.test.mjs scripts/world03-construction-stages.test.mjs scripts/world02-stage-hazards.test.mjs scripts/world01-box-open.test.mjs scripts/stage-progression.test.mjs scripts/boss-stage-content.test.mjs`.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 exit 0. Next 16.3.5 프로덕션 정적 페이지 생성 완료.
- `node scripts/build-world04-backgrounds.mjs --check`: exit 0, 9개 일치. `node scripts/build-world04-obstacles.mjs --check`: exit 0, 14개 일치. `node scripts/validate-assets.mjs`: exit 0, 209개 항목/필수 194개 통과.

### 실제 Chrome 입력 검증
- 다른 프로젝트가 사용 중인 3000 대신 이 저장소 서버 `http://127.0.0.1:3005`를 사용했다. 전용 임시 Chrome 프로필과 CDP 9229를 사용했으며 실제 사용자 저장은 변경하지 않았다.
- 최종 실행: `node scripts/browser-world04-scrapyard.mjs --launch --url http://127.0.0.1:3005 --cdp http://127.0.0.1:9229 --screenshots` — exit 0. 전체 경로 4개 + 회귀 31사례, 총 35사례 통과. Runtime/콘솔 오류 0, 누락 자산 0.
- 각 전체 경로는 x96에서 출구까지 ArrowLeft/ArrowRight/Space/Digit1 입력만 사용했다. 시작 이후 위치 이동·쿨타임 초기화·물리 조작 없이 모두 사망 0회, 체크포인트 획득, 다음 맵 연결 성공. 맵별 입력 이벤트 40/50/48/46개, 관측 60/59/59/59fps. 맵 4는 기존 world-04-stage-boss로 진입했다. 더블 점프 미해금 상태다.
- 저프레임 실행: `node scripts/browser-world04-scrapyard.mjs --launch --url http://127.0.0.1:3005 --cdp http://127.0.0.1:9229 --stage 1 --fps 30 --screenshots` — exit 0. Phaser 루프 목표 30fps(전체 경로 관측 약 28fps), 물리 수치 그대로 맵 1 전체 통과·상승 후퇴·체크포인트·다음 맵 진입 성공, 사망 0회.
- 무전조 상승: 발동 직전 앞판 이미지가 보이지 않음. 제자리/전진/점프/전방 대시는 각각 사망 1회, 후퇴는 생존. retreat/strike/lowering 각 단계에서 1초 pause 중 모든 장치 시간·그림 위치 불변. 소진 후 왕복 재발동 없음, 사망 복원 시 armed.
- 대시 통로: 보행·점프 실패, 대시로 몸 전체 통과 성공. 타이어 도약 후 톱·추에 일반 접촉 시 사망, 대시 회피 성공. 톱·추의 AABB 모서리에만 닿고 실제 원 밖인 경우 생존. 크레인 화물·압축기는 대시 중에도 사망.
- 꺼지는 바닥: 실제 bridge body 비활성화 및 낙사 확인. 사라진 바닥 위 점프·공중 대시 착지 성공. 압력판 문은 시간제 통과·닫힐 때 압사·시간 초과 후 재무장·재개방·pause 상태 보존 확인.
- 체크포인트: 공중 대시로 획득한 뒤 사망하면 x2496 복원, 이전 사망은 x96 복원. 같은 프레임 사망 중복 없음, 누적 코인 3개 유지. 기름 제동 거리 약 80.96px(일반 15.17px), 컨베이어 역방향 150px/s·순방향 330px/s·공중 240px/s, 타이어 이탈 후 재접촉 시에만 다시 발사됨.
- 기존 월드 1·2·3 첫 일반맵과 월드 4 보스: 각각 진입·이동·사망 0회, 월드 4 일반맵 owner 없음. 장면 재진입 3회 collider 수 26/26/26, 활성 타이머 0/0/0, preupdate listener 4/4/4로 일정.
- 1280×720과 768×720 캡처에서 코기·깃발·바닥의 가림과 자산 누락 없음을 확인했다. 캡처는 OS 임시 폴더의 `world04-checkpoint-wide.png`, `world04-checkpoint-narrow.png`, `world04-world-04-stage-<1..4>-exit-60fps.png` 등에만 저장했다.
- 국소 회귀의 준비 조건: 꺼짐 회피 사례는 해당 셀에서 5.4초 기다린 상태로 공중 기계 시간을 준비했고, 투명 모서리 사례는 원 밖 높이로 위치를 준비했다. 이는 전체 경로 통과 증거와 구분한다. 전체 경로는 시작 이후 기계 시간을 수정하지 않았다.

### 실제 실패에 근거한 수정과 최종 수치
| 항목 | 변경 전 → 후 | 근거 |
| --- | --- | --- |
| 대시 숫자 키 | Phaser 키 이름 `1` → `ONE`; 저장 Digit0~9도 영문 상수로 정규화 | 실제 Digit1 입력이 대시를 발생시키지 않았음. 실제 Phaser KeyCodes 49 회귀 추가 |
| 장면 재사용 | 파괴한 gimmickSystem 참조 유지 → 즉시 undefined | 월드 3에서 월드 4로 전환 시 파괴된 이전 장치 update 접근 방지 |
| 경계 접촉 | 정확 비교 → 1e-7px 오차 허용 | 발판/고철 모서리에만 닿은 부동소수점 오차가 사망으로 판정됨 |
| 대시 종료 프레임 | 이전 보호 구간까지 충돌 sweep → 공격 위험은 현재 접촉만 확인 | 현재 몸은 톱 밖인데 보호받던 이전 위치 때문에 사망. 압사/물리 충돌은 계속 sweep 유지 |
| 대시 통로 천장 | 폭 192 → 160px | 출구 직후 고철을 넘을 점프 상승 거리 확보 |
| 기름 전기 통로 천장 | 폭 192 → 128px | 출구 점프의 머리 충돌 제거, 전기 통과 대시 요구 유지 |
| 긴 꺼짐 셀 고철 | 셀 내부 x448 → 464 | 착지 직후 고철 모서리 충돌을 피할 공간 확보 |
| 압축기 앞 벨트 | 폭 160 → 112px | 벨트 밖 대기 공간 80px 확보; 이미지도 실제 벨트/기름 폭에 맞춤 |
| 긴 압축기 셀 고철 | 셀 내부 x464 → 488 | 압축기 통과 뒤 상승 거리 확보 |
| 체크포인트 접근 고철 | x2240 → 2288 | 크레인 뒤 점프 가능 거리 확보 |
| 접근 톱 왕복 | x2224~2296 → 2272~2344 | 고철과 맞춘 시점 선택 경로 확보 |
| 맵 4 접근 벨트 | x2184/폭128 → x2224/폭88 | 크레인 뒤 정지 공간 확보, 끝 x2312 유지 |
- 장애물을 삭제하지 않았고 개수는 22/24/26/27개다. 이동·점프·대시·장치 주기·상승 반응 700ms는 유지했다. 점프/후퇴/대시/정지 타이밍을 조합해야 하는 구조를 실제 통과 경로로 확인했다.

### 학습 노트와 남은 범위
- 대시 종료는 물리 이동이 일어난 프레임과 무적 종료 시점을 함께 봐야 한다. 전 프레임의 보호 구간을 다음 프레임에 소급해서 공격 피해로 처리하면 정상 통과도 실패한다. Scene 재사용 때 destroy 이후 참조도 비워야 다른 맵의 update에 잔류하지 않는다.
- 검증 도구는 위치·장치 단계에 맞춰 키를 누르며 실제 프레임 2개 이상 입력을 유지한다. 30fps에서 프레임 1개만 기다리면 브라우저 입력 전달과 Scene 갱신 순서에 따라 눌림이 누락될 수 있다.
- 기존 미커밋 사망 오버레이 중 QA가 Scene을 강제로 중단하면 기존 shutdown의 physics.world.resume 접근 오류가 있었다. 검증 도구는 정상 900ms 사망 연출 종료 후 다음 사례로 넘어간다. 사용자 작업 중인 오버레이 코드는 이번 커밋에 포함하거나 수정하지 않았다. 정상 재진입 3회는 위와 같이 검증했다.
- 월드 3 인트로 자동 진행 중단은 사용자 결정대로 별도 후속이다. 월드 1~3·보스의 전체 재클리어, 실제 모바일 터치·스피커 청음은 이번 검증 범위가 아니다. 기존 월드의 인접 자동 회귀 및 대표 장면 진입·이동은 통과했다.
- 기존 dirty 파일은 보존하며 StageScene은 이번 참조 해제 한 줄만 부분 스테이징한다. 이미지 생성 방식·참조·프롬프트·산출물은 T02/T03 Progress에 기록되어 있다.

