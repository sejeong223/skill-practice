# Plan: 월드 1 짖기 해금 연출과 스킬 이름 한글화

## Goal

`배운 기술` 목록에 다섯 기술의 한국어 이름을 순서대로 표시한다. 월드 1 삼색이 승리 대사가 끝나면 짖기 해금 안내를 보여주고, 사용자가 넘긴 뒤에만 `[STAGE CLEAR!]`를 연다. 이미 해금된 짖기는 삼색이 재도전에서 가까운 보스의 공격 패턴을 잠시 멈춘다.

- [확정 결정](../decisions/2026-10-14-world01-bark-unlock-and-korean-skills.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 한국어 표시 이름, 해금 화면, 삼색이 짖기 경직 | [P01](../phases/2026-10-14-world01-bark-unlock-and-korean-skills/P01-skill-ui-and-bark/phase.md) |

## Execution Order

1. T01: `SkillDefinition`에 표시 이름을 정의하고 `SkillList`에서 기존 내부 ID 대신 `짖기 → 물기 → 대시 → 더블 점프 → 꼬리 모터`를 표시한다.
2. T02: `StageScene`의 월드 1 승리 종료 경로에 짖기 해금 안내 Scene을 끼워 넣는다. 안내의 클릭·Enter·Space 후에 기존 클리어 Scene과 월드 2 진입 경로를 그대로 따른다.
3. T03: 이미 해금된 짖기 사용을 `World01CalicoBoss`에 연결하고, 범위·지속시간·재경직 대기시간을 검증한다.

## Existing Runtime Findings

- `src/components/game/SkillList.tsx`는 `SKILL_DEFINITIONS` 순서대로 `skill.id`를 제목으로 출력한다. `SkillId`는 저장 데이터와 기술 로직에도 쓰이므로 표시 텍스트만 분리해야 한다.
- `StageScene.handleCalicoDefeat()`는 승리 대사 종료 → `bark` 해금·이벤트 → `runtime.complete()` → `World01StageClearScene` 순서다. `runtime.complete()`에서 클리어 기록과 코인 정산을 한 번만 처리한다.
- `PreloadScene`은 저장된 월드 1 완료 상태에서 기존 클리어 Scene을 직접 복원한다. 이미 본 해금 안내를 다시 재생할 새 저장 필드는 필요하지 않다.
- `GameShell`은 `stage-clear-scene-opened`를 받아 게임 HUD를 숨긴다. 새 안내 Scene에도 별도 화면 이벤트가 필요하다.
- `SkillSystem.use("bark")`는 사용 성공 여부를 반환하지만 현재 보스 패턴을 건드리지 않는다. 활성 보스 전투는 `World01CalicoBoss`뿐이다.

## Acceptance

- 스킬 목록의 다섯 한국어 이름이 첨부 이미지의 순서 그대로 보인다. 저장된 영문 ID, 잠금 상태, 기존 스킬 설명과 입력키는 유지된다.
- 첫 월드 1 보스 승리에서 대사 8줄 뒤 네 줄의 해금 안내가 정확히 표시된다. 안내가 열려 있는 동안 `[STAGE CLEAR!]`는 보이지 않고, 클릭 또는 Enter/Space 한 번으로 클리어 화면으로 이동한다.
- 클리어 보상·짖기 해금·코인 정산은 한 번만 저장된다. 클리어 화면의 `NEXT STAGE ->`와 월드 2 진입 연출은 이어진다. 새로고침 복원은 기존 완료 화면을 유지한다.
- 이미 짖기를 배운 상태로 삼색이와 싸울 때, 가까운 유효 사용은 현재 공격을 중단하고 1.2초간 다음 공격을 막는다. 멀리서 사용하거나 대기시간 중 재사용해도 보스는 다시 멈추지 않는다. 사망·재시작 시 경직 상태는 초기화된다.

## Adjacent Finding

- 현재 완료된 월드 1을 다시 시작하는 사용자용 버튼은 없고, 월드 2 이후 보스 전투도 아직 구현되지 않았다. 이번 계획은 새 재도전 메뉴나 월드 2 보스 전투를 만들지 않는다. 삼색이 효과는 이미 해금된 진행 상태를 주입한 검증 경로에서 확인한다.
- 일반 적 대상 짖기 효과 역시 현재 연결되지 않았다. 이번에 확정된 범위는 보스 공격 패턴의 일시 정지다.

## Progress

- done: 3/3 (active: none)
