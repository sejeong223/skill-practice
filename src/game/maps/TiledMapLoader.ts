import * as Phaser from "phaser";
import type {
  MapObjectDefinition,
  MapObjectKind,
  MapPropertyValue,
  WorldMapThemeDefinition,
} from "../core/contentTypes";
import type { StageDefinition } from "../core/types";
import type { LoadedMap } from "./mapTypes";

export class TiledMapLoader {
  public static load(
    scene: Phaser.Scene,
    definition: StageDefinition,
    theme: WorldMapThemeDefinition,
  ): LoadedMap | null {
    if (!definition.mapKey || !scene.cache.tilemap.exists(definition.mapKey)) {
      return null;
    }

    const tilemap = scene.make.tilemap({ key: definition.mapKey });
    const tileset = tilemap.addTilesetImage(theme.tilesetKey, theme.tilesetKey);

    if (!tileset) {
      tilemap.destroy();
      return null;
    }

    const layers: Partial<Record<"background-far" | "background-mid" | "gameplay" | "foreground", Phaser.Tilemaps.TilemapLayer>> = {};

    for (const layerDefinition of definition.map?.layers ?? theme.layers) {
      const layer = tilemap.createLayer(layerDefinition.layerId, tileset, 0, 0);

      if (!layer) {
        continue;
      }

      layer.setDepth(layerDefinition.depth);
      layer.setScrollFactor(
        layerDefinition.scrollFactorX,
        layerDefinition.scrollFactorY,
      );

      if (layerDefinition.kind === "gameplay") {
        layer.setCollisionByExclusion([-1]);
      }

      layers[layerDefinition.kind] = layer;
    }

    const objects = TiledMapLoader.readObjects(tilemap);

    return {
      tilemap,
      layers,
      objects,
      chainRules: definition.map?.chainRules ?? [],
      destroy: () => {
        Object.values(layers).forEach((layer) => layer?.destroy());
        tilemap.destroy();
      },
    };
  }

  private static readObjects(
    tilemap: Phaser.Tilemaps.Tilemap,
  ): readonly MapObjectDefinition[] {
    const objects: MapObjectDefinition[] = [];

    for (const objectLayer of tilemap.objects ?? []) {
      for (const object of objectLayer.objects) {
        const properties = TiledMapLoader.readProperties(object.properties);
        const kind = TiledMapLoader.readKind(properties.kind ?? object.type);

        objects.push({
          id: TiledMapLoader.readString(properties.mapObjectId, String(object.id)),
          kind,
          x: object.x ?? 0,
          y: object.y ?? 0,
          width: object.width ?? 0,
          height: object.height ?? 0,
          visualKey: TiledMapLoader.readString(properties.visualKey, object.name),
          layerId: TiledMapLoader.readString(properties.layerId, objectLayer.name),
          collision: TiledMapLoader.readBoolean(properties.collision, false),
          triggerId: TiledMapLoader.readOptionalString(properties.triggerId),
          variantPool: TiledMapLoader.readStringList(properties.variantPool),
          chainId: TiledMapLoader.readOptionalString(properties.chainId),
          seedGroup: TiledMapLoader.readOptionalString(properties.seedGroup),
          properties,
        });
      }
    }

    return objects;
  }

  private static readProperties(
    raw: unknown,
  ): Readonly<Record<string, MapPropertyValue>> {
    if (Array.isArray(raw)) {
      const entries = raw.filter(
        (entry): entry is { name: string; value: MapPropertyValue } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { name?: unknown }).name === "string" &&
          TiledMapLoader.isPropertyValue((entry as { value?: unknown }).value),
      );
      return Object.fromEntries(entries.map((entry) => [entry.name, entry.value]));
    }

    if (typeof raw !== "object" || raw === null) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(raw).filter((entry): entry is [string, MapPropertyValue] =>
        TiledMapLoader.isPropertyValue(entry[1]),
      ),
    );
  }

  private static isPropertyValue(value: unknown): value is MapPropertyValue {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  private static readKind(value: unknown): MapObjectKind {
    const kinds: readonly MapObjectKind[] = [
      "decoration",
      "interactive",
      "trap",
      "enemy-spawn",
      "checkpoint",
      "collectible",
      "exit",
    ];
    return typeof value === "string" && kinds.includes(value as MapObjectKind)
      ? (value as MapObjectKind)
      : "decoration";
  }

  private static readString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.length > 0 ? value : fallback;
  }

  private static readOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private static readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
  }

  private static readStringList(value: unknown): readonly string[] | undefined {
    if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      return value;
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return undefined;
  }
}
