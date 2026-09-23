import type {
  MapChainRule,
  MapObjectDefinition,
  MapSectionDefinition,
  StageMapDefinition,
} from "../core/contentTypes";
import { MAP_TILE_SIZE, NORMAL_MAP_WIDTH, stageIdFor } from "../core/constants";
import type { StageId } from "../core/types";
import { WORLD_MAP_THEMES } from "./worldMaps";
import {
  getWorld01FloorY,
  getWorld01GimmicksForStage,
} from "./world01Gimmicks";

type World01StageNumber = 1 | 2 | 3 | 4;

const SAFE_LENGTH = 192;
const GAUNTLET_LENGTH = 1152;

function getSectionIndex(x: number): 1 | 2 | 3 | 4 | 5 {
  if (x < SAFE_LENGTH) {
    return 1;
  }
  if (x < SAFE_LENGTH + GAUNTLET_LENGTH) {
    return 2;
  }
  if (x < SAFE_LENGTH + GAUNTLET_LENGTH * 2) {
    return 3;
  }
  if (x < NORMAL_MAP_WIDTH - SAFE_LENGTH) {
    return 4;
  }
  return 5;
}

function mapTriggerFor(
  trigger: ReturnType<typeof getWorld01GimmicksForStage>[number]["trigger"],
): MapChainRule["trigger"] {
  switch (trigger) {
    case "walk-enter":
      return "object-enter";
    case "forward-jump":
    case "jump-in-zone":
      return "player-jump";
    case "jump-over":
      return "jump-over";
    case "timed-after-enter":
      return "timer";
    case "collect":
      return "object-hit";
    case "checkpoint-touch":
      return "checkpoint-reached";
    case "dialogue-enter":
      return "dialogue-enter";
  }
}

function createGimmickObject(
  stageId: StageId,
  gimmick: ReturnType<typeof getWorld01GimmicksForStage>[number],
): MapObjectDefinition {
  const chainId = gimmick.chainIds[0];
  return {
    id: gimmick.objectId,
    kind: "interactive",
    x: gimmick.x,
    y: gimmick.y,
    width: gimmick.width,
    height: gimmick.height,
    visualKey: gimmick.visualKey,
    layerId: "world-01-gameplay",
    collision: false,
    chainId,
    seedGroup: gimmick.seedGroup,
    properties: {
      gimmickId: gimmick.id,
      gimmickKind: gimmick.kind,
      trigger: gimmick.trigger,
      hintPolicy: gimmick.hintPolicy,
      lethal: gimmick.lethal,
      counterplayAction: gimmick.counterplay.action,
      chainId,
      seedGroup: gimmick.seedGroup ?? "world01-stage-" + stageId,
      ...(gimmick.kind === "fake-checkpoint" ? { fakeCheckpoint: true } : {}),
      ...(gimmick.variantKey ? { variantKey: gimmick.variantKey } : {}),
    },
  };
}

