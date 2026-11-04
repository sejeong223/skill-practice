import type { StageEventMap } from "../stages/stageEvents";
import { PauseReasons, hasForcedPause } from "./PauseReasons";

export type GameEventType = keyof StageEventMap;
export type GameEventListener<T extends GameEventType> = (
  payload: StageEventMap[T],
) => void;

export class GameEventBus {
  public readonly pauseReasons = new PauseReasons();
  private deathOverlayVisible = false;
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
    if (type === "pause-requested") this.pauseReasons.set("manual", (payload as StageEventMap["pause-requested"]).paused);
    if ((type === "cutscene-advance-requested" || type === "cutscene-skip-requested" || type === "world-selection-requested") && hasForcedPause(this.pauseReasons.snapshot())) return;
    this.listeners.get(type)?.forEach((listener) => listener(payload));
  }

  public setDeathOverlayVisible(visible: boolean): void {
    if (this.deathOverlayVisible === visible) return;
    this.deathOverlayVisible = visible;
    this.emit("death-overlay-visibility-changed", { visible });
  }

  public isDeathOverlayVisible(): boolean {
    return this.deathOverlayVisible;
  }

  public clear(): void {
    this.deathOverlayVisible = false;
    this.listeners.clear();
  }
}
