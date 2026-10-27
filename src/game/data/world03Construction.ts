import type { StageId } from "../core/types";

export type World03ObstacleKind = "traffic-cone" | "brick-stack" | "cement-bag" | "steel-pipe" | "cable-drum" | "wheelbarrow";

export interface World03ObstaclePlacement {
  readonly id: string;
  readonly kind: World03ObstacleKind;
  readonly x: number;
  readonly width: number;
  readonly height: number;
}

export const WORLD03_OBSTACLE_SCALE = 1.25;

const POSITIONS = [380, 740, 1100, 1460, 1820, 2180, 2820, 3220] as const;
const COIN_POSITIONS = [
  170, 250, 330, 800, 880, 1530, 1720, 2280,
  2420, 2600, 3120, 3300, 3500, 3600, 3680,
] as const;
const COLLAPSE_CENTERS: readonly (readonly number[])[] = [
  [560, 1280, 2000, 3000],
  [576, 1264, 1984, 2992],
  [544, 1296, 2016, 3008],
  [560, 1280, 2000, 2976],
];
export const WORLD03_COLLAPSE_WIDTH = 128;

export interface World03CollapseZone {
  readonly id: string;
  readonly x: number;
  readonly width: number;
}
const KINDS: readonly (readonly World03ObstacleKind[])[] = [
  ["traffic-cone", "cement-bag", "cable-drum", "brick-stack", "wheelbarrow", "steel-pipe", "traffic-cone", "brick-stack"],
  ["cement-bag", "steel-pipe", "cable-drum", "traffic-cone", "wheelbarrow", "brick-stack", "cable-drum", "cement-bag"],
  ["steel-pipe", "brick-stack", "cable-drum", "traffic-cone", "wheelbarrow", "cement-bag", "cable-drum", "wheelbarrow"],
  ["brick-stack", "traffic-cone", "cable-drum", "cement-bag", "wheelbarrow", "steel-pipe", "cable-drum", "wheelbarrow"],
];
const HITBOX: Readonly<Record<World03ObstacleKind, { width: number; height: number }>> = {
  "traffic-cone": { width: 23, height: 34 },
  "brick-stack": { width: 34, height: 29 },
  "cement-bag": { width: 29, height: 32 },
  "steel-pipe": { width: 37, height: 23 },
  "cable-drum": { width: 42, height: 42 },
  "wheelbarrow": { width: 52, height: 40 },
};

export function getWorld03Obstacles(stageId: StageId): readonly World03ObstaclePlacement[] {
  const match = /^world-03-stage-([1-4])$/.exec(stageId);
  if (!match) return [];
  const stageNumber = Number(match[1]);
  return POSITIONS.map((x, index) => {
    const kind = KINDS[stageNumber - 1][index];
    return {
      id: `${stageId}-construction-${index + 1}`,
      kind,
      x,
      width: HITBOX[kind].width * WORLD03_OBSTACLE_SCALE,
      height: HITBOX[kind].height * WORLD03_OBSTACLE_SCALE,
    };
  });
}

export function getWorld03CoinPositions(stageId: StageId): readonly number[] {
  return /^world-03-stage-[1-4]$/.test(stageId) ? COIN_POSITIONS : [];
}

export function getWorld03CollapseZones(stageId: StageId): readonly World03CollapseZone[] {
  const match = /^world-03-stage-([1-4])$/.exec(stageId);
  if (!match) return [];
  return COLLAPSE_CENTERS[Number(match[1]) - 1].map((center, index) => ({
    id: `${stageId}-collapse-${index + 1}`,
    x: center - WORLD03_COLLAPSE_WIDTH / 2,
    width: WORLD03_COLLAPSE_WIDTH,
  }));
}
