import type { ProgressState } from "../core/types";

export type World04Entry =
  | { readonly sceneKey: "World04EntranceScene";
      readonly data: { readonly nextStageId: "world-04-stage-1" } }
  | { readonly sceneKey: "StageScene";
      readonly data: { readonly stageId: "world-04-stage-1"; readonly playerName: string } };

export function getWorld04Entry(
  progress: Pick<ProgressState, "seenCutsceneIds" | "playerName">,
): World04Entry {
  return progress.seenCutsceneIds.includes("world-04-intro")
    ? { sceneKey: "StageScene", data: { stageId: "world-04-stage-1", playerName: progress.playerName } }
    : { sceneKey: "World04EntranceScene", data: { nextStageId: "world-04-stage-1" } };
}
