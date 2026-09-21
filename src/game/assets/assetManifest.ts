import rawAssets from "./assetManifest.json";
import type { PixelAssetDefinition } from "./assetTypes";

export const PIXEL_ASSETS: readonly PixelAssetDefinition[] =
  rawAssets as readonly PixelAssetDefinition[];

export function getAssetDefinition(key: string): PixelAssetDefinition {
  const asset = PIXEL_ASSETS.find((candidate) => candidate.key === key);

  if (!asset) {
    throw new Error("Unknown pixel asset key: " + key);
  }

  return asset;
}
