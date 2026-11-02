# Task: T08 실제 통과 경로·재도전·회귀 검증

## Status: pending

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
  5. 테스트 메모리 progress는 createDefaultProgressState를 복제하고 onboardingCompleted=true,clearedStages에1~3월드 보스,unlockedSkills에 bark/bite/dash만 넣는다. 더블 점프·무적·추가 체력을 넣지 않는다. registry progressState를 이 복제로 교체한 뒤 기존 active Scene을 멈추고 StageScene을 stageId/seed1로 시작한다. 실제 사용자 프로필/저장소를 수정하지 않는다.
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
- [ ] 네 일반맵 전체의 실제 입력 통과와4→보스 연결이 확인된다.
- [ ] 무전조·후퇴 전용·즉사·대시 예외·체크포인트 사례가 모두 검증된다.
- [ ] 타입/린트/빌드/관련 회귀가 통과하고 남은 한계를 사실대로 기록한다.
- [ ] 별도 테스트 폴더·test-plans 문서를 생성하지 않는다.
- [ ] 기존 미커밋 작업과 제외한 인트로/보스/메뉴 기능을 임의로 변경하지 않는다.

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
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- 검증 결과: 미실행 — 계획 단계
- 브라우저 전체 통과: 미실행
- 수치 조정: 없음
- 잔여 한계: 구현 후 검증으로 확인

