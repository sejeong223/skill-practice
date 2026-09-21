# Task: T04 월드 4 폭풍 옥상 도시·네 번째 간부

## Status: pending

## Goal

돌진 스킬과 밥그릇의 부작용을 활용해야 하는 폭풍 옥상 도시 4개 스테이지와 네 번째 고양이 간부를 구현하고, 보스 처치 후 이단 점프를 해금한다.

## Decision Summary

- 월드 4는 비·번개·옥상·전선·에어컨 실외기와 긴 낙하를 중심으로 구성한다.
- 돌진은 회복 기동과 적 공격 모두에 쓰이지만, 바람과 미끄러운 지붕이 돌진 방향을 망가뜨릴 수 있다.

## Implementation

### I01. 월드·스테이지 데이터

- Related Files:
  - src/game/data/worlds/world-04.ts :: WORLD_04_DEFINITION — new
  - src/game/data/stages/world-04.ts :: WORLD_04_STAGES — new
  - src/game/data/bosses/longhair.ts :: LONGHAIR_BOSS — new

#### Details

- Stage IDs and titles:
  - world-04-stage-1: 비 오는 옥상길
  - world-04-stage-2: 전선 가득한 고층 구역
  - world-04-stage-3: 실외기 바람 통로
  - world-04-stage-4: 번개가 멈추지 않는 통신탑
  - world-04-stage-boss: 장모 고양이의 옥상 정원
- 일반 스테이지는 checkpoint 1개, 수집품 3개, wind volume 2개 이상, offscreen hazard 1개 이상을 포함한다.
- 일부 낙하 구간은 dash로만 복구할 수 있지만, dash 종료 위치가 fake platform을 지나치도록 설계한다.
- 밥그릇 clang으로 유기견이 옥상 좁은 길목을 막는 부작용을 최소 1회 강제한다.

### I02. 장모 고양이 보스

- Related Files:
  - src/game/data/bosses/longhair.ts :: LonghairBossController — new

#### Details

- 보스는 긴 털로 바람 방향을 가리고, 화면 밖에서 번개를 호출한다.
- Phase 1은 이동 전선, phase 2는 gust reversal, phase 3은 보스가 사라진 척한 뒤 옥상 가장자리에서 밀어내는 낚시다.
- 보스 처치 보상은 double-jump이며, 월드 5의 왕궁 수직 구간에서 사용할 수 있다.

## Acceptance Criteria

- [ ] 폭풍·바람·번개·전선·실외기 함정이 결합된 4개 스테이지가 완주 가능하다.
- [ ] dash가 이동·전투·낙사 회복에 모두 사용된다.
- [ ] 밥그릇 유기견 부작용이 실제 길막으로 작동한다.
- [ ] 장모 고양이 보스 처치 후 double-jump가 저장된다.

## Validation

- npm run lint — world 4 data와 weather hazard 타입 통과
- npm run build — rooftop assets/data registry 통과
- npm run dev — gust reversal, lightning, dash recovery, longhair boss 수동 확인

## Commit Message

~~~text
feat(content): build world four storm rooftop city

Plan: 2026-09-21-legendary-rib-corgi
Phase: P04-campaign-content
Task: T04-world04-storm-rooftop

- Add wind, lightning and rooftop hazard stages
- Add longhair boss and double jump reward
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