function createChainRules(
  stageNumber: World01StageNumber,
  gimmicks: ReturnType<typeof getWorld01GimmicksForStage>,
): readonly MapChainRule[] {
  const gimmickRules = gimmicks.flatMap((gimmick): MapChainRule[] => {
    const actions: MapChainRule["actions"][number][] = [];
    if (gimmick.kind === "fake-bone-green") {
      actions.push({ type: "set-player-tint", value: "green" });
    } else if (gimmick.kind === "fake-bone-fire") {
      actions.push({ type: "force-control", value: "launch-up" });
    } else if (gimmick.kind === "fake-bone-reverse") {
      actions.push({ type: "force-control", value: "drift-backward" });
    } else if (gimmick.kind === "name-bubble-control-loss") {
      actions.push({ type: "force-control", value: "run-left" });
    }
    if (gimmick.kind === "fake-checkpoint") {
      actions.push({ type: "activate-object", targetId: gimmick.id + "-spikes" });
    }
    if (gimmick.kind !== "name-bubble-control-loss") {
      actions.push({
        type: "request-death",
        eventType: "world01-gimmick:" + gimmick.kind,
        delayMs: gimmick.outcome.durationMs ?? gimmick.outcome.deathDelayMs ?? 0,
      });
    }

    const mainRule: MapChainRule = {
      id: gimmick.chainIds[0],
      trigger: mapTriggerFor(gimmick.trigger),
      sourceId: gimmick.objectId,
      actions,
      randomized: false,
      seedGroup: gimmick.seedGroup,
    };

    if (gimmick.kind !== "name-bubble-control-loss") {
      return [mainRule];
    }

    return [
      mainRule,
      {
        id: gimmick.id + "-escaped",
        trigger: "input-mash",
        sourceId: gimmick.objectId,
        actions: [{ type: "clear-control" }],
        randomized: false,
        seedGroup: gimmick.seedGroup,
      },
      {
        id: gimmick.id + "-mash-expired",
        trigger: "timer-expired",
        sourceId: gimmick.objectId,
        actions: [{ type: "request-death", eventType: "world01-name-bubble-failed" }],
        randomized: false,
        seedGroup: gimmick.seedGroup,
      },
    ];
  });

  if (stageNumber !== 1 && stageNumber !== 3) {
    return gimmickRules;
  }

  const sourceId = "world01-cat-chain-source-" + stageNumber;
  const enemyId = "world01-cat-chain-enemy-" + stageNumber;
  const seedGroup = "world01-cat-chain-" + stageNumber;
  const mapX = stageNumber === 1 ? 1184 : 2304;
  const floorY = getWorld01FloorY(stageNumber, mapX);

  return [
    ...gimmickRules,
    {
      id: seedGroup,
      trigger: "object-enter",
      sourceId,
      actions: [
        {
          type: "move-object",
          targetId: enemyId,
          value: mapX + 80 + "," + (floorY - 48),
        },
        { type: "spawn-enemy", targetId: enemyId },
      ],
      randomized: false,
      seedGroup,
    },
  ];
}

