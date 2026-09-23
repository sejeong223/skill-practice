"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type * as Phaser from "phaser";
import type { GameEventBus } from "@/game/bridge/GameEventBus";

export interface PhaserGameProps {
  readonly className?: string;
  readonly onGameReady?: (game: Phaser.Game) => void;
  readonly gameEventBus?: GameEventBus;
}

export function PhaserGame({
  className,
  onGameReady,
  gameEventBus,
}: PhaserGameProps): ReactElement {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onGameReadyRef = useRef(onGameReady);

  useEffect(() => {
    onGameReadyRef.current = onGameReady;
  }, [onGameReady]);

  useEffect(() => {
    if (!mountRef.current || gameRef.current) {
      return;
    }

    let disposed = false;

    void import("@/game/config").then(({ createGame }) => {
      if (disposed || !mountRef.current || gameRef.current) {
        return;
      }

      const game = createGame({
        parent: mountRef.current,
        gameEventBus,
        onReady: (readyGame) => {
          gameRef.current = readyGame;
          onGameReadyRef.current?.(readyGame);
        },
      });

      gameRef.current = game;
    });

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [gameEventBus]);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-label="짧은 다리의 역습: 전설의 왕갈비뼈를 찾아서 게임 화면"
    />
  );
}
