"use client";
import { useEffect, type ReactElement } from "react";
import type { GameEventBus, GameEventType } from "@/game/bridge/GameEventBus";

export interface GameEventBridgeProps {
  readonly eventBus: GameEventBus;
  readonly onEvent?: (type: GameEventType) => void;
}

export function GameEventBridge({ eventBus, onEvent }: GameEventBridgeProps): ReactElement | null {
  useEffect(() => {
    let disposed = false;
    const events: readonly GameEventType[] = [
      "stage-started", "cutscene-started", "cutscene-finished", "ending-finished", "death", "coin-changed", "stage-completed", "skill-unlock-scene-opened", "stage-clear-scene-opened", "boss-hearts-changed", "tool-purchased", "collectible-found", "death-count-updated", "drawback-discovered", "keybinds-changed",
    ];
    const unsubscribe = events.map((type) => eventBus.on(type, () => {
      if (!disposed) onEvent?.(type);
    }));
    return () => {
      disposed = true;
      unsubscribe.forEach((remove) => remove());
    };
  }, [eventBus, onEvent]);
  return null;
}
