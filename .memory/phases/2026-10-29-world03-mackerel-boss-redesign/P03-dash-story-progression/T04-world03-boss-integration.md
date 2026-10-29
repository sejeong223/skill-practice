# Task: T04 월드 3 보스전 통합 플레이 검증

## Status: done

## Goal

완성된 고등어 보스전을 실제 스테이지에서 처음 대화부터 월드 4 진입까지 확인하고, 자산·전투·대시·모달의 경계에서 발생하는 회귀를 고친다. 자동 테스트만으로 판별하기 어려운 그림 크기와 실제 재질 소리도 기록한다.

## Decision Summary

- 검증 범위는 월드 3 새 보스전과 대시가 영향을 주는 이전 월드의 공격 접점이다. 공사장 기존 아레나·월드 1·2 전투 규칙을 바꾸지 않는다.
- 사망과 재시작, 같은 시도 시드 재현, 대시 종료 프레임 피격, 짖기로 2연계 취소, 착용 중 의상 변경이 주요 경계다.

## Implementation

### I01. 시나리오 기반 통합 테스트와 검증 기록

- Related Files:
  - `scripts/world03-boss-end-to-end.test.mjs` :: 시도→승리·재시작·모달 이벤트 통합 — new
  - `scripts/world03-boss-combat.test.mjs` :: 발견한 공격 경계 회귀 시나리오 — modify if needed
  - `scripts/dash-invulnerability.test.mjs` :: 종료/재시도/공중 경계 — modify if needed
  - `scripts/world03-victory-flow.test.mjs` :: 중복 모달/빠른 클릭 경계 — modify if needed
  - `.memory/test-plans/2026-10-29-world03-mackerel-boss-redesign.md` :: 자동·수동 증거와 미검증 항목 — new

#### Details

- **Signatures & Types**:
  ```text
  Scenario A: first entry -> 6 dialogue beats -> brick/wave/lump -> HP 10 combo -> victory
              -> 8 clear beats -> stage clear -> dash unlock -> world-04-intro -> world-04-stage-1
  Scenario B: boss death -> attempt+1 -> different seeded order -> HP/hearts/brick/puddle/cooldowns reset
  Scenario C: dash ground/air -> attack immunity, wall/gap retained, expiration resumes damage
  ```
- **Data & Schema Fields**: 기록에는 커밋 해시, 실행 커맨드와 종료 코드, 게임 환경/화면 크기, 스크린샷 경로, 시드/attempt, 녹음 출처와 청음 결과, 수동 확인 불가 항목을 나눠 적는다. 코드에 테스트용 보상 우회나 보스 HP 축소를 남기지 않는다.
- **Execution Flow / Logic**:
  1. Precondition: P01~P03-T03의 자산·게임 코드가 모두 존재하고 테스트용 저장에서 W3 보스에 진입 가능해야 한다. 기존 미커밋 변경과 Task 커밋 경계를 먼저 확인한다.
  2. Core: 1280×720 데스크톱 실제 플레이에서 대사·회피·재시도·승리 순서를 확인한다. 첫 3회는 종류별 하나, HP10 이하의 2연계는 서로 다른 공격, 짖기 중 공격/잔류물 소거, 대시 중 공격 면역/고체 벽돌 정지/갈라진 바닥 낙하, 사망 후 초기화, 저장 재접속을 검사한다. 의상 5종·장신구 5종·맞춤 옷과 지상/공중 대시를 최소 대표 프레임으로 캡처한다. 실제 스피커에서 벽돌·흙손·시멘트 0.3초 준비음을 구별한다.
  3. Error handling: 발견한 회귀만 그 원인 파일과 해당 테스트를 함께 고친다. 월드 1·2·4·5 보스나 기존 발레 자산을 요청과 무관하게 재디자인하지 않는다. 수동 플레이/청음을 못 했다면 통과로 쓰지 않고 미검증 이유를 기록한다.
  4. State/return: 자동·수동 결과를 링크 가능한 검증 문서로 남기고, 다음 작업 포인터를 이 계획의 완료 상태로 진행할 수 있게 한다.

### I02. 공통 회귀 게이트

- Related Files:
  - `src/game/scenes/StageScene.ts` :: 승리/재도전/대시 중복 경로 — modify only if a failing scenario identifies a defect
  - `src/game/systems/BossEncounter.ts` :: 공격 중단·피격 경계 — modify only if needed
  - `src/game/entities/PlayerAnimator.ts` :: 공중 회전/지상 대시 경계 — modify only if needed
  - `scripts/world02-victory-flow.test.mjs` :: 기존 W2 보상 회귀 — read-only unless failure
  - `scripts/corgi-pirouette-integration.test.mjs` :: 기존 회전 회귀 — read-only unless failure

#### Details

- **Execution Flow / Logic**: 테스트가 실패하면 원인을 재현하는 최소 시나리오를 먼저 추가하고, 그 결과를 회복하는 가장 좁은 수정을 수행한다. 모든 수정은 이 Task의 한 커밋에 담고 다른 작업 트리의 변경은 스테이징하지 않는다.

## Acceptance Criteria

- [x] 첫 진입·재도전·승리·재접속 경로의 자동 시나리오에서 중복 대사/공격/모달·자동 전환이 없다. 실제 플레이는 미검증으로 기록했다.
- [ ] 세 준비 자세/실제 소리, 보스 상대 크기, 코기 전신 대시/발레 회전/의상의 실제 화면 확인은 인트로 진행 정지로 미검증이다.
- [x] 월드 1·2 보스와 W3 일반 맵 철근·장애물·발레 점프 회귀 검사가 통과한다.
- [x] 확인하지 못한 수동 항목을 검증 기록에 명확히 남겼다.

## Validation

- `node --experimental-strip-types --test scripts/world03-boss-end-to-end.test.mjs scripts/world03-boss-combat.test.mjs scripts/dash-invulnerability.test.mjs scripts/world03-victory-flow.test.mjs scripts/world02-victory-flow.test.mjs scripts/corgi-pirouette-integration.test.mjs scripts/world03-steel-beams.test.mjs` — 전체 흐름 회귀.
- `node scripts/generate-world03-boss.mjs --check`, `node scripts/generate-world03-cement-attacks.mjs --check`, `node scripts/generate-world03-boss-attack-sfx.mjs --check`, `node scripts/build-corgi-dash-sprites.mjs --check` — 자산 재현성.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 최종 게이트.
- 실제 브라우저 플레이와 청음 결과를 `.memory/test-plans/2026-10-29-world03-mackerel-boss-redesign.md`에 기록.

## Commit Message

```text
test(월드3): 고등어 전투 대시 승리 흐름 통합 검증

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P03-dash-story-progression
Task: T04-world03-boss-integration

- 재도전 시드·공격·대시·모달 통합 시나리오 추가
- 실제 화면과 효과음 검증 결과 및 필요한 회귀 수정 기록
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과·수동 미검증 기록 완료
- commit: 이 Task 커밋
