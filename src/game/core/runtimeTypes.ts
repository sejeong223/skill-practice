import type { GimmickRuntimeStatus } from "./contentTypes";
import type { StageId } from "./types";

export interface MapObjectRuntimeState {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly collision: boolean;
  readonly variant?: string;
}

export interface GimmickRuntimeState {
  readonly gimmickId: string;
  readonly status: GimmickRuntimeStatus;
  readonly startedAt: number | null;
  readonly counterpresses: number;
  readonly snapshotSeed: number;
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
  readonly gimmickStates: Readonly<Record<string, GimmickRuntimeState>>;
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
