# Task: T02 월드 2 뒤틀린 놀이공원·두 번째 간부

## Status: pending

## Goal

짖기 스킬을 처음 활용하는 두 번째 월드로 뒤틀린 놀이공원 4개 스테이지와 두 번째 고양이 간부 보스전을 구현하고, 보스 처치 후 물기 스킬을 해금한다.

## Decision Summary

- 월드 2는 밝은 놀이공원 외형과 불안한 낙하·회전·가짜 안전지대의 대비를 사용한다.
- 짖기는 고양이 stun과 특정 소리 반응 함정을 다루지만, 소리로 더 많은 위험을 깨울 수 있다.

## Implementation

### I01. 월드·스테이지 데이터

- Related Files:
  - src/game/data/worlds/world-02.ts :: WORLD_02_DEFINITION — new
  - src/game/data/stages/world-02.ts :: WORLD_02_STAGES — new
  - src/game/data/bosses/cheese.ts :: CHEESE_BOSS — new

#### Details

- Stage IDs and titles:
  - world-02-stage-1: 회전목마 광장
  - world-02-stage-2: 범퍼카 골목
  - world-02-stage-3: 풍선 관람차
  - world-02-stage-4: 놀이공원 지하통로
  - world-02-stage-boss: 놀이공원 관리실
- 각 일반 스테이지는 checkpoint 1개, 수집품 3개, randomized cat behavior 최소 1개를 포함한다.
- 짖기 반응 오브젝트는 일부 고양이를 기절시키지만, 특정 풍선·경보장치·폭죽 함정을 발동할 수 있게 한다.

### I02. 치즈 고양이 보스

- Related Files:
  - src/game/data/bosses/cheese.ts :: CheeseBossController — new

#### Details

- 보스는 범퍼카·회전목마·관람차 발판을 이용하며, 짖기 stun window를 의도적으로 짧게 제공한다.
- Phase 1은 이동 플랫폼, phase 2는 화면 밖 폭죽, phase 3은 가짜 보스 종료 연출 뒤 재개되는 낚시 패턴이다.
- 보스 처치 보상은 bite이며, 다음 월드부터 J 공격 연계에서 슬리퍼를 놓고 직접 무는 follow-up을 활성화한다.

## Acceptance Criteria

- [ ] 월드 2 일반 4개와 보스전이 순서대로 열린다.
- [ ] bark가 적 stun과 위험한 소리 트리거 모두에 영향을 준다.
- [ ] 치즈 고양이의 fake-clear 낚시 연출이 한 번 이상 발생한다.
- [ ] 보스 처치 후 bite 해금 상태가 저장되고 월드 3에서 사용 가능하다.

## Validation

- npm run lint — world 2/boss data 통과
- npm run build — stage registry 통과
- npm run dev — bark, randomized hazards, cheese boss, bite unlock 수동 확인

## Commit Message

~~~text
feat(content): build world two twisted amusement park

Plan: 2026-09-21-legendary-rib-corgi
Phase: P04-campaign-content
Task: T02-world02-twisted-amusement-park

- Add amusement park stages and sound-reactive traps
- Add cheese cat boss and bite skill reward
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
