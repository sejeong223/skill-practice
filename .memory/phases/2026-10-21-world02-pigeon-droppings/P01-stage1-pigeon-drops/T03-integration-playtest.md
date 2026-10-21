# Task: T03 월드 2 비둘기 낙하의 실제 플레이 통합 검증

## Status: pending

## Goal

첫 스테이지를 실제 화면에서 이동·점프하며 세 비둘기를 모두 확인한다. 예고가 읽히고 멈춤/이동으로 똥을 피할 수 있는지, 닿으면 한 번만 사망하는지, 체크포인트·일시정지·상점·모바일에서 깨지지 않는지 확인하고 관찰한 문제만 수정한다.

## Decision Summary

- T01의 픽셀 아트와 T02의 게임플레이를 함께 검사한다. 데이터 테스트 통과만으로 낙하 예고의 가독성·공정성을 증명하지 않는다.
- 이번 Task에서 조정할 수 있는 것은 비둘기 `triggerX`/`dropX`/속도, 똥의 작은 hitbox, 경고 그림자의 크기·색과 PNG의 외형이다. 월드 2 모래 바닥, 코기 점프 성능, 기존 장애물 8종은 유지한다.

## Implementation

### I01. 실제 화면·물리·입력 검증 및 관찰된 오차 수정

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `WORLD02_STAGE1_PIGEON_PASSES` — 실측에 따라 구간·속도 조정 가능; modify if needed.
  - `src/game/systems/World02PigeonDropSystem.ts` :: `update`, `resetForAttempt`, `destroy` — 예고·접촉·일시정지 문제 수정 가능; modify if needed.
  - `src/game/scenes/StageScene.ts` :: `update`, restart/shutdown 연결 — 통합 오류 수정 가능; modify if needed.
  - `public/assets/pixel/props/world-02/pigeon-fly.png`, `pigeon-dropping.png`, `pigeon-splat.png` — 실제 화면에서 작거나 색이 묻히면 수정 가능; modify if needed.
  - `scripts/world02-pigeon-drops.test.mjs`, `scripts/world02-pigeon-assets.test.mjs` — 발견한 버그의 회귀 검사 보강 가능; modify if needed.
  - `src/game/data/world02Obstacles.ts`, `src/game/entities/playerTypes.ts`, `src/game/data/worlds.ts` — 기준 점프/장애물/맵 확인; read-only.

#### Details

- **Signatures & Types**: T02의 `World02PigeonPassDefinition`·`World02PigeonDropSystem` 공개 계약을 유지한다. 최종 좌표를 바꿀 때는 데이터 테스트의 안전 거리 계약과 검증 메모를 함께 수정한다.
- **Data & Schema Fields**: 새 저장 필드는 없다. 브라우저 관찰값은 각 pass의 `triggerX`, `dropX`, 첫 경고 시각, 낙하 시작 시각, 접지/사망 시각, 체크포인트 ID로 기록한다.
- **Execution Flow / Logic**:
  1. 데스크톱 1280×720에서 `world-02-stage-1` 진입 후 x≈1280/1980/3040의 비둘기가 세 번 모두 **오른쪽에서 왼쪽으로** 날고, 왼쪽 부리·오른쪽 얼굴 측면과 날개 프레임이 보이며, 경고 그림자 → 낙하 똥 → 착지 자국 순서로 보이는지 확인한다. 똥은 밝은 모래·뼈다귀 코인과 혼동되지 않아야 한다.
  2. 표시된 낙하 위치 앞에서 멈춰 피한 뒤 자국이 사라지면 통과할 수 있어야 한다. 일부러 낙하 경로로 들어가면 사망 카운트가 정확히 1 늘고 시작/활성 체크포인트로 복귀해야 한다. 비둘기 몸체 또는 낙하 뒤 자국만 접촉해도 사망하지 않아야 한다.
  3. 첫 두 패스는 체크포인트 2496 전에, 세 번째는 체크포인트 이후에 있다. 세 번째 똥으로 사망하면 x≈2536의 체크포인트로 돌아와 앞의 두 새는 재출현하지 않고 세 번째 패스는 다시 활성화돼야 한다. 새로고침으로 체크포인트 복원 시에도 앞쪽 새가 화면 뒤에서 생성되지 않아야 한다.
  4. 비행·낙하 중 일시정지와 상점을 각각 열어 bird x, drop y, 자국 만료 시간이 그대로인지 확인한다. 재개 후 정상 진행해야 한다. 월드 전환/장면 종료 후에도 새 이미지·Arcade Collider가 남거나 브라우저 오류가 나면 안 된다.
  5. 기존 8종 장애물을 기본 이동/점프로 모두 지나 출구에 도달할 수 있어야 한다. 390×844 세로 모바일 크기에서도 코기·경고 그림자·낙하물이 식별되고 HUD가 비둘기를 가리지 않아야 한다. 특히 기존 삽·오리·코끼리 점프와 낙하 타이밍이 겹쳐 피할 수 없는 죽음이 없어야 한다.
