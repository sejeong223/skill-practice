import type { StageId } from "../core/types";

export interface World03SteelBeamDefinition {
  readonly id: string;
  readonly x: number;
}

export const WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND = 1600;
export const WORLD03_STEEL_BEAM_HITBOX_WIDTH = 56;
export const WORLD03_STEEL_BEAM_HITBOX_HEIGHT = 20;

const DROP_POSITIONS: readonly (readonly number[])[] = [
  [1640],
  [1640, 2360],
  [1640, 2360, 3400],
  [1640, 2360, 3400],
];

export function getWorld03SteelBeamDefinitions(stageId: StageId): readonly World03SteelBeamDefinition[] {
  const match = /^world-03-stage-([1-4])$/.exec(stageId);
  if (!match) return [];
  return DROP_POSITIONS[Number(match[1]) - 1].map((x, index) => ({
    id: `${stageId}-steel-beam-${index + 1}`,
    x,
  }));
}
