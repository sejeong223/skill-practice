import type { ProgressState } from "../core/types";
import { GameEventBus } from "../bridge/GameEventBus";

export class CollectionSystem {
  private readonly progress: ProgressState;
  private readonly eventBus: GameEventBus;

  public constructor(progress: ProgressState, eventBus: GameEventBus) {
    this.progress = progress;
    this.eventBus = eventBus;
  }

  public collect(collectibleId: string): boolean {
    const firstDiscovery = !this.progress.collectedItems.includes(collectibleId);
    if (firstDiscovery) {
      this.progress.collectedItems.push(collectibleId);
    }
    this.eventBus.emit("collectible-found", { collectibleId, firstDiscovery });
    return firstDiscovery;
  }

  public hasCollected(collectibleId: string): boolean {
    return this.progress.collectedItems.includes(collectibleId);
  }

  public getCollectedIds(): readonly string[] {
    return this.progress.collectedItems;
  }
}
