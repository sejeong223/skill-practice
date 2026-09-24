import * as Phaser from "phaser";
import type { WorldMapThemeDefinition } from "../core/contentTypes";

interface ScrollableGameObject extends Phaser.GameObjects.GameObject {
  setScrollFactor(x: number, y?: number): ScrollableGameObject;
  setVisible(visible: boolean): ScrollableGameObject;
}

interface ParallaxLayer {
  readonly gameObject: ScrollableGameObject;
  readonly scrollFactorX: number;
  readonly scrollFactorY: number;
}

export class ParallaxRenderer {
  private readonly scene: Phaser.Scene;
  private readonly layers: ParallaxLayer[] = [];

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
      // The tilemap owns gameplay pixels. An opaque fallback here would cover
      // the sky and midground that were rendered at lower depths.
      if (layer.kind === "gameplay") {
        continue;
      }
      const gameObject = this.createLayer(
        layer.assetKey,
        layer.depth,
        layer.scrollFactorX,
        layer.scrollFactorY,
        mapWidth,
        mapHeight,
        this.colorForLayer(theme, layer.kind),
      );
      this.layers.push({
        gameObject,
        scrollFactorX: layer.scrollFactorX,
        scrollFactorY: layer.scrollFactorY,
      });
    }

    return this.layers.map((layer) => layer.gameObject);
  }

  public setOverview(overview: boolean): void {
    for (const layer of this.layers) {
      // Normal parallax artwork tiles during scrolling. Hide it in the
      // full-map review so repeated scenery cannot obscure the route layout.
      layer.gameObject.setVisible(!overview);
      layer.gameObject.setScrollFactor(
        overview ? 1 : layer.scrollFactorX,
        overview ? 1 : layer.scrollFactorY,
      );
    }
  }

  public destroy(): void {
    this.layers.splice(0).forEach((layer) => layer.gameObject.destroy());
  }

  private createLayer(
    assetKey: string,
    depth: number,
    scrollFactorX: number,
    scrollFactorY: number,
    mapWidth: number,
    mapHeight: number,
    fallbackColor: number,
  ): ScrollableGameObject {
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
