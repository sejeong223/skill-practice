import {
  stageIdFor,
  WORLD_IDS,
} from "../core/constants";
import type {
  BossDefinition,
  CutsceneDefinition,
  StageSegment,
  WorldDefinition,
} from "../core/contentTypes";
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
    title: "생일 집 앞",
    subtitle: "왕갈비뼈를 훔쳐 간 냥아치 연합의 첫 흔적",
    stageTitles: [
      "무법지대 뒷골목",
      "빨래방 지붕길",
      "도둑고양이 지름길",
      "담벼락 위의 추격전",
    ],
    bossTitle: "냥아치 연합 초소",
    bossName: "턱시도",
    rewardSkill: "bark",
  },
  {
    id: "world-02",
    title: "뒤틀린 놀이공원",
    subtitle: "웃음소리와 함정이 동시에 튀어나오는 구역",
    stageTitles: [
      "회전목마 광장",
      "범퍼카 골목",
      "풍선 관람차",
      "놀이공원 지하통로",
    ],
    bossTitle: "놀이공원 관리실",
    bossName: "고등어",
    rewardSkill: "bite",
  },
  {
    id: "world-03",
    title: "육즙 공장",
    subtitle: "왕갈비뼈 냄새가 사방에서 코를 괴롭히는 곳",
    stageTitles: [
      "육즙 공장 입구",
      "고기 컨베이어 구역",
      "압력솥 통로",
      "왕갈비뼈 포장 라인",
    ],
    bossTitle: "품질관리실",
    bossName: "공장장",
    rewardSkill: "dash",
  },
  {
    id: "world-04",
    title: "폭풍 고가도로",
    subtitle: "꼬리 모터가 아니면 바람에 날아가는 구역",
    stageTitles: [
      "먹구름 고가도로",
      "젖은 옥상 주차장",
      "번개 피뢰침 구역",
      "바람개비 송전탑",
    ],
    bossTitle: "폭풍 관제탑",
    bossName: "번개",
    rewardSkill: "double-jump",
  },
  {
    id: "world-05",
    title: "냥아치 연합 본부",
    subtitle: "모든 고양이 패거리의 우두머리가 기다리는 곳",
    stageTitles: [
      "냥아치 연합 외곽",
      "버려진 고물상",
      "고양이 왕국 수문",
      "왕좌 복도",
    ],
    bossTitle: "우두머리의 옥좌",
    bossName: "우두머리",
    rewardSkill: "tail-rotor",
  },
];

function createSegment(
  stageId: StageId,
  segmentNumber: number,
  isBoss: boolean,
): StageSegment {
  const segmentId = stageId + "-segment-" + segmentNumber;

  return {
    id: segmentId,
    length: isBoss ? 640 : 960,
    platforms: [
      {
        id: segmentId + "-platform",
        x: 96,
        y: 520,
        width: isBoss ? 448 : 768,
        height: 32,
      },
    ],
    traps: isBoss
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
    enemies: isBoss
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
    coins: [
      segmentId + "-coin-1",
      segmentId + "-coin-2",
      segmentId + "-coin-3",
    ],
    collectibles: [segmentId + "-collectible"],
    decorations: [segmentId + "-background-prop"],
  };
}

function createNormalStage(
  blueprint: WorldBlueprint,
  stageNumber: 1 | 2 | 3 | 4,
): StageDefinition {
  const id = stageIdFor(blueprint.id, stageNumber);

  return {
    id,
    worldId: blueprint.id,
    title: blueprint.stageTitles[stageNumber - 1],
    subtitle: blueprint.subtitle,
    kind: "normal",
    spawn: { x: 96, y: 440 },
    checkpointIds: [id + "-checkpoint"],
    mapWidth: 2880,
    mapHeight: 720,
    segments: [1, 2, 3].map((segmentNumber) =>
      createSegment(id, segmentNumber, false),
    ),
    collectibleIds: [id + "-memory"],
    cutsceneIds: [blueprint.id + "-world-intro"],
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
    mapWidth: 1280,
    mapHeight: 720,
    segments: [1].map((segmentNumber) =>
      createSegment(id, segmentNumber, true),
    ),
    collectibleIds: [],
    cutsceneIds: [
      blueprint.id + "-boss-intro",
      blueprint.id + "-boss-clear",
    ],
    bossId: blueprint.id + "-boss",
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
    phases: [
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
