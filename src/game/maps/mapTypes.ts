import * as Phaser from "phaser";
import type {
  MapChainRule,
  MapLayerKind,
  MapObjectDefinition,
} from "../core/contentTypes";

export interface LoadedMap {
  readonly tilemap: Phaser.Tilemaps.Tilemap;
  readonly layers: Readonly<Partial<Record<MapLayerKind, Phaser.Tilemaps.TilemapLayer>>>;
  readonly objects: readonly MapObjectDefinition[];
  readonly chainRules: readonly MapChainRule[];
  destroy(): void;
}
