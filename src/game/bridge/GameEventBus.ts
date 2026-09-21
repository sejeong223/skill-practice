import type { StageEventMap } from "../stages/stageEvents";

export type GameEventType = keyof StageEventMap;
export type GameEventListener<T extends GameEventType> = (
  payload: StageEventMap[T],
) => void;

export class GameEventBus {
  private readonly listeners = new Map<
    GameEventType,
    Set<GameEventListener<GameEventType>>
  >();

  public on<T extends GameEventType>(
    type: T,
    listener: GameEventListener<T>,
  ): () => void {
    const listeners =
      this.listeners.get(type) ?? new Set<GameEventListener<GameEventType>>();
    listeners.add(listener as GameEventListener<GameEventType>);
    this.listeners.set(type, listeners);

    return () => {
      listeners.delete(listener as GameEventListener<GameEventType>);
    };
  }

  public emit<T extends GameEventType>(
    type: T,
    payload: StageEventMap[T],
  ): void {
    this.listeners.get(type)?.forEach((listener) => listener(payload));
  }

  public clear(): void {
    this.listeners.clear();
  }
}
