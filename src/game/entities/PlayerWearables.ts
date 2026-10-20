import type * as Phaser from "phaser";
import type { CosmeticId } from "../core/types";
import { MARKET_PRODUCTS } from "../data/marketCatalog";
import type { Player } from "./Player";

const categories = new Map(MARKET_PRODUCTS
  .filter((product) => product.cosmeticId !== undefined)
  .map((product) => [product.cosmeticId!, product.category]));

export class PlayerWearables {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private outfitId: CosmeticId | null = null;
  private accessoryId: CosmeticId | null = null;
  private outfitImage?: Phaser.GameObjects.Image;
  private accessoryImage?: Phaser.GameObjects.Image;
  private destroyed = false;

  public constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    scene.events.on("postupdate", this.sync, this);
  }

  public setEquipment(outfitId: CosmeticId | null, accessoryId: CosmeticId | null): void {
    if (this.destroyed) return;
    const safeOutfit = outfitId && categories.get(outfitId) === "outfit" ? outfitId : null;
    const safeAccessory = accessoryId && categories.get(accessoryId) === "accessory" ? accessoryId : null;
    if (safeOutfit !== this.outfitId) {
      this.outfitImage?.destroy();
      this.outfitId = safeOutfit;
      this.outfitImage = this.createLayer(safeOutfit, 1);
    }
    if (safeAccessory !== this.accessoryId) {
      this.accessoryImage?.destroy();
      this.accessoryId = safeAccessory;
      this.accessoryImage = this.createLayer(safeAccessory, 2);
    }
    this.sync();
  }

  public sync(): void {
    if (this.destroyed || !this.player.scene) return;
    const bark = this.player.texture.key === "corgi-bark";
    const numericFrame = Number(this.player.frame.name);
    const frame = Number.isInteger(numericFrame) && numericFrame >= 0 && numericFrame < 4 ? numericFrame : 0;
    this.syncLayer(this.outfitImage, this.outfitId, bark, frame, 1);
    this.syncLayer(this.accessoryImage, this.accessoryId, bark, frame, 2);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off("postupdate", this.sync, this);
    this.outfitImage?.destroy();
    this.accessoryImage?.destroy();
    this.outfitImage = undefined;
    this.accessoryImage = undefined;
  }

  private createLayer(id: CosmeticId | null, depthOffset: number): Phaser.GameObjects.Image | undefined {
    if (!id) return undefined;
    const key = `wear-${id}-run`;
    if (!this.scene.textures.exists(key)) return undefined;
    return this.scene.add.image(this.player.x, this.player.y, key, 0).setDepth(this.player.depth + depthOffset);
  }

  private syncLayer(
    image: Phaser.GameObjects.Image | undefined,
    id: CosmeticId | null,
    bark: boolean,
    frame: number,
    depthOffset: number,
  ): void {
    if (!image || !id) return;
    const key = `wear-${id}-${bark ? "bark" : "run"}`;
    if (!this.scene.textures.exists(key)) {
      image.setVisible(false);
      return;
    }
    if (image.texture.key !== key) image.setTexture(key, bark ? undefined : frame);
    else if (!bark && Number(image.frame.name) !== frame) image.setFrame(frame);
    image.setPosition(this.player.x, this.player.y)
      .setOrigin(this.player.originX, this.player.originY)
      .setScale(this.player.scaleX, this.player.scaleY)
      .setFlipX(this.player.flipX)
      .setDepth(this.player.depth + depthOffset)
      .setVisible(this.player.visible && this.player.active);
  }
}
