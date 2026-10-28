import * as Phaser from "phaser";
import type { GameEventBus } from "./bridge/GameEventBus";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { IntroScene } from "./scenes/IntroScene";
import { PrototypeScene } from "./scenes/PrototypeScene";
import { StageScene } from "./scenes/StageScene";
import { World01StageClearScene } from "./scenes/World01StageClearScene";
import { World01SkillUnlockScene } from "./scenes/World01SkillUnlockScene";
import { World02EntranceScene } from "./scenes/World02EntranceScene";
import { World03EntranceScene } from "./scenes/World03EntranceScene";
import type { ProgressState } from "./core/types";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_GRAVITY_Y = 900;

export interface CreateGameOptions {
  readonly parent: HTMLElement;
  readonly gameEventBus?: GameEventBus;
  readonly progressState?: ProgressState;
  readonly onReady?: (game: Phaser.Game) => void;
}

export function createPhaserConfig(
  parent: HTMLElement,
  gameEventBus?: GameEventBus,
  progressState?: ProgressState,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    callbacks: {
      preBoot: (game) => {
        if (gameEventBus) game.registry.set("gameEventBus", gameEventBus);
        if (progressState) game.registry.set("progressState", progressState);
      },
    },
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
    scene: [BootScene, PreloadScene, IntroScene, PrototypeScene, StageScene, World01SkillUnlockScene, World01StageClearScene, World02EntranceScene, World03EntranceScene],
  };
}

export function createGame(options: CreateGameOptions): Phaser.Game {
  const game = new Phaser.Game(
    createPhaserConfig(options.parent, options.gameEventBus, options.progressState),
  );
  options.onReady?.(game);
  return game;
}
