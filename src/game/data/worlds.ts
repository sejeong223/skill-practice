import {
  BOSS_MAP_WIDTH,
  MAP_TILE_SIZE,
  NORMAL_MAP_WIDTH,
  stageIdFor,
  WORLD_IDS,
} from "../core/constants";
import type {
  BossDefinition,
  CutsceneDefinition,
  MapObjectDefinition,
  StageMapDefinition,
  StageSegment,
  WorldDefinition,
} from "../core/contentTypes";
import { createDefaultStageSections, WORLD_MAP_THEMES } from "./worldMaps";
import { WORLD01_STAGE_MAPS, world01Checkpoint } from "./world01Maps";
import { getWorld01FloorY } from "./world01Gimmicks";
import type {
  SkillId,
  StageDefinition,
  StageId,
  WorldId,
} from "../core/types";

interface WorldBlueprint {
  id: WorldId;
  title: string;
  subtitle: string;
  stageTitles: readonly [string, string, string, string];
  bossTitle: string;
  bossName: string;
  rewardSkill: SkillId;
}

const WORLD_BLUEPRINTS: readonly WorldBlueprint[] = [
  {
    id: "world-01",
    title: "뒷골목",
    subtitle: "왕갈비뼈를 훔쳐 간 냥아치 연합의 첫 흔적",
    stageTitles: [
      "무법지대 뒷골목",
      "빨래방 지붕길",
      "도둑고양이 통로",
      "담벼락 위의 추격전",
    ],
    bossTitle: "냥아치 연합 초소",
    bossName: "삼색이",
    rewardSkill: "bark",
  },
  {
    id: "world-02",
    title: "놀이터",
    subtitle: "웃음소리와 함정이 동시에 튀어나오는 놀이터",
    stageTitles: [
      "지옥의 동네 놀이터",
      "미끄럼틀 낙하 구역",
      "그네 줄타기 골목",
      "정글짐 냥아치 통로",
    ],
    bossTitle: "놀이공원 관리실",
    bossName: "치즈 태비",
    rewardSkill: "bite",
  },
  {
    id: "world-03",
    title: "공사장",
    subtitle: "철근과 레미콘 사이로 이어진 냥아치의 흔적",
    stageTitles: [
      "공사장 진입로",
      "레미콘 구역",
      "비계 통로",
      "자재 야적장",
    ],
    bossTitle: "공사장 감독실",
    bossName: "고등어",
    rewardSkill: "dash",
  },
  {
    id: "world-04",
    title: "냥아치 아지트 (고물상)",
    subtitle: "버려진 고물상에 모인 냥아치들의 본거지",
    stageTitles: [
      "냥아치 아지트 외곽",
      "버려진 고물상",
      "고철 압축장",
      "우두머리 경비 통로",
    ],
    bossTitle: "고물상 집결지",
    bossName: "턱시도",
    rewardSkill: "double-jump",
  },
  {
    id: "world-05",
    title: "캣타워 공성전",
    subtitle: "모든 고양이 패거리의 우두머리가 기다리는 곳",
    stageTitles: [
      "캣타워 공성전 외곽",
      "사료 창고 돌파로",
      "캣타워 중층 난간",
      "왕좌 직통 승강로",
    ],
    bossTitle: "우두머리의 옥좌",
    bossName: "메인쿤",
    rewardSkill: "tail-rotor",
  },
];

function createSegment(
  stageId: StageId,
  segmentNumber: number,
  isBoss: boolean,
  length: number,
): StageSegment {
  const segmentId = stageId + "-segment-" + segmentNumber;
  const isSafeSection = !isBoss && (segmentNumber === 1 || segmentNumber === 5);
  const continuousFloor = stageId === "world-02-stage-1" || /^world-03-stage-[1-4]$/.test(stageId);
  const platforms = continuousFloor
    ? segmentNumber === 1 ? [{
        id: segmentId + "-platform",
        x: NORMAL_MAP_WIDTH / 2,
        y: 520,
        width: NORMAL_MAP_WIDTH,
        height: 32,
      }] : []
    : [{
        id: segmentId + "-platform",
        x: isBoss ? length / 2 : 16,
        y: 520,
        width: length - 32,
        height: 32,
      }];

  return {
    id: segmentId,
    length,
    platforms,
    traps: continuousFloor || isBoss || isSafeSection
      ? []
      : [
          {
            id: segmentId + "-trap",
            kind: segmentNumber % 2 === 0 ? "false-floor" : "falling-object",
            x: 420,
            y: 488,
            width: 64,
            height: 32,
            trigger: "proximity",
            lethal: segmentNumber === 3,
            randomized: segmentNumber === 2,
            telegraph: "눈에 띄지 않는 작은 픽셀 깜빡임",
            effect: "knockback-and-reset",
          },
        ],
    enemies: continuousFloor || isBoss || isSafeSection
      ? []
      : [
          {
            id: segmentId + "-enemy",
            kind: "stray-cat",
            spawn: { x: 560, y: 460 },
            patrol: { minX: 480, maxX: 720, speed: 48 },
            health: 2,
            contactDamage: 1,
            canBeStunned: true,
            loot: [segmentId + "-coin-drop"],
          },
        ],
    coins: isBoss && stageId === "world-01-stage-boss" ? [] : [
      segmentId + "-coin-1",
      segmentId + "-coin-2",
      segmentId + "-coin-3",
    ],
    collectibles: [segmentId + "-collectible"],
    decorations: [segmentId + "-background-prop"],
  };
}

