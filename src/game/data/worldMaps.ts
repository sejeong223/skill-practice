import type {
  MapLayerDefinition,
  MapSectionDefinition,
  WorldMapPalette,
  WorldMapThemeDefinition,
} from "../core/contentTypes";
import {
  NORMAL_MAP_GAUNTLET_LENGTH,
  NORMAL_MAP_SAFE_LENGTH,
  NORMAL_MAP_WIDTH,
} from "../core/constants";
import type { StageId, WorldId } from "../core/types";

export function getWorld01StageTheme(
  stageId: StageId,
  base: WorldMapThemeDefinition,
): WorldMapThemeDefinition {
  const midAssetKey = stageId === "world-01-stage-2"
    ? "world-01-roof-day-mid"
    : stageId === "world-01-stage-4"
      ? "world-01-clothesline-day-mid"
      : null;
  if (!midAssetKey) return base;
  return {
    ...base,
    layers: base.layers.map((layer) => layer.kind === "background-mid"
      ? { ...layer, assetKey: midAssetKey }
      : layer),
  };
}

export function getWorld03StageTheme(
  stageId: StageId,
  base: WorldMapThemeDefinition,
): WorldMapThemeDefinition {
  const match = /^world-03-stage-([1-4])$/.exec(stageId);
  if (!match) return base;
  return {
    ...base,
    layers: base.layers.map((layer) => layer.kind === "background-mid"
      ? { ...layer, assetKey: `world-03-background-mid-${match[1]}` }
      : layer),
  };
}

export const WORLD_MAP_THEMES: readonly WorldMapThemeDefinition[] = [
  createTheme(
    "world-01",
    "world-01-tileset",
    [
      "alley",
      "laundry",
      "roof",
      "fence",
      "ant",
      "ground",
      "white-spike",
      "world-01-pigeon-static",
      "world-01-manhole-open",
      "bone-coin",
      "cat-box",
    ],
    {
      far: "#9bdcf2",
      mid: "#c8d6ca",
      gameplay: "#68736e",
      foreground: "#33454b",
      accent: "#e3c95f",
    },
  ),
  createTheme("world-02", "world-02-tileset", ["swing", "slide", "seesaw", "jungle-gym"], {
    far: "#9bd8e5",
    mid: "#f4c95d",
    gameplay: "#8a5a8c",
    foreground: "#442b56",
    accent: "#e96b9a",
  }),
  createTheme("world-03", "world-03-tileset", ["world-03-traffic-cone", "world-03-brick-stack", "world-03-cement-bag", "world-03-steel-pipe"], {
    far: "#b9d2d3",
    mid: "#b5a996",
    gameplay: "#71645d",
    foreground: "#4a4544",
    accent: "#eeb849",
  }),
  createTheme("world-04", "world-04-tileset", ["scrap", "crane", "camera", "compressor"], {
    far: "#77747a",
    mid: "#4f555e",
    gameplay: "#424044",
    foreground: "#25232b",
    accent: "#f08a44",
  }),
  createTheme("world-05", "world-05-tileset", ["tower", "catwalk", "banner", "throne"], {
    far: "#3c274e",
    mid: "#2d203b",
    gameplay: "#241c2c",
    foreground: "#120f19",
    accent: "#e9b949",
  }),
];

export function createDefaultStageSections(
  stageId: string,
): readonly MapSectionDefinition[] {
  return [
    {
      id: stageId + "-section-1",
      index: 1,
      role: "safe-entry",
      x: 0,
      width: NORMAL_MAP_SAFE_LENGTH,
      safe: true,
      vertical: false,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-2",
      index: 2,
      role: "gauntlet",
      x: NORMAL_MAP_SAFE_LENGTH,
      width: NORMAL_MAP_GAUNTLET_LENGTH,
      safe: false,
      vertical: false,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-3",
      index: 3,
      role: "gauntlet",
      x: NORMAL_MAP_SAFE_LENGTH + NORMAL_MAP_GAUNTLET_LENGTH,
      width: NORMAL_MAP_GAUNTLET_LENGTH,
      safe: false,
      vertical: false,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-4",
      index: 4,
      role: "checkpoint-gauntlet",
      x: NORMAL_MAP_SAFE_LENGTH + NORMAL_MAP_GAUNTLET_LENGTH * 2,
      width: NORMAL_MAP_GAUNTLET_LENGTH,
      safe: false,
      vertical: false,
      checkpointId: stageId + "-checkpoint",
      mapObjectIds: [stageId + "-checkpoint"],
    },
    {
      id: stageId + "-section-5",
      index: 5,
      role: "safe-exit",
      x: NORMAL_MAP_WIDTH - NORMAL_MAP_SAFE_LENGTH,
      width: NORMAL_MAP_SAFE_LENGTH,
      safe: true,
      vertical: false,
      mapObjectIds: [stageId + "-exit"],
    },
  ];
}

function createTheme(
  worldId: WorldId,
  tilesetKey: string,
  hazardCatalog: readonly string[],
  palette: WorldMapPalette,
): WorldMapThemeDefinition {
  const layers: readonly MapLayerDefinition[] = [
    {
      layerId: worldId + "-background-far",
      kind: "background-far",
      depth: -30,
      scrollFactorX: 0.15,
      scrollFactorY: 0.15,
      assetKey: worldId + "-background-far",
    },
    {
      layerId: worldId + "-background-mid",
      kind: "background-mid",
      depth: -20,
      scrollFactorX: 0.35,
      scrollFactorY: 0.35,
      assetKey: worldId + "-background-mid",
    },
    {
      layerId: worldId + "-gameplay",
      kind: "gameplay",
      depth: 0,
      scrollFactorX: 1,
      scrollFactorY: 1,
      assetKey: tilesetKey,
    },
    {
      layerId: worldId + "-foreground",
      kind: "foreground",
      depth: worldId === "world-01" ? -10 : 20,
      scrollFactorX: 1.05,
      scrollFactorY: 1.05,
      assetKey: worldId === "world-01"
        ? "world-01-background-foreground"
        : worldId + "-foreground",
    },
  ];

  return {
    id: worldId + "-theme",
    worldId,
    tilesetKey,
    palette,
    layers,
    objectVisualKeys: hazardCatalog,
    hazardCatalog,
  };
}
