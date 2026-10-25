# Task: T05 플레이 개선과 간식 코인 적립 통합 검증

## Status: done

## Goal

월드1 시작부터 삼색이 승리·재시도까지 실제로 플레이해 이동감, 간식 위장, 위험 밀도, 전투 가독성·가림·소리가 함께 동작함을 검증한다. 후속 요청인 오른쪽 상단 잔액 표시와 획득 즉시 영구 적립을 사망·새로고침·클리어까지 확인한다.

## Decision Summary

- T01~T04의 코드 검사만으로 걸음걸이·시각적 위장·음량을 완료 판정하지 않는다. 실제 화면과 청취 결과를 남긴다.
- 새 범용 테스트 프레임워크/벤치마크를 도입하지 않는다. 기존 Node 검사, 새 방어/무리 행동검사, 브라우저 실측을 사용한다.
- 코인은 bankedCoins를 유일한 보유 잔액으로 사용하며 실제 획득 즉시 저장한다. 사망 후0이 되는 currentStageCoins는 통계일 뿐, 화면 잔액이0이 되는 기준이 아니다.
- 발견한 회귀는 원인 파일을 좁게 수정하고 관련 검사를 다시 실행한다. 이미 완료한 이전 작업의 이력을 덮어쓰거나 T05에서 새 기능을 추가하지 않는다.
- 코드 수정이 필요하면 먼저 `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`를 읽는다.

## Implementation

### I01. 검증 기록과 최종 계약

- Related Files:
  - `.memory/test-plans/2026-10-12-world01-gameplay-refinement.md` :: 결과 표; modify (없으면 new)
  - `.memory/test-plans/assets/world01-refinement-*` :: 화면/영상 증거; new as needed
  - `scripts/world01-maps.mjs`, `scripts/bowl-defense.test.mjs`, `scripts/samoyed-surge.test.mjs`, `scripts/snack-wallet.test.mjs` :: 통합 실행; read-only unless regression found
  - `src/game/camera/CameraDirector.ts`, `src/game/entities/PlayerAnimator.ts`, `src/game/entities/Player.ts`, `src/game/maps/ParallaxRenderer.ts` :: 이동 회귀의 제한 수정 대상
  - `src/game/data/world01Maps.ts`, `src/game/data/world01Gimmicks.ts`, `src/game/data/validateMaps.ts`, `src/game/stages/StageRuntime.ts`, `src/game/stages/StageEntityFactory.ts`, `src/game/systems/MapGimmickSystem.ts` :: 일반맵 회귀의 제한 수정 대상
  - `src/game/scenes/StageScene.ts`, `src/game/systems/World01CalicoBoss.ts`, `src/game/entities/BowlShieldVisual.ts`, `src/game/systems/StrayDogEvent.ts`, `src/game/systems/samoyedSurge.ts`, `src/game/audio/AudioManager.ts` :: 전투 회귀의 제한 수정 대상
  - `src/game/systems/EconomySystem.ts`, `src/game/persistence/AutoSaveCoordinator.ts`, `src/components/game/GameShell.tsx`, `src/components/game/SnackCoinCounter.tsx`, `src/components/game/Hud.tsx`, `src/app/globals.css` :: 적립·저장·HUD 회귀의 제한 수정 대상

#### Details

