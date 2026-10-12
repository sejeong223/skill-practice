import type { MapChainRule, MapObjectDefinition, MapSectionDefinition, StageMapDefinition, WorldGimmickDefinition } from "../core/contentTypes";
import { MAP_TILE_SIZE, WORLD01_NORMAL_MAP_WIDTH, stageIdFor } from "../core/constants";
import type { StageId } from "../core/types";
import { WORLD_MAP_THEMES } from "./worldMaps";
import { getWorld01FloorY, getWorld01GimmicksForStage } from "./world01Gimmicks";
import { SNACK_PRESENTATION } from "./snackPresentation";

type Stage = 1 | 2 | 3 | 4;
const SAFE_LENGTH = 192;
const SECTION_STARTS = [0, 192, 912, 1648, 2368] as const;
const SECTION_LENGTHS = [192, 720, 736, 720, 192] as const;
const realSnackXs: Readonly<Record<Stage, readonly number[]>> = {
  1: [224, 304, 384, 1008, 1776],
  2: [224, 304, 384, 1584, 1904],
  3: [224, 304, 384, 1008, 1776],
  4: [224, 304, 384, 1472, 1776],
};

function createRealSnackObject(stage: Stage, index: number, x: number): MapObjectDefinition {
  return {
    id: `world-01-stage-${stage}-snack-${index + 1}`, kind: "collectible", x,
    y: getWorld01FloorY(stage, x) - SNACK_PRESENTATION.topOffsetFromFloor,
    width: SNACK_PRESENTATION.width, height: SNACK_PRESENTATION.height,
    visualKey: SNACK_PRESENTATION.frameKey, layerId: "world-01-gameplay", collision: false,
    properties: { collectibleType: "snack-coin", coinValue: 1 },
  };
}

export function world01Checkpoint(stageNumber: Stage): { id: string; x: number; sectionIndex: 3 | 4 } | null {
  if (stageNumber === 2) return { id: "world-01-stage-2-checkpoint", x: 1520, sectionIndex: 3 };
  if (stageNumber === 4) return { id: "world-01-stage-4-checkpoint", x: 2320, sectionIndex: 4 };
  return null;
}

function sectionIndex(x: number): 1 | 2 | 3 | 4 | 5 {
  if (x < SAFE_LENGTH) return 1;
  if (x < SECTION_STARTS[2]) return 2;
  if (x < SECTION_STARTS[3]) return 3;
  if (x < SECTION_STARTS[4]) return 4;
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

  const checkpoint = world01Checkpoint(stageNumber);
  const exitX = WORLD01_NORMAL_MAP_WIDTH - SAFE_LENGTH + 48;
  const exitId = stageId + "-exit";
  const objectDefinitions: MapObjectDefinition[] = [
    ...gimmicks.map((gimmick) => createGimmickObject(stageId, gimmick)),
    ...realSnackXs[stageNumber].map((x, index) => createRealSnackObject(stageNumber, index, x)),
    ...(checkpoint ? [{
      id: checkpoint.id, kind: "checkpoint" as const, x: checkpoint.x,
      y: getWorld01FloorY(stageNumber, checkpoint.x) - 128,
      width: 18, height: 128, visualKey: "checkpoint",
      layerId: "world-01-gameplay", collision: false,
      properties: { trueCheckpoint: true },
    }] : []),
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
    { id: stageId + "-section-2", index: 2, role: "gauntlet", x: SECTION_STARTS[1], width: SECTION_LENGTHS[1], safe: false, vertical: false, mapObjectIds: [] },
    { id: stageId + "-section-3", index: 3, role: checkpoint?.sectionIndex === 3 ? "checkpoint-gauntlet" : "gauntlet", x: SECTION_STARTS[2], width: SECTION_LENGTHS[2], safe: false, vertical: stageNumber === 2 || stageNumber === 4, ...(checkpoint?.sectionIndex === 3 ? { checkpointId: checkpoint.id } : {}), mapObjectIds: [] },
    { id: stageId + "-section-4", index: 4, role: checkpoint?.sectionIndex === 4 ? "checkpoint-gauntlet" : "gauntlet", x: SECTION_STARTS[3], width: SECTION_LENGTHS[3], safe: false, vertical: false, ...(checkpoint?.sectionIndex === 4 ? { checkpointId: checkpoint.id } : {}), mapObjectIds: [] },
    { id: stageId + "-section-5", index: 5, role: "safe-exit", x: SECTION_STARTS[4], width: SAFE_LENGTH, safe: true, vertical: false, mapObjectIds: [] },
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
    mapWidth: WORLD01_NORMAL_MAP_WIDTH, mapHeight: 720,
    sections, layers: theme.layers, objectDefinitions, gimmicks,
    chainRules: createChainRules(gimmicks),
  };
}

export const WORLD01_STAGE_MAPS: Readonly<Record<Stage, StageMapDefinition>> = {
  1: createStageMap(1), 2: createStageMap(2), 3: createStageMap(3), 4: createStageMap(4),
};
