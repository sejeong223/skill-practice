# Plan: 삼색이 방향·승리 대화와 클리어 표시 개선

## Goal

삼색이는 전투 중 코기가 있는 방향을 바라보고, 처치 직후 첫 대사부터 쓰러진 이미지로 표시된다. 코기는 전투 종료 위치에서 대화한다. 일반 맵 전환에는 완료 문구를 표시하지 않고 보스 승리 후 다음 월드로 넘어가는 화면에서만 `STAGE CLEAR!`를 표시한다.

- [결정](../decisions/2026-10-13-world01-victory-dialogue-position.md)
- [이전 완료 계획](./2026-10-12-world01-camera-exit-sfx.md)의 후속 계획이다. 이전 T01~T05를 다시 실행하지 않는다.
- 계획 작성 후 사용자의 `/memory-execute` 요청에 따라 아래 Task를 모두 구현·검증했다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 코기 정지·삼색이 방향과 기절 이미지·보스 전용 클리어 표시 | [P01](../phases/2026-10-13-world01-victory-dialogue-position/P01-victory-dialogue/phase.md) |

## Scope

T01은 `StageScene.ts`에서 코기의 물리 이동/달리기/공격 잔여 연출을 멈추고 현재 좌표를 유지한다. T02는 `World01CalicoBoss.ts`와 `StageScene.ts`에서 코기 방향 추적과 첫 대사 전 frame2 표시를 구현한다. T03은 `GameShell.tsx`의 일반 맵 클리어 저장 알림을 제거하고, 일반 맵/보스의 문구 표시 경로를 통합 검증한다.

검증은 좌우 이동과 투척 방향, 공중 마지막 타격, 대화 첫 프레임의 기절 이미지, 대화 중 입력, 자동/수동 완료와 건너뛰기, 씬 재진입 시 물리 정상화를 포함한다. 일반1→2→3→4→보스 전환 중 DOM/Phaser 완료 문구가0개이고 보스 승리 뒤 전용 화면에서만1개임을 확인한다. 대사 내용·화자 카메라·보상·저장 이벤트·맵 길이·효과음 정책은 유지한다. 새 이미지 생성은 필요하지 않다.

## Task Granularity

단일 P01 안에서 T01→T02→T03으로 순차 실행한다. 코기 정지, 보스 시각 상태, React/Phaser 완료 문구는 각각 독립적으로 검증할 수 있어 Task를 나눈다. T01/T02가 같은 승리 함수를 수정하므로 T02는 T01 이후에 실행하고, 마지막 T03에서 저장/전환까지 통합 확인한다.

## Progress

- done: 3/3
- T01~T03 구현·검증·한국어 커밋 완료. 다음 Active Task 없음.
- T01 `bcf8229`: 코기 물리/연출 정지와 마지막 타격 프레임 종료. [좌표 검증](../test-plans/2026-10-13-world01-victory-dialogue-position.md).
- T02 `1e4ef5a`: 보스 방향 추적과 첫 대사 전 기절 이미지. [방향/기절 검증](../test-plans/2026-10-13-calico-facing-collapse.md).
- T03 `5aba8f6`: 일반 맵 완료 알림 제거. [최종 통합 검증](../test-plans/2026-10-13-boss-only-clear-message.md). 자동47건·타입·lint·빌드·브라우저 검증 통과. 실제 모바일 터치는 미실시.
- 요청 범위 밖에서 새로 발견한 문제: 특이사항 없음.
