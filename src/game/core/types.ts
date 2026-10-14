import type { StageMapDefinition, StageSegment } from "./contentTypes";

export type WorldId =
  | "world-01"
  | "world-02"
  | "world-03"
  | "world-04"
  | "world-05";

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
export type InputAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "attack"
  | "dash"
  | "bark"
  | "pause";

export type ToolSlot = "attack" | "defense";

export interface ProgressState {
  version: number;
  onboardingCompleted: boolean;
  playerName: string;
  clearedStages: StageId[];
  world01CheckpointStageId: World01CheckpointStageId | null;
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
  inputAction: Extract<InputAction, "bark" | "attack" | "dash"> | "jump";
  description: string;
  effect: string;
}

export interface ToolDefinition {
  id: ToolId;
  slot: ToolSlot;
  price: number;
  passiveEffect: string;
  charges: number | null;
  hiddenDrawbackId: string;
  discoverOnTrigger: boolean;
}
