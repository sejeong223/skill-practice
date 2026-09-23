import * as Phaser from "phaser";
import type { WorldMapThemeDefinition } from "../core/contentTypes";

export class ParallaxRenderer {
  private readonly scene: Phaser.Scene;
  private readonly layers: Phaser.GameObjects.GameObject[] = [];

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public render(
    theme: WorldMapThemeDefinition,
    mapWidth: number,
    mapHeight: number,
  ): readonly Phaser.GameObjects.GameObject[] {
    this.destroy();

    for (const layer of theme.layers) {
      const gameObject = this.createLayer(
        layer.assetKey,
        layer.depth,
        layer.scrollFactorX,
        layer.scrollFactorY,
        mapWidth,
        mapHeight,
        this.colorForLayer(theme, layer.kind),
      );
      this.layers.push(gameObject);
    }

    return this.layers;
  }

  public destroy(): void {
    this.layers.splice(0).forEach((layer) => layer.destroy());
  }

  private createLayer(
    assetKey: string,
    depth: number,
    scrollFactorX: number,
    scrollFactorY: number,
    mapWidth: number,
    mapHeight: number,
    fallbackColor: number,
  ): Phaser.GameObjects.GameObject {
    const canDrawTexture = assetKey !== "world-01-tileset" &&
      this.scene.textures.exists(assetKey);

    if (canDrawTexture) {
      return this.scene.add
        .tileSprite(0, 0, mapWidth, mapHeight, assetKey)
        .setOrigin(0)
        .setDepth(depth)
        .setScrollFactor(scrollFactorX, scrollFactorY);
    }

    return this.scene.add
      .rectangle(0, 0, mapWidth, mapHeight, fallbackColor, 1)
      .setOrigin(0)
      .setDepth(depth)
      .setScrollFactor(scrollFactorX, scrollFactorY);
  }

  private colorForLayer(
    theme: WorldMapThemeDefinition,
    kind: "background-far" | "background-mid" | "gameplay" | "foreground",
  ): number {
    const color = theme.palette[kind === "background-far" ? "far" : kind === "background-mid" ? "mid" : kind];
    return Phaser.Display.Color.HexStringToColor(color).color;
  }
}
