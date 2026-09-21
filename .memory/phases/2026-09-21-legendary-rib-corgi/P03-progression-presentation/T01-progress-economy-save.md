# Task: T01 localStorage 진행 저장·안전 금고 코인·수집품

## Status: done

## Goal

플레이어 이름·클리어 진행·스킬·영구 장비·안전 금고 코인·수집품·사망 통계·키 설정을 버전 있는 localStorage 저장소에 자동 저장하고, 현재 스테이지 위치와 현재 스테이지 코인은 저장하지 않는다.

## Decision Summary

- 스테이지 클리어 시 current-stage coins만 bankedCoins로 커밋한다.
- 사망 시 current-stage coins는 0이 되지만 bankedCoins, 영구 장비, 스킬, 수집품, 누적 사망 통계는 유지한다.

## Implementation

### I01. 저장 스키마와 migration

- Related Files:
  - src/game/persistence/saveTypes.ts :: SaveEnvelope, SaveSchemaVersion — new
  - src/game/persistence/ProgressStore.ts :: ProgressStore — new
  - src/game/persistence/migrations.ts :: migrateSave — new
  - src/game/core/types.ts :: ProgressState — modify

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface SaveEnvelope {
    schemaVersion: number;
    updatedAt: string;
    progress: ProgressState;
  }

  export class ProgressStore {
    load(): ProgressState;
    save(progress: ProgressState): void;
    clear(): void;
    update(mutator: (current: ProgressState) => ProgressState): ProgressState;
  }
  ~~~
- storage key는 legendary-rib-corgi:progress:v1로 고정한다.
- JSON parse 실패, schemaVersion 불일치, 배열 타입 오류, 음수 coin/death 값은 기본값으로 복구하고 console.warn을 남긴다.
- 기본 ProgressState는 playerName 코기, stage world-01-stage-1 시작, bankedCoins 0, 기본 tools 보유, 모든 skill locked다.
- migration은 새 필드 추가 시 기존 저장을 유지하고, 삭제된 ID는 owned/equipped에서 제거한다.

### I02. 경제·클리어 커밋

- Related Files:
  - src/game/systems/EconomySystem.ts :: EconomySystem — new
  - src/game/systems/CollectionSystem.ts :: CollectionSystem — new
  - src/game/bridge/GameEventBus.ts :: economy listeners — modify

#### Details

- collectCoin(stageId, amount)은 RuntimeStageState.currentStageCoins만 증가시킨다.
- commitStageClear()는 bankedCoins += currentStageCoins 후 currentStageCoins를 0으로 만든다.
- handleDeath()는 currentStageCoins를 0으로 만들고 bankedCoins를 읽기만 한다.
- 수집품은 unique collectibleId로 dedupe하고, 이미 저장된 수집품은 재획득 보상을 주지 않는다.
- 상점 구매는 bankedCoins에서만 차감하며, 구매한 도구는 ownedToolIds에 영구 추가한다.

### I03. 자동 저장 트리거

- Related Files:
  - src/game/persistence/AutoSaveCoordinator.ts :: AutoSaveCoordinator — new

#### Details

- 저장 트리거는 player-name-confirmed, stage-completed, skill-unlocked, tool-purchased, collectible-found, keybinds-changed, drawback-discovered, death-count-updated다.
- 저장은 이벤트를 debounce 100ms하고, 페이지 unload 전에 마지막 pending update를 flush한다.

## Acceptance Criteria

- [ ] 새로고침 후 이름·클리어 스테이지·스킬·장비·bankedCoins·수집품·사망 통계·키 설정이 복구된다.
- [ ] 사망 시 currentStageCoins만 사라지고 bankedCoins는 유지된다.
- [ ] 스테이지 클리어 시 currentStageCoins가 정확히 한 번만 bankedCoins로 이월된다.
- [ ] 깨진 localStorage와 구버전 저장이 게임을 중단시키지 않고 기본값 또는 migration으로 복구된다.

## Validation

## Acceptance Verification

- [x] Versioned localStorage envelope restores progress and keybinds without touching stage position.
- [x] Death clears current-stage coins while preserving banked coins.
- [x] Stage clear commits current-stage coins exactly once.
- [x] Duplicate collectibles do not grant a second discovery reward.
- [x] Invalid and legacy saves fall back or migrate without stopping the game.

- npm run lint — persistence/economy 타입 통과
- npm run build — localStorage 접근이 server render에서 실행되지 않음
- npm run dev — 새로고침·사망·클리어·재구매·수집품 중복을 수동 확인

## Commit Message

~~~text
feat(progress): add versioned save and coin economy

Plan: 2026-09-21-legendary-rib-corgi
Phase: P03-progression-presentation
Task: T01-progress-economy-save

- Persist campaign progress and keybinds in versioned localStorage
- Separate safe banked coins from current-stage coins
~~~

## Progress

- [x] 구현 완료
- [x] 검증 통과: lint, build
- commit: pending

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
