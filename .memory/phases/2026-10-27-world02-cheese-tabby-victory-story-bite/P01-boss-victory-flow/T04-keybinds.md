# Task: T04 공격 Q·짖기 W·물기 E와 저장 마이그레이션

## Status: done

## Goal

기본·기존 저장 게임 모두 공격 Q, 짖기 W, 물기 E를 별개 입력으로 인식하고, 물기 6초 쿨타임 정의와 조작 설정의 표시를 일치시킨다. W를 눌렀을 때 위쪽 이동이 함께 발동하지 않는다.

## Decision Summary

- 2026-10-27 사용자 지정: 공격 `Q`, 짖기 `W`, 물기 `E`; 물기 cooldown `6000ms`. 물기는 공격 도구와 별개 입력이며 기존 슬리퍼 콤보에서 자동 발동하지 않는다.
- `W`는 기존 `InputManager.DEFAULT_KEYBINDS.up=["W","UP"]`와 충돌한다. 위쪽 이동은 `ArrowUp/UP`만 유지한다. 저장 스키마를 5로 한 번 올려 오래된 키 설정을 새 배치로 마이그레이션하되 v5 이후 사용자가 다시 바꾼 키는 보존한다.

## Implementation

### I01. 입력 액션과 기본값

- Related Files:
  - `src/game/core/types.ts` :: `InputAction`, `ProgressState.keybinds`, `SkillDefinition.inputAction` — `"bite"` 액션 추가; modify
  - `src/game/core/constants.ts` :: `DEFAULT_KEYBINDS`, `DEFAULT_VERSION`, `createDefaultProgressState` — Q/W/E와 버전 5; modify
  - `src/game/input/inputTypes.ts` :: `KeybindMap`, `InputSnapshot` — `bite: string[]`, `bitePressed: boolean`; modify
  - `src/game/input/InputManager.ts` :: `DEFAULT_KEYBINDS`, `toKeybindMap`, `getSnapshot` — 공격 Q/짖기 W/물기 E 및 up=UP; modify
  - `src/components/game/KeybindPanel.tsx` :: `ACTION_LABELS` — 물기 항목 추가; modify
  - `src/game/data/skills.ts` :: `BITE_COOLDOWN_MS`, `SKILL_DEFINITIONS`의 `bite` — `inputAction="bite"`, `cooldownMs=6000`, 새 설명; modify
  - `src/game/scenes/PrototypeScene.ts` :: `InputManager.DEFAULT_KEYBINDS` 소비 — 새 액션 타입 적용 확인; read-only unless type/runtime requires

#### Details

- **Signatures & Types**:
  ```typescript
  export type InputAction = "left" | "right" | "up" | "down" | "jump" | "attack" | "dash" | "bark" | "bite" | "pause";
  export interface KeybindMap { left: string[]; right: string[]; up: string[]; down: string[];
    jump: string[]; attack: string[]; dash: string[]; bark: string[]; bite: string[]; pause: string[]; }
  export interface InputSnapshot { left: boolean; right: boolean; jumpPressed: boolean; jumpHeld: boolean;
    attackPressed: boolean; dashPressed: boolean; barkPressed: boolean; bitePressed: boolean;
    pausePressed: boolean; pauseHeld: boolean; }
  export function toKeybindMap(keybinds: Readonly<Record<string, string>>): KeybindMap;
  // SkillDefinition.inputAction의 Extract 대상에 "bite"를 포함한다.
  ```
- **Data & Schema Fields**:
  - 새 진행 기본값: `ProgressState.keybinds.attack="KeyQ"`, `bark="KeyW"`, `bite="KeyE"`, `up="ArrowUp"`; 나머지는 기존 기본값. `InputManager.DEFAULT_KEYBINDS`에는 각각 `["Q"]`, `["W"]`, `["E"]`, up `["UP"]`.
  - `export const BITE_COOLDOWN_MS = 6_000`을 정의한다. `SKILL_DEFINITIONS`의 bite: `id="bite"`, `displayName="물기"`, `unlockAfterBossId="world-02-boss"`, `cooldownMs=BITE_COOLDOWN_MS`, `inputAction="bite"`, `description="코기의 날카로운 이빨로 적을 앙숙처럼 물어뜯어 큰 피해를 줍니다."`, 기존 effect ID `"close-range-bite"` 유지.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 각 `InputAction`은 `DEFAULT_KEYBINDS`, `KeybindMap`, `KeybindPanel`에서 정확히 하나의 역할을 갖는다. `KeybindPanel`의 기존 중복 키 거절을 유지한다.
  2. Core Processing: `toKeybindMap`은 저장 값 `KeyQ/KeyW/KeyE`를 Phaser `Q/W/E`로 변환하고 빠진 bite 값은 E를 사용한다. `getSnapshot()`은 E의 JustDown을 `bitePressed`로 한 프레임만 보고한다. W는 `barkPressed`만 올리고 `up`에는 쓰이지 않는다.
  3. Error & Exception Handling: 키보드 객체가 없을 때 기존 오류를 유지한다. 사용자 재설정 중 Scene의 `setKeybinds()`가 모든 키를 제거·재등록하므로 bite도 포함한다.
  4. State Transition & Return: 신규 게임/프로토타입/저장 복구 후 Q 공격, W 짖기, E 물기 상태가 독립적으로 도착한다. 실제 E 물기 처리는 T05에서 연결한다.

