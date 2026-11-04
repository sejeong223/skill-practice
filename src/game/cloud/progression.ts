import { STAGE_IDS, WORLD_IDS, getNextStageId } from "../core/constants";
import type { StageId, WorldId } from "../core/types";
import type { BestRecord, CurrentState, SaveEvent } from "./contracts";

export const PLAYABLE_PATH: readonly StageId[] = STAGE_IDS.filter(id => id !== "world-02-stage-4");
export const CHECKPOINT_STAGES: readonly StageId[] = PLAYABLE_PATH.filter(id =>
  !id.endsWith("-boss") && (!id.startsWith("world-01-") ||
    id === "world-01-stage-2" || id === "world-01-stage-4"));
export interface Milestone { id: string; rank: number; label: string; stageId: StageId; checkpointId: string | null }
export function worldOf(stageId: StageId): WorldId { return stageId.split("-stage-")[0] as WorldId; }
export const MILESTONES: readonly Milestone[] = WORLD_IDS.flatMap((worldId, index) => {
  const n = index + 1;
  const checkpoints = CHECKPOINT_STAGES.filter(id => worldOf(id) === worldId);
  return [
    { id: worldId + ":start", rank: n * 100, label: "월드 " + n + " 시작",
      stageId: (worldId + "-stage-1") as StageId, checkpointId: null },
    ...checkpoints.map((stageId, i) => ({
      id: worldId + ":checkpoint-" + (i + 1), rank: n * 100 + i + 1,
      label: "월드 " + n + " 체크포인트 " + (i + 1), stageId, checkpointId: stageId + "-checkpoint",
    })),
    { id: worldId + ":clear", rank: n * 100 + 99, label: "월드 " + n + " 클리어",
      stageId: (worldId + "-stage-boss") as StageId, checkpointId: null },
  ];
});
export function milestoneFor(event: SaveEvent): Milestone | null {
  if (event.kind === "world-select" || event.kind === "state") return null;
  if (event.kind === "checkpoint") {
    return event.origin === "reached"
      ? MILESTONES.find(m => m.stageId === event.stageId && m.checkpointId === event.snapshot.checkpointId) ?? null
      : null;
  }
  const suffix = event.kind === "stage-enter" && event.stageId.endsWith("-stage-1") ? ":start"
    : event.kind === "stage-complete" && event.stageId.endsWith("-boss") ? ":clear" : null;
  return suffix ? MILESTONES.find(m => m.id === worldOf(event.stageId) + suffix) ?? null : null;
}
export function canEnterStage(current: CurrentState, target: StageId): boolean {
  if (!PLAYABLE_PATH.includes(target)) return false;
  return target === current.activeStageId || target === current.resume.stageId ||
    current.progress.clearedStages.includes(current.activeStageId) && getNextStageId(current.activeStageId) === target ||
    current.activeStageId === "world-02-stage-2" && target === "world-02-stage-1" ||
    current.activeStageId === "world-02-stage-3" && target === "world-02-stage-2";
}
export function isBetterRecord(candidate: BestRecord, previous: BestRecord | null): boolean {
  return !previous || candidate.progressRank > previous.progressRank ||
    candidate.progressRank === previous.progressRank && candidate.deaths < previous.deaths;
}