- **Signatures & Types**: 새 production API/저장 필드를 만들지 않는다. 검증 기록 각 행은 `id:string, scenario:string, expected:string, observed:string, status:'pass'|'fail'|'not-run', evidence:string`의 Markdown 표로 남긴다. 환경에는 commit/브라우저/viewport/캔버스 배율/측정fps/음원출력기기/날짜를 적는다.
- **Data & Schema Fields / Final invariants**: 네 일반 맵2560×720,5구간[192,720,736,720,192],정적위험맵별6,전체맨홀2/가짜6/진짜20/기믹32/Tiled객체58/체크포인트2. checkpoint IDs는 stage2/stage4 기존 이름, x1520/2320. 출구x2416. 비둘기60×40,투사체72×36/판정54×24,보스10HP/코기3하트/방어3회/무리5마리.
- **Wallet invariant**: bankedCoins는 기존 저장 잔액+성공한 진짜 획득-기존 구매 지출. 사망·클리어는 차감/추가 정산0. 같은 활성 코인 중복 겹침은0, 재시도로 다시 생성된 진짜 코인을 실제 수집하면+1. SaveEnvelope 버전2와 기존 저장 키를 유지한다.
- **Execution Flow / Logic**:
  1. 검사 명령을 먼저 실행해 배치/생성물/타입/기존 컷신 회귀를 확인한다. 에셋 누락으로 fallback만 보이는 상태는 화면검증 실패다.
  2. 아래 시나리오를 desktop1280×720과 모바일 가로844×390에서 검증한다. 잔액 HUD는 세로390×844에서도 숫자/버튼 겹침을 확인한다. 실제 touch 조작을 제공하지 않는 환경에서는 viewport 검증과 실제 모바일 입력 검증을 구분해 기록한다. 지원하지 않는 입력 기능을 T05에서 새로 만들지 않는다.
  3. 성능은 같은 기기/같은 seed로 baseline과 비교한다. 실제 프레임 데이터를 측정하지 않았다면 특정fps 보장을 적지 않는다. 자동 로그는 시각적 끊김/걸음걸이 판단과 함께 본다.
  4. 문제를 수정하면 해당 task의 기준과 이 통합기록을 정렬하고 관련 테스트를 재실행한다. crop을 새로 선택하면 T01의 원본유지 시도·실패증거 조건부터 충족한다.
  5. 통과 후 이 Task done, phase done5/5, plan phase done, current Active Task 없음으로 갱신한다. 이전 짧은경로 T02~T04는 별도 미완료 포인터로 남기며 자동으로 완료 처리하지 않는다.
- **Error & State**: 테스트 미실행/청취 불가를 pass로 적지 않는다. 진행 중에 사용자 저장 데이터를 지우지 않고 테스트용 진행 상태를 사용한다. 원래의 온보딩·이름·완료스테이지 저장을 보존한다.

### I02. 요구사항별 실제 시나리오

| ID | 시나리오 | 합격 기준 |
| :--- | :--- | :--- |
| R01 | stage1~4 평지 왕복, 구간경계, 가감속/방향전환/점프/착지 | camera startFollow 재초기화 없음, run 주기 연속, 발이 몸체와 어긋나지 않음 |
| R02 | 짧은 맵 전체 배경, stage2/4 단차, F3 개요 왕복 | 빈 영역·압축된 그림·반복 이음새로 튀는 느낌 없음. 원본자르기 최후조건 준수 |
| R03 | 각 맵 초반3개 간식, 뒤의 진짜/초록fake 비교 | 시도 통계1→2→3, 보유N→N+3, 미발동 동일외형, 접촉 뒤에만 초록변신→사망 |
| R04 | fake 회피, reverse/fire, 사망/체크포인트복귀 | false 경고 없음, 기존 효과 유지, 시도 통계만0/보유잔액유지/코인재생성 |
| R05 | 맵별 모든 위험, 비둘기 점프, 맨홀, 두 checkpoint | 정적6개·안전착지 공간,60×40비둘기 안쪽판정, 정확한 복귀 |
| R06 | 세 생선뼈 궤적, 좌우근접/원거리, 공중조준 | 식별 가능, 한 발한 번 처리, swept collision 관통 없음 |
| R07 | 머리방패 정지/run4프레임/좌우/공중,3회방어 | 어색한 떠다님 없음, 셋째 반응후소멸, 다음 시도복원 |
| R08 | 방어1·2·3·4번째, BGM 켬/최초unlock/재진입 | 깡정확히3회, 넷째는하트감소, 적당한음량, 중복/뒤늦은재생없음 |
| R09 | 화면좌/중/우, 세번째방어후무리 | 왼쪽화면밖→5마리연속진입→불투명가림→잠금해제/퇴장 |
| R10 | 입장/가림중pause, death, victory, 재진입 | pause동안정지, 재개연속, 중단자원/잠금즉시정리 |
| R11 | 보스9회유효타격/10회, 재채기/헛공격, 재진입 | HP1→0의10번째만승리, 초기/재시도10/10, 하트3/방어3 유지 |
| R12 | 보스intro/clear 자동진행, 세번째하트피격, stage4복귀 | 자동컷신유지, stage4 기존checkpoint ID 복귀, clear1회/짖기해금 유지 |
| R13 | world2 일반맵 최소1개 로드, 진행순서회귀 |3840px와 기존엔티티/기본개수 유지, 스테이지 연결 안 깨짐 |
| R14 | 오른쪽 상단 잔액, 일반/보스/사망/pause/clear, 모바일 가로·세로 | bankedCoins와 표시 일치,0/1,234/1,234,567을 읽을 수 있음, 하트·버튼 겹침/모바일 숨김 없음 |
| R15 | 기존저장10→진짜3개→사망→재생성1개→즉시새로고침→클리어 | 잔액10→13→13→14→14→14, 가짜와 중복 overlap 적립0, 과거 진행 필드 보존 |
| R16 | 이미 클리어한 스테이지 재도전, 반복complete, 기존상점재화계약 | 새 실제 획득은적립, 완료시추가합산0, 구매용bankedCoins와 HUD잔액 동일, 새상점UI는추가하지않음 |

