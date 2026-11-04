import type { ProgressState, StageId, WorldId, WorldSelectionRequest } from "../core/types";
import type { MapRuntimeSnapshot } from "../core/runtimeTypes";
import type { World02TravelState } from "../data/world02Travel";

export type Namespace = "prod" | "test";
export interface Identity { tenantId: string; objectId: string; playerId: string; namespace: Namespace }
export interface CloudCheckpoint {
  checkpointId: string; stageId: StageId; x: number; y: number; facing: 1 | -1;
  randomSeed: number; mapSnapshotVersion: number; contentVersion: 1;
  capturedAt: number; mapSnapshot: MapRuntimeSnapshot | null;
}
export interface ResumeState {
  worldId: WorldId; stageId: StageId; checkpoint: CloudCheckpoint | null;
  worldSeed: number; world02Travel: World02TravelState; completed: boolean;
}
export interface BestRecord { milestoneId: string; progressRank: number; deaths: number; runId: string }
export interface CurrentState {
  runId: string; version: number; lastSequence: number; activeStageId: StageId;
  pendingCheckpointId: string | null; progress: ProgressState; resume: ResumeState;
}
export interface Lease { sessionId: string | null; generation: number; expiresAt: string }
export interface Bootstrap {
  schemaVersion: 1; playerId: string; displayName: string; current: CurrentState;
  best: BestRecord | null; lease: Lease; serverTime: string;
}
export interface MutationBase {
  requestId: string; sessionId: string; generation: number; runId: string;
  expectedVersion: number; sequence: number;
}
export type SaveEvent =
  | { kind: "state"; stageId: StageId }
  | { kind: "stage-enter"; stageId: StageId; seed: number; world02Travel: World02TravelState }
  | { kind: "stage-complete"; stageId: StageId }
  | { kind: "world-select"; selection: WorldSelectionRequest }
  | { kind: "checkpoint"; stageId: StageId; origin: "reached" | "restored"; snapshot: CloudCheckpoint };
export interface SaveRequest extends MutationBase { schemaVersion: 1; event: SaveEvent; progress: ProgressState }
export interface ResetRequest extends MutationBase { schemaVersion: 1 }
export interface SaveAck {
  requestId: string; runId: string; version: number; sequence: number;
  best: BestRecord | null; committedAt: string;
}
export interface AcquireRequest { requestId: string; sessionId: string; takeover: boolean }
export interface LeaseRequest { sessionId: string; generation: number }
export interface LeaderboardRow { rank: number; nickname: string; deaths: number; location: string }
export interface LeaderboardResponse { rows: LeaderboardRow[]; generatedAt: string }
export type ApiErrorCode =
  | "INVALID_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "SESSION_CONFLICT" | "SESSION_LOST"
  | "VERSION_CONFLICT" | "RUN_CONFLICT" | "SEQUENCE_CONFLICT" | "REQUEST_REUSED"
  | "THROTTLED" | "UNAVAILABLE" | "UNSUPPORTED_SAVE";
export interface ApiErrorBody { error: { code: ApiErrorCode; message: string; retryAfterMs: number | null } }

