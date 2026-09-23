import rawAssets from "./assetManifest.json";
import type { PixelAssetDefinition } from "./assetTypes";

export const PIXEL_ASSETS: readonly PixelAssetDefinition[] =
  rawAssets as readonly PixelAssetDefinition[];

const WORLD01_PROP_FRAMES: Readonly<Record<string, string>> = {
  "world-01-prop-ant": "ant",
  "world-01-prop-trash-can": "trash-can",
  "world-01-prop-clothesline": "clothesline",
  "world-01-prop-air-conditioner": "air-conditioner",
  "world-01-prop-cat-box": "cat-box",
  "world-01-prop-cloud": "cloud",
  "world-01-prop-white-spike": "white-spike",
  "world-01-prop-pigeon": "pigeon",
  "world-01-prop-fake-checkpoint": "fake-checkpoint",
  "world-01-prop-bone-coin": "bone-coin",
  "world-01-prop-bone-coin-green": "bone-coin-green",
  "world-01-prop-bone-coin-fire": "bone-coin-fire",
  "world-01-prop-bone-coin-reverse": "bone-coin-reverse",
  "world-01-prop-name-bubble": "name-bubble",
  "world-01-prop-manhole": "manhole",
};

const WORLD01_PROP_ASSET = PIXEL_ASSETS.find(
  (asset) => asset.key === "world-01-props",
);

export function getAssetDefinition(key: string): PixelAssetDefinition {
  const asset = PIXEL_ASSETS.find((candidate) => candidate.key === key)
    ?? (WORLD01_PROP_FRAMES[key] ? WORLD01_PROP_ASSET : undefined);

  if (!asset) {
    throw new Error("Unknown pixel asset key: " + key);
  }

  return asset;
}

export function getAssetFrameKey(key: string): string | undefined {
  return WORLD01_PROP_FRAMES[key];
}
