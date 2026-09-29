import type { MapChainRule, MapObjectDefinition, MapSectionDefinition, StageMapDefinition, WorldGimmickDefinition } from "../core/contentTypes";
import { MAP_TILE_SIZE, NORMAL_MAP_WIDTH, stageIdFor } from "../core/constants";
import type { StageId } from "../core/types";
import { WORLD_MAP_THEMES } from "./worldMaps";
import { getWorld01FloorY, getWorld01GimmicksForStage } from "./world01Gimmicks";

type Stage = 1 | 2 | 3 | 4;
const SAFE_LENGTH = 192;
const GAUNTLET_LENGTH = 1152;

function sectionIndex(x: number): 1 | 2 | 3 | 4 | 5 {
  if (x < SAFE_LENGTH) return 1;
  if (x < SAFE_LENGTH + GAUNTLET_LENGTH) return 2;
  if (x < SAFE_LENGTH + GAUNTLET_LENGTH * 2) return 3;
  if (x < NORMAL_MAP_WIDTH - SAFE_LENGTH) return 4;
  return 5;
}

function createGimmickObject(stageId: StageId, gimmick: WorldGimmickDefinition): MapObjectDefinition {
  const chainId = gimmick.chainIds[0];
  return {
    id: gimmick.objectId,
    kind: "interactive",
    x: gimmick.x, y: gimmick.y, width: gimmick.width, height: gimmick.height,
    visualKey: gimmick.visualKey, layerId: "world-01-gameplay", collision: false,
    chainId, seedGroup: gimmick.seedGroup,
    properties: {
      gimmickId: gimmick.id, gimmickKind: gimmick.kind, trigger: gimmick.trigger,
      hintPolicy: gimmick.hintPolicy, lethal: gimmick.lethal,
      gimmickOutcome: gimmick.outcome.kind, deathCause: gimmick.outcome.deathCause,
      counterplayAction: gimmick.counterplay.action, chainId,
      seedGroup: gimmick.seedGroup ?? "world01-stage-" + stageId,
      ...(gimmick.variantKey ? { variantKey: gimmick.variantKey } : {}),
    },
  };
}

function createChainRules(gimmicks: readonly WorldGimmickDefinition[]): readonly MapChainRule[] {
  return gimmicks.map((gimmick) => {
    const actions: MapChainRule["actions"][number][] = [];
    if (gimmick.kind === "fake-bone-green") {
      actions.push({ type: "set-player-tint", value: "#40d850" });
      actions.push({ type: "request-death", eventType: "world01-gimmick:fake-bone-green", delayMs: 450 });
    } else if (gimmick.kind === "fake-bone-reverse") {
      actions.push({ type: "force-control", value: "drift-backward", durationMs: 1800 });
    } else if (gimmick.kind === "fake-bone-fire") {
      actions.push({ type: "force-control", value: "launch-up", durationMs: 1700 });
    }
    return {
      id: gimmick.chainIds[0],
      trigger: gimmick.trigger === "collect" ? "object-hit" : "object-enter",
      sourceId: gimmick.objectId,
      actions,
      randomized: false,
      seedGroup: gimmick.seedGroup,
    };
  });
}

function createStageMap(stageNumber: Stage): StageMapDefinition {
  const stageId = stageIdFor("world-01", stageNumber);
  const gimmicks = getWorld01GimmicksForStage(stageId);
  const theme = WORLD_MAP_THEMES.find((candidate) => candidate.worldId === "world-01");
  if (!theme) throw new Error("월드 1 테마를 찾을 수 없습니다.");

  const checkpointX = SAFE_LENGTH + GAUNTLET_LENGTH * 2 + 8;
  const exitX = NORMAL_MAP_WIDTH - SAFE_LENGTH + 48;
  const checkpointId = stageId + "-checkpoint";
  const exitId = stageId + "-exit";
  const objectDefinitions: MapObjectDefinition[] = [
    ...gimmicks.map((gimmick) => createGimmickObject(stageId, gimmick)),
    {
      id: checkpointId, kind: "checkpoint", x: checkpointX,
      y: getWorld01FloorY(stageNumber, checkpointX) - 128,
      width: 18, height: 128, visualKey: "checkpoint",
      layerId: "world-01-gameplay", collision: false,
      properties: { trueCheckpoint: true },
    },
    {
      id: exitId, kind: "exit", x: exitX,
      y: getWorld01FloorY(stageNumber, exitX) - 128,
      width: 32, height: 128, visualKey: "exit",
      layerId: "world-01-gameplay", collision: false,
      properties: { safeExit: true },
    },
  ];
  const sectionDefinitions: readonly MapSectionDefinition[] = [
    { id: stageId + "-section-1", index: 1, role: "safe-entry", x: 0, width: SAFE_LENGTH, safe: true, vertical: false, mapObjectIds: [] },
    { id: stageId + "-section-2", index: 2, role: "gauntlet", x: SAFE_LENGTH, width: GAUNTLET_LENGTH, safe: false, vertical: false, mapObjectIds: [] },
    { id: stageId + "-section-3", index: 3, role: "gauntlet", x: SAFE_LENGTH + GAUNTLET_LENGTH, width: GAUNTLET_LENGTH, safe: false, vertical: stageNumber === 2 || stageNumber === 4, mapObjectIds: [] },
    { id: stageId + "-section-4", index: 4, role: "checkpoint-gauntlet", x: SAFE_LENGTH + GAUNTLET_LENGTH * 2, width: GAUNTLET_LENGTH, safe: false, vertical: false, checkpointId, mapObjectIds: [] },
    { id: stageId + "-section-5", index: 5, role: "safe-exit", x: NORMAL_MAP_WIDTH - SAFE_LENGTH, width: SAFE_LENGTH, safe: true, vertical: false, mapObjectIds: [] },
  ];
  const sections = sectionDefinitions.map((part) => ({
    ...part,
    mapObjectIds: objectDefinitions
      .filter((object) => sectionIndex(object.x + object.width / 2) === part.index)
      .map((object) => object.id),
  }));
  return {
    mapKey: stageId + "-map",
    mapFile: "/assets/pixel/maps/world-01/world-01-stage-" + stageNumber + ".json",
    tileWidth: MAP_TILE_SIZE, tileHeight: MAP_TILE_SIZE,
    mapWidth: NORMAL_MAP_WIDTH, mapHeight: 720,
    sections, layers: theme.layers, objectDefinitions, gimmicks,
    chainRules: createChainRules(gimmicks),
  };
}

export const WORLD01_STAGE_MAPS: Readonly<Record<Stage, StageMapDefinition>> = {
  1: createStageMap(1), 2: createStageMap(2), 3: createStageMap(3), 4: createStageMap(4),
};
