# Task: T06 의상·그림판·공사장·보스 통합 검증

## Status: done

## Goal

각 Task에서 만든 기능을 실제 플레이 흐름으로 검증하고, 이어 붙이면서 생긴 오류만 수정해 릴리스 가능한 상태로 마무리한다.

## Decision Summary

- 사용자 결정: 메뉴는 월드 1~5 플레이 중 언제나 열리며 기본 슬리퍼로 후반 보스를 이길 수 있어야 한다. 저장한 사용자 옷과 장비는 재도전/새로고침에 남는다.
- 코드 사실: 월드 2 맵 2·3 제작은 별도 pending 계획이라 1→5 전체 걷기 경로 검증은 그 계획 완료에 달려 있다. 이번 Task에서는 보스 직접 진입과 현재 구현 가능한 정상 경로를 모두 검사한다.

## Implementation

### I01. 정적·자동 회귀 검증

- Related Files:
  - `scripts/corgi-wardrobe-campaign.integration.test.mjs` :: 신규, 기존 시스템을 함께 사용하는 저장→장착→피해→보상→다음 스테이지 시나리오.
  - `src/components/game/GameShell.tsx`, `src/game/scenes/StageScene.ts`, `src/game/systems/BossEncounter.ts`, `src/game/data/worlds.ts` :: 검증에서 발견한 실제 결함에 한해 수정.
  - `src/app/globals.css` :: 좁은 화면 버튼/하트 겹침이 재현될 때만 수정.
- **Signatures & Types**: 생산 코드의 API를 새로 넓히기보다 P01~T05에서 정의한 타입을 유지. 통합 테스트는 실제 `ProgressStore` 직렬화 구조와 stage ID를 사용한다.
- **Execution Flow / Logic**:
  1. v3 저장을 v4로 읽고 사용자 옷 3벌 저장/덮어쓰기/재장착/시장 의상 교체/벗기기를 수행한다.
  2. W1 삼색이에 피해 1/2/3, W2~5 보스 HP/주기/스킬 보상, 한 타격 한 번, 방패 소모, 짖기 스턴, 하트 0 재도전을 확인한다.
  3. 월드 3 네 스테이지의 바닥/장애물/체크포인트/출구를 확인한다. 월드 2 맵 2·3이 아직 pending이면 미완료 경로를 이번 기능의 실패로 숨기지 않고 분리해 기록한다.
  4. 빌드/타입/린트를 돌리고 실제 실패를 수정한 다음 재검증한다.
- **Error & State Transition**: 테스트가 재현하지 못하는 새 범위 기능을 임의 추가하지 않는다. 외부 pending 계획의 파일을 덮어써야 한다면 실제 구현과의 충돌을 먼저 확인한다.

### I02. 브라우저 수동 검증

- Related Files:
  - `scripts/corgi-wardrobe-campaign.integration.test.mjs` :: 필요한 자동 검증 시나리오만 반영. 수동 점검 기록은 이 Task의 Progress에 추가.
- **Execution Flow / Logic**: 데스크톱과 좁은 모바일 폭에서 메뉴 3개가 보스 하트와 겹치지 않는지, 열린 메뉴가 공격/타이머를 멈추는지, 그림판 펜/지우개/채우기/undo/색상/덮어쓰기 확인이 동작하는지, 각 보스 투사체가 예고대로 움직이는지 확인. 슬리퍼만 착용한 W5 직접 보스전에서 최소 한 번 승리하고 대기/회피/공격 구간을 기록한다.
- **Error & State Transition**: 시각 결함이 있으면 실제 화면과 프레임을 근거로 해당 Task의 자산/위치를 수정한다. 보스가 사실상 회피 불가능하면 HP·주기를 바꾸지 않고 궤도·동시 수·신호/충돌 범위를 조정한다.

## Acceptance Criteria

- [ ] 모든 자동 검증과 타입·린트·빌드가 통과한다.
- [ ] 월드 1~5에서 세 메뉴의 진입/닫기와 pause/resume이 실제로 확인된다.
- [ ] 슬리퍼만으로 W2~5 보스 직접 진입 클리어, 스킬 보상, W5 엔딩이 확인된다.
- [ ] 별도 월드 2 맵 계획의 pending 상태와 이번 계획의 완료 범위를 최종 보고에 명확히 남긴다.

## Validation

- `node --test scripts/corgi-wardrobe-campaign.integration.test.mjs scripts/goodboy-market-save.test.mjs scripts/owned-item-catalog.test.mjs scripts/boss-stage-content.test.mjs scripts/stage-progression.test.mjs` — 통합 회귀.
- `npx tsc --noEmit && npm run lint && npm run build` — 타입·린트·빌드.
- 실제 브라우저에서 W1 재도전, W2~5 보스 직접 진입, 월드 3 네 맵, 저장 새로고침, 좁은 화면 UI를 수동 확인.

## Commit Message

```text
fix(통합): 의상 그림판 공사장 보스 플레이 흐름 점검

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P04-boss-combat
Task: T06-campaign-qa

- 저장 메뉴 일시정지와 보스 전투의 회귀 오류를 수정
- 기본 슬리퍼 클리어와 최종 엔딩 흐름을 검증
```

## Progress

- [x] 구현 완료: 캠페인 통합 테스트와 모바일 HUD 겹침 수정.
- [x] 검증 통과: 관련 테스트 25개, 타입 검사, 린트, 프로덕션 빌드, Chrome 메뉴·그림판·모바일 확인.
- 수동 검증 기록: [캠페인 QA](../../../test-plans/2026-10-22-campaign-qa.md).
- commit: 이 Task의 한국어 커밋에 포함