function createStageMap(stageNumber: World01StageNumber): StageMapDefinition {
  const stageId = stageIdFor("world-01", stageNumber);
  const mapHeight = stageNumber === 2 || stageNumber === 4 ? 1152 : 720;
  const gimmicks = getWorld01GimmicksForStage(stageId);
  const theme = WORLD_MAP_THEMES.find((candidate) => candidate.worldId === "world-01");
  if (!theme) {
    throw new Error("월드 1 테마를 찾을 수 없습니다.");
  }

  const checkpointX = SAFE_LENGTH + GAUNTLET_LENGTH * 2 + 8;
  const exitX = NORMAL_MAP_WIDTH - SAFE_LENGTH + 48;
  const checkpointFloor = getWorld01FloorY(stageNumber, checkpointX);
  const exitFloor = getWorld01FloorY(stageNumber, exitX);
  const checkpointId = stageId + "-checkpoint";
  const exitId = stageId + "-exit";
  const gimmickObjects = gimmicks.map((gimmick) =>
    createGimmickObject(stageId, gimmick),
  );
  const checkpointSpikeObjects: MapObjectDefinition[] = gimmicks
    .filter((gimmick) => gimmick.kind === "fake-checkpoint")
    .map((gimmick) => ({
      id: gimmick.id + "-spikes",
      kind: "interactive",
      x: gimmick.x,
      y: gimmick.y + gimmick.height - 32,
      width: gimmick.width,
      height: 32,
      visualKey: "white-spike",
      layerId: "world-01-gameplay",
      collision: false,
      seedGroup: gimmick.seedGroup,
      properties: {
        active: false,
        chainId: gimmick.chainIds[0],
        seedGroup: gimmick.seedGroup ?? "world01-fake-checkpoint",
        triggeredByFakeCheckpoint: true,
      },
    }));
  const requiredObjects: MapObjectDefinition[] = [
    {
      id: checkpointId,
      kind: "checkpoint",
      x: checkpointX,
      y: checkpointFloor - 128,
      width: 18,
      height: 128,
      visualKey: "checkpoint",
      layerId: "world-01-gameplay",
      collision: false,
      properties: { trueCheckpoint: true },
    },
    {
      id: exitId,
      kind: "exit",
      x: exitX,
      y: exitFloor - 128,
      width: 32,
      height: 128,
      visualKey: "exit",
      layerId: "world-01-gameplay",
      collision: false,
      properties: { safeExit: true },
    },
  ];

  const chainObjects: MapObjectDefinition[] = [];
  if (stageNumber === 1 || stageNumber === 3) {
    const sourceId = "world01-cat-chain-source-" + stageNumber;
    const enemyId = "world01-cat-chain-enemy-" + stageNumber;
    const seedGroup = "world01-cat-chain-" + stageNumber;
    const sourceX = stageNumber === 1 ? 1184 : 2304;
    const floorY = getWorld01FloorY(stageNumber, sourceX);
    chainObjects.push(
      {
        id: sourceId,
        kind: "interactive",
        x: sourceX,
        y: floorY - 64,
        width: 32,
        height: 64,
        visualKey: "alley",
        layerId: "world-01-gameplay",
        collision: false,
        chainId: seedGroup,
        seedGroup,
        properties: { chainId: seedGroup, seedGroup, active: true },
      },
      {
        id: enemyId,
        kind: "enemy-spawn",
        x: sourceX + 80,
        y: floorY - 48,
        width: 48,
        height: 48,
        visualKey: "tuxedo-cat",
        layerId: "world-01-gameplay",
        collision: true,
        seedGroup,
        properties: {
          active: false,
          enemyKind: "alley-cat",
          health: 1,
          contactDamage: 1,
          patrolMinX: sourceX + 32,
          patrolMaxX: sourceX + 192,
          patrolSpeed: 72,
          seedGroup,
        },
      },
    );
  }

  const objectDefinitions = [
    ...gimmickObjects,
    ...checkpointSpikeObjects,
    ...requiredObjects,
    ...chainObjects,
  ];
  const sectionDefinitions: readonly MapSectionDefinition[] = [
    {
      id: stageId + "-section-1",
      index: 1,
      role: "safe-entry",
      x: 0,
      width: SAFE_LENGTH,
      safe: true,
      vertical: false,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-2",
      index: 2,
      role: "gauntlet",
      x: SAFE_LENGTH,
      width: GAUNTLET_LENGTH,
      safe: false,
      vertical: false,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-3",
      index: 3,
      role: "gauntlet",
      x: SAFE_LENGTH + GAUNTLET_LENGTH,
      width: GAUNTLET_LENGTH,
      safe: false,
      vertical: stageNumber === 2 || stageNumber === 4,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-4",
      index: 4,
      role: "checkpoint-gauntlet",
      x: SAFE_LENGTH + GAUNTLET_LENGTH * 2,
      width: GAUNTLET_LENGTH,
      safe: false,
      vertical: false,
      checkpointId,
      mapObjectIds: [],
    },
    {
      id: stageId + "-section-5",
      index: 5,
      role: "safe-exit",
      x: NORMAL_MAP_WIDTH - SAFE_LENGTH,
      width: SAFE_LENGTH,
      safe: true,
      vertical: false,
      mapObjectIds: [],
    },
  ];
  const sections: readonly MapSectionDefinition[] = sectionDefinitions.map((section) => ({
    ...section,
    mapObjectIds: objectDefinitions
      .filter((object) => getSectionIndex(object.x + object.width / 2) === section.index)
      .map((object) => object.id),
  }));

  return {
    mapKey: stageId + "-map",
    mapFile: "/assets/pixel/maps/world-01/world-01-stage-" + stageNumber + ".json",
    tileWidth: MAP_TILE_SIZE,
    tileHeight: MAP_TILE_SIZE,
    mapWidth: NORMAL_MAP_WIDTH,
    mapHeight,
    sections,
    layers: theme.layers,
    objectDefinitions,
    gimmicks,
    chainRules: createChainRules(stageNumber, gimmicks),
  };
}

export const WORLD01_STAGE_MAPS: Readonly<
  Record<World01StageNumber, StageMapDefinition>
> = {
  1: createStageMap(1),
  2: createStageMap(2),
  3: createStageMap(3),
  4: createStageMap(4),
};

export function getWorld01StageMap(stageNumber: World01StageNumber) {
  return WORLD01_STAGE_MAPS[stageNumber];
}
