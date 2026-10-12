import * as Phaser from "phaser";
import type { EnemyDefinition, PlatformDefinition, TrapDefinition } from "../core/contentTypes";
import { Enemy } from "../entities/Enemy";
import { Trap } from "../entities/Trap";
import { SNACK_PRESENTATION } from "../data/snackPresentation";
import { getAssetDefinition, getAssetFrameKey } from "../assets/assetManifest";

type CoinAppearance = "legacy" | "bone";

export type StageEntityKind =
  | "platform"
  | "trap"
  | "enemy"
  | "coin"
  | "collectible"
  | "checkpoint"
  | "exit";

export type StageEntityRequest =
  | { kind: "platform"; definition: PlatformDefinition }
  | { kind: "trap"; definition: TrapDefinition }
  | { kind: "enemy"; definition: EnemyDefinition }
  | { kind: "coin"; id: string; x: number; y: number; appearance?: CoinAppearance }
  | { kind: "collectible"; id: string; x: number; y: number }
  | { kind: "checkpoint"; id: string; x: number; y: number }
  | { kind: "exit"; id: string; x: number; y: number };

export type StageEntity = Phaser.GameObjects.GameObject & {
  setVisible(value: boolean): Phaser.GameObjects.GameObject;
};

export class StageEntityFactory {
  public create(scene: Phaser.Scene, request: StageEntityRequest): StageEntity {
    switch (request.kind) {
      case "platform":
        return this.createPlatform(scene, request.definition);
      case "trap":
        return new Trap(scene, request.definition);
      case "enemy":
        return new Enemy(scene, request.definition);
      case "coin":
        return this.createCoin(scene, request.id, request.x, request.y, request.appearance);
      case "collectible":
        return this.createCollectible(scene, request.id, request.x, request.y);
      case "checkpoint":
        return this.createCheckpoint(scene, request.id, request.x, request.y);
      case "exit":
        return this.createExit(scene, request.id, request.x, request.y);
      default: {
        const unknown = request as unknown as { kind: string };
        throw new Error("Unknown stage entity kind: " + unknown.kind);
      }
    }
  }

  private createPlatform(
    scene: Phaser.Scene,
    definition: PlatformDefinition,
  ): Phaser.GameObjects.Rectangle {
    const platform = scene.add.rectangle(
      definition.x,
      definition.y,
      definition.width,
      definition.height,
      0x5f3942,
    );
    scene.physics.add.existing(platform, true);
    platform.setData("stageEntityKind", "platform");
    return platform;
  }

  private createCoin(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    appearance: CoinAppearance = "legacy",
  ): Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image {
    const coin = appearance === "bone"
      ? scene.add.image(x, y, SNACK_PRESENTATION.textureKey, SNACK_PRESENTATION.frameKey)
        .setDisplaySize(SNACK_PRESENTATION.width, SNACK_PRESENTATION.height).setDepth(1)
      : scene.add.ellipse(x, y, 18, 18, 0xf0b95f);
    scene.physics.add.existing(coin, true);
    coin.setData("stageEntityKind", "coin");
    coin.setData("entityId", id);
    return coin;
  }

  private createCollectible(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.Rectangle {
    const collectible = scene.add.rectangle(x, y, 22, 22, 0x87c8a5);
    scene.physics.add.existing(collectible, true);
    collectible.setData("stageEntityKind", "collectible");
    collectible.setData("entityId", id);
    return collectible;
  }

  private createCheckpoint(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.Rectangle {
    const checkpoint = scene.add.rectangle(x, y, 18, 120, 0x8f283d, 0.6);
    scene.physics.add.existing(checkpoint, true);
    checkpoint.setData("stageEntityKind", "checkpoint");
    checkpoint.setData("entityId", id);
    if (id === "world-01-stage-2-checkpoint" || id === "world-01-stage-4-checkpoint") {
      checkpoint.setVisible(false);
      const key = "world-01-checkpoint-flag";
      const flag = scene.add.image(x, y + 64, getAssetDefinition(key).key, getAssetFrameKey(key))
        .setOrigin(0.5, 1).setDisplaySize(76, 128).setDepth(1);
      flag.setData("checkpointId", id);
      checkpoint.once(Phaser.GameObjects.Events.DESTROY, () => {
        if (flag.scene) flag.destroy();
      });
    }
    return checkpoint;
  }

  private createExit(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.Rectangle {
    const exit = scene.add.rectangle(x, y, 32, 160, 0xf18a72, 0.7);
    scene.physics.add.existing(exit, true);
    exit.setData("stageEntityKind", "exit");
    exit.setData("entityId", id);
    return exit;
  }
}