## Acceptance Criteria

- [x] R01~R16에 실제 결과와 증거가 있으며 실패/미확인 사항을 숨기지 않았다.
- [x] 자동 검사와 빌드가 통과한다.
- [ ] 사용자의7개 요청과 후속 코인 적립·상단 표시가 각각 화면/행동/청취/저장으로 확인된다. 화면·행동·저장·오디오 출력 측정은 완료. 실제 스피커/이어폰 청취는 도구가 지원하지 않아 미실시(R08 not-run).
- [x] 코인을 먹고 즉시 새로고침해도 잔액이 복원되며 사망·클리어 중복 정산으로 변하지 않는다.
- [x] 기존 컷신 자동진행·저장ID·다른월드 크기가 회귀하지 않는다.
- [x] 완료한 새 계획과 별도 미완료 이전 계획의 포인터가 명확하다.

## Validation

- `npm.cmd run world01:maps:check`
- `node scripts/validate-assets.mjs`
- `node --experimental-strip-types --test scripts/fishbone-trajectory.test.mjs scripts/calico-melee-hitbox.test.mjs scripts/cutscene-auto-advance.test.mjs scripts/bowl-defense.test.mjs scripts/samoyed-surge.test.mjs`
- `node --experimental-strip-types --test scripts/snack-wallet.test.mjs`
- `npm.cmd run test:progression`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run dev` — R01~R16 실제 확인, 이미 사용 중인 서버가 있으면 재사용하고 사용자 프로세스를 임의로 종료하지 않는다.
- `git diff --check` — 문서/소스 공백오류 없음. 이 명령의 성공만으로 게임 검증이 끝난 것으로 보지 않는다.

## Commit Message

```text
test(world01): 이동 간식과 삼색이 전투 개선 통합 검증

Plan: 2026-10-12-world01-gameplay-refinement
Phase: P01-gameplay-refinement
Task: T05-integration-playtest

- 7개 수정 요구와 후속 코인 잔액의 실제 플레이 및 음향 결과 기록
- 획득 즉시 저장과 재접속 복원 및 모바일 오른쪽 상단 표시 확인
- 일시정지 재시도 컷신 진행 회귀 확인
- 완료 포인터와 별도 미완료 계획을 정리
```

## Progress

- [x] 구현 완료
- [x] 실행 가능한 검증 통과: 자동21건, 타입·lint·빌드, 브라우저 화면/입력/저장/컷신/재도전.
- commit: 본 Task 제목의 Git 커밋 참조
- [검증 기록](../../../test-plans/2026-10-12-world01-gameplay-refinement.md)에 R01~R16과 화면·녹음·JSON 증거를 저장했다. 실기기 청취/터치 입력은 완료 판정에서 제외하고 미실시로 기록했다.
- 통합에서 발견한 방패 물리 갱신 지연, 가짜 간식의 강제 이동 종료 후 사망 누락, 복귀 직후 이전 충돌 위치 문제를 수정했다.
- 이전 짧은 경로 계획 T02~T04는 별도 미완료로 유지하며 이번 완료 포인터에서 자동 실행하지 않는다.
- 완료 후 코인 정책 보완: R04/R05/R15/R16의 사망 뒤 코인 복원·재획득 통과 결과는 현재 정책의 의도된 결과로 유지한다. 향후 의상 상점·클리어 월드 재도전 수급 검증 뒤 정책을 전환할 때 새 회귀 테스트를 작성하며, 이 완료 기록을 새 정책 검증으로 재사용하지 않는다. [후속 로드맵](../../../plans/2026-10-12-world01-gameplay-refinement.md#follow-up-roadmap--의상-상점과-반복-수급) 참조.
