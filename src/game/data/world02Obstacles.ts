export type World02ObstacleKind =
  | "crushed-cola-can"
  | "empty-snack-bag"
  | "pink-sand-shovel"
  | "orange-traffic-cone"
  | "duck-spring"
  | "sleeping-fat-cat"
  | "elephant-spring"
  | "rabbit-spring";

export interface World02ObstacleDefinition {
  readonly id: string;
  readonly kind: World02ObstacleKind;
  readonly x: number;
  readonly groundY: 504;
  readonly textureKey: string;
  readonly hitbox: Readonly<{ width: number; height: number }>;
  readonly contact: "instant-death" | "cat-scratch";
}

const obstacle = (
  kind: World02ObstacleKind,
  x: number,
  width: number,
  height: number,
  contact: World02ObstacleDefinition["contact"] = "instant-death",
): World02ObstacleDefinition => ({
  id: `world-02-stage-1-obstacle-${kind}`,
  kind,
  x,
  groundY: 504,
  textureKey: `world-02-obstacle-${kind}`,
  hitbox: { width, height },
  contact,
});

export const WORLD02_STAGE1_OBSTACLES: readonly World02ObstacleDefinition[] = [
  obstacle("crushed-cola-can", 420, 28, 18),
  obstacle("empty-snack-bag", 760, 34, 22),
  obstacle("pink-sand-shovel", 1100, 26, 40),
  obstacle("orange-traffic-cone", 1460, 34, 40),
  obstacle("duck-spring", 1810, 42, 44),
  obstacle("sleeping-fat-cat", 2160, 62, 32, "cat-scratch"),
  obstacle("elephant-spring", 2850, 44, 44),
  obstacle("rabbit-spring", 3220, 42, 44),
];
