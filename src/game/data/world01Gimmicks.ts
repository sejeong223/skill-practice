import { stageIdFor } from "../core/constants";
import type {
  GimmickCounterplay,
  GimmickKind,
  GimmickOutcome,
  GimmickTrigger,
  WorldGimmickDefinition,
} from "../core/contentTypes";
import type { StageId } from "../core/types";

type World01StageNumber = 1 | 2 | 3 | 4;
type GauntletSection = 2 | 3 | 4;

export const WORLD01_GIMMICK_MAX_GAP_MS = 8000;

export function getWorld01FloorY(
  stageNumber: World01StageNumber,
  x: number,
): number {
  if (stageNumber !== 2 && stageNumber !== 4) {
    return 512;
  }

  const ascentStart = 1344;
  const ascentSteps = Math.min(
    18,
    Math.floor(Math.max(0, x - ascentStart) / 64),
  );
  return 512 - ascentSteps * 16;
}

const instantTrap: GimmickOutcome = {
  kind: "instant-death",
  deathCause: "trap",
};

const jumpBeforeZone: GimmickCounterplay = {
  action: "jump-before-zone",
  notes: "위험 구간에 들어가기 전에 점프해 통과한다.",
};

const precisionMovement: GimmickCounterplay = {
  action: "precision-movement",
  notes: "갑작스러운 변화에 맞춰 짧게 이동해 피한다.",
};

function makeGimmick(
  stageNumber: World01StageNumber,
  sectionIndex: GauntletSection,
  serial: number,
  kind: GimmickKind,
  trigger: GimmickTrigger,
  x: number,
  visualKey: string,
  counterplay: GimmickCounterplay,
  outcome: GimmickOutcome,
  variantKey?: string,
): WorldGimmickDefinition {
  const stageId = stageIdFor("world-01", stageNumber);
  const id = "world01-gimmick-" + serial;

  return {
    id,
    worldId: "world-01",
    stageId,
    sectionIndex,
    objectId: id + "-object",
    kind,
    trigger,
    x,
    y: getWorld01FloorY(stageNumber, x) - 96,
    width: 64,
    height: 96,
    visualKey,
    ...(variantKey ? { variantKey } : {}),
    hintPolicy: "none",
    lethal: true,
    counterplay,
    outcome,
    seedGroup: "world01-stage-" + stageNumber + "-" + kind,
    chainIds: [id + "-chain"],
  };
}

const coreLayout: readonly {
  sectionIndex: GauntletSection;
  kind: GimmickKind;
  trigger: GimmickTrigger;
  x: number;
  visualKey: string;
  counterplay: GimmickCounterplay;
}[] = [
  {
    sectionIndex: 2,
    kind: "ground-collapse",
    trigger: "walk-enter",
    x: 360,
    visualKey: "ground",
    counterplay: jumpBeforeZone,
  },
  {
    sectionIndex: 2,
    kind: "revealed-white-spike",
    trigger: "walk-enter",
    x: 720,
    visualKey: "white-spike",
    counterplay: precisionMovement,
  },
  {
    sectionIndex: 3,
    kind: "ground-rise",
    trigger: "timed-after-enter",
    x: 1500,
    visualKey: "ground",
    counterplay: {
      action: "micro-forward-then-back",
      notes: "짧게 전진해 솟는 순간을 유도한 뒤 즉시 뒤로 물러난다.",
    },
  },
  {
    sectionIndex: 3,
    kind: "jump-pigeon",
    trigger: "jump-in-zone",
    x: 1880,
    visualKey: "pigeon",
    counterplay: precisionMovement,
  },
  {
    sectionIndex: 3,
    kind: "ground-collapse",
    trigger: "walk-enter",
    x: 2180,
    visualKey: "ground",
    counterplay: jumpBeforeZone,
  },
  {
    sectionIndex: 4,
    kind: "revealed-white-spike",
    trigger: "walk-enter",
    x: 2740,
    visualKey: "white-spike",
    counterplay: precisionMovement,
  },
  {
    sectionIndex: 4,
    kind: "ground-rise",
    trigger: "timed-after-enter",
    x: 3100,
    visualKey: "ground",
    counterplay: {
      action: "micro-forward-then-back",
      notes: "짧게 전진해 솟는 순간을 유도한 뒤 즉시 뒤로 물러난다.",
    },
  },
  {
    sectionIndex: 4,
    kind: "jump-pigeon",
    trigger: "jump-in-zone",
    x: 3440,
    visualKey: "pigeon",
    counterplay: precisionMovement,
  },
];

const coreXOverrides: Readonly<
  Partial<Record<World01StageNumber, Readonly<Partial<Record<number, number>>>>>
> = {
  4: {
    5: 2650,
    7: 3560,
  },
};

