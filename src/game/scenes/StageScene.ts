import * as Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import { createRuntimeStageState } from "../core/constants";
import type { StageId } from "../core/types";
import { GameEventBus } from "../bridge/GameEventBus";
import { CameraDirector } from "../camera/CameraDirector";
import { getStageDefinition, getWorldMapTheme } from "../data";
import { Player } from "../entities/Player";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { DEFAULT_KEYBINDS, InputManager } from "../input/InputManager";
import { ParallaxRenderer } from "../maps/ParallaxRenderer";
import { TiledMapLoader } from "../maps/TiledMapLoader";
import type { LoadedMap } from "../maps/mapTypes";
import { StageBuilder } from "../stages/StageBuilder";
import { StageRuntime } from "../stages/StageRuntime";
import { PlayerController } from "../systems/PlayerController";

export interface StageSceneData {
  readonly stageId?: StageId;
  readonly seed?: number;
}

export class StageScene extends Phaser.Scene {
  private player?: Player;
  private inputManager?: InputManager;
  private playerController?: PlayerController;
  private cameraDirector?: CameraDirector;
  private runtime?: StageRuntime;
  private loadedMap?: LoadedMap | null;
  private parallaxRenderer?: ParallaxRenderer;
  private eventBus?: GameEventBus;
  private statusText?: Phaser.GameObjects.Text;
  private stageId: StageId = "world-01-stage-1";

  public constructor() {
    super("StageScene");
  }

  public create(data: StageSceneData = {}): void {
    this.stageId = data.stageId ?? "world-01-stage-1";
    const stage = getStageDefinition(this.stageId);
    const theme = getWorldMapTheme(stage.worldId);
    const seed = data.seed ?? 1;
    this.physics.world.setBounds(0, 0, stage.mapWidth, stage.mapHeight);
    this.add.rectangle(stage.mapWidth / 2, GAME_HEIGHT / 2, stage.mapWidth, GAME_HEIGHT, 0xf5e7c7).setDepth(-40);
    this.parallaxRenderer = new ParallaxRenderer(this);
    this.parallaxRenderer.render(theme, stage.mapWidth, stage.mapHeight);

    this.player = new Player(this, stage.spawn.x, stage.spawn.y);
    this.inputManager = new InputManager(this, DEFAULT_KEYBINDS);
    this.playerController = new PlayerController(
      this.player,
      this.inputManager,
      DEFAULT_PLAYER_TUNING,
    );
    this.eventBus = new GameEventBus();
    this.runtime = new StageBuilder(undefined, this.eventBus).build(
      this,
      stage,
      seed,
      createRuntimeStageState(stage.id, seed),
    );
    this.loadedMap = TiledMapLoader.load(this, stage, theme);

    const gameplayLayer = this.loadedMap?.layers.gameplay;
    if (gameplayLayer) {
      this.physics.add.collider(this.player, gameplayLayer);
    }

    for (const record of this.runtime.getEntities("platform")) {
      this.physics.add.collider(this.player, record.entity as Phaser.GameObjects.GameObject);
    }
    for (const record of this.runtime.getEntities("coin")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => this.runtime?.collectCoin(record.id),
      );
    }
    for (const record of this.runtime.getEntities("checkpoint")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => this.activateCheckpoint(record.id),
      );
    }
    for (const record of this.runtime.getEntities("exit")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => this.runtime?.complete(),
      );
    }

    this.cameraDirector = new CameraDirector(this, this.player, stage);
    this.cameraDirector.followPlayer();
    this.runtime.start();
    this.eventBus.on("stage-completed", (payload) => {
      this.runtime?.setStatus("completed");
      this.statusText?.setText(
        "completed: " + payload.stageId + "  next: " + (payload.nextStageId ?? "none"),
      );
    });
    this.eventBus.on("coin-changed", (payload) => {
      this.statusText?.setText(
        "play: " + payload.stageId + "  coins: " + payload.currentStageCoins,
      );
    });

    this.statusText = this.add.text(36, 32, "stage: " + stage.title, {
      color: "#5f3942",
      fontFamily: "monospace",
      fontSize: "18px",
    }).setScrollFactor(0).setResolution(2);

    this.events.once("shutdown", () => {
      this.inputManager?.destroy();
      this.runtime?.destroy();
      this.loadedMap?.destroy();
      this.parallaxRenderer?.destroy();
      this.eventBus?.clear();
    });
  }

  public update(time: number, delta: number): void {
    if (this.runtime?.getStatus() !== "play") {
      return;
    }
    this.playerController?.update(time, delta);
  }

  private activateCheckpoint(checkpointId: string): void {
    if (this.runtime?.getStatus() !== "play") {
      return;
    }
    this.eventBus?.emit("checkpoint-activated", {
      stageId: this.stageId,
      checkpointId,
    });
    this.statusText?.setText("checkpoint: " + checkpointId);
  }
}
