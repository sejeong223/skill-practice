import type {
  SkillDefinition,
  SkillId,
  StageDefinition,
  StageId,
  ToolDefinition,
  ToolId,
  WorldId,
} from "./types";

export type TrapKind =
  | "spike"
  | "falling-object"
  | "false-floor"
  | "moving-platform"
  | "wind"
  | "catapult"
  | "juice-slick"
  | "camera-flash";

export type TrapTrigger =
  | "contact"
  | "proximity"
  | "timed"
  | "sequence"
  | "parry";

export type EnemyKind =
  | "stray-cat"
  | "alley-cat"
  | "junkyard-cat"
  | "factory-cat"
  | "storm-cat"
  | "guard-cat";

export interface PlatformDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrapDefinition {
  id: string;
  kind: TrapKind;
  x: number;
  y: number;
  width: number;
  height: number;
  trigger: TrapTrigger;
  lethal: boolean;
  randomized: boolean;
  telegraph: string;
  effect: string;
}

export interface EnemyDefinition {
  id: string;
  kind: EnemyKind;
  spawn: { x: number; y: number };
  patrol: { minX: number; maxX: number; speed: number };
  health: number;
  contactDamage: number;
  canBeStunned: boolean;
  loot: string[];
}

export interface BossPhaseDefinition {
  id: string;
  healthThreshold: number;
  pattern: string;
  telegraph: string;
}

export interface BossDefinition {
  id: string;
  name: string;
  worldId: WorldId;
  phases: BossPhaseDefinition[];
  arenaStageId: StageId;
  rewardSkill: SkillId;
  cutsceneIds: string[];
}

export interface CutsceneDefinition {
  id: string;
  kind: "world-intro" | "boss-intro" | "boss-clear" | "discovery" | "ending";
  speakerIds: string[];
  durationMs: number;
}

export interface StageSegment {
  id: string;
  length: number;
  platforms: PlatformDefinition[];
  traps: TrapDefinition[];
  enemies: EnemyDefinition[];
  coins: string[];
  collectibles: string[];
  decorations: string[];
}

export interface WorldDefinition {
  id: WorldId;
  order: number;
  title: string;
  subtitle: string;
  stageIds: StageId[];
  bossId: string;
}

export interface ContentRegistry {
  worlds: readonly WorldDefinition[];
  stages: readonly StageDefinition[];
  bosses: readonly BossDefinition[];
  skills: readonly SkillDefinition[];
  tools: readonly ToolDefinition[];
  cutscenes: readonly CutsceneDefinition[];
}

export type ContentId = StageId | SkillId | ToolId;
