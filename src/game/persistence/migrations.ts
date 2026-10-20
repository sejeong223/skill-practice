import { DEFAULT_KEYBINDS, DEFAULT_VERSION, createDefaultProgressState } from "../core/constants";
import { SKILL_DEFINITIONS } from "../data/skills";
import { STAGE_IDS } from "../core/constants";
import { TOOL_DEFINITIONS } from "../data/tools";
import { MARKET_PRODUCTS } from "../data/marketCatalog";
import type { CosmeticId, InputAction, ProgressState, SkillId, StageId, ToolId } from "../core/types";
import { isWorld01CheckpointStageId } from "../systems/world01Respawn";

const validSkillIds = new Set<string>(SKILL_DEFINITIONS.map((definition) => definition.id));
const validToolIds = new Set<string>(TOOL_DEFINITIONS.map((definition) => definition.id));
const validStageIds = new Set<string>(STAGE_IDS);
const validAttackToolIds = new Set<string>(
  TOOL_DEFINITIONS.filter((definition) => definition.slot === "attack").map((definition) => definition.id),
);
const validDefenseToolIds = new Set<string>(
  TOOL_DEFINITIONS.filter((definition) => definition.slot === "defense").map((definition) => definition.id),
);
const cosmeticCategoryById = new Map<string, "outfit" | "accessory">(
  MARKET_PRODUCTS.filter((product) => product.category === "outfit" || product.category === "accessory")
    .map((product) => [product.cosmeticId!, product.category as "outfit" | "accessory"]),
);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function warn(message: string): void {
  console.warn("[ProgressStore] " + message);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function readStageIds(value: unknown): StageId[] {
  if (!isStringArray(value)) {
    throw new Error("stage IDs must be an array of strings");
  }
  return [...new Set(value.filter((id): id is StageId => validStageIds.has(id)))];
}

function readToolIds(value: unknown): ToolId[] {
  if (!isStringArray(value)) {
    throw new Error("tool IDs must be an array of strings");
  }
  return [...new Set(value.filter((id) => validToolIds.has(id)))];
}

function readCosmeticIds(value: unknown): CosmeticId[] {
  if (!isStringArray(value)) return [];
  return [...new Set(value.filter((id): id is CosmeticId => cosmeticCategoryById.has(id)))];
}

export function migrateSave(input: unknown): ProgressState {
  const fallback = createDefaultProgressState();
  if (!isRecord(input)) {
    warn("save is not an object; using defaults");
    return fallback;
  }

  const schemaVersion = input.schemaVersion === undefined ? 0 : input.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion) || schemaVersion < 0 || schemaVersion > 3) {
    warn("unsupported schema version; using defaults");
    return fallback;
  }
  const rawProgress = isRecord(input.progress) ? input.progress : input;

  try {
    const clearedStages = readStageIds(rawProgress.clearedStages ?? []);
    const ownedToolIds = readToolIds(rawProgress.ownedToolIds ?? fallback.ownedToolIds);
    const unlockedSkills = rawProgress.unlockedSkills;
    if (!isStringArray(unlockedSkills)) {
      throw new Error("unlocked skills must be an array of strings");
    }
    const seenCutsceneIds = rawProgress.seenCutsceneIds;
    const collectedItems = rawProgress.collectedItems;
    const discoveredDrawbackIds = rawProgress.discoveredDrawbackIds;
    if (!isStringArray(seenCutsceneIds) || !isStringArray(collectedItems) || !isStringArray(discoveredDrawbackIds)) {
      throw new Error("collection fields must be arrays of strings");
    }
    const onboardingCompleted = typeof rawProgress.onboardingCompleted === "boolean"
      ? rawProgress.onboardingCompleted
      : seenCutsceneIds.includes("intro-home");
    if (!isNonNegativeInteger(rawProgress.bankedCoins) || !isNonNegativeInteger(rawProgress.deathsTotal)) {
      throw new Error("coins and deaths must be non-negative integers");
    }
    if (typeof rawProgress.playerName !== "string") {
      throw new Error("player name must be a string");
    }
    if (!isRecord(rawProgress.deathsByStage) || !isRecord(rawProgress.keybinds)) {
      throw new Error("deaths and keybinds must be objects");
    }

    const deathsByStage: Partial<Record<StageId, number>> = {};
    for (const [stageId, count] of Object.entries(rawProgress.deathsByStage)) {
      if (validStageIds.has(stageId) && isNonNegativeInteger(count)) {
        deathsByStage[stageId as StageId] = count;
      }
    }
    const keybinds = { ...DEFAULT_KEYBINDS } as Record<InputAction, string>;
    for (const action of Object.keys(DEFAULT_KEYBINDS) as InputAction[]) {
      const key = rawProgress.keybinds[action];
      if (typeof key === "string" && key.length > 0) {
        keybinds[action] = key;
      }
    }
    const safeOwnedTools = [...new Set([...fallback.ownedToolIds, ...ownedToolIds])];
    const ownedCosmeticIds = readCosmeticIds(rawProgress.ownedCosmeticIds);
    const equippedCosmetic = (value: unknown, category: "outfit" | "accessory"): CosmeticId | null =>
      typeof value === "string" && ownedCosmeticIds.includes(value as CosmeticId) && cosmeticCategoryById.get(value) === category
        ? value as CosmeticId : null;
    const attackToolId = typeof rawProgress.equippedAttackToolId === "string" &&
      validAttackToolIds.has(rawProgress.equippedAttackToolId) &&
      safeOwnedTools.includes(rawProgress.equippedAttackToolId)
      ? rawProgress.equippedAttackToolId
      : fallback.equippedAttackToolId;
    const defenseToolId = typeof rawProgress.equippedDefenseToolId === "string" &&
      validDefenseToolIds.has(rawProgress.equippedDefenseToolId) &&
      safeOwnedTools.includes(rawProgress.equippedDefenseToolId)
      ? rawProgress.equippedDefenseToolId
      : fallback.equippedDefenseToolId;

    return {
      version: DEFAULT_VERSION,
      onboardingCompleted,
      playerName: rawProgress.playerName.trim() || fallback.playerName,
      clearedStages,
      selectedWorldId: rawProgress.selectedWorldId === "world-01" || rawProgress.selectedWorldId === "world-02"
        ? rawProgress.selectedWorldId : null,
      world01BossReplayActive: rawProgress.world01BossReplayActive === true,
      world01CheckpointStageId: isWorld01CheckpointStageId(rawProgress.world01CheckpointStageId)
        ? rawProgress.world01CheckpointStageId : null,
      unlockedSkills: [...new Set(unlockedSkills.filter((id): id is SkillId => validSkillIds.has(id)))],
      ownedToolIds: safeOwnedTools,
      ownedCosmeticIds,
      equippedAttackToolId: attackToolId,
      equippedDefenseToolId: defenseToolId,
      equippedOutfitId: equippedCosmetic(rawProgress.equippedOutfitId, "outfit"),
      equippedAccessoryId: equippedCosmetic(rawProgress.equippedAccessoryId, "accessory"),
      bankedCoins: rawProgress.bankedCoins,
      collectedItems: [...new Set(collectedItems)],
      deathsTotal: rawProgress.deathsTotal,
      deathsByStage,
      seenCutsceneIds: [...new Set(seenCutsceneIds)],
      discoveredDrawbackIds: [...new Set(discoveredDrawbackIds)],
      keybinds,
    };
  } catch (error) {
    warn("invalid save fields; using defaults (" + String(error) + ")");
    return fallback;
  }
}
