import type { StageId } from "../core/types";

export interface World03CheckpointCrossingInput {
  readonly stageId: StageId;
  readonly playerCenterX: number;
  readonly checkpointX: number;
  readonly latestActiveX: number | null;
}

export function shouldActivateWorld03Checkpoint(input: World03CheckpointCrossingInput): boolean {
  if (!/^world-03-stage-[1-4]$/.test(input.stageId) ||
      !Number.isFinite(input.playerCenterX) || !Number.isFinite(input.checkpointX) ||
      (input.latestActiveX !== null && !Number.isFinite(input.latestActiveX))) return false;
  return input.playerCenterX >= input.checkpointX &&
    (input.latestActiveX === null || input.checkpointX > input.latestActiveX);
}
