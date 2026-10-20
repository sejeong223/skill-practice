# Task: T02 상자 통과 발동과 열린 상태 유지

## Status: done

## Goal

월드 1 `box-static` 장애물이 코기가 지나는 순간 손이 나온 상자로 바뀌고, 무사히 점프로 넘어가도 열린 채 남으며, 닿으면 기존처럼 사망한다.

## Decision Summary

- 대상은 `world01Gimmicks.ts`가 생성한 스테이지 1~4의 `box-static` 7개다. `box-cat-arm`은 별개다.
- 기본 점프의 이론상 최고 상승 높이는 약 88px이므로 열린 그림·충돌 높이를 먼저 측정하고 실제로 뛰어본 뒤 필요할 때만 점프 속도를 소폭 조정한다.

## Implementation

### I01. 가로 진입 시 열린 상태로 전환

- Related Files:
  - `src/game/systems/MapGimmickSystem.ts` :: `update`, `reset`, `createGimmickVisual`, `requestDeath`, `overlapsGimmick` — 상자 전용 발동·시각·피격·복원; modify.
  - `src/game/systems/world01BoxTrap.ts` :: `isAtStaticBox`, `hasPassedStaticBox`, `getOpenStaticBoxDangerRects` — 가로 진입과 판지/손 두 영역의 순수 기하 계산; new.
  - `src/game/data/world01Gimmicks.ts` :: `visuals["box-static"]` — 기존 좌표와 닫힌 상자 크기 참고; read-only.
  - `src/game/systems/checkpointGimmickState.ts` :: `toCheckpointGimmickState` — 열린 상태 저장 정책 참고; read-only.
  - `src/game/assets/assetManifest.json` :: `world-01-prop-cat-box-open` — T01 키 참조; read-only.

#### Details

- `update`에서 `box-static`만 일반 `status !== "armed"` 건너뛰기보다 앞에서 처리한다. 코기 몸체의 가로 구간이 상자 x부터 폭44의 근처(예: 좌우 12px 여유)에 진입하면 높이와 점프 입력에 관계없이 `armed -> triggered`로 한 번 전환한다. `triggered`/`escaped`인 상자도 다시 닫히지 않으며, 왼쪽으로 되돌아와도 열린 채다.
- T01 PNG를 기존 이미지 객체의 texture로 전환한다. 표시 크기는 실제 PNG 형태에 맞춰 폭 56~68px, 높이 50~64px 안에서 정하고 하단을 기존 바닥 `gimmick.y + gimmick.height`에 맞춘다. 원래 닫힌 이미지는 `world-01-props` 아틀라스의 `cat-box` 프레임으로 그대로 사용한다. 열린 상자만 바꾸고 별도의 2번째 상자 오브젝트를 겹쳐 그리지 않는다.
- 코기 몸체가 상자 오른쪽을 통과하면 `escaped`로 기록해 성공한 회피를 남긴다. `triggered`와 `escaped` 모두 시각은 열린 채이며 위험 영역도 유지한다. 닿으면 기존 `requestDeath` 경로를 써서 사망·체크포인트 복귀를 실행한다. `requestDeath` 후 `dead`인 상자는 반복 사망 이벤트를 내지 않는다.
- 열린 상자의 판지와 손은 서로 다른 두 개의 위험 사각형으로 판정한다. 바닥 `gimmick.y + gimmick.height`를 기준으로 상자 몸체는 `x=gimmick.x, width=44, height=36`, 손은 `x=gimmick.x+14, width=16, height=54`다. 월드 1 코기 몸체 폭은 `StageScene`에서 48px로 설정된다. 열린 그림 전체를 폭 56×높이54 사각형으로 잡을 경우 피할 수는 있어도 도약 시작 허용 구간이 좁으므로, 판지의 열린 날개는 장식으로 두고 실제 고양이 손의 좁은 폭만 높은 판정에 넣는다. 처음 열린 프레임부터 이 판정을 적용한다.
- `reset(snapshot)`은 `armed`면 닫힌 아틀라스·원래 44×36 크기/위치, `triggered`/`escaped`면 열린 PNG·열린 크기/위치를 복원한다. 저장된 체크포인트의 열린 상태는 그대로 표시하고, 새 시도의 초기화는 스냅샷 상태를 따른다. 기존 `box-cat-arm`의 `showTriggeredVisual`은 수정하지 않는다.

