import type {
  InputAction,
  ProgressState,
  RuntimeStageState,
  StageId,
  StageNumber,
  WorldId,
} from "./types";

export const WORLD_IDS: readonly WorldId[] = [
  "world-01",
  "world-02",
  "world-03",
  "world-04",
  "world-05",
];

export const NORMAL_STAGE_NUMBERS: readonly Exclude<StageNumber, "boss">[] = [
  1,
  2,
  3,
  4,
];

export const STAGE_SUFFIXES: readonly StageNumber[] = [
  1,
  2,
  3,
  4,
  "boss",
];

export const stageIdFor = (
  worldId: WorldId,
  stageNumber: StageNumber,
): StageId => (worldId + "-stage-" + stageNumber) as StageId;

export const STAGE_IDS: readonly StageId[] = WORLD_IDS.flatMap((worldId) =>
  STAGE_SUFFIXES.map((stageNumber) => stageIdFor(worldId, stageNumber)),
);

export function getNextStageId(stageId: StageId): StageId | null {
  const index = STAGE_IDS.indexOf(stageId);
  return index < 0 ? null : STAGE_IDS[index + 1] ?? null;
}

export const BOSS_STAGE_IDS: readonly StageId[] = WORLD_IDS.map((worldId) =>
  stageIdFor(worldId, "boss"),
);

export const DEFAULT_KEYBINDS: Readonly<Record<InputAction, string>> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  jump: "Space",
  attack: "KeyJ",
  dash: "KeyK",
  bark: "KeyL",
  pause: "Escape",
};

export const DEFAULT_VERSION = 2;
export const DEFAULT_ATTACK_TOOL_ID = "rabbit-slipper";
export const DEFAULT_DEFENSE_TOOL_ID = "upside-down-bowl";
export const DEFAULT_DEFENSE_CHARGES = 3;
export const NORMAL_STAGE_CHECKPOINT_COUNT = 1;
export const BOSS_STAGE_CHECKPOINT_COUNT = 0;
export const MAP_TILE_SIZE = 16;
export const NORMAL_MAP_WIDTH = 3840;
export const WORLD01_NORMAL_MAP_WIDTH = 2560;
export const NORMAL_MAP_SAFE_LENGTH = 192;
export const NORMAL_MAP_GAUNTLET_LENGTH = 1152;
export const BOSS_MAP_WIDTH = 1920;

export function createDefaultProgressState(
  playerName = "코기",
): ProgressState {
  return {
    version: DEFAULT_VERSION,
    onboardingCompleted: false,
    playerName,
    clearedStages: [],
    unlockedSkills: [],
    ownedToolIds: [DEFAULT_ATTACK_TOOL_ID, DEFAULT_DEFENSE_TOOL_ID],
    equippedAttackToolId: DEFAULT_ATTACK_TOOL_ID,
    equippedDefenseToolId: DEFAULT_DEFENSE_TOOL_ID,
    bankedCoins: 0,
    collectedItems: [],
    deathsTotal: 0,
    deathsByStage: {},
    seenCutsceneIds: [],
    discoveredDrawbackIds: [],
    keybinds: { ...DEFAULT_KEYBINDS },
  };
}

export function createRuntimeStageState(
  stageId: StageId,
  randomSeed = 1,
): RuntimeStageState {
  return {
    stageId,
    attempt: 1,
    currentStageCoins: 0,
    checkpointId: null,
    checkpointUsed: false,
    activeToolCharges: {
      [DEFAULT_DEFENSE_TOOL_ID]: DEFAULT_DEFENSE_CHARGES,
    },
    randomSeed,
    checkpointSeed: null,
    mapSnapshotVersion: 0,
  };
}
