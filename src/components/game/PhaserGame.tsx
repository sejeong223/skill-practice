"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type * as Phaser from "phaser";

export interface PhaserGameProps {
  readonly className?: string;
  readonly onGameReady?: (game: Phaser.Game) => void;
}

export function PhaserGame({
  className,
  onGameReady,
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
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-label="전설의 무한 육즙 왕갈비뼈 게임 화면"
    />
  );
}
