import type { CurrentState, SaveEvent } from "../../../src/game/cloud/contracts";
import type { ProgressState, StageId, WorldId } from "../../../src/game/core/types";
import { STAGE_IDS } from "../../../src/game/core/constants";
import { canEnterStage, worldOf } from "../../../src/game/cloud/progression";
import { SKILL_DEFINITIONS } from "../../../src/game/data/skills";
import { isWorld02PlaygroundStageId } from "../../../src/game/data/world02Travel";
import { getWorld01ReplayTarget, isWorldSelectionUnlocked } from "../../../src/game/systems/worldSelection";
import { ApiError } from "../errors";

function invalid(): never { throw new ApiError(400, "INVALID_REQUEST", "허용되지 않는 게임 진행입니다."); }
export function validateProgressTransition(previous: ProgressState, next: ProgressState, event: SaveEvent): void {
  if (previous.clearedStages.some(s => !next.clearedStages.includes(s)) ||
      next.clearedStages.some(s => !previous.clearedStages.includes(s) && (event.kind !== "stage-complete" || s !== event.stageId)) ||
      event.kind === "stage-complete" && !next.clearedStages.includes(event.stageId)) invalid();
  if (previous.unlockedSkills.some(s => !next.unlockedSkills.includes(s))) invalid();
  for (const skill of next.unlockedSkills) {
    const boss = SKILL_DEFINITIONS.find(s => s.id === skill)!.unlockAfterBossId.replace("-boss", "-stage-boss") as StageId;
    if (!next.clearedStages.includes(boss)) invalid();
  }
  if (next.deathsTotal < previous.deathsTotal) invalid();
  for (const stage of STAGE_IDS) {
    const before = previous.deathsByStage[stage] ?? 0, after = next.deathsByStage[stage] ?? 0;
    if (after < before || after > before && (event.kind === "world-select" || event.kind === "stage-enter" || stage !== event.stageId)) invalid();
  }
  const clearingWorld = event.kind === "stage-complete" && event.stageId.endsWith("-boss") ? worldOf(event.stageId) : null;
  if (previous.collectedCoinIds.some(key => !next.collectedCoinIds.includes(key) && !key.startsWith(clearingWorld + "-stage-"))) invalid();
}
function worldStart(worldId: WorldId, seed = 1): CurrentState["resume"] {
  return { worldId, stageId: (worldId + "-stage-1") as StageId, checkpoint: null, worldSeed: seed, world02Travel: {}, completed: false };
}
export function applySaveEvent(current: CurrentState, event: SaveEvent, next: ProgressState): CurrentState {
  validateProgressTransition(current.progress, next, event);
  const result = structuredClone(current);
  result.progress = structuredClone(next);
  if (event.kind === "world-select") {
    if (!isWorldSelectionUnlocked(current.progress)) invalid();
    const worldId = event.selection.worldId;
    const target = worldId === "world-01" ? getWorld01ReplayTarget(event.selection.point) : null;
    result.activeStageId = target?.stageId ?? "world-02-stage-1";
    result.pendingCheckpointId = target?.resumeCheckpointId ?? null;
    // A boss replay keeps the last real checkpoint only when staying in this world.
    if (!target?.bossReplayActive || current.resume.worldId !== worldId) result.resume = worldStart(worldId);
    result.resume.completed = false;
    return result;
  }
  if (event.kind === "stage-enter") {
    if (!canEnterStage(current, event.stageId)) invalid();
    const worldId = worldOf(event.stageId);
    if (worldId !== "world-02" && Object.keys(event.world02Travel).length) invalid();
    if (worldId !== current.resume.worldId) {
      result.resume = worldStart(worldId, event.seed);
      result.pendingCheckpointId = null;
    } else if (!current.resume.checkpoint && event.stageId === current.resume.stageId) {
      result.resume.worldSeed = event.seed;
    }
    if (worldId === "world-02") result.resume.world02Travel = { ...result.resume.world02Travel, ...structuredClone(event.world02Travel) };
    result.activeStageId = event.stageId;
    return result;
  }
  if (event.stageId !== current.activeStageId) invalid();
  if (event.kind === "checkpoint") {
    const snapshot = event.snapshot;
    if (event.origin === "restored" && current.pendingCheckpointId !== snapshot.checkpointId) {
      if (current.resume.checkpoint?.checkpointId !== snapshot.checkpointId) invalid();
      return result; // A restore cannot change the saved achievement or its random state.
    }
    if (event.origin === "reached" && current.pendingCheckpointId) invalid();
    result.resume.stageId = event.stageId;
    result.resume.checkpoint = structuredClone(snapshot);
    result.resume.worldSeed = snapshot.randomSeed;
    result.pendingCheckpointId = null;
    if (isWorld02PlaygroundStageId(event.stageId)) {
      const { checkpointId, stageId, x, y, facing, randomSeed, mapSnapshotVersion, mapSnapshot } = snapshot;
      result.resume.world02Travel[event.stageId] = { seed: randomSeed, checkpointSnapshot: {
        checkpointId, stageId, x, y, facing, randomSeed, mapSnapshotVersion, ...(mapSnapshot ? { mapSnapshot } : {}),
      } };
    }
  } else if (event.kind === "stage-complete" && event.stageId === "world-05-stage-boss") {
    result.resume.completed = true;
  }
  return result;
}
