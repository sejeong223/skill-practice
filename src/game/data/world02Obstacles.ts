export type World02ObstacleKind =
  | "crushed-cola-can"
  | "empty-snack-bag"
  | "crushed-cider-can"
  | "crushed-fanta-can"
  | "empty-cheetos-bag"
  | "sleeping-orange-cat"
  | "sleeping-tuxedo-cat"
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
  readonly scratchTextureKey?: string;
  readonly originY?: number;
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
  ...(contact === "cat-scratch" ? { scratchTextureKey: "world-02-obstacle-scratching-fat-cat" } : {}),
  ...(kind === "empty-snack-bag" ? { originY: 0.88 } : {}),
});

export function createWorld02Obstacle(
  kind: World02ObstacleKind,
  x: number,
  id: string,
): World02ObstacleDefinition {
  const can = kind === "crushed-cola-can" || kind === "crushed-cider-can" || kind === "crushed-fanta-can";
  const bag = kind === "empty-snack-bag" || kind === "empty-cheetos-bag";
  const cat = kind === "sleeping-fat-cat" || kind === "sleeping-orange-cat" || kind === "sleeping-tuxedo-cat";
  const spring = kind === "duck-spring" || kind === "elephant-spring" || kind === "rabbit-spring";
  const hitbox = can ? { width: 36, height: 22 }
    : bag ? { width: 42, height: 18 }
      : cat ? { width: 40, height: 26 }
        : kind === "pink-sand-shovel" ? { width: 28, height: 44 }
          : kind === "orange-traffic-cone" ? { width: 38, height: 44 }
            : { width: kind === "elephant-spring" ? 44 : 42, height: 44 };
  const displaySize = can ? { width: 72, height: 50 }
    : bag ? { width: 175, height: 95 }
      : cat ? { width: 100, height: 60 }
        : kind === "pink-sand-shovel" ? { width: 64, height: 84 }
          : kind === "orange-traffic-cone" ? { width: 72, height: 78 }
            : undefined;
  return {
    id, kind, x, groundY: 504,
    textureKey: `world-02-obstacle-${kind}`,
    displaySize: spring ? undefined : displaySize,
    hitbox,
    contact: cat ? "cat-scratch" : "instant-death",
    ...(cat ? { scratchTextureKey: `world-02-obstacle-scratching-${kind === "sleeping-fat-cat" ? "fat" : kind === "sleeping-orange-cat" ? "orange" : "tuxedo"}-cat` } : {}),
    ...(bag ? { originY: 0.88 } : {}),
  };
}

export const WORLD02_STAGE1_OBSTACLES: readonly World02ObstacleDefinition[] = [
  obstacle("crushed-cola-can", 420, 36, 22, "instant-death", { width: 72, height: 50 }),
  obstacle("empty-snack-bag", 760, 42, 18, "instant-death", { width: 175, height: 95 }),
  obstacle("pink-sand-shovel", 1100, 28, 44, "instant-death", { width: 64, height: 84 }),
  obstacle("orange-traffic-cone", 1460, 38, 44, "instant-death", { width: 72, height: 78 }),
  obstacle("duck-spring", 1810, 42, 44),
  obstacle("sleeping-fat-cat", 2160, 40, 26, "cat-scratch", { width: 100, height: 60 }),
  obstacle("elephant-spring", 2850, 44, 44),
  obstacle("rabbit-spring", 3220, 42, 44),
];
