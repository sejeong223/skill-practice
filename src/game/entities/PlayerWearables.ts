import type * as Phaser from "phaser";
import type { CosmeticId, CustomOutfitDesign } from "../core/types";
import { MARKET_PRODUCTS } from "../data/marketCatalog";
import { colorizeCustomOutfitPixels, type OutfitPose } from "./customOutfitTexture";
import type { Player } from "./Player";

const categories = new Map(MARKET_PRODUCTS
  .filter((product) => product.cosmeticId !== undefined)
  .map((product) => [product.cosmeticId!, product.category]));
let nextWearableInstanceId = 1;
type TexturePair = { run: string; bark: string };
type TextureSet = TexturePair & { bite: string | null };
const BARE_CORGI: TextureSet = { run: "corgi-run", bark: "corgi-bark", bite: "corgi-bite" };

export class PlayerWearables {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private outfitId: CosmeticId | null = null;
  private customSignature: string | null = null;
  private readonly ownedTextureKeys: string[] = [];
  private readonly instanceId = nextWearableInstanceId++;
  private accessoryId: CosmeticId | null = null;
  private accessoryImage?: Phaser.GameObjects.Image;
  private destroyed = false;

  public constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    scene.events.on("postupdate", this.sync, this);
  }

  public setEquipment(outfitId: CosmeticId | null, accessoryId: CosmeticId | null, customOutfit: CustomOutfitDesign | null = null): void {
    if (this.destroyed) return;
    const safeCustom = customOutfit && customOutfit.cells.length === 56 * 32 ? customOutfit : null;
    const signature = safeCustom ? `${safeCustom.id}:${safeCustom.updatedAt}:${safeCustom.cells.join("|")}` : null;
    const safeOutfit = !safeCustom && outfitId && categories.get(outfitId) === "outfit" ? outfitId : null;
    const safeAccessory = accessoryId && categories.get(accessoryId) === "accessory" ? accessoryId : null;
    if (safeOutfit !== this.outfitId || signature !== this.customSignature) {
      const current = this.player.getAppearanceTextures();
      const wasBarking = this.player.texture.key === current.bark;
      const wasBiting = current.bite !== null && this.player.texture.key === current.bite;
      const frame = Number(this.player.frame.name);
      this.player.anims?.stop();
      this.player.setAppearanceTextures(BARE_CORGI);
      this.player.setTexture(wasBarking ? BARE_CORGI.bark : BARE_CORGI.run, wasBarking ? undefined : 0);
      this.removeCustomTextures();
      this.outfitId = safeOutfit;
      this.customSignature = signature;
      const requested = safeCustom
        ? this.createCustomTextures(safeCustom)
        : safeOutfit ? { run: `wear-${safeOutfit}-run`, bark: `wear-${safeOutfit}-bark`,
          bite: `wear-${safeOutfit}-bite` } : undefined;
      const appearance: TextureSet = requested && this.scene.textures.exists(requested.run) &&
          this.scene.textures.exists(requested.bark)
        ? { ...requested, bite: requested.bite && this.scene.textures.exists(requested.bite)
          ? requested.bite : null }
        : BARE_CORGI;
      this.player.setAppearanceTextures(appearance);
      const nextPose = wasBarking ? appearance.bark : wasBiting && appearance.bite
        ? appearance.bite : appearance.run;
      this.player.setTexture(nextPose, wasBarking ? undefined :
        Number.isInteger(frame) && frame >= 0 && frame < 4 ? frame : 0);
    }
    if (safeAccessory !== this.accessoryId) {
      this.accessoryImage?.destroy();
      this.accessoryId = safeAccessory;
      this.accessoryImage = this.createLayer(safeAccessory ? `wear-${safeAccessory}-run` : undefined, 1);
    }
    this.sync();
  }

  public sync(): void {
    if (this.destroyed || !this.player.scene) return;
    const bark = this.player.texture.key === this.player.getAppearanceTextures().bark;
    const numericFrame = Number(this.player.frame.name);
    const frame = Number.isInteger(numericFrame) && numericFrame >= 0 && numericFrame < 4 ? numericFrame : 0;
    this.syncLayer(this.accessoryImage, this.accessoryId ? {
      run: `wear-${this.accessoryId}-run`, bark: `wear-${this.accessoryId}-bark`,
    } : undefined, bark, frame, 1);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off("postupdate", this.sync, this);
    this.accessoryImage?.destroy();
    if (this.player.scene && this.ownedTextureKeys.includes(this.player.texture.key)) {
      this.player.setTexture(BARE_CORGI.run, 0);
    }
    this.player.setAppearanceTextures(BARE_CORGI);
    this.removeCustomTextures();
    this.accessoryImage = undefined;
  }

  private createLayer(key: string | undefined, depthOffset: number): Phaser.GameObjects.Image | undefined {
    if (!key || !this.scene.textures.exists(key)) return undefined;
    return this.scene.add.image(this.player.x, this.player.y, key, 0).setDepth(this.player.depth + depthOffset);
  }

  private createCustomTextures(design: CustomOutfitDesign): TextureSet | null {
    const version = design.updatedAt.replace(/[^0-9]/g, "");
    const prefix = `wear-custom-${design.id}-${version}-${this.instanceId}`;
    const keys = { run: `${prefix}-run`, bark: `${prefix}-bark`, bite: `${prefix}-bite` };
    try {
      for (const pose of ["run", "bark", "bite"] as const) {
        const templateKey = `custom-outfit-template-${pose}`;
        const source = this.scene.textures.get(templateKey).getSourceImage() as CanvasImageSource;
        const canvas = document.createElement("canvas");
        canvas.width = pose === "bark" ? 112 : 448;
        canvas.height = 128;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D context unavailable");
        context.drawImage(source, 0, 0);
        const templatePixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const colored = colorizeCustomOutfitPixels(templatePixels.data, canvas.width, canvas.height, pose as OutfitPose, design);
        templatePixels.data.set(colored);
        context.putImageData(templatePixels, 0, 0);
        const texture = this.scene.textures.addCanvas(keys[pose], canvas);
        if (!texture) throw new Error(`Could not create custom outfit texture: ${pose}`);
        this.ownedTextureKeys.push(keys[pose]);
        if (pose !== "bark") {
          for (let frame = 0; frame < 4; frame++) {
            texture.add(String(frame), 0, frame * 112, 0, 112, 128);
          }
        }
        texture.refresh();
      }
      return keys;
    } catch (error) {
      console.warn("[PlayerWearables] custom dressed corgi texture failed; using bare corgi", error);
      this.removeCustomTextures();
      return null;
    }
  }

  private removeCustomTextures(): void {
    for (const key of this.ownedTextureKeys.splice(0)) {
      if (this.scene.anims?.exists(key)) this.scene.anims.remove(key);
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }

  private syncLayer(
    image: Phaser.GameObjects.Image | undefined,
    keys: TexturePair | undefined,
    bark: boolean,
    frame: number,
    depthOffset: number,
  ): void {
    if (!image || !keys) return;
    const key = bark ? keys.bark : keys.run;
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
