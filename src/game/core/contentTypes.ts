import type {
  SkillDefinition,
  SkillId,
  StageDefinition,
  StageId,
  ToolDefinition,
  ToolId,
  WorldId,
} from "./types";

export type MapPropertyValue = string | number | boolean;

export type MapSectionRole =
  | "safe-entry"
  | "gauntlet"
  | "checkpoint-gauntlet"
  | "safe-exit";

export type MapLayerKind =
  | "background-far"
  | "background-mid"
  | "gameplay"
  | "foreground";

export type MapObjectKind =
  | "decoration"
  | "interactive"
  | "trap"
  | "enemy-spawn"
  | "checkpoint"
  | "collectible"
  | "exit";

export type MapChainTrigger =
  | "object-enter"
  | "object-hit"
  | "trap-triggered"
  | "enemy-defeated"
  | "checkpoint-reached"
  | "timer"
  | "chain-fired";

export type MapChainActionKind =
  | "activate-object"
  | "deactivate-object"
  | "move-object"
  | "spawn-enemy"
  | "set-collision"
  | "emit-event"
  | "camera-effect";

export interface MapSectionDefinition {
  readonly id: string;
  readonly index: 1 | 2 | 3 | 4 | 5;
  readonly role: MapSectionRole;
  readonly x: number;
  readonly width: number;
  readonly safe: boolean;
  readonly vertical: boolean;
  readonly checkpointId?: string;
  readonly mapObjectIds: readonly string[];
}

export interface MapLayerDefinition {
  readonly layerId: string;
  readonly kind: MapLayerKind;
  readonly depth: number;
  readonly scrollFactorX: number;
  readonly scrollFactorY: number;
  readonly assetKey: string;
}

export interface MapChainCondition {
  readonly property: string;
  readonly equals?: MapPropertyValue;
  readonly notEquals?: MapPropertyValue;
}

export interface MapChainActionDefinition {
  readonly type: MapChainActionKind;
  readonly targetId?: string;
  readonly value?: MapPropertyValue;
  readonly delayMs?: number;
  readonly eventType?: string;
}

export interface MapChainRule {
  readonly id: string;
  readonly trigger: MapChainTrigger;
  readonly sourceId?: string;
  readonly condition?: MapChainCondition;
  readonly actions: readonly MapChainActionDefinition[];
  readonly randomized: boolean;
  readonly seedGroup?: string;
}

export interface MapObjectDefinition {
  readonly id: string;
  readonly kind: MapObjectKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly visualKey: string;
  readonly layerId: string;
  readonly collision: boolean;
  readonly triggerId?: string;
  readonly variantPool?: readonly string[];
  readonly chainId?: string;
  readonly seedGroup?: string;
  readonly properties: Readonly<Record<string, MapPropertyValue>>;
}

export interface WorldMapPalette {
  readonly far: string;
  readonly mid: string;
  readonly gameplay: string;
  readonly foreground: string;
  readonly accent: string;
}

export interface WorldMapThemeDefinition {
  readonly id: string;
  readonly worldId: WorldId;
  readonly tilesetKey: string;
  readonly palette: WorldMapPalette;
  readonly layers: readonly MapLayerDefinition[];
  readonly objectVisualKeys: readonly string[];
  readonly hazardCatalog: readonly string[];
}

export interface StageMapDefinition {
  readonly mapKey: string;
  readonly mapFile: string;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly sections: readonly MapSectionDefinition[];
  readonly layers: readonly MapLayerDefinition[];
  readonly objectDefinitions: readonly MapObjectDefinition[];
  readonly chainRules: readonly MapChainRule[];
}

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
  worldMaps: readonly WorldMapThemeDefinition[];
  stages: readonly StageDefinition[];
  bosses: readonly BossDefinition[];
  skills: readonly SkillDefinition[];
  tools: readonly ToolDefinition[];
  cutscenes: readonly CutsceneDefinition[];
}

export type ContentId = StageId | SkillId | ToolId;
