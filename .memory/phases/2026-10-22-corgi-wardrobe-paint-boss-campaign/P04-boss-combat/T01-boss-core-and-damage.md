# Task: T01 공통 보스 전투와 무기 피해 단계

## Status: done

## Goal

월드 2~5가 공유할 체력·주기·명중·피격·방어·짖기·재시작 규칙을 만들고, 월드 1 삼색이 재도전에도 무기 피해 1/2/3을 적용한다.

## Decision Summary

- 사용자 결정: 월드 2~5 HP 15/20/25/40, 기본 공격 주기 3000/2600/2200/1500ms. 슬리퍼·삑삑이 1, 신문지·효자손 2, 부메랑·원반 3 피해. 월드 1에도 적용, 기본 슬리퍼로 모든 보스 클리어 가능.
- 코드 사실: 월드 1만 `World01CalicoBoss`가 HP10·하트3·900ms 피격 무적·방패·짖기 스턴을 구현하고 도구 명중을 항상 1 피해로 처리한다. `WeaponHitTracker`가 한 attackId의 중복 명중을 막는다.

## Implementation

### I01. 피해 수치와 보스 설정

- Related Files:
  - `src/game/data/bossCombat.ts` :: 신규 `getBossDamage`, `BOSS_COMBAT_CONFIG`.
  - `src/game/systems/World01CalicoBoss.ts` :: `acceptToolHit`이 피해 수치 적용, HP 0 이하 clamp, 기존 삼색이 패턴 유지.
  - `scripts/boss-stage-content.test.mjs` :: HP·주기·무기 피해 매핑과 월드 1 회귀 보강.
- **Signatures & Types**: `getBossDamage(toolId:ToolId):1|2|3`; `interface BossCombatConfig { worldId:WorldId; maxHealth:number; attackIntervalMs:number; telegraphMs:number; bossName:string; rewardSkill:SkillId }`; `BOSS_COMBAT_CONFIG:Readonly<Record<Exclude<WorldId,"world-01">,BossCombatConfig>>`.
- **Data & Schema Fields**: `rabbit-slipper`,`squeaky-ball`=1; `rolled-newspaper`,`pink-backscratcher`,`cardboard-tube`=2; `drumstick-boomerang`,`plastic-frisbee`=3. 기타/손상된 도구 ID=1로 안전하게 처리. W2~5 각각 `{15,3000}`,`{20,2600}`,`{25,2200}`,`{40,1500}`. 월드 1 HP10 유지.
- **Execution Flow / Logic**: `WeaponHitTracker.accept`가 true인 한 공격 ID에만 `getBossDamage(contact.toolId)`를 적용하고 `Math.max(0,health-damage)`로 갱신한다. 슬리퍼 명중은 1. 기존 `weapon-hit` 이벤트의 `remainingHealth`에 실제 값을 싣는다. 실제 attack cooldown·사거리·단점은 바꾸지 않는다.
- **Error & State Transition**: HP가 0이 되는 콜백은 한 번만 호출한다. 구입하지 않은 도구가 장착되면 기존 저장 검증/장비 시스템이 막고, 피해 함수만 따로 권한을 부여하지 않는다.

### I02. 월드 2~5 공통 전투 수명

- Related Files:
  - `src/game/systems/BossEncounter.ts` :: 신규 보스 클래스, 시각·패턴은 주입.
  - `src/game/systems/BossPattern.ts` :: 신규 `BossPattern`과 `BossHazard` 계약.
  - `src/game/stages/stageEvents.ts` :: `boss-hearts-changed.stageId`를 `StageId`로 일반화.
  - `src/components/game/GameShell.tsx`, `src/components/game/GameOverlay.tsx` :: 모든 `stage.kind==="boss"`에서 하트3 초기화/표시.
  - `scripts/boss-encounter.test.mjs` :: 신규 상태기계·중복명중·pause/restart/bark 검사.