- **Error & Exception Handling**: 스크린샷/로그로 재현한 경우에만 좌표·속도·hitbox 또는 알파/색을 조정한다. 낙하 시각을 무작위화하거나 코기 점프 속도를 올려 문제를 숨기지 않는다. `pageerror`·필수 PNG 404·반복 사망은 0건이어야 한다.
- **State Transition & Return**: 통합 검증 후 세 구간 모두 안전 회피와 의도적 충돌이 재현 가능한 상태다.

### I02. 자동 검증과 결과 기록

- Related Files:
  - `.memory/test-plans/browser-world02-pigeon-drops.mjs` — 기존 `browser-coin-replay.mjs`의 Chrome CDP 패턴을 참고하는 브라우저 재현 스크립트; new.
  - `.memory/test-plans/2026-10-21-world02-pigeon-droppings.md` — 좌표·이미지·사망/회피·체크포인트·한계 기록; new.
  - `.memory/test-plans/assets/2026-10-21-world02-pigeon-*.png` — 예고/낙하/모바일/재시작 화면 증거; new.
  - `scripts/world02-sand-floor.test.mjs`, `scripts/world02-obstacles.test.mjs`, `scripts/world02-cat-attack.test.mjs`, `scripts/death-system.test.mjs`, `scripts/stage-progression.test.mjs` — 인접 회귀; read-only unless bug.

#### Details

- **Execution Flow / Logic**: 검증 문서에 이미지 최종 치수/키, 세 pass의 최종 좌표·속도, 의도적 접촉 1회당 사망 카운트, 체크포인트 복귀 x, 일시정지 전후 bird/drop 좌표, 모바일 가독성, 전체 완주 여부를 기록한다. 브라우저 자동화가 확인하지 못한 실제 손 조작 또는 스피커 청음은 했다고 쓰지 않는다.
- **Error & Exception Handling**: 자동 검증에서 실패한 회귀는 원인을 수정해 재실행한다. 기존 월드 2 스테이지 2~4의 미완료 Tiled 맵 계획을 완료 처리하거나 새 Task로 끼워 넣지 않는다.
- **State Transition & Return**: 구현 결과와 한계를 증거와 함께 남긴다.

## Acceptance Criteria

- [ ] 비둘기 3회·날개 프레임·낙하 예고·똥·착지 자국이 데스크톱과 모바일에서 식별된다.
- [ ] 정지/이동으로 똥을 피할 수 있고 낙하물 접촉은 정확히 한 번 즉시 사망한다.
- [ ] 체크포인트/새로고침/일시정지/상점/장면 종료와 기존 8종 장애물·출구가 정상이다.
- [ ] 검증 메모와 실제 화면 증거가 남고 필수 회귀 검사들이 통과한다.

## Validation

- `node --test scripts/world02-pigeon-assets.test.mjs scripts/world02-pigeon-drops.test.mjs scripts/world02-sand-floor.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/death-system.test.mjs scripts/stage-progression.test.mjs` — 기능·인접 회귀 검사.
- `node scripts/validate-assets.mjs` — 필수 PNG 및 manifest 검사.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사.
- `npm.cmd run lint` — 린트 검사.
- `npm.cmd run build` — 프로덕션 빌드.
- `npm.cmd run dev -- --port 3001`와 `node .memory/test-plans/browser-world02-pigeon-drops.mjs` — 실제 브라우저에서 회피/접촉/체크포인트/일시정지/모바일 확인. 이미 같은 포트의 개발 서버가 실행 중이면 그것을 재사용하고 테스트를 위해 새로 띄운 프로세스만 종료한다.

## Commit Message

```text
test(world02): 비둘기 낙하 회피와 체크포인트 동작 검증

Plan: 2026-10-21-world02-pigeon-droppings
Phase: P01-stage1-pigeon-drops
Task: T03-integration-playtest

- 세 비둘기의 실제 화면 가독성·접촉 사망·안전 회피 확인
- 체크포인트·일시정지·모바일 회귀와 검증 기록 보존
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
