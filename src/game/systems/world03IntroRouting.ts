import type { ProgressState } from "../core/types";

export type World03Entry =
  | { readonly sceneKey: "World03EntranceScene";
      readonly data: { readonly nextStageId: "world-03-stage-1" } }
  | { readonly sceneKey: "StageScene";
      readonly data: { readonly stageId: "world-03-stage-1"; readonly playerName: string } };

export function getWorld03Entry(
  progress: Pick<ProgressState, "seenCutsceneIds" | "playerName">,
): World03Entry {
  return progress.seenCutsceneIds.includes("world-03-intro")
    ? {
      sceneKey: "StageScene",
      data: { stageId: "world-03-stage-1", playerName: progress.playerName },
    }
    : {
      sceneKey: "World03EntranceScene",
      data: { nextStageId: "world-03-stage-1" },
    };
}