const coreGimmicks = ([1, 2, 3, 4] as const).flatMap((stageNumber) =>
  coreLayout.map((entry, index) =>
    makeGimmick(
      stageNumber,
      entry.sectionIndex,
      (stageNumber - 1) * coreLayout.length + index + 1,
      entry.kind,
      entry.trigger,
      coreXOverrides[stageNumber]?.[index] ?? entry.x,
      entry.visualKey,
      entry.counterplay,
      instantTrap,
    ),
  ),
);

const specialGimmicks: readonly WorldGimmickDefinition[] = [
  makeGimmick(1, 2, 33, "ant-trip", "walk-enter", 260, "ant", {
    action: "move-backward",
    notes: "앞으로 걷지 말고 뒤로 이동해 개미를 통과한다.",
  }, instantTrap),
  makeGimmick(1, 2, 34, "forward-jump-wall", "forward-jump", 520, "invisible-wall", {
    action: "move-backward",
    notes: "앞으로 점프하지 않고 뒤로 이동해 허공의 벽 생성을 피한다.",
  }, instantTrap),
  makeGimmick(1, 3, 35, "fake-bone-green", "collect", 1640, "bone-coin", {
    action: "do-not-collect",
    notes: "뼈다귀 간식을 먹지 않는다.",
  }, instantTrap, "green-body"),
  makeGimmick(1, 4, 36, "fake-checkpoint", "checkpoint-touch", 2580, "fake-checkpoint", {
    action: "move-backward",
    notes: "깃발에 닿지 않고 지나간다.",
  }, instantTrap),
  makeGimmick(1, 4, 37, "box-cat-arm", "jump-over", 2860, "cat-box", {
    action: "jump-then-back",
    notes: "상자를 넘은 직후 뒤로 이동해 튀어나온 앞발을 피한다.",
  }, instantTrap),
  makeGimmick(2, 2, 38, "cloud-rain", "jump-over", 920, "cloud", {
    action: "precision-movement",
    notes: "구름 위를 지나며 즉시 뒤로 이동해 폭우 지점을 벗어난다.",
  }, instantTrap),
  makeGimmick(2, 3, 39, "forward-jump-wall", "forward-jump", 1560, "invisible-wall", {
    action: "move-backward",
    notes: "앞으로 점프하지 않고 뒤로 이동해 허공의 벽 생성을 피한다.",
  }, instantTrap),
  makeGimmick(2, 4, 40, "fake-bone-reverse", "collect", 2820, "bone-coin", {
    action: "do-not-collect",
    notes: "뒤로 밀려나는 가짜 뼈다귀를 먹지 않는다.",
  }, { ...instantTrap, kind: "forced-control-death", deathCause: "scripted", controlOverride: "drift-backward", durationMs: 1800 }, "reverse-control"),
  makeGimmick(2, 4, 41, "name-bubble-control-loss", "dialogue-enter", 3260, "name-bubble", {
    action: "mash-jump",
    requiredPresses: 100,
    windowMs: 2200,
    notes: "말풍선을 향해 달려가는 동안 점프를 100번 연타한다.",
  }, { kind: "forced-control-death", deathCause: "scripted", controlOverride: "run-left", durationMs: 2600 }),
  makeGimmick(3, 2, 42, "fake-bone-fire", "collect", 680, "bone-coin", {
    action: "do-not-collect",
    notes: "엉덩이에 불이 붙는 가짜 뼈다귀를 먹지 않는다.",
  }, { ...instantTrap, kind: "launch-death", deathCause: "scripted", controlOverride: "launch-up", durationMs: 1700 }, "fire-launch"),
  makeGimmick(3, 3, 43, "box-cat-arm", "jump-over", 1700, "cat-box", {
    action: "jump-then-back",
    notes: "상자를 넘은 직후 뒤로 이동해 튀어나온 앞발을 피한다.",
  }, instantTrap),
  makeGimmick(3, 4, 44, "fake-checkpoint", "checkpoint-touch", 2660, "fake-checkpoint", {
    action: "move-backward",
    notes: "깃발에 닿지 않고 지나간다.",
  }, instantTrap),
  makeGimmick(3, 4, 45, "cloud-rain", "jump-over", 3020, "cloud", {
    action: "precision-movement",
    notes: "구름 위를 지나며 즉시 뒤로 이동해 폭우 지점을 벗어난다.",
  }, instantTrap),
  makeGimmick(4, 2, 46, "ant-trip", "walk-enter", 340, "ant", {
    action: "move-backward",
    notes: "앞으로 걷지 말고 뒤로 이동해 개미를 통과한다.",
  }, instantTrap),
  makeGimmick(4, 2, 47, "forward-jump-wall", "forward-jump", 640, "invisible-wall", {
    action: "move-backward",
    notes: "앞으로 점프하지 않고 뒤로 이동해 허공의 벽 생성을 피한다.",
  }, instantTrap),
  makeGimmick(4, 3, 48, "fake-bone-green", "collect", 1540, "bone-coin", {
    action: "do-not-collect",
    notes: "몸이 초록색으로 변하는 가짜 뼈다귀를 먹지 않는다.",
  }, instantTrap, "green-body"),
  makeGimmick(4, 3, 49, "fake-checkpoint", "checkpoint-touch", 2180, "fake-checkpoint", {
    action: "move-backward",
    notes: "깃발에 닿지 않고 지나간다.",
  }, instantTrap),
  makeGimmick(4, 4, 50, "box-cat-arm", "jump-over", 2720, "cat-box", {
    action: "jump-then-back",
    notes: "상자를 넘은 직후 뒤로 이동해 튀어나온 앞발을 피한다.",
  }, instantTrap),
  makeGimmick(4, 4, 51, "cloud-rain", "jump-over", 2920, "cloud", {
    action: "precision-movement",
    notes: "구름 위를 지나며 즉시 뒤로 이동해 폭우 지점을 벗어난다.",
  }, instantTrap),
  makeGimmick(4, 4, 52, "name-bubble-control-loss", "dialogue-enter", 3160, "name-bubble", {
    action: "mash-jump",
    requiredPresses: 100,
    windowMs: 2200,
    notes: "말풍선을 향해 달려가는 동안 점프를 100번 연타한다.",
  }, { kind: "forced-control-death", deathCause: "scripted", controlOverride: "run-left", durationMs: 2600 }),
  makeGimmick(4, 4, 53, "fake-bone-reverse", "collect", 3300, "bone-coin", {
    action: "do-not-collect",
    notes: "뒤로 밀려나는 가짜 뼈다귀를 먹지 않는다.",
  }, { ...instantTrap, kind: "forced-control-death", deathCause: "scripted", controlOverride: "drift-backward", durationMs: 1800 }, "reverse-control"),
  makeGimmick(4, 4, 54, "fake-bone-fire", "collect", 3390, "bone-coin", {
    action: "do-not-collect",
    notes: "엉덩이에 불이 붙는 가짜 뼈다귀를 먹지 않는다.",
  }, { ...instantTrap, kind: "launch-death", deathCause: "scripted", controlOverride: "launch-up", durationMs: 1700 }, "fire-launch"),
];

