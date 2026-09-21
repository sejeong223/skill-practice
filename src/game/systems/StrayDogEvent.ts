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

  public constructor(eventBus: GameplayEventBus) {
    this.eventBus = eventBus;
    this.unsubscribe = eventBus.on("clang", (payload) => {
      this.spawnSurge(payload.now);
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
    this.surgeNumber += 1;
    const count = 3;
    const dogs = Array.from({ length: count }, (_, index) => ({
      id: "stray-dog-" + this.surgeNumber + "-" + (index + 1),
      x: 520 + index * 46,
      y: 500,
      attacksEnemies: true,
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
