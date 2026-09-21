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
  "death-requested": {
    stageId: string;
    cause: "enemy" | "trap" | "fall" | "tool-drawback" | "scripted";
    checkpointId: string | null;
    now: number;
  };
  death: {
    stageId: string;
    cause: "enemy" | "trap" | "fall" | "tool-drawback" | "scripted";
    checkpointId: string | null;
    now: number;
  };
  restart: {
    stageId: string;
    checkpointId: string | null;
    attempt: number;
    now: number;
  };
  "checkpoint-reached": {
    stageId: string;
    checkpointId: string;
    x: number;
    y: number;
    now: number;
  };
  "enemy-contact": {
    enemyId: string;
    damage: number;
    now: number;
  };
  "enemy-defeated": {
    enemyId: string;
    loot: string[];
    now: number;
  };
  "trap-triggered": {
    trapId: string;
    lethal: boolean;
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
