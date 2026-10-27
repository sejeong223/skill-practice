import { DEFAULT_KEYBINDS, DEFAULT_VERSION, createDefaultProgressState } from "../core/constants";
import { SKILL_DEFINITIONS } from "../data/skills";
import { STAGE_IDS } from "../core/constants";
import { TOOL_DEFINITIONS } from "../data/tools";
import { MARKET_PRODUCTS } from "../data/marketCatalog";
import type { CosmeticId, CustomOutfitDesign, CustomOutfitId, InputAction, ProgressState, SkillId, StageId, ToolId } from "../core/types";
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
const customOutfitIds: readonly CustomOutfitId[] = ["custom-outfit-1", "custom-outfit-2", "custom-outfit-3"];
const colorPattern = /^#[0-9A-Fa-f]{6}$/;
const isoPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;

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

export function sanitizeCustomOutfits(value: unknown): CustomOutfitDesign[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<CustomOutfitId, CustomOutfitDesign>();
  for (const entry of value) {
    if (!isRecord(entry) || !customOutfitIds.includes(entry.id as CustomOutfitId)) continue;
    if (!Array.isArray(entry.cells) || entry.cells.length !== 56 * 32 ||
        !entry.cells.every((cell) => cell === null || typeof cell === "string" && colorPattern.test(cell))) continue;
    if (typeof entry.updatedAt !== "string" || !isoPattern.test(entry.updatedAt) ||
        !Number.isFinite(Date.parse(entry.updatedAt))) continue;
    byId.set(entry.id as CustomOutfitId, {
      id: entry.id as CustomOutfitId,
      cells: [...entry.cells],
      updatedAt: entry.updatedAt,
    });
  }
  return customOutfitIds.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}

export function migrateSave(input: unknown): ProgressState {
  const fallback = createDefaultProgressState();
  if (!isRecord(input)) {
    warn("save is not an object; using defaults");
    return fallback;
  }

  const schemaVersion = input.schemaVersion === undefined ? 0 : input.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion) || schemaVersion < 0 || schemaVersion > 5) {
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
    if (schemaVersion < 5) {
      keybinds.attack = "KeyQ";
      keybinds.bark = "KeyW";
      keybinds.bite = "KeyE";
      if (keybinds.up === "KeyW") keybinds.up = "ArrowUp";
      for (const action of Object.keys(DEFAULT_KEYBINDS) as InputAction[]) {
        if (action !== "attack" && action !== "bark" && action !== "bite" &&
            ["KeyQ", "KeyW", "KeyE"].includes(keybinds[action])) {
          keybinds[action] = DEFAULT_KEYBINDS[action];
        }
      }
    }
    const safeOwnedTools = [...new Set([...fallback.ownedToolIds, ...ownedToolIds])];
    const ownedCosmeticIds = readCosmeticIds(rawProgress.ownedCosmeticIds);
    const customOutfits = schemaVersion >= 4 ? sanitizeCustomOutfits(rawProgress.customOutfits) : [];
    const equippedCustomOutfitId = schemaVersion >= 4 &&
      typeof rawProgress.equippedCustomOutfitId === "string" &&
      customOutfits.some((design) => design.id === rawProgress.equippedCustomOutfitId)
      ? rawProgress.equippedCustomOutfitId as CustomOutfitId : null;
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
      equippedOutfitId: equippedCustomOutfitId ? null : equippedCosmetic(rawProgress.equippedOutfitId, "outfit"),
      customOutfits,
      equippedCustomOutfitId,
      equippedAccessoryId: equippedCosmetic(rawProgress.equippedAccessoryId, "accessory"),
      bankedCoins: rawProgress.bankedCoins,
      collectedCoinIds: isStringArray(rawProgress.collectedCoinIds)
        ? [...new Set(rawProgress.collectedCoinIds.filter((key) => {
          const separator = key.indexOf(":");
          return separator > 0 && separator < key.length - 1 && validStageIds.has(key.slice(0, separator));
        }))]
        : [],
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
