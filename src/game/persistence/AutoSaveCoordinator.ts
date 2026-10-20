import { GameEventBus, type GameEventType } from "../bridge/GameEventBus";
import type { ProgressState } from "../core/types";
import { ProgressStore } from "./ProgressStore";

const SAVE_EVENTS: readonly GameEventType[] = [
  "player-name-confirmed",
  "stage-completed",
  "skill-unlocked",
  "tool-purchased",
  "market-item-purchased",
  "cosmetic-change-requested",
  "collectible-found",
  "keybinds-changed",
  "drawback-discovered",
  "death-count-updated",
  "cutscene-finished",
];

export class AutoSaveCoordinator {
  private readonly store: ProgressStore;
  private readonly progress: ProgressState;
  private readonly eventBus: GameEventBus;
  private readonly unsubscribe: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  public constructor(
    store: ProgressStore,
    progress: ProgressState,
    eventBus: GameEventBus,
    debounceMs = 100,
  ) {
    this.store = store;
    this.progress = progress;
    this.eventBus = eventBus;
    this.unsubscribe.push(eventBus.on("coin-changed", this.flush));
    this.unsubscribe.push(eventBus.on("checkpoint-activated", this.flush));
    this.unsubscribe.push(eventBus.on("world-selection-committed", this.flush));
    for (const event of SAVE_EVENTS) {
      this.unsubscribe.push(eventBus.on(event, () => this.schedule(debounceMs)));
    }
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.flush);
    }
  }

  public requestSave(): void {
    this.schedule(100);
  }

  public flush = (): void => {
    if (this.destroyed) {
      return;
    }
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.store.save(this.progress);
  };

  public destroy(): void {
    this.flush();
    this.destroyed = true;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.unsubscribe.splice(0).forEach((unsubscribe) => unsubscribe());
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.flush);
    }
  }

  private schedule(delayMs: number): void {
    if (this.destroyed || this.timer !== undefined) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.store.save(this.progress);
    }, delayMs);
  }
}
