import type { CheckpointSnapshot } from "../core/runtimeTypes";
import type { StageId } from "../core/types";
import type { World02PlaygroundStageId } from "./world02StageHazards";

export type World02EntrySide = "left" | "right";
export interface World02StageVisit {
  readonly seed: number;
  readonly checkpointSnapshot: CheckpointSnapshot | null;
}
export type World02TravelState = Partial<Record<World02PlaygroundStageId, World02StageVisit>>;

const PLAYGROUND_IDS: readonly World02PlaygroundStageId[] = [
  "world-02-stage-1", "world-02-stage-2", "world-02-stage-3",
];

export function isWorld02PlaygroundStageId(stageId: StageId): stageId is World02PlaygroundStageId {
  return PLAYGROUND_IDS.includes(stageId as World02PlaygroundStageId);
}

export function validWorld02Seed(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= 0x7fffffff;
}

export function readWorld02TravelState(value: unknown): World02TravelState {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: World02TravelState = {};
  for (const stageId of PLAYGROUND_IDS) {
    const entry = source[stageId];
    if (!entry || typeof entry !== "object") continue;
    const visit = entry as Record<string, unknown>;
    if (!validWorld02Seed(visit.seed)) continue;
    const snapshot = visit.checkpointSnapshot;
    if (snapshot !== null && (!snapshot || typeof snapshot !== "object" ||
      (snapshot as CheckpointSnapshot).stageId !== stageId ||
      (snapshot as CheckpointSnapshot).checkpointId !== `${stageId}-checkpoint`)) continue;
    result[stageId] = { seed: visit.seed, checkpointSnapshot: snapshot ? structuredClone(snapshot as CheckpointSnapshot) : null };
  }
  return result;
}

export function saveWorld02Visit(
  state: World02TravelState,
  stageId: World02PlaygroundStageId,
  seed: number,
  checkpointSnapshot: CheckpointSnapshot | null,
): World02TravelState {
  if (!validWorld02Seed(seed)) throw new Error(`Invalid World 2 seed: ${seed}`);
  return { ...state, [stageId]: { seed, checkpointSnapshot: checkpointSnapshot ? structuredClone(checkpointSnapshot) : null } };
}

export function getWorld02EntryPosition(
  entrySide: World02EntrySide | undefined,
  mapWidth: number,
  spawn: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number; facing: 1 | -1 }> {
  return entrySide === "right"
    ? { x: mapWidth - 144, y: 440, facing: -1 }
    : { ...spawn, facing: 1 };
}

export function canBacktrackWorld02(input: Readonly<{
  stageId: StageId;
  status: string | undefined;
  left: boolean;
  playerLeft: number;
  controlLocked: boolean;
  controlOverridden: boolean;
  transitionStarted: boolean;
  menuOpen: boolean;
}>): boolean {
  return (input.stageId === "world-02-stage-2" || input.stageId === "world-02-stage-3") &&
    input.status === "play" && input.left && input.playerLeft <= 48 &&
    !input.controlLocked && !input.controlOverridden && !input.transitionStarted && !input.menuOpen;
}
