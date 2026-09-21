export interface GameplayEventMap {
  "skill-used": {
    skillId: string;
    now: number;
  };
  "slipper-hit": {
    comboCount: number;
    now: number;
  };
  "slipper-sneeze": {
    knockbackX: number;
    now: number;
  };
  "bite-hit": {
    now: number;
  };
  clang: {
    toolId: string;
    remainingCharges: number;
    now: number;
  };
  "bowl-broken": {
    toolId: string;
    now: number;
  };
  "stray-dog-surge": {
    count: number;
    source: string;
    now: number;
  };
  "drawback-triggered": {
    toolId: string;
    drawbackId: string;
    now: number;
  };
  "drawback-discovered": {
    toolId: string;
    drawbackId: string;
    now: number;
  };
}

export type GameplayEventType = keyof GameplayEventMap;
export type GameplayEventListener<T extends GameplayEventType> = (
  payload: GameplayEventMap[T],
) => void;

export class GameplayEventBus {
  private readonly listeners = new Map<
    GameplayEventType,
    Set<GameplayEventListener<GameplayEventType>>
  >();

  public on<T extends GameplayEventType>(
    type: T,
    listener: GameplayEventListener<T>,
  ): () => void {
    const listeners =
      this.listeners.get(type) ??
      new Set<GameplayEventListener<GameplayEventType>>();
    listeners.add(listener as GameplayEventListener<GameplayEventType>);
    this.listeners.set(type, listeners);

    return () => {
      listeners.delete(listener as GameplayEventListener<GameplayEventType>);
    };
  }

  public emit<T extends GameplayEventType>(
    type: T,
    payload: GameplayEventMap[T],
  ): void {
    this.listeners.get(type)?.forEach((listener) => {
      listener(payload);
    });
  }

  public clear(): void {
    this.listeners.clear();
  }
}
