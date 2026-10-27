import type { StageId } from "../core/types";

export type World03ObstacleKind = "traffic-cone" | "brick-stack" | "cement-bag" | "steel-pipe";

export interface World03ObstaclePlacement {
  readonly id: string;
  readonly kind: World03ObstacleKind;
  readonly x: number;
  readonly width: number;
  readonly height: number;
}

const POSITIONS = [380, 740, 1100, 1460, 1820, 2180, 2820, 3220] as const;
const COIN_POSITIONS = [
  180, 260, 830, 920, 1010, 1550, 1640, 1730,
  2290, 2380, 2590, 2700, 3350, 3450, 3550,
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
  ["traffic-cone", "cement-bag", "brick-stack", "steel-pipe", "traffic-cone", "brick-stack", "cement-bag", "steel-pipe"],
  ["cement-bag", "steel-pipe", "traffic-cone", "brick-stack", "cement-bag", "traffic-cone", "steel-pipe", "brick-stack"],
  ["steel-pipe", "brick-stack", "cement-bag", "traffic-cone", "steel-pipe", "cement-bag", "brick-stack", "traffic-cone"],
  ["brick-stack", "traffic-cone", "steel-pipe", "cement-bag", "brick-stack", "steel-pipe", "traffic-cone", "cement-bag"],
];
const HITBOX: Readonly<Record<World03ObstacleKind, { width: number; height: number }>> = {
  "traffic-cone": { width: 23, height: 34 },
  "brick-stack": { width: 34, height: 29 },
  "cement-bag": { width: 29, height: 32 },
  "steel-pipe": { width: 37, height: 23 },
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
      ...HITBOX[kind],
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
