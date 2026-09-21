import { createDefaultProgressState } from "../core/constants";
import type { ProgressState } from "../core/types";
import { migrateSave } from "./migrations";
import { PROGRESS_STORAGE_KEY, SAVE_SCHEMA_VERSION, type SaveEnvelope } from "./saveTypes";

export class ProgressStore {
  private readonly storage?: Storage;

  public constructor(storage?: Storage) {
    this.storage = storage;
  }

  public load(): ProgressState {
    const storage = this.getStorage();
    if (!storage) {
      return createDefaultProgressState();
    }

    try {
      const raw = storage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? migrateSave(JSON.parse(raw)) : createDefaultProgressState();
    } catch (error) {
      console.warn("[ProgressStore] failed to read save; using defaults", error);
      return createDefaultProgressState();
    }
  }

  public save(progress: ProgressState): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    const envelope: SaveEnvelope = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      progress: migrateSave({ schemaVersion: SAVE_SCHEMA_VERSION, progress }),
    };
    try {
      storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(envelope));
    } catch (error) {
      console.warn("[ProgressStore] failed to write save", error);
    }
  }

  public clear(): void {
    this.getStorage()?.removeItem(PROGRESS_STORAGE_KEY);
  }

  public update(mutator: (current: ProgressState) => ProgressState): ProgressState {
    const next = mutator(this.load());
    this.save(next);
    return next;
  }

  private getStorage(): Storage | null {
    if (this.storage) {
      return this.storage;
    }
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return window.localStorage;
    } catch (error) {
      console.warn("[ProgressStore] localStorage is unavailable", error);
      return null;
    }
  }
}
