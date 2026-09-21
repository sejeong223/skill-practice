export type AssetKind = "image" | "spritesheet" | "atlas" | "audio" | "tilemap";

export interface PixelAssetDefinition {
  readonly key: string;
  readonly kind: AssetKind;
  readonly url: string;
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  readonly frameCount?: number;
  readonly tileWidth?: number;
  readonly tileHeight?: number;
  readonly worldId?: string;
  readonly required: boolean;
}
