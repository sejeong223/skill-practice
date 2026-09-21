# Task: T05 월드 5 고양이 왕국·우두머리·엔딩

## Status: pending

## Goal

마지막 스킬인 꼬리 회전을 사용하는 고양이 왕국 4개 스테이지와 전체 고양이 패거리의 우두머리 보스전을 구현하고, 왕갈비뼈를 사용하지 않은 채 탈환한 뒤 지정된 코믹 엔딩과 크레딧을 재생한다.

## Decision Summary

- 월드 5 보스가 전체 고양이 패거리의 우두머리이며 총 캠페인은 25개 스테이지로 끝난다.
- 최종전에서 왕갈비뼈는 화면에 보이기만 하고 보스 능력으로 사용되지 않는다. 엔딩에서도 강아지가 먹지 못하고 주인이 베란다 밖으로 던진다.

## Implementation

### I01. 월드·스테이지 데이터

- Related Files:
  - src/game/data/worlds/world-05.ts :: WORLD_05_DEFINITION — new
  - src/game/data/stages/world-05.ts :: WORLD_05_STAGES — new
  - src/game/data/bosses/leader.ts :: LEADER_BOSS — new

#### Details

- Stage IDs and titles:
  - world-05-stage-1: 고양이 왕국 외곽문
  - world-05-stage-2: 왕궁으로 가는 수직 정원
  - world-05-stage-3: 냥아치 연합 작전실
  - world-05-stage-4: 왕갈비뼈 보관 금고
  - world-05-stage-boss: 고양이 왕국 왕궁
- 일반 스테이지는 checkpoint 1개, 수집품 3개, double-jump와 tail-rotor를 조합하는 수직 구간을 포함한다.
- 왕갈비뼈 보관 금고는 오브젝트가 화면에 보이지만 상호작용·섭취·보스 공격으로 변환하지 않는다.

### I02. 고양이 패거리 우두머리

- Related Files:
  - src/game/data/bosses/leader.ts :: LeaderBossController — new
  - src/game/scenes/BossScene.ts :: final boss rules — modify

#### Details

- 보스는 이전 월드의 함정 규칙을 섞되, 왕갈비뼈를 휘두르거나 먹지 않는다.
- Phase 1은 왕궁 방어선, phase 2는 각 월드 간부의 잔여 장치, phase 3은 우두머리와 코기의 순수 플랫폼 추격전이다.
- 처치 후 왕갈비뼈 탈환 이벤트를 발행하고 rewardSkill로 tail-rotor의 최종 해금을 확정한다.

### I03. 엔딩·크레딧

- Related Files:
  - src/game/data/cutscenes/ending.ts :: ENDING_CUTSCENE — new
  - src/components/game/EndingOverlay.tsx :: EndingOverlay — new
  - src/game/scenes/CreditsScene.ts :: CreditsScene — new

#### Details

- 엔딩 순서:
  1. 코기가 왕갈비뼈를 입에 물고 집으로 돌아온다.
  2. 주인이 잘 기다렸다고 칭찬하고 머리를 쓰다듬는다.
  3. 주인이 코기의 입에서 갈비뼈를 빼낸다.
  4. 코기가 기대의 눈빛을 보낸다.
  5. 주인이 갈비뼈를 열린 베란다 창문 밖으로 던진다.
  6. 주인이 “자, (강아지 이름)아!! 물어와!!!!”라고 외친다.
  7. 코기가 “.......멍?” 하고 다시 뛰어든다.
  8. 하늘로 날아가는 코기 클로즈업, [ TO BE CONTINUED...? ], 크레딧과 추격 장면.
- 플레이어 이름은 text interpolation 전에 허용 문자와 길이를 검증하고, 모든 이름은 12자 이내로 자른다.
- 엔딩 이후에는 campaignComplete를 저장하고 replay credits만 허용한다.

## Acceptance Criteria

- [ ] 월드 5 일반 4개와 우두머리 보스전으로 25개 스테이지가 완결된다.
- [ ] tail-rotor가 보스 전후 올바른 상태로 작동한다.
- [ ] 최종 보스가 왕갈비뼈를 능력으로 사용하지 않는다.
- [ ] 사용자 입력 이름이 엔딩 대사에 안전하게 들어간다.
- [ ] 지정된 엔딩·TO BE CONTINUED 문구·크레딧 추격 장면이 재생된다.

## Validation

- npm run lint — world 5/final ending 타입 통과
- npm run build — final scene/credits build 통과
- npm run dev — world 5부터 ending credits까지 수동 완주

## Commit Message

~~~text
feat(content): build cat kingdom finale and absurd ending

Plan: 2026-09-21-legendary-rib-corgi
Phase: P04-campaign-content
Task: T05-world05-cat-kingdom-ending

- Add final kingdom stages and leader boss
- Add the owner throw-away ending and credits chase
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
