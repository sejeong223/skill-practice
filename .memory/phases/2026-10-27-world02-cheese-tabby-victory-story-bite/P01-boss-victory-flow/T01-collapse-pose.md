# Task: T01 치즈 태비 패배 프레임과 방향

## Status: done

## Goal

월드 2 치즈 태비의 HP가 0이 되는 즉시 흰 피격 색이 사라지고, 쓰러진 4번째 프레임에서 얼굴이 화면 왼쪽을 향한 모습이 승리 대화 내내 남는다.

## Decision Summary

- 기존 `world-02-cheese-tabby-boss` 96×96 스프라이트 시트의 index 3이 쓰러짐이다. 원본 그림은 얼굴이 오른쪽이라 패배 순간 `flipX=true`가 필요하다.
- `CheeseTabbyBallPattern.clear()`는 스프라이트를 frame 0으로 되돌린다. 반드시 `pattern.clear()` 뒤 패배 프레임을 설정한다. 치명타의 흰 `setTintFill(0xffffff)`은 명시적으로 해제한다.

## Implementation

### I01. 치명타 확정 시 시각 상태 마감

- Related Files:
  - `src/game/systems/BossEncounter.ts` :: `BossEncounter.damageBoss` — 치명타 후 tint·패턴·프레임·방향의 순서를 고친다; modify
  - `src/game/scenes/StageScene.ts` :: `StageScene.handleLaterBossDefeat` — 현재 frame 3 설정과 월드 2 분기를 확인한다. T01에서는 중복 프레임 설정이 방향을 바꾸지 않게만 한다; read-only unless needed
  - `src/game/systems/CheeseTabbyBallPattern.ts` :: `CheeseTabbyBallPattern.clear` — frame 0 복구 동작 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  private damageBoss(damage: 1 | 2 | 3): void;
  private readonly stageId: StageId;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly pattern: BossPattern;
  ```
- **Data & Schema Fields**:
  - `BossEncounterState.health: number`는 `Math.max(0, previous - damage)`로 0이 된다. `phase: BossPhase`는 `"defeated"`로 바뀐다. 새 저장 필드는 없다.
  - `world-02-cheese-tabby-boss`는 `assetManifest.json`에서 `frameWidth=96`, `frameHeight=96`, `frameCount=4`; 쓰러짐은 index 3.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 `acceptSlipperHit`/`acceptToolHit`의 `canFight()`와 명중 판정을 보존한다.
  2. Core Processing: HP 0을 확정하면 `phase="defeated"`, 위험물·강아지·경고를 정리한 다음 `pattern.clear()`를 호출한다. 이어 `sprite.clearTint()`를 호출하고 월드 2인 경우 `sprite.setFrame(3).setFlipX(true)`로 고정한다. 마지막에 `onDefeated()`를 단 한 번 부른다.
  3. Error & Exception Handling: 이미 패배했을 때 추가 명중은 `canFight()`에서 거절한다. 기존 140ms 지연 콜백이 패배 프레임을 다시 바꾸거나 tint를 켜지 못하도록 한다.
  4. State Transition & Return: `getState().health===0`, `isDefeated()===true`; 화면에서는 흰색이 아닌 쓰러짐 frame 3과 `flipX===true`가 유지된다. 재도전의 `resetAttempt()`는 기존과 같이 tint·상태를 초기화한다.

### I02. 실제 객체 상태 회귀 테스트

- Related Files:
  - `scripts/boss-encounter.test.mjs` :: `harness`, 치명타 패배 테스트 — 스프라이트의 `frame`, `flipX`, tint 상태를 추적해 월드 2 치명타와 재도전을 검증한다; modify
  - `scripts/world02-cheese-tabby-art.test.mjs` :: 기존 네 프레임 이미지 계약 — 실행만 한다; read-only

#### Details

- harness의 `sprite.setFrame`, `setFlipX`, `setTintFill`, `clearTint`를 체이닝 가능하게 모델링하고 마지막 상태를 보존한다. 월드 2에서 치명타 직후 frame 3, `flipX=true`, tint 해제, 투사체 clear, 승리 콜백 1회를 검증한다. `boss.update(50)` 이후에도 상태가 유지되고 `resetAttempt()` 후 초기 프레임/색으로 돌아오는지 확인한다.
- 시작 전 이 두 파일과 `BossEncounter.ts`에 기존 미커밋 변경이 있음을 확인한다. 코드와 커밋에는 T01의 추가 부분만 포함한다.

## Acceptance Criteria

- [ ] HP 0 순간 치즈 태비는 원래 색의 쓰러짐 자세이며 얼굴이 왼쪽에 있다.
- [ ] 공격 패턴의 `clear()`가 패배 프레임을 0으로 되돌리지 않는다.
- [ ] 재도전과 월드 3~5 보스의 기존 전투 흐름이 유지된다.

## Validation

- `node --test scripts/boss-encounter.test.mjs scripts/world02-cheese-tabby-art.test.mjs` — 치명타·프레임·에셋 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 0개.
- `node node_modules/eslint/bin/eslint.js src/game/systems/BossEncounter.ts scripts/boss-encounter.test.mjs` — lint 오류 0개.
- 브라우저에서 월드 2 보스 치명타 직후와 승리 대화 중 frame 3, `flipX=true`, tint 없음 확인.

## Commit Message

```text
fix(world02): 치즈 태비 패배 자세와 방향을 바로잡기

Plan: 2026-10-27-world02-cheese-tabby-victory-story-bite
Phase: P01-boss-victory-flow
Task: T01-collapse-pose

- 치명타의 흰 피격 색을 해제하고 패턴 정리 뒤 쓰러진 프레임 적용
- 얼굴이 왼쪽인 패배 상태와 재도전 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: T01-collapse-pose
