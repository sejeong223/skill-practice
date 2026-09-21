import { GameplayEventBus } from "../core/events";
import type { ProgressState } from "../core/types";

export class DrawbackDiscovery {
  private readonly progress: ProgressState;
  private readonly eventBus: GameplayEventBus;
  private readonly unsubscribe: () => void;

  public constructor(progress: ProgressState, eventBus: GameplayEventBus) {
    this.progress = progress;
    this.eventBus = eventBus;
    this.unsubscribe = eventBus.on("drawback-triggered", (payload) => {
      this.discover(payload.toolId, payload.drawbackId, payload.now);
    });
  }

  public discover(
    toolId: string,
    drawbackId: string,
    now: number,
  ): boolean {
    if (this.progress.discoveredDrawbackIds.includes(drawbackId)) {
      return false;
    }

    this.progress.discoveredDrawbackIds.push(drawbackId);
    this.eventBus.emit("drawback-discovered", {
      toolId,
      drawbackId,
      now,
    });
    return true;
  }

  public isDiscovered(drawbackId: string): boolean {
    return this.progress.discoveredDrawbackIds.includes(drawbackId);
  }

  public getDiscoveredIds(): readonly string[] {
    return this.progress.discoveredDrawbackIds;
  }

  public destroy(): void {
    this.unsubscribe();
  }
}