const recurringPositions: Readonly<
  Record<World01StageNumber, { collapse: number; rise: number; spike: number }>
> = {
  1: { collapse: 1040, rise: 2330, spike: 3300 },
  2: { collapse: 1100, rise: 2320, spike: 3000 },
  3: { collapse: 1040, rise: 2310, spike: 3180 },
  4: { collapse: 1060, rise: 3470, spike: 3000 },
};

const recurringGimmicks = ([1, 2, 3, 4] as const).flatMap((stageNumber) => {
  const positions = recurringPositions[stageNumber];
  const entries = [
    {
      sectionIndex: 2 as const,
      kind: "ground-collapse" as const,
      trigger: "walk-enter" as const,
      x: positions.collapse,
      visualKey: "ground",
      counterplay: jumpBeforeZone,
    },
    {
      sectionIndex: stageNumber === 4 ? 4 as const : 3 as const,
      kind: "ground-rise" as const,
      trigger: "timed-after-enter" as const,
      x: positions.rise,
      visualKey: "ground",
      counterplay: {
        action: "micro-forward-then-back" as const,
        notes: "짧게 전진해 솟는 순간을 유도한 뒤 즉시 뒤로 물러난다.",
      },
    },
    {
      sectionIndex: 4 as const,
      kind: "revealed-white-spike" as const,
      trigger: "walk-enter" as const,
      x: positions.spike,
      visualKey: "white-spike",
      counterplay: precisionMovement,
    },
  ];

  return entries.map((entry, index) =>
    makeGimmick(
      stageNumber,
      entry.sectionIndex,
      55 + (stageNumber - 1) * entries.length + index,
      entry.kind,
      entry.trigger,
      entry.x,
      entry.visualKey,
      entry.counterplay,
      instantTrap,
    ),
  );
});

export const WORLD01_GIMMICKS: readonly WorldGimmickDefinition[] = [
  ...coreGimmicks,
  ...specialGimmicks,
  ...recurringGimmicks,
];

export const WORLD01_GIMMICK_COUNT = WORLD01_GIMMICKS.length;

export const WORLD01_GIMMICK_MINIMUMS: Readonly<
  Partial<Record<GimmickKind, number>>
> = {
  "ground-collapse": 12,
  "ground-rise": 12,
  "revealed-white-spike": 12,
  "jump-pigeon": 8,
  "fake-bone-green": 2,
  "fake-bone-reverse": 2,
  "fake-bone-fire": 2,
  "fake-checkpoint": 3,
  "box-cat-arm": 3,
  "cloud-rain": 3,
  "ant-trip": 2,
  "forward-jump-wall": 3,
  "name-bubble-control-loss": 2,
};

export function getWorld01GimmicksForStage(
  stageId: StageId,
): readonly WorldGimmickDefinition[] {
  return WORLD01_GIMMICKS.filter((gimmick) => gimmick.stageId === stageId);
}
