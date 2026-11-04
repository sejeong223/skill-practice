import type { Bootstrap, CloudCheckpoint, ResumeState } from "./contracts";
import type { ProgressState, StageId, WorldSelectionRequest } from "../core/types";
import type { CheckpointSnapshot } from "../core/runtimeTypes";
import { STAGE_DEFINITIONS } from "../data/worlds";
import { getWorld03Entry } from "../systems/world03IntroRouting";
import { getWorld04Entry } from "../systems/world04IntroRouting";
import { getWorld01ReplayTarget } from "../systems/worldSelection";
import { toCheckpointGimmickState } from "../systems/checkpointGimmickState";
import { parseBootstrap, validateCheckpoint, validateResume, validateTravel } from "./validation";
import { worldOf } from "./progression";
import type { World02TravelState } from "../data/world02Travel";
export const CLOUD_ENTRY_KEY = "cloudEntry";
export const CLOUD_RESUME_KEY = "cloudResume";
export const CLOUD_RUNTIME_KEY = "cloudRuntime";
export const CLOUD_CHECKPOINT_KEY = "cloudCheckpoint";
export const CLOUD_PENDING_CHECKPOINT_KEY = "cloudPendingCheckpoint";
export interface CloudEntry { progress: ProgressState; resume: ResumeState; activeStageId: StageId }
export function buildCloudEntry(bootstrap: Bootstrap): CloudEntry {
  const b = parseBootstrap(bootstrap);
  return { progress: b.current.progress, resume: b.current.resume, activeStageId: b.current.resume.stageId };
}
export function cloudEntryRoute(entry: CloudEntry) {
  const { progress, resume } = entry;
  if (resume.completed) return { sceneKey: "ending", data: {} };
  if (!progress.onboardingCompleted) return { sceneKey: "IntroScene", data: {} };
  if (!resume.checkpoint) {
    if (resume.worldId === "world-02" && !progress.seenCutsceneIds.includes("world-02-intro")) return { sceneKey: "World02EntranceScene", data: { nextStageId: "world-02-stage-1" } };
    if (resume.worldId === "world-03") { const target = getWorld03Entry(progress); if (target.sceneKey !== "StageScene") return target; }
    if (resume.worldId === "world-04") { const target = getWorld04Entry(progress); if (target.sceneKey !== "StageScene") return target; }
  }
  return { sceneKey: "StageScene", data: { stageId: resume.stageId, seed: resume.worldSeed,
    ...(resume.checkpoint ? { resumeCheckpointId: resume.checkpoint.checkpointId } : {}), playerName: progress.playerName } };
}
export function toCloudCheckpoint(snapshot: CheckpointSnapshot, capturedAt: number): CloudCheckpoint {
  return validateCheckpoint(JSON.parse(JSON.stringify({ ...snapshot, randomSeed: snapshot.randomSeed ?? 1,
    mapSnapshotVersion: snapshot.mapSnapshotVersion ?? 0, mapSnapshot: snapshot.mapSnapshot ?? null, contentVersion: 1, capturedAt })), snapshot.stageId);
}
export function restoreCloudCheckpoint(value: CloudCheckpoint, spawn: { x: number; y: number }, now: number): CheckpointSnapshot {
  const snapshot = validateCheckpoint(value, value.stageId), stage = STAGE_DEFINITIONS.find(stage => stage.id === snapshot.stageId)!, map = stage.map;
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) throw new Error("체크포인트 위치를 확인해 주세요.");
  const state = snapshot.mapSnapshot;
  let restoredMap = state ? structuredClone(state) : undefined;
  if (state) {
    const objects = new Set(map?.objectDefinitions.map(o => o.id) ?? []), chains = new Set(map?.chainRules.map(c => c.id) ?? []);
    const ids = [...Object.keys(state.objectStates), ...Object.keys(state.activeObjectStates), ...Object.keys(state.movedObjectPositions), ...state.spawnedEntityIds];
    if (ids.some(id => !objects.has(id)) || state.firedChainIds.some(id => !chains.has(id))) throw new Error("저장된 맵과 현재 맵이 다릅니다.");
    const gimmickStates = Object.fromEntries(Object.entries(state.gimmickStates).map(([id, old]) => {
      const definition = map?.gimmicks.find(g => g.id === id);
      if (!definition) throw new Error("저장된 장애물을 찾을 수 없습니다.");
      const clean = toCheckpointGimmickState(definition.kind, old);
      return [id, { ...clean, startedAt: clean.startedAt === null ? null : now - Math.max(0, snapshot.capturedAt - clean.startedAt) }];
    }));
    restoredMap = { ...state, gimmickStates };
  }
  return { checkpointId: snapshot.checkpointId, stageId: snapshot.stageId, ...spawn, facing: snapshot.facing,
    randomSeed: snapshot.randomSeed, mapSnapshotVersion: snapshot.mapSnapshotVersion, ...(restoredMap ? { mapSnapshot: restoredMap } : {}) };
}
export function resumeForStage(previous: ResumeState, stageId: StageId, seed: number, travel: World02TravelState): ResumeState {
  const worldId = worldOf(stageId);
  const next = worldId === previous.worldId ? structuredClone(previous) : {
    worldId, stageId: (worldId + "-stage-1") as StageId, checkpoint: null, worldSeed: seed, world02Travel: {}, completed: false,
  };
  if (!next.checkpoint && next.stageId === stageId) next.worldSeed = seed;
  if (worldId === "world-02") next.world02Travel = validateTravel(travel);
  return validateResume(next);
}
export function resumeForSelection(previous: ResumeState, selection: WorldSelectionRequest): { resume: ResumeState; pendingCheckpointId: string | null } {
  const target = selection.worldId === "world-01" ? getWorld01ReplayTarget(selection.point) : null;
  const resume = target?.bossReplayActive && previous.worldId === selection.worldId ? structuredClone(previous) : {
    worldId: selection.worldId, stageId: (selection.worldId + "-stage-1") as StageId, checkpoint: null, worldSeed: 1, world02Travel: {}, completed: false,
  };
  return { resume: validateResume(resume), pendingCheckpointId: target?.resumeCheckpointId ?? null };
}
