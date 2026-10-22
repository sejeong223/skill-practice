import { StageRandom } from "../random/StageRandom";
import {
  createWorld02Obstacle,
  WORLD02_STAGE1_OBSTACLES,
  type World02ObstacleDefinition,
  type World02ObstacleKind,
} from "./world02Obstacles";
import {
  WORLD02_PIGEON_DROP_OFFSETS,
  WORLD02_STAGE1_PIGEON_PASSES,
  type World02PigeonPassDefinition,
} from "./world02PigeonDrops";

export type World02PlaygroundStageId = "world-02-stage-1" | "world-02-stage-2" | "world-02-stage-3";

export interface World02StageHazards {
  readonly obstacles: readonly World02ObstacleDefinition[];
  readonly pigeonPasses: readonly World02PigeonPassDefinition[];
}

const OBSTACLE_SLOTS = [420, 760, 1100, 1460, 1810, 2160, 2850, 3220] as const;
const PIGEON_SLOTS = [1280, 1980, 3040] as const;
const JITTER = [-16, 0, 16] as const;
const CHECKPOINT_X = 2496;

function shuffled<T>(values: readonly T[], random: StageRandom): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random.next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function safe(obstacles: readonly World02ObstacleDefinition[], passes: readonly World02PigeonPassDefinition[]): boolean {
  for (let index = 0; index < obstacles.length; index += 1) {
    const obstacle = obstacles[index];
    const halfWidth = obstacle.hitbox.width / 2;
    if (obstacle.x - halfWidth < 192 || obstacle.x + halfWidth >= 3648 ||
        Math.abs(obstacle.x - CHECKPOINT_X) - halfWidth < 250) return false;
    if (index > 0 && obstacle.x - obstacles[index - 1].x < 300) return false;
  }
  for (const pass of passes) {
    for (const offset of WORLD02_PIGEON_DROP_OFFSETS) {
      const dropX = pass.dropX + offset;
      if (dropX < 192 || dropX >= 3648 || Math.abs(dropX - CHECKPOINT_X) < 250) return false;
      if (obstacles.some((obstacle) =>
        Math.abs(dropX - obstacle.x) - obstacle.hitbox.width / 2 - 7 - 36 < 20)) return false;
    }
  }
  return true;
}

export function getWorld02StageHazards(stageId: World02PlaygroundStageId, seed: number): World02StageHazards {
  if (stageId === "world-02-stage-1") {
    return { obstacles: WORLD02_STAGE1_OBSTACLES, pigeonPasses: WORLD02_STAGE1_PIGEON_PASSES };
  }
  const random = new StageRandom(StageRandom.hash(`${seed}:${stageId}`));
  const kinds: World02ObstacleKind[] = shuffled([
    "crushed-cider-can", "crushed-fanta-can", "empty-cheetos-bag", "sleeping-orange-cat", "sleeping-tuxedo-cat",
    random.pick(["crushed-cola-can", "empty-snack-bag", "sleeping-fat-cat"] as const),
    stageId === "world-02-stage-2" ? random.pick(["duck-spring", "elephant-spring"] as const) : "rabbit-spring",
    random.pick(["pink-sand-shovel", "orange-traffic-cone"] as const),
  ], random);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const obstacles = OBSTACLE_SLOTS.map((baseX, index) => createWorld02Obstacle(
      kinds[index], baseX + random.pick(JITTER), `${stageId}-obstacle-${index + 1}`,
    ));
    const pigeonPasses = PIGEON_SLOTS.map((baseX, index) => {
      const dropX = baseX + random.pick(JITTER);
      return { id: `${stageId}-pigeon-${index + 1}`, triggerX: dropX - 450,
        dropX, flightY: 190, birdSpeedX: 102, droppingSpeedY: 770 };
    });
    if (safe(obstacles, pigeonPasses)) return { obstacles, pigeonPasses };
  }
  const obstacles = OBSTACLE_SLOTS.map((x, index) => createWorld02Obstacle(kinds[index], x, `${stageId}-obstacle-${index + 1}`));
  const pigeonPasses = PIGEON_SLOTS.map((dropX, index) => ({
    id: `${stageId}-pigeon-${index + 1}`, triggerX: dropX - 450,
    dropX, flightY: 190, birdSpeedX: 102, droppingSpeedY: 770,
  }));
  if (!safe(obstacles, pigeonPasses)) throw new Error(`Invalid fallback hazards for ${stageId}`);
  return { obstacles, pigeonPasses };
}
