import type { StageId } from "./types";

export interface MapObjectRuntimeState {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly collision: boolean;
  readonly variant?: string;
}

export interface MapRuntimeSnapshot {
  readonly checkpointId: string;
  readonly randomSeed: number;
  readonly activeObjectStates: Readonly<Record<string, boolean>>;
  readonly movedObjectPositions: Readonly<
    Record<string, { readonly x: number; readonly y: number }>
  >;
  readonly spawnedEntityIds: readonly string[];
  readonly firedChainIds: readonly string[];
  readonly objectStates: Readonly<Record<string, MapObjectRuntimeState>>;
}

export interface CheckpointSnapshot {
  checkpointId: string;
  stageId: StageId;
  x: number;
  y: number;
  facing: 1 | -1;
  randomSeed?: number;
  mapSnapshotVersion?: number;
  mapSnapshot?: MapRuntimeSnapshot;
}
