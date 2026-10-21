import { GameplayEventBus } from "../core/events";

export interface StrayDogAlly {
  id: string;
  x: number;
  y: number;
  attacksEnemies: boolean;
  blocksPlayerRoute: boolean;
  collidesWithPlayer: boolean;
}

export class StrayDogEvent {
  private readonly eventBus: GameplayEventBus;
  private readonly unsubscribe: () => void;
  private dogs: StrayDogAlly[] = [];
  private surgeNumber = 0;
  private readonly getOrigin: () => { x: number; y: number };

  public constructor(
    eventBus: GameplayEventBus,
    getOrigin: () => { x: number; y: number } = () => ({ x: 520, y: 500 }),
    private readonly options: { count?: number } = {},
  ) {
    this.eventBus = eventBus;
    this.getOrigin = getOrigin;
    this.unsubscribe = eventBus.on("bowl-broken", (payload) => {
      if (payload.toolId === "upside-down-bowl") this.spawnSurge(payload.now);
    });
  }

  public getActiveDogs(): readonly StrayDogAlly[] {
    return this.dogs;
  }

  public clear(): void {
    this.dogs = [];
  }

  public destroy(): void {
    this.unsubscribe();
    this.clear();
  }

  private spawnSurge(now: number): void {
    if (this.dogs.length > 0) return;
    this.surgeNumber += 1;
    const requested = this.options.count ?? 3;
    const count = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
    const origin = this.getOrigin();
    const dogs = Array.from({ length: count }, (_, index) => ({
      id: "stray-dog-" + this.surgeNumber + "-" + (index + 1),
      x: origin.x + (index - (count - 1) / 2) * 48,
      y: origin.y,
      attacksEnemies: false,
      blocksPlayerRoute: true,
      collidesWithPlayer: false,
    }));

    this.dogs = [...this.dogs, ...dogs];
    this.eventBus.emit("stray-dog-surge", {
      count,
      source: "upside-down-bowl",
      now,
    });
  }
}
