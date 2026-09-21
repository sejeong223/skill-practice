import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

interface PrototypeSceneData {
  readonly assetLoadError?: string | null;
}

export class PrototypeScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Image;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey?: Phaser.Input.Keyboard.Key;

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

    this.player = this.physics.add.image(
      218,
      GAME_HEIGHT - 190,
      "corgi-reference",
    );
    this.player.setDisplaySize(228, 152);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, ground);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.jumpKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );

    this.add
      .text(36, 32, "T02  ·  Phaser runtime shell", {
        color: "#5f3942",
        fontFamily: "monospace",
        fontSize: "22px",
      })
      .setResolution(2);
    this.add
      .text(36, 64, "방향키 이동   SPACE 점프   ·   1280 × 720 FIT", {
        color: "#8b5a56",
        fontFamily: "sans-serif",
        fontSize: "18px",
      })
      .setResolution(2);

    if (data.assetLoadError) {
      this.add
        .text(36, GAME_HEIGHT - 42, data.assetLoadError, {
          color: "#8f283d",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setResolution(2);
    }
  }

  public update(): void {
    if (!this.player || !this.cursors) {
      return;
    }

    const speed = 220;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if (
      this.jumpKey &&
      Phaser.Input.Keyboard.JustDown(this.jumpKey) &&
      this.player.body?.blocked.down
    ) {
      this.player.setVelocityY(-470);
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
