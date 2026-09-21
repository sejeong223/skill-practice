import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { PrototypeScene } from "./scenes/PrototypeScene";
import { StageScene } from "./scenes/StageScene";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_GRAVITY_Y = 900;

export interface CreateGameOptions {
  readonly parent: HTMLElement;
  readonly onReady?: (game: Phaser.Game) => void;
}

export function createPhaserConfig(
  parent: HTMLElement,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: "#f5e7c7",
    pixelArt: true,
    roundPixels: true,
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: {
          x: 0,
          y: GAME_GRAVITY_Y,
        },
        debug: false,
      },
    },
    scene: [BootScene, PreloadScene, PrototypeScene, StageScene],
  };
}

export function createGame(options: CreateGameOptions): Phaser.Game {
  const game = new Phaser.Game(createPhaserConfig(options.parent));
  options.onReady?.(game);
  return game;
}
