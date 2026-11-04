import { DEFAULT_KEYBINDS } from "../core/constants";
import type { ProgressState, StageId, WorldSelectionRequest } from "../core/types";
import type { MapRuntimeSnapshot } from "../core/runtimeTypes";
import type { World02TravelState } from "../data/world02Travel";
import { STAGE_DEFINITIONS } from "../data/worlds";
import { SKILL_DEFINITIONS } from "../data/skills";
import { TOOL_DEFINITIONS } from "../data/tools";
import { MARKET_PRODUCTS } from "../data/marketCatalog";
import { CHECKPOINT_STAGES, MILESTONES, PLAYABLE_PATH, worldOf } from "./progression";
import type {
  AcquireRequest, BestRecord, Bootstrap, CloudCheckpoint, CurrentState, Lease, LeaseRequest,
  LeaderboardResponse, MutationBase, ResetRequest, ResumeState, SaveAck, SaveEvent, SaveRequest,
} from "./contracts";

export class ContractError extends Error {
  readonly code = "INVALID_REQUEST";
  constructor(readonly fieldPath: string, message = "Invalid field") {
    super(message + ": " + fieldPath);
    this.name = "ContractError";
  }
}
type RecordValue = Record<string, unknown>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
function fail(path: string): never { throw new ContractError(path); }
export function record(value: unknown, path: string, keys?: readonly string[], optional: readonly string[] = []): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(path);
  const result = value as RecordValue;
  for (const key of Object.keys(result)) {
    if (forbidden.has(key) || keys && !keys.includes(key) && !optional.includes(key)) fail(path + "." + key);
  }
  if (keys?.some(key => !Object.hasOwn(result, key))) fail(path);
  return result;
}
export function textField(value: unknown, path: string, max = 128, min = 1): string {
  if (typeof value !== "string" || value.length < min || value.length > max) fail(path);
  return value;
}
export function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(path);
  return value;
}
function finite(value: unknown, path: string, min = -Number.MAX_VALUE, max = Number.MAX_VALUE): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(path);
  return value;
}
function bool(value: unknown, path: string): boolean { if (typeof value !== "boolean") fail(path); return value; }
export function uuid(value: unknown, path: string): string {
  const s = textField(value, path, 36); if (!uuidPattern.test(s)) fail(path); return s.toLowerCase();
}
export function iso(value: unknown, path: string): string {
  const s = textField(value, path, 40);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(s) || !Number.isFinite(Date.parse(s))) fail(path);
  return s;
}
function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail(path); return value as T;
}
export function stage(value: unknown, path = "stageId"): StageId { return oneOf(value, PLAYABLE_PATH, path); }
function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path); return value;
}
function strings(value: unknown, path: string, max = 8192, allowed?: readonly string[]): string[] {
  const a = list(value, path, max).map((v, i) => textField(v, path + "[" + i + "]"));
  if (new Set(a).size !== a.length || allowed && a.some(v => !allowed.includes(v))) fail(path);
  return a;
}
export function boundedJson(value: unknown, max: number, path: string): void {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); } catch { fail(path); }
  if (serialized === undefined || new TextEncoder().encode(serialized).length > max) fail(path);
}
export function normalizeNickname(value: string): string {
  return value.trim().replace(/[<>]/g, "").slice(0, 20) || "코기";
}
const progressKeys = [
  "version", "onboardingCompleted", "playerName", "clearedStages", "selectedWorldId", "world01BossReplayActive",
  "world01CheckpointStageId", "unlockedSkills", "ownedToolIds", "ownedCosmeticIds", "equippedAttackToolId",
  "equippedDefenseToolId", "equippedOutfitId", "customOutfits", "equippedCustomOutfitId", "equippedAccessoryId",
  "bankedCoins", "collectedCoinIds", "collectedItems", "deathsTotal", "deathsByStage", "seenCutsceneIds",
  "discoveredDrawbackIds", "keybinds",
];
export function validateProgress(value: unknown): ProgressState {
  boundedJson(value, 192 * 1024, "progress");
  const p = record(value, "progress", progressKeys);
  if (p.version !== 5) fail("progress.version");
  bool(p.onboardingCompleted, "onboardingCompleted"); bool(p.world01BossReplayActive, "world01BossReplayActive");
  const name = normalizeNickname(textField(p.playerName, "playerName", 8192, 0));
  strings(p.clearedStages, "clearedStages", 24, PLAYABLE_PATH);
  if (p.selectedWorldId !== null) oneOf(p.selectedWorldId, ["world-01", "world-02"], "selectedWorldId");
  if (p.world01CheckpointStageId !== null) oneOf(p.world01CheckpointStageId,
    ["world-01-stage-2", "world-01-stage-4"], "world01CheckpointStageId");
  strings(p.unlockedSkills, "unlockedSkills", 5, SKILL_DEFINITIONS.map(s => s.id));
  const owned = strings(p.ownedToolIds, "ownedToolIds", TOOL_DEFINITIONS.length, TOOL_DEFINITIONS.map(t => t.id));
  for (const [field, slot] of [["equippedAttackToolId", "attack"], ["equippedDefenseToolId", "defense"]] as const) {
    if (!owned.includes(textField(p[field], field)) || !TOOL_DEFINITIONS.some(t => t.id === p[field] && t.slot === slot)) fail(field);
  }
  const cosmeticIds = MARKET_PRODUCTS.flatMap(p => p.cosmeticId ? [p.cosmeticId] : []);
  const cosmetics = strings(p.ownedCosmeticIds, "ownedCosmeticIds", cosmeticIds.length, cosmeticIds);
  for (const [field, category] of [["equippedOutfitId", "outfit"], ["equippedAccessoryId", "accessory"]] as const) {
    if (p[field] !== null && (!cosmetics.includes(textField(p[field], field)) ||
        !MARKET_PRODUCTS.some(product => product.cosmeticId === p[field] && product.category === category))) fail(field);
  }
  const designs = list(p.customOutfits, "customOutfits", 3).map((value, i) => {
    const path = "customOutfits." + i;
    const d = record(value, path, ["id", "cells", "updatedAt"]);
    oneOf(d.id, ["custom-outfit-1", "custom-outfit-2", "custom-outfit-3"], path + ".id");
    const cells = list(d.cells, path + ".cells", 1792);
    if (cells.length !== 1792 || cells.some(c => c !== null && (typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c)))) fail(path);
    iso(d.updatedAt, path + ".updatedAt"); return d;
  });
  if (new Set(designs.map(d => d.id)).size !== designs.length) fail("customOutfits.id");
  if (p.equippedCustomOutfitId !== null &&
      (!designs.some(d => d.id === p.equippedCustomOutfitId) || p.equippedOutfitId !== null)) fail("equippedCustomOutfitId");
  integer(p.bankedCoins, "bankedCoins"); integer(p.deathsTotal, "deathsTotal");
  const deaths = record(p.deathsByStage, "deathsByStage");
  let total = 0;
  for (const [id, count] of Object.entries(deaths)) { stage(id, "deathsByStage"); total += integer(count, "deathsByStage." + id); }
  if (!Number.isSafeInteger(total) || total !== p.deathsTotal) fail("deathsTotal");
  strings(p.collectedCoinIds, "collectedCoinIds").forEach(key => {
    const [id, ...rest] = key.split(":"); stage(id, "collectedCoinIds");
    if (!rest.join(":")) fail("collectedCoinIds");
  });
  strings(p.collectedItems, "collectedItems"); strings(p.seenCutsceneIds, "seenCutsceneIds", 256);
  strings(p.discoveredDrawbackIds, "discoveredDrawbackIds", 256);
  const keys = record(p.keybinds, "keybinds", Object.keys(DEFAULT_KEYBINDS));
  for (const [action, key] of Object.entries(keys)) textField(key, "keybinds." + action, 64);
  return { ...structuredClone(p), playerName: name } as unknown as ProgressState;
}
function validateMap(value: unknown, checkpointId: string, seed: number): MapRuntimeSnapshot {
  const m = record(value, "mapSnapshot", ["checkpointId", "randomSeed", "activeObjectStates", "movedObjectPositions",
    "spawnedEntityIds", "firedChainIds", "objectStates", "gimmickStates"]);
  if (m.checkpointId !== checkpointId || m.randomSeed !== seed) fail("mapSnapshot.identity");
  for (const [key, value] of Object.entries(record(m.activeObjectStates, "activeObjectStates"))) {
    textField(key, "objectId"); bool(value, key);
  }
  for (const [key, value] of Object.entries(record(m.movedObjectPositions, "movedObjectPositions"))) {
    textField(key, "objectId"); const xy = record(value, key, ["x", "y"]); finite(xy.x, key); finite(xy.y, key);
  }
  strings(m.spawnedEntityIds, "spawnedEntityIds", 2048); strings(m.firedChainIds, "firedChainIds", 2048);
  for (const [key, value] of Object.entries(record(m.objectStates, "objectStates"))) {
    textField(key, "objectId"); const o = record(value, key, ["active", "x", "y", "collision"], ["variant"]);
    bool(o.active, key); bool(o.collision, key); finite(o.x, key); finite(o.y, key);
    if (o.variant !== undefined) textField(o.variant, key);
  }
  for (const [key, value] of Object.entries(record(m.gimmickStates, "gimmickStates"))) {
    const g = record(value, key, ["gimmickId", "status", "startedAt", "counterpresses", "snapshotSeed"]);
    if (textField(g.gimmickId, key) !== key) fail(key);
    oneOf(g.status, ["armed", "triggered", "escaped", "dead"], key);
    if (g.startedAt !== null) finite(g.startedAt, key);
    integer(g.counterpresses, key); integer(g.snapshotSeed, key, 1, 0x7fffffff);
  }
  return structuredClone(m) as unknown as MapRuntimeSnapshot;
}
export function validateCheckpoint(value: unknown, stageId: StageId): CloudCheckpoint {
  boundedJson(value, 48 * 1024, "checkpoint");
  const c = record(value, "checkpoint", ["checkpointId", "stageId", "x", "y", "facing", "randomSeed",
    "mapSnapshotVersion", "contentVersion", "capturedAt", "mapSnapshot"]);
  if (!CHECKPOINT_STAGES.includes(stageId) || c.stageId !== stageId ||
      c.checkpointId !== stageId + "-checkpoint" || c.contentVersion !== 1) fail("checkpoint.identity");
  const definition = STAGE_DEFINITIONS.find(d => d.id === stageId)!;
  finite(c.x, "checkpoint.x", 0, definition.mapWidth); finite(c.y, "checkpoint.y", 0, definition.mapHeight);
  if (c.facing !== 1 && c.facing !== -1) fail("checkpoint.facing");
  const seed = integer(c.randomSeed, "checkpoint.seed", 1, 0x7fffffff);
  integer(c.mapSnapshotVersion, "checkpoint.version"); finite(c.capturedAt, "checkpoint.capturedAt", 0);
  if (c.mapSnapshot !== null) validateMap(c.mapSnapshot, c.checkpointId as string, seed);
  return structuredClone(c) as unknown as CloudCheckpoint;
}
export function validateTravel(value: unknown): World02TravelState {
  const travel = record(value, "world02Travel");
  const result: World02TravelState = {};
  for (const [id, value] of Object.entries(travel)) {
    const key = oneOf(id, ["world-02-stage-1", "world-02-stage-2", "world-02-stage-3"] as const, "travel.stage");
    const v = record(value, id, ["seed", "checkpointSnapshot"]);
    const seed = integer(v.seed, id + ".seed", 1, 0x7fffffff);
    if (v.checkpointSnapshot === null) { result[key] = { seed, checkpointSnapshot: null }; continue; }
    const cp = record(v.checkpointSnapshot, id + ".checkpoint", ["checkpointId", "stageId", "x", "y", "facing"],
      ["randomSeed", "mapSnapshotVersion", "mapSnapshot"]);
    const normalized = validateCheckpoint({ ...cp, randomSeed: cp.randomSeed ?? seed,
      mapSnapshotVersion: cp.mapSnapshotVersion ?? 0, contentVersion: 1, capturedAt: 0,
      mapSnapshot: cp.mapSnapshot ?? null }, key);
    if (normalized.randomSeed !== seed) fail(id + ".seed");
    result[key] = { seed, checkpointSnapshot: {
      checkpointId: normalized.checkpointId, stageId: key, x: normalized.x, y: normalized.y, facing: normalized.facing,
      randomSeed: seed, mapSnapshotVersion: normalized.mapSnapshotVersion,
      ...(normalized.mapSnapshot ? { mapSnapshot: normalized.mapSnapshot } : {}),
    } };
  }
  return result;
}
export function validateSelection(value: unknown): WorldSelectionRequest {
  const r = record(value, "selection");
  if (r.worldId === "world-02") { record(r, "selection", ["worldId"]); return { worldId: "world-02" }; }
  record(r, "selection", ["worldId", "point"]);
  if (r.worldId !== "world-01") fail("selection.worldId");
  return { worldId: "world-01", point: oneOf(r.point, ["start", "checkpoint-1", "checkpoint-2", "boss"], "selection.point") };
}
export function parseSaveEvent(value: unknown): SaveEvent {
  const e = record(value, "event");
  if (e.kind === "world-select") {
    record(e, "event", ["kind", "selection"]); return { kind: e.kind, selection: validateSelection(e.selection) };
  }
  const id = stage(e.stageId);
  if (e.kind === "stage-enter") {
    record(e, "event", ["kind", "stageId", "seed", "world02Travel"]);
    return { kind: e.kind, stageId: id, seed: integer(e.seed, "event.seed", 1, 0x7fffffff), world02Travel: validateTravel(e.world02Travel) };
  }
  if (e.kind === "checkpoint") {
    record(e, "event", ["kind", "stageId", "origin", "snapshot"]);
    return { kind: e.kind, stageId: id, origin: oneOf(e.origin, ["reached", "restored"], "origin"),
      snapshot: validateCheckpoint(e.snapshot, id) };
  }
  record(e, "event", ["kind", "stageId"]);
  return { kind: oneOf(e.kind, ["state", "stage-complete"], "event.kind"), stageId: id };
}
const mutationKeys = ["schemaVersion", "requestId", "sessionId", "generation", "runId", "expectedVersion", "sequence"];
function mutation(r: RecordValue): MutationBase {
  if (r.schemaVersion !== 1) fail("schemaVersion");
  return { requestId: uuid(r.requestId, "requestId"), sessionId: uuid(r.sessionId, "sessionId"),
    generation: integer(r.generation, "generation"), runId: uuid(r.runId, "runId"),
    expectedVersion: integer(r.expectedVersion, "expectedVersion"), sequence: integer(r.sequence, "sequence", 1) };
}
export function parseSaveRequest(value: unknown): SaveRequest {
  boundedJson(value, 256 * 1024, "request");
  const r = record(value, "request", [...mutationKeys, "event", "progress"]);
  return { ...mutation(r), schemaVersion: 1, event: parseSaveEvent(r.event), progress: validateProgress(r.progress) };
}
export function parseResetRequest(value: unknown): ResetRequest {
  return { ...mutation(record(value, "reset", mutationKeys)), schemaVersion: 1 };
}
export function parseAcquireRequest(value: unknown): AcquireRequest {
  const r = record(value, "acquire", ["requestId", "sessionId", "takeover"]);
  return { requestId: uuid(r.requestId, "requestId"), sessionId: uuid(r.sessionId, "sessionId"), takeover: bool(r.takeover, "takeover") };
}
export function parseLeaseRequest(value: unknown): LeaseRequest {
  const r = record(value, "leaseRequest", ["sessionId", "generation"]);
  return { sessionId: uuid(r.sessionId, "sessionId"), generation: integer(r.generation, "generation") };
}
export function validateLease(value: unknown): Lease {
  const r = record(value, "lease", ["sessionId", "generation", "expiresAt"]);
  return { sessionId: r.sessionId === null ? null : uuid(r.sessionId, "lease.sessionId"),
    generation: integer(r.generation, "lease.generation"), expiresAt: iso(r.expiresAt, "lease.expiresAt") };
}
export function validateBest(value: unknown): BestRecord | null {
  if (value === null) return null;
  const b = record(value, "best", ["milestoneId", "progressRank", "deaths", "runId"]);
  const milestone = MILESTONES.find(m => m.id === b.milestoneId && m.rank === b.progressRank);
  if (!milestone) fail("best.milestone");
  return { milestoneId: milestone.id, progressRank: milestone.rank, deaths: integer(b.deaths, "best.deaths"), runId: uuid(b.runId, "best.runId") };
}
export function validateResume(value: unknown): ResumeState {
  const r = record(value, "resume", ["worldId", "stageId", "checkpoint", "worldSeed", "world02Travel", "completed"]);
  const id = stage(r.stageId);
  if (r.worldId !== worldOf(id)) fail("resume.worldId");
  const cp = r.checkpoint === null ? null : validateCheckpoint(r.checkpoint, id);
  if (!cp && !id.endsWith("-stage-1") || cp && cp.stageId !== id) fail("resume.stageId");
  const travel = validateTravel(r.world02Travel);
  if (r.worldId !== "world-02" && Object.keys(travel).length > 0) fail("resume.world02Travel");
  if (r.completed && r.worldId !== "world-05") fail("resume.completed");
  return { worldId: worldOf(id), stageId: id, checkpoint: cp, worldSeed: integer(r.worldSeed, "resume.seed", 1, 0x7fffffff),
    world02Travel: travel, completed: bool(r.completed, "resume.completed") };
}
export function validateCurrentState(value: unknown): CurrentState {
  const r = record(value, "current", ["runId", "version", "lastSequence", "activeStageId", "pendingCheckpointId", "progress", "resume"]);
  const id = stage(r.activeStageId);
  if (r.pendingCheckpointId !== null && (!CHECKPOINT_STAGES.includes(id) || r.pendingCheckpointId !== id + "-checkpoint")) fail("pendingCheckpointId");
  const progress = validateProgress(r.progress), resume = validateResume(r.resume);
  if (worldOf(id) !== resume.worldId) fail("current.world");
  return { runId: uuid(r.runId, "runId"), version: integer(r.version, "version"),
    lastSequence: integer(r.lastSequence, "lastSequence"), activeStageId: id,
    pendingCheckpointId: r.pendingCheckpointId as string | null, progress, resume };
}
export function parseBootstrap(value: unknown): Bootstrap {
  const r = record(value, "bootstrap", ["schemaVersion", "playerId", "displayName", "current", "best", "lease", "serverTime"]);
  if (r.schemaVersion !== 1) fail("schemaVersion");
  const playerId = textField(r.playerId, "playerId");
  const parts = playerId.split(":");
  if (parts.length !== 3 || !["prod", "test"].includes(parts[0]) || !uuidPattern.test(parts[1]) ||
      !uuidPattern.test(parts[2]) || playerId !== playerId.toLowerCase()) fail("playerId");
  return { schemaVersion: 1, playerId, displayName: normalizeNickname(textField(r.displayName, "displayName", 20)),
    current: validateCurrentState(r.current), best: validateBest(r.best), lease: validateLease(r.lease), serverTime: iso(r.serverTime, "serverTime") };
}
export function parseSaveAck(value: unknown): SaveAck {
  const r = record(value, "ack", ["requestId", "runId", "version", "sequence", "best", "committedAt"]);
  return { requestId: uuid(r.requestId, "requestId"), runId: uuid(r.runId, "runId"), version: integer(r.version, "version"),
    sequence: integer(r.sequence, "sequence"), best: validateBest(r.best), committedAt: iso(r.committedAt, "committedAt") };
}
export function parseLeaderboardResponse(value: unknown): LeaderboardResponse {
  const r = record(value, "leaderboard", ["rows", "generatedAt"]);
  return { generatedAt: iso(r.generatedAt, "generatedAt"), rows: list(r.rows, "rows", 10).map((value, i) => {
    const row = record(value, "row", ["rank", "nickname", "deaths", "location"]);
    if (row.rank !== i + 1 || !MILESTONES.some(m => m.label === row.location)) fail("row");
    return { rank: i + 1, nickname: textField(row.nickname, "nickname", 20),
      deaths: integer(row.deaths, "deaths"), location: row.location as string };
  }) };
}

