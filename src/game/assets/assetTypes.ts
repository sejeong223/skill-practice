export type AssetKind = "image" | "spritesheet" | "atlas" | "audio";

export interface PixelAssetDefinition {
  readonly key: string;
  readonly kind: AssetKind;
  readonly url: string;
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  readonly frameCount?: number;
  readonly worldId?: string;
  readonly required: boolean;
}
