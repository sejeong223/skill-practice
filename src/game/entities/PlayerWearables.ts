import type * as Phaser from "phaser";
import type { CosmeticId, CustomOutfitDesign } from "../core/types";
import { MARKET_PRODUCTS } from "../data/marketCatalog";
import { colorizeCustomOutfitPixels, type OutfitPose } from "./customOutfitTexture";
import type { Player, PlayerAppearanceTextures } from "./Player";

const categories = new Map(MARKET_PRODUCTS
  .filter((product) => product.cosmeticId !== undefined)
  .map((product) => [product.cosmeticId!, product.category]));
let nextWearableInstanceId = 1;
type AccessoryTextures = { run: string; bark: string; pirouette: string; pirouetteMirror: string };
type TextureSet = PlayerAppearanceTextures;
const BARE_CORGI: TextureSet = {
  run: "corgi-run", bark: "corgi-bark", bite: "corgi-bite",
  pirouette: "corgi-pirouette", pirouetteMirror: "corgi-pirouette-mirror",
};

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
      const wasSpinning = this.player.texture.key === current.pirouette ||
        this.player.texture.key === current.pirouetteMirror;
      const wasMirrored = this.player.texture.key === current.pirouetteMirror;
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
          bite: `wear-${safeOutfit}-bite`, pirouette: `wear-${safeOutfit}-pirouette`,
          pirouetteMirror: `wear-${safeOutfit}-pirouette-mirror` } : undefined;
      const appearance: TextureSet = requested && this.scene.textures.exists(requested.run) &&
          this.scene.textures.exists(requested.bark) && this.scene.textures.exists(requested.pirouette) &&
          this.scene.textures.exists(requested.pirouetteMirror)
        ? { ...requested, bite: requested.bite && this.scene.textures.exists(requested.bite)
          ? requested.bite : null }
        : BARE_CORGI;
      this.player.setAppearanceTextures(appearance);
      const nextPose = wasSpinning
        ? wasMirrored ? appearance.pirouetteMirror : appearance.pirouette
        : wasBarking ? appearance.bark : wasBiting && appearance.bite
          ? appearance.bite : appearance.run;
      const frameLimit = wasSpinning ? 8 : 4;
      this.player.setTexture(nextPose, wasBarking ? undefined :
        Number.isInteger(frame) && frame >= 0 && frame < frameLimit ? frame : 0);
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
    const appearance = this.player.getAppearanceTextures();
    const pose = this.player.texture.key === appearance.bark ? "bark"
      : this.player.texture.key === appearance.pirouette ? "pirouette"
      : this.player.texture.key === appearance.pirouetteMirror ? "pirouetteMirror" : "run";
    const numericFrame = Number(this.player.frame.name);
    const frameLimit = pose === "pirouette" || pose === "pirouetteMirror" ? 8 : 4;
    const frame = Number.isInteger(numericFrame) && numericFrame >= 0 && numericFrame < frameLimit ? numericFrame : 0;
    this.syncLayer(this.accessoryImage, this.accessoryId ? {
      run: `wear-${this.accessoryId}-run`, bark: `wear-${this.accessoryId}-bark`,
      pirouette: `wear-${this.accessoryId}-pirouette`,
      pirouetteMirror: `wear-${this.accessoryId}-pirouette-mirror`,
    } : undefined, pose, frame, 1);
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
    const keys = {
      run: `${prefix}-run`, bark: `${prefix}-bark`, bite: `${prefix}-bite`,
      pirouette: `${prefix}-pirouette`, pirouetteMirror: `${prefix}-pirouette-mirror`,
    };
    try {
      for (const pose of ["run", "bark", "bite", "pirouette", "pirouetteMirror"] as const) {
        const templateKey = pose === "pirouetteMirror"
          ? "custom-outfit-template-pirouette-mirror" : `custom-outfit-template-${pose}`;
        const source = this.scene.textures.get(templateKey).getSourceImage() as CanvasImageSource;
        const canvas = document.createElement("canvas");
        const frames = pose === "bark" ? 1 : pose === "pirouette" || pose === "pirouetteMirror" ? 8 : 4;
        canvas.width = frames * 112;
        canvas.height = 128;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D context unavailable");
        context.drawImage(source, 0, 0);
        const templatePixels = context.getImageData(0, 0, canvas.width, canvas.height);
        let uv: Uint8ClampedArray | undefined;
        if (pose === "pirouette" || pose === "pirouetteMirror") {
          const uvKey = pose === "pirouette"
            ? "custom-outfit-template-pirouette-uv" : "custom-outfit-template-pirouette-mirror-uv";
          const uvSource = this.scene.textures.get(uvKey).getSourceImage() as CanvasImageSource;
          const uvCanvas = document.createElement("canvas");
          uvCanvas.width = canvas.width;
          uvCanvas.height = canvas.height;
          const uvContext = uvCanvas.getContext("2d", { willReadFrequently: true });
          if (!uvContext) throw new Error("Canvas 2D context unavailable for pirouette UV");
          uvContext.drawImage(uvSource, 0, 0);
          uv = uvContext.getImageData(0, 0, canvas.width, canvas.height).data;
        }
        const colored = colorizeCustomOutfitPixels(templatePixels.data, canvas.width, canvas.height,
          pose as OutfitPose, design, uv);
        templatePixels.data.set(colored);
        context.putImageData(templatePixels, 0, 0);
        const texture = this.scene.textures.addCanvas(keys[pose], canvas);
        if (!texture) throw new Error(`Could not create custom outfit texture: ${pose}`);
        this.ownedTextureKeys.push(keys[pose]);
        if (pose !== "bark") {
          for (let frame = 0; frame < frames; frame++) {
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
    keys: AccessoryTextures | undefined,
    pose: "run" | "bark" | "pirouette" | "pirouetteMirror",
    frame: number,
    depthOffset: number,
  ): void {
    if (!image || !keys) return;
    const key = keys[pose];
    if (!this.scene.textures.exists(key)) {
      image.setVisible(false);
      return;
    }
    if (image.texture.key !== key) image.setTexture(key, pose === "bark" ? undefined : frame);
    else if (pose !== "bark" && Number(image.frame.name) !== frame) image.setFrame(frame);
    image.setPosition(this.player.x, this.player.y)
      .setOrigin(this.player.originX, this.player.originY)
      .setScale(this.player.scaleX, this.player.scaleY)
      .setFlipX(this.player.flipX)
      .setDepth(this.player.depth + depthOffset)
      .setVisible(this.player.visible && this.player.active);
  }
}