function createStageMap(
  stageId: StageId,
  worldId: WorldId,
  isBoss: boolean,
): StageMapDefinition {
  const mapWidth = isBoss ? BOSS_MAP_WIDTH : NORMAL_MAP_WIDTH;
  const gameplayLayerId = worldId + "-gameplay";
  const requiredObjects: MapObjectDefinition[] = [
    {
      id: stageId + "-exit",
      kind: "exit",
      x: mapWidth - 112,
      y: 360,
      width: 32,
      height: 160,
      visualKey: "exit",
      layerId: gameplayLayerId,
      collision: false,
      properties: {},
    },
  ];

  if (!isBoss) {
    requiredObjects.unshift({
      id: stageId + "-checkpoint",
      kind: "checkpoint",
      x: 2496,
      y: 400,
      width: 18,
      height: 120,
      visualKey: "checkpoint",
      layerId: gameplayLayerId,
      collision: false,
      properties: {},
    });
  }

  const gimmicks: StageMapDefinition["gimmicks"] = [];
  const gimmickObjects: MapObjectDefinition[] = gimmicks.map((gimmick) => ({
    id: gimmick.objectId,
    kind: "interactive",
    x: gimmick.x,
    y: gimmick.y,
    width: gimmick.width,
    height: gimmick.height,
    visualKey: gimmick.visualKey,
    layerId: gameplayLayerId,
    collision: false,
    properties: {
      gimmickId: gimmick.id,
      gimmickKind: gimmick.kind,
      trigger: gimmick.trigger,
      hintPolicy: gimmick.hintPolicy,
    },
  }));

  return {
    mapKey: stageId + "-map",
    mapFile: "/assets/pixel/maps/" + stageId + ".json",
    tileWidth: MAP_TILE_SIZE,
    tileHeight: MAP_TILE_SIZE,
    mapWidth,
    mapHeight: 720,
    sections: isBoss ? [] : createDefaultStageSections(stageId),
    layers: WORLD_MAP_THEMES.find((theme) => theme.worldId === worldId)?.layers ?? [],
    objectDefinitions: [...gimmickObjects, ...requiredObjects],
    gimmicks,
    chainRules: [],
  };
}

function createNormalStage(
  blueprint: WorldBlueprint,
  stageNumber: 1 | 2 | 3 | 4,
): StageDefinition {
  const id = stageIdFor(blueprint.id, stageNumber);
  const map = blueprint.id === "world-01"
    ? WORLD01_STAGE_MAPS[stageNumber]
    : createStageMap(id, blueprint.id, false);
  const world01Save = blueprint.id === "world-01" ? world01Checkpoint(stageNumber) : null;

  return {
    id,
    worldId: blueprint.id,
    title: blueprint.stageTitles[stageNumber - 1],
    subtitle: blueprint.subtitle,
    kind: "normal",
    spawn: {
      x: 96,
      y: blueprint.id === "world-01" ? getWorld01FloorY(stageNumber, 96) : 440,
    },
    checkpointIds: blueprint.id === "world-01"
      ? world01Save ? [world01Save.id] : []
      : [id + "-checkpoint"],
    mapWidth: map.mapWidth,
    mapHeight: map.mapHeight,
    segments: map.sections.map(({ width: length }, index) =>
      createSegment(id, index + 1, false, length),
    ),
    collectibleIds: [id + "-memory"],
    cutsceneIds: [blueprint.id + "-world-intro"],
    themeId: blueprint.id + "-theme",
    mapKey: map.mapKey,
    map,
    ...(blueprint.id !== "world-01" || world01Save
      ? { checkpointSectionIndex: world01Save?.sectionIndex ?? 4 }
      : {}),
  };
}

function createBossStage(blueprint: WorldBlueprint): StageDefinition {
  const id = stageIdFor(blueprint.id, "boss");

  return {
    id,
    worldId: blueprint.id,
    title: blueprint.bossTitle,
    subtitle: blueprint.subtitle,
    kind: "boss",
    spawn: { x: 160, y: 440 },
    checkpointIds: [],
    mapWidth: BOSS_MAP_WIDTH,
    mapHeight: 720,
    segments: [1].map((segmentNumber) =>
      createSegment(id, segmentNumber, true, BOSS_MAP_WIDTH),
    ),
    collectibleIds: [],
    cutsceneIds: [
      blueprint.id + "-boss-intro",
      blueprint.id + "-boss-clear",
    ],
    bossId: blueprint.id + "-boss",
    themeId: blueprint.id + "-theme",
    mapKey: id + "-map",
    map: createStageMap(id, blueprint.id, true),
  };
}

