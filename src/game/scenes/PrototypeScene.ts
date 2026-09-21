import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { PlayerAnimator } from "../entities/PlayerAnimator";
import { Player } from "../entities/Player";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { DEFAULT_KEYBINDS, InputManager } from "../input/InputManager";
import { PlayerController } from "../systems/PlayerController";

interface PrototypeSceneData {
  readonly assetLoadError?: string | null;
}

export class PrototypeScene extends Phaser.Scene {
  private player?: Player;
  private inputManager?: InputManager;
  private playerController?: PlayerController;
  private playerAnimator?: PlayerAnimator;
  private stateText?: Phaser.GameObjects.Text;

  public constructor() {
    super("PrototypeScene");
  }

  public create(data: PrototypeSceneData = {}): void {
    this.cameras.main.setBackgroundColor("#f5e7c7");
    this.createBackdrop();

    const ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 72,
      GAME_WIDTH - 120,
      28,
      0x5f3942,
    );
    this.physics.add.existing(ground, true);

    this.player = new Player(this, 218, GAME_HEIGHT - 88);
    this.physics.add.collider(this.player, ground);

    this.inputManager = new InputManager(this, DEFAULT_KEYBINDS);
    this.playerController = new PlayerController(
      this.player,
      this.inputManager,
      DEFAULT_PLAYER_TUNING,
    );
    this.playerAnimator = new PlayerAnimator(this.player);

    this.events.once("shutdown", () => {
      this.inputManager?.destroy();
    });

    this.add
      .text(36, 32, "T01  ·  Corgi player controller", {
        color: "#5f3942",
        fontFamily: "monospace",
        fontSize: "22px",
      })
      .setResolution(2);
    this.add
      .text(36, 64, "WASD / 방향키 이동   SPACE 점프   J 공격   K 돌진   L 짖기", {
        color: "#8b5a56",
        fontFamily: "sans-serif",
        fontSize: "18px",
      })
      .setResolution(2);

    this.stateText = this.add
      .text(36, GAME_HEIGHT - 44, "state: idle", {
        color: "#8b5a56",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setResolution(2);

    if (data.assetLoadError) {
      this.add
        .text(36, GAME_HEIGHT - 70, data.assetLoadError, {
          color: "#8f283d",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setResolution(2);
    }
  }

  public update(time: number, delta: number): void {
    this.playerController?.update(time, delta);
    this.playerAnimator?.update(time);

    if (this.player && this.stateText) {
      this.stateText.setText(
        "state: " +
          this.player.getAnimationState() +
          "   velocity: " +
          Math.round(this.player.body.velocity.x),
      );
    }
  }

  private createBackdrop(): void {
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xf5e7c7,
    );
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 112,
      GAME_WIDTH,
      110,
      0xe8cda0,
    );
    this.add.circle(1040, 142, 58, 0xf0b95f, 0.8);
    this.add.rectangle(820, 450, 260, 18, 0xc78b72, 0.75);
    this.add.rectangle(1010, 380, 170, 18, 0xc78b72, 0.55);
  }
}
