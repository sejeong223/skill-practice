import type { StageId } from "../core/types";

export interface World03SteelBeamDefinition {
  readonly id: string;
  readonly x: number;
}

export const WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND = 1600;
export const WORLD03_STEEL_BEAM_HITBOX_WIDTH = 56;
export const WORLD03_STEEL_BEAM_HITBOX_HEIGHT = 20;

const DROP_POSITIONS: readonly (readonly number[])[] = [
  [1165],
  [1165, 2340],
  [1165, 2340, 2900],
  [1165, 2340, 2880],
];

export function getWorld03SteelBeamDefinitions(stageId: StageId): readonly World03SteelBeamDefinition[] {
  const match = /^world-03-stage-([1-4])$/.exec(stageId);
  if (!match) return [];
  return DROP_POSITIONS[Number(match[1]) - 1].map((x, index) => ({
    id: `${stageId}-steel-beam-${index + 1}`,
    x,
  }));
}
