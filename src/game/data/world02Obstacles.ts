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
  readonly displaySize?: Readonly<{ width: number; height: number }>;
  readonly hitbox: Readonly<{ width: number; height: number }>;
  readonly contact: "instant-death" | "cat-scratch";
}

const obstacle = (
  kind: World02ObstacleKind,
  x: number,
  width: number,
  height: number,
  contact: World02ObstacleDefinition["contact"] = "instant-death",
  displaySize?: World02ObstacleDefinition["displaySize"],
): World02ObstacleDefinition => ({
  id: `world-02-stage-1-obstacle-${kind}`,
  kind,
  x,
  groundY: 504,
  textureKey: `world-02-obstacle-${kind}`,
  displaySize,
  hitbox: { width, height },
  contact,
});

export const WORLD02_STAGE1_OBSTACLES: readonly World02ObstacleDefinition[] = [
  obstacle("crushed-cola-can", 420, 36, 22, "instant-death", { width: 72, height: 50 }),
  obstacle("empty-snack-bag", 760, 42, 18, "instant-death", { width: 80, height: 36 }),
  obstacle("pink-sand-shovel", 1100, 28, 44, "instant-death", { width: 64, height: 84 }),
  obstacle("orange-traffic-cone", 1460, 38, 44, "instant-death", { width: 72, height: 78 }),
  obstacle("duck-spring", 1810, 42, 44),
  obstacle("sleeping-fat-cat", 2160, 52, 28, "cat-scratch", { width: 112, height: 66 }),
  obstacle("elephant-spring", 2850, 44, 44),
  obstacle("rabbit-spring", 3220, 42, 44),
];