- **Signatures & Types**:
  - `type BossPhase="intro"|"ready"|"telegraph"|"active"|"defeated"`.
  - `interface BossPattern { telegraph(targetX:number,serial:number):void; launch(targetX:number,serial:number):void; update(deltaMs:number):readonly BossHazardHit[]; clear():void; destroy():void }`.
  - `interface BossHazardHit { id:string; bounds:Phaser.Geom.Rectangle; sourceX:number; kind:"weak"|"boss-phase" }`.
  - `BossEncounter.start():void`, `update(deltaMs:number):void`, `acceptSlipperHit(result,player):boolean`, `acceptToolHit(contact):boolean`, `tryBarkStun(nowMs:number):boolean`, `resetAttempt():void`, `isDefeated():boolean`, `destroy():void`.
- **Data & Schema Fields**: state `{health,maxHealth,hearts:0|1|2|3,phase,elapsedMs,nextTelegraphAtMs,damageLockedUntilMs,attackSerial}`. 공격 주기는 **예고 시작부터 다음 예고 시작까지**의 간격이다. 시작 후 첫 예고는 1500ms; 기본 예고는 600ms (월드 5는 후속 Task에서 450ms), 다음 주기를 이미 경과한 경우 안전 여유 최소 500ms.
- **Execution Flow / Logic**:
  1. 씬이 `play`일 때만 `update(deltaMs)`를 호출하고 시뮬레이션 시간으로 타이머를 누적한다. 컷신/일시정지/죽음에는 이동·피격·스폰이 멈춘다.
  2. 예고 후 패턴의 `launch`를 호출하고 각 hazard의 이동·이전/현재 위치를 쓸어 충돌 판정한다. 약한 투사체는 `DefenseToolSystem.tryBlock`에 전달; 방패가 깨지면 기존 이벤트/충전 표시를 갱신한다.
  3. 피격 시 하트 1 감소와 900ms 무적; 0이면 `death-requested`를 한 번만 보낸다. 재시작 때 HP/하트/패턴/중복명중 추적을 초기화한다.
  4. 짖기는 기존 `beginBossBarkStun`의 거리 320px·스턴 1200ms·재스턴 3000ms를 사용하고 진행 중 hazard를 제거한다. 스턴 중 보스의 공격 시계도 정지한다. 이후 700ms 안전 시간을 보장한다.
  5. 승리하면 투사체를 즉시 제거하고 모든 접촉/공격 생성을 멈춘 뒤 컷신 콜백을 한 번 보낸다. boss health bar와 이름은 기존 삼색이처럼 표시한다.
- **Error & State Transition**: 패턴이 없는 보스/에셋이 없는 보스는 조용한 무적 표적으로 두지 않고 명시 오류로 실패한다. `destroy()`는 이벤트 구독·Phaser 오브젝트·텍스처 참조를 해제한다. 기존 월드 1 `World01CalicoBoss`는 이 클래스에 강제로 옮기지 않는다.

## Acceptance Criteria

- [x] 피해 단계가 모든 보스용 API와 삼색이에 정확히 적용되고 한 발이 두 번 맞아도 한 번만 깎인다.
- [x] 보스 2~5 설정 HP·주기가 고정되며 공통 전투는 정지·사망·재시작·승리·짖기를 안전하게 처리한다.
- [x] 모든 보스 스테이지 하트가 HUD에 나타난다.

## Validation

- `node --test scripts/boss-stage-content.test.mjs scripts/boss-encounter.test.mjs scripts/bark-boss-stun.test.mjs` — 수치·상태.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 삼색이 재도전에서 슬리퍼와 2·3피해 무기로 HP 감소량을 비교.

## Commit Message

```text
feat(보스): 공통 전투 규칙과 무기별 피해 단계 도입

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P04-boss-combat
Task: T01-boss-core-and-damage

- 월드 2~5 체력 공격 주기 하트 방어 짖기 규칙을 정의
- 월드 1 삼색이에도 무기 피해 1 2 3을 적용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 보스 관련 테스트 11건, 타입·린트·빌드, Chrome 삼색이 1·2·3 피해 및 중복 명중 확인
- commit: 이 Task의 한국어 커밋
