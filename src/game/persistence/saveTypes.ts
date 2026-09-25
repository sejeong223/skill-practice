import type { ProgressState } from "../core/types";

export type SaveSchemaVersion = 2;
export const SAVE_SCHEMA_VERSION: SaveSchemaVersion = 2;
export const PROGRESS_STORAGE_KEY = "legendary-rib-corgi:progress:v1";

export interface SaveEnvelope {
  schemaVersion: number;
  updatedAt: string;
  progress: ProgressState;
}