export const STAGE_DEFINITIONS: readonly StageDefinition[] =
  WORLD_BLUEPRINTS.flatMap((blueprint) => [
    ...([1, 2, 3, 4] as const).map((stageNumber) =>
      createNormalStage(blueprint, stageNumber),
    ),
    createBossStage(blueprint),
  ]);

export const BOSS_DEFINITIONS: readonly BossDefinition[] =
  WORLD_BLUEPRINTS.map((blueprint) => ({
    id: blueprint.id + "-boss",
    name: blueprint.bossName,
    worldId: blueprint.id,
    phases: blueprint.id === "world-01" ? [{
      id: "world-01-phase-1",
      healthThreshold: 1,
      pattern: "telegraphed-single-fishbone-throw-and-ten-slipper-hits",
      telegraph: "삼색이가 생선 가시를 들어 올린 뒤 한 번 던진다",
    }] : blueprint.id === "world-02" ? [{
      id: "world-02-phase-1",
      healthThreshold: 1,
      pattern: "whistle-telegraphed-rubber-ball-single-bounce",
      telegraph: "치즈 태비가 호루라기를 불고 고무공을 집어 든다",
    }, {
      id: "world-02-phase-2",
      healthThreshold: 0.5,
      pattern: "whistle-telegraphed-rubber-ball-single-bounce-close-target",
      telegraph: "고무공을 코기 쪽으로 다시 겨눈다",
    }] : blueprint.id === "world-03" ? [{
      id: "world-03-phase-1",
      healthThreshold: 1,
      pattern: "telegraphed-brick-throw-then-temporary-wall",
      telegraph: "고등어가 벽돌 조각이 떨어질 자리를 먼저 표시한다",
    }, {
      id: "world-03-phase-2",
      healthThreshold: 0.5,
      pattern: "overlapping-brick-flights-with-two-landed-walls",
      telegraph: "착지한 벽돌이 잠시 길을 막는 동안 다음 조각이 날아온다",
    }] : blueprint.id === "world-04" ? [{
      id: "world-04-phase-1",
      healthThreshold: 1,
      pattern: "telegraphed-scrap-fall-magnet-drag",
      telegraph: "턱시도가 고철의 낙하 위치를 표시한다",
    }, {
      id: "world-04-phase-2",
      healthThreshold: 0.5,
      pattern: "alternating-magnet-drag-direction",
      telegraph: "착지한 고철이 자석 방향 표시를 따라 한 번 더 움직인다",
    }] : blueprint.id === "world-05" ? [{
      id: "world-05-phase-1",
      healthThreshold: 1,
      pattern: "homing-mouse-salvos-and-independent-furball-rain",
      telegraph: "메인쿤이 생쥐 두 마리를 겨누고 털뭉치 낙하 지점이 표시된다",
    }, {
      id: "world-05-phase-2",
      healthThreshold: 0.5,
      pattern: "alternating-curved-straight-fast-mice-with-furball-rain",
      telegraph: "생쥐의 궤도가 바뀌어도 털뭉치는 계속 떨어진다",
    }] : [
      {
        id: blueprint.id + "-phase-1",
        healthThreshold: 1,
        pattern: "predictable-looking-three-hit-combo",
        telegraph: "반 박자 늦게 울리는 종소리",
      },
      {
        id: blueprint.id + "-phase-2",
        healthThreshold: 0.5,
        pattern: "arena-wide-gimmick",
        telegraph: "배경 장식이 아주 살짝 흔들림",
      },
    ],
    arenaStageId: stageIdFor(blueprint.id, "boss"),
    rewardSkill: blueprint.rewardSkill,
    cutsceneIds: [
      blueprint.id + "-boss-intro",
      blueprint.id + "-boss-clear",
    ],
  }));

export const WORLD_DEFINITIONS: readonly WorldDefinition[] =
  WORLD_BLUEPRINTS.map((blueprint, index) => ({
    id: blueprint.id,
    order: index + 1,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    stageIds: [
      ...([1, 2, 3, 4] as const).map((stageNumber) =>
        stageIdFor(blueprint.id, stageNumber),
      ),
      stageIdFor(blueprint.id, "boss"),
    ],
    bossId: blueprint.id + "-boss",
  }));

export const CUTSCENE_DEFINITIONS: readonly CutsceneDefinition[] =
  WORLD_IDS.flatMap((worldId) => [
    {
      id: worldId + "-world-intro",
      kind: "world-intro" as const,
      speakerIds: ["narrator"],
      durationMs: 4200,
    },
    {
      id: worldId + "-boss-intro",
      kind: "boss-intro" as const,
      speakerIds: [worldId + "-boss"],
      durationMs: 3200,
    },
    {
      id: worldId + "-boss-clear",
      kind: "boss-clear" as const,
      speakerIds: ["corgi"],
      durationMs: 3600,
    },
  ]);
