import type { StageMapDefinition, StageSegment } from "./contentTypes";

export type WorldId =
  | "world-01"
  | "world-02"
  | "world-03"
  | "world-04"
  | "world-05";
export type SelectableWorldId = Extract<WorldId, "world-01" | "world-02">;
export type World01ReplayPoint = "start" | "checkpoint-1" | "checkpoint-2" | "boss";
export type WorldSelectionRequest =
  | { worldId: "world-01"; point: World01ReplayPoint }
  | { worldId: "world-02" };

export type StageNumber = 1 | 2 | 3 | 4 | "boss";
export type StageId = `${WorldId}-stage-${StageNumber}`;
export type World01CheckpointStageId = "world-01-stage-2" | "world-01-stage-4";
export type SkillId =
  | "bark"
  | "bite"
  | "dash"
  | "double-jump"
  | "tail-rotor";
export type ToolId = string;
export type CosmeticId =
  | "pink-caterpillar-suit" | "banana-peel-suit" | "bee-bodysuit"
  | "hotdog-outfit" | "diamond-armor" | "shinchan-eyebrow-sticker"
  | "birthday-party-hat" | "strawberry-headpiece" | "propeller-hat" | "prince-crown";
export type CustomOutfitId = "custom-outfit-1" | "custom-outfit-2" | "custom-outfit-3";
export interface CustomOutfitDesign {
  id: CustomOutfitId;
  cells: (string | null)[];
  updatedAt: string;
}
export type MarketCategory = "weapon" | "shield" | "outfit" | "accessory";
export type MarketProduct = Readonly<{
  id: string;
  nameKo: string;
  price: number;
  iconUrl: string;
  advantageKo: string;
} & (
  { category: "weapon" | "shield"; toolId: ToolId; cosmeticId?: never } |
  { category: "outfit" | "accessory"; cosmeticId: CosmeticId; toolId?: never }
)>;
export type ToolEffectId =
  | "slipper-combo" | "squeaky-bounce" | "newspaper-reach"
  | "backscratcher-arc" | "drumstick-return" | "frisbee-straight"
  | "legacy-tube" | "bowl-three-block" | "cushion-two-block"
  | "pizza-slip" | "umbrella-front" | "pot-lid-stagger" | "legacy-box";
export type InputAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "attack"
  | "dash"
  | "bark"
  | "bite"
  | "pause";

export type ToolSlot = "attack" | "defense";

export interface ProgressState {
  version: number;
  onboardingCompleted: boolean;
  playerName: string;
  clearedStages: StageId[];
  selectedWorldId: SelectableWorldId | null;
  world01BossReplayActive: boolean;
  world01CheckpointStageId: World01CheckpointStageId | null;
  unlockedSkills: SkillId[];
  ownedToolIds: ToolId[];
  ownedCosmeticIds: CosmeticId[];
  equippedAttackToolId: ToolId;
  equippedDefenseToolId: ToolId;
  equippedOutfitId: CosmeticId | null;
  customOutfits: CustomOutfitDesign[];
  equippedCustomOutfitId: CustomOutfitId | null;
  equippedAccessoryId: CosmeticId | null;
  bankedCoins: number;
  collectedCoinIds: string[];
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
  checkpointSeed: number | null;
  mapSnapshotVersion: number;
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
  themeId?: string;
  mapKey?: string;
  map?: StageMapDefinition;
  checkpointSectionIndex?: number;
}

export interface SkillDefinition {
  id: SkillId;
  displayName: string;
  unlockAfterBossId: string;
  cooldownMs: number;
  inputAction: Extract<InputAction, "bark" | "bite" | "attack" | "dash"> | "jump";
  description: string;
  effect: string;
}

export interface ToolDefinition {
  id: ToolId;
  slot: ToolSlot;
  price: number;
  effectId: ToolEffectId;
  passiveEffect: string;
  charges: number | null;
  hiddenDrawbackId: string;
  discoverOnTrigger: boolean;
}