### I02. 회귀 검증과 게임 화면 확인

- Related Files:
  - `scripts/world01-box-open.test.mjs` — 7개 상자의 발동/유지/복원 데이터와 점프 여유 검증; new.
  - `scripts/world01-maps.mjs` — 기존 스테이지 1~4 맵 좌표 회귀; read-only.
  - `scripts/world01-respawn.test.mjs` — 체크포인트 재시작 경로 회귀; read-only.
  - `src/game/entities/playerTypes.ts` :: `DEFAULT_PLAYER_TUNING` — 실제 회피 불가능할 때만 `jumpVelocity` 조정; modify if needed.
  - `.memory/test-plans/2026-10-20-world01-cat-box-open.md` — 실제 점프·열림·사망·재시작 화면과 결과; new/modify.

#### Details

- 테스트는 네 스테이지의 7개 상자가 모두 같은 `box-static` 경로를 쓰는지, 닫힌 이미지와 열린 이미지 키를 혼동하지 않는지, 상자 접근 시 높이에 무관하게 열리는지, 지나간 뒤 열린 상태와 충돌이 남는지, reset이 저장 상태에 맞는지 확인한다. 실제 게임 조작으로 정상 점프 1회, 도중 멈춤/후진, 걷다가 피격, 재시작을 확인한다.
- 1280×720 실제 게임에서 열린 이미지가 손과 판지 상자 한 개로 보이고 정면 점프로 넘을 수 있어야 한다. 필요하면 열린 표시 크기/충돌 높이를 조정한다. 기존 점프 -460px/s로 넘기 어려운 것이 확인될 때만 -480px/s 이하의 소폭 변경을 검토하고 월드 1 다른 장애물 및 월드 2 기본 점프도 재확인한다.
- 관련 테스트·타입·lint·빌드와 브라우저 `pageerror` 0건을 확인한다. 열린 모습이 잠깐 보이다 닫히거나 점프 회피 뒤 닫히면 완료하지 않는다.

## Acceptance Criteria

- [ ] 월드 1의 모든 `box-static` 상자가 코기의 가로 통과 순간 열린 상자·고양이 손으로 전환한다.
- [ ] 점프해서 넘은 뒤에도 열린 이미지가 유지되고, 닿으면 한 번 사망한다.
- [ ] 열린 상자를 기본 점프로 회피할 수 있고 재시작·체크포인트에서 상태가 일관된다.
- [ ] 기존 `box-cat-arm`, 맵 좌표, 다른 장애물 동작은 유지된다.

## Validation

- `node --test scripts/world01-box-open-art.test.mjs scripts/world01-box-open.test.mjs scripts/world01-respawn.test.mjs` — 새 상자·기존 재시작 검증.
- `npm.cmd run world01:maps:check` — 맵 좌표 회귀(파일 재생성 없음).
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사.
- `npm.cmd run lint` — lint.
- `npm.cmd run build` — 빌드.
- `npm.cmd run dev` — 실제 브라우저에서 도약·열림 유지·피격·재시작을 확인한 뒤 종료.

## Commit Message

```text
fix(world01): 상자 통과 시 고양이 손이 나오도록 연결

Plan: 2026-10-20-world01-cat-box-open
Phase: P01-box-open
Task: T02-box-trigger-and-collision

- 점프로 지나가도 상자가 열리고 열린 상태를 유지
- 열린 손의 피격 영역과 체크포인트 복원을 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Git 커밋 메시지 참조