### I02. 스키마 4 → 5 키 설정 마이그레이션

- Related Files:
  - `src/game/persistence/saveTypes.ts` :: `SaveSchemaVersion`, `SAVE_SCHEMA_VERSION` — 5; modify
  - `src/game/persistence/migrations.ts` :: `migrateSave` — 0~5 허용, 구버전 키 재배치, 기존 커스텀 의상 보존; modify
  - `scripts/keybind-migration.test.mjs` :: 새·기존 저장의 키 매핑/충돌 테스트; new
  - `scripts/goodboy-market-save.test.mjs` :: 저장 schema 기대값과 미지원 상한/의상 회귀; modify
  - `scripts/corgi-wardrobe-campaign.integration.test.mjs` :: 저장 후 사용자 옷 버전 기대값; modify
  - `scripts/snack-wallet.test.mjs` :: 저장 envelope 버전 기대값; modify
  - `scripts/world-selection.test.mjs` :: 기존 진행 저장 회귀; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export type SaveSchemaVersion = 5;
  export const SAVE_SCHEMA_VERSION: SaveSchemaVersion = 5;
  export function migrateSave(input: unknown): ProgressState;
  ```
- **Data & Schema Fields**: `ProgressState.version=5`; save envelope `schemaVersion=5`. `keybinds`는 `Record<InputAction,string>`에 새 `bite` 필드를 가진다. v4의 `customOutfits`/`equippedCustomOutfitId`는 v5에서도 보존하도록 기존 `schemaVersion===4` 검사를 `schemaVersion>=4` 범위로 확장한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 0~4 save는 기존 파서로 읽고 5 save도 수용한다. >5 및 잘못된 필드는 기존 fallback 정책을 유지한다.
  2. Core Processing: schema<5인 저장을 읽을 때 기본/기존 사용자 키 배치에서 `attack=KeyQ`, `bark=KeyW`, 새 `bite=KeyE`로 한 번 바꾼다. `up=KeyW`면 `ArrowUp`으로 바꾼다. 다른 액션이 Q/W/E와 충돌하면 해당 액션을 새 기본키로 되돌려 한 키의 동시 발동을 막는다. 기존 코인·월드 선택·해금·장비·의상은 보존한다. schema=5인 저장은 사용자가 이후 바꾼 키를 그대로 유지한다.
  3. Error & Exception Handling: bite 누락은 E로 채운다. 타입이 아닌 키 값은 기존 기본값으로 대체한다. 중복 또는 변환 실패가 있어도 다른 진행 필드를 초기화하지 않는다.
  4. State Transition & Return: 저장을 다시 쓰면 schema 5가 된다. 옛 v4 저장과 새 v5 저장 모두 다음 로드에서 동일한 키 설정을 보존한다.

### I03. 조작 설정 검증

- Related Files:
  - `scripts/keybind-migration.test.mjs` :: 새 Progress와 v4/v5 save, `toKeybindMap` 결과를 검사; new
  - `src/game/input/keybindPresentation.ts` :: Q/W/E 표기 확인; read-only

#### Details

- 신규·v4 저장에서 `KeyQ/KeyW/KeyE`, `ArrowUp`을 검증한다. `KeyW`가 `up`에 포함되지 않는지, 기존 v4 custom outfit/장비/코인 값이 남는지 확인한다. v5 저장에서 사용자가 임의 재설정한 `attack`, `bark`, `bite`는 재마이그레이션하지 않는지 확인한다.

## Acceptance Criteria

- [ ] 신규/기존 저장에서 Q·W·E가 서로 다른 액션으로 동작하고 W가 위쪽 이동을 일으키지 않는다.
- [ ] 물기 항목이 조작 설정에 표시되고 6초 스킬 정의가 적용된다.
- [ ] 저장 업그레이드로 의상·장비·코인·해금 상태를 잃지 않는다.

## Validation

- `node --test scripts/keybind-migration.test.mjs scripts/goodboy-market-save.test.mjs scripts/world-selection.test.mjs` — v4→5/신규/v5 키 설정과 저장 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 추가 `InputAction`의 모든 필수 Record 타입 검사 통과.
- `node node_modules/eslint/bin/eslint.js src/game/core/types.ts src/game/core/constants.ts src/game/input/inputTypes.ts src/game/input/InputManager.ts src/game/data/skills.ts src/game/persistence/saveTypes.ts src/game/persistence/migrations.ts src/components/game/KeybindPanel.tsx scripts/keybind-migration.test.mjs` — lint 오류 0개.
- 브라우저에서 신규 저장과 v4 복구 저장 각각 Q/W/E 및 조작 설정 항목을 확인한다.

## Commit Message

```text
feat(input): 공격 짖기 물기 키를 Q W E로 나누기

Plan: 2026-10-27-world02-cheese-tabby-victory-story-bite
Phase: P01-boss-victory-flow
Task: T04-keybinds

- 공격 Q 짖기 W 물기 E와 6초 물기 정의 적용
- 기존 저장의 키 충돌을 해소하고 스키마 5로 업그레이드
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: T04-keybinds
