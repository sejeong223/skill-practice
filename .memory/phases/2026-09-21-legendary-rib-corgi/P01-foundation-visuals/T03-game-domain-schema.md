# Task: T03 게임 상태·월드·스킬·도구·스테이지 도메인 스키마

## Status: done

## Goal

게임플레이·UI·저장·콘텐츠가 같은 타입을 공유하도록 핵심 도메인 모델과 정적 registry의 계약을 만든다. 이후 Task가 파일을 다시 탐색하거나 문자열 key를 추측하지 않도록 모든 ID와 상태 전이를 명시한다.

## Decision Summary

- 모든 콘텐츠는 데이터 기반으로 정의하고, 5개 월드·25개 스테이지를 같은 `StageDefinition` 구조로 로드한다.
- 진행 저장은 `ProgressState`, 런타임 진행은 `RuntimeStageState`로 분리해 진행 중 스테이지 위치와 안전 금고 코인을 혼동하지 않는다.

## Implementation

### I01. 공통 타입

- Related Files:
  - `src/game/core/types.ts` :: domain types; new
  - `src/game/core/constants.ts` :: canonical IDs and limits; new

#### Details

- **Signatures & Types**:
  ```typescript
  export type WorldId = "world-01" | "world-02" | "world-03" | "world-04" | "world-05";
  export type StageId = `${WorldId}-stage-${1 | 2 | 3 | 4 | "boss"}`;
  export type SkillId = "bark" | "bite" | "dash" | "double-jump" | "tail-rotor";
  export type ToolId = string;
  export type InputAction = "left" | "right" | "up" | "down" | "jump" | "attack" | "dash" | "bark" | "pause";

  export interface ProgressState {
    version: number;
    playerName: string;
    clearedStages: StageId[];
    unlockedSkills: SkillId[];
    ownedToolIds: ToolId[];
    equippedAttackToolId: ToolId;
    equippedDefenseToolId: ToolId;
    bankedCoins: number;
    collectedItems: string[];
    deathsTotal: number;
    deathsByStage: Partial<Record<StageId, number>>;
    seenCutsceneIds: string[];
    discoveredDrawbackIds: string[];
    keybinds: Record<InputAction, string>;
  }

  export interface RuntimeStageState {
    stageId: StageId;
    attempt: number;
    currentStageCoins: number;
    checkpointId: string | null;
    checkpointUsed: boolean;
    activeToolCharges: Record<ToolId, number>;
    randomSeed: number;
  }

  export interface StageDefinition {
    id: StageId;
    worldId: WorldId;
    title: string;
    subtitle: string;
    kind: "normal" | "boss";
    spawn: { x: number; y: number };
    checkpointIds: string[];
    mapWidth: number;
    mapHeight: number;
    segments: StageSegment[];
    collectibleIds: string[];
    cutsceneIds: string[];
    bossId?: string;
  }
  ```
- `ProgressState`의 기본값은 `playerName: "코기"`, 빈 해금·수집·사망 목록, `bankedCoins: 0`, 기본 공격 도구 `rabbit-slipper`, 기본 방어 도구 `upside-down-bowl`로 정한다.
- `StageDefinition.checkpointIds`는 정상 스테이지에서 정확히 1개, 보스전에서는 0개 또는 콘텐츠 설계에서 명시한 1개만 허용한다.

### I02. 콘텐츠 모델

- Related Files:
  - `src/game/core/contentTypes.ts` :: `StageSegment`, `TrapDefinition`, `EnemyDefinition`, `BossDefinition`, `CutsceneDefinition`; new
  - `src/game/data/skills.ts` :: `SKILL_DEFINITIONS`; new
  - `src/game/data/tools.ts` :: `TOOL_DEFINITIONS`; new
  - `src/game/data/worlds.ts` :: `WORLD_DEFINITIONS`; new

#### Details

- `StageSegment`는 `platforms`, `traps`, `enemies`, `coins`, `collectibles`, `decorations`의 배열과 `length`를 갖는다.
- `TrapDefinition`은 `id`, `kind`, `x`, `y`, `width`, `height`, `trigger`, `lethal`, `randomized`, `telegraph`, `effect`를 갖는다.
- `EnemyDefinition`은 `id`, `kind`, `spawn`, `patrol`, `health`, `contactDamage`, `canBeStunned`, `loot`를 갖는다.
- `BossDefinition`은 `id`, `name`, `worldId`, `phases`, `arenaStageId`, `rewardSkill`, `cutsceneIds`를 갖는다.
- `SkillDefinition`은 `id`, `unlockAfterBossId`, `cooldownMs`, `inputAction`, `description`, `effect`를 갖는다.
- `ToolDefinition`은 `id`, `slot: "attack" | "defense"`, `price`, `passiveEffect`, `charges`, `hiddenDrawbackId`, `discoverOnTrigger`를 갖는다.
- 스킬 해금 순서는 `bark`, `bite`, `dash`, `double-jump`, `tail-rotor`로 고정한다.

### I03. 검증 가능한 registry

- Related Files:
  - `src/game/data/validateContent.ts` :: `validateContentRegistry`; new
  - `src/game/data/index.ts` :: public data exports; new

#### Details

- 모든 ID 중복, 누락된 보스 보상, 잘못된 월드 순서, 스테이지 번호 누락, 가격 음수, cooldown 음수를 빌드 전 검사한다.
- `getStageDefinition(stageId)`, `getSkillDefinition(skillId)`, `getToolDefinition(toolId)`는 없는 ID에 대해 `undefined`를 반환하지 말고 명시적인 `ContentRegistryError`를 throw한다.

## Acceptance Criteria

+ [x] 코어 타입이 진행 저장과 런타임 상태를 분리한다.
+ [x] 스킬·도구·스테이지·보스·컷신이 문자열 추측 없이 registry에서 조회된다.
+ [x] 25개 StageId와 5개 WorldId가 타입 및 registry 규칙으로 표현된다.
+ [x] 콘텐츠 검증기가 중복·누락·잘못된 가격·잘못된 스킬 순서를 잡는다.

## Validation

- `npm run lint` — 모든 domain type과 registry 타입 검사 통과
- `npm run build` — 콘텐츠 registry import 및 validation 통과

## Commit Message

```text
feat(core): define game domain schemas and content registries

Plan: 2026-09-21-legendary-rib-corgi
Phase: P01-foundation-visuals
Task: T03-game-domain-schema

- Add typed progress, runtime, stage, skill and tool models
- Add content registry validation for the 25-stage campaign
```

## Progress

+ [x] 구현 완료
+ [x] 검증 통과
+ commit: T03 commit recorded in git history
