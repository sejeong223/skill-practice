import { stageIdFor } from "../core/constants";
import type { GimmickKind, GimmickOutcome, WorldGimmickDefinition } from "../core/contentTypes";
import type { StageId } from "../core/types";

type Stage = 1 | 2 | 3 | 4;
type StaticKind = "ant-static" | "white-spike-static" | "pigeon-static" | "box-static";
type DangerKind = StaticKind | "open-manhole";
type CoinKind = "fake-bone-green" | "fake-bone-reverse" | "fake-bone-fire";

export const WORLD01_STATIC_KINDS: readonly StaticKind[] = ["ant-static", "white-spike-static", "pigeon-static", "box-static"];
const dangers: Readonly<Record<Stage, readonly [DangerKind, number][]>> = {
  1: [["ant-static", 336], ["white-spike-static", 944], ["box-static", 1552], ["pigeon-static", 2160]],
  2: [["ant-static", 320], ["open-manhole", 800], ["pigeon-static", 1280], ["white-spike-static", 1760], ["box-static", 2240]],
  3: [["ant-static", 352], ["box-static", 960], ["white-spike-static", 1568], ["pigeon-static", 2176]],
  4: [["pigeon-static", 288], ["open-manhole", 736], ["box-static", 1184], ["white-spike-static", 1664], ["ant-static", 2112]],
};
const coins: Readonly<Record<Stage, readonly [CoinKind, number][]>> = {
  1: [["fake-bone-green", 1360]],
  2: [["fake-bone-reverse", 600], ["fake-bone-green", 2016]],
  3: [["fake-bone-fire", 1344]],
  4: [["fake-bone-reverse", 1056], ["fake-bone-fire", 1952]],
};
const visuals: Readonly<Record<DangerKind, { width: number; height: number; key: string }>> = {
  "ant-static": { width: 32, height: 20, key: "ant" },
  "white-spike-static": { width: 38, height: 28, key: "white-spike" },
  "pigeon-static": { width: 48, height: 32, key: "world-01-pigeon-static" },
  "box-static": { width: 44, height: 36, key: "cat-box" },
  "open-manhole": { width: 80, height: 16, key: "world-01-manhole-open" },
};

export function getWorld01FloorY(stage: Stage, x: number): number {
  if (stage === 2) {
    if (x < 1024) return 512;
    if (x < 1280) return 496;
    if (x < 1792) return 480;
    if (x < 2048) return 496;
  }
  if (stage === 4) {
    if (x < 896) return 512;
    if (x < 1152) return 496;
    if (x < 1664) return 480;
    if (x < 1920) return 496;
  }
  return 512;
}

export function getWorld01OpenManholes(stage: Stage): readonly { x: number; width: 80 }[] {
  return dangers[stage].filter(([kind]) => kind === "open-manhole").map(([, x]) => ({ x, width: 80 as const }));
}

function section(x: number): 2 | 3 | 4 {
  return x < 912 ? 2 : x < 1648 ? 3 : 4;
}

function makeDanger(stage: Stage, kind: DangerKind, x: number): WorldGimmickDefinition {
  const { width, height, key } = visuals[kind];
  const id = `world01-stage-${stage}-${kind}-${x}`;
  return {
    id, worldId: "world-01", stageId: stageIdFor("world-01", stage),
    sectionIndex: section(x + width / 2), objectId: `${id}-object`,
    kind, trigger: "walk-enter", x, y: getWorld01FloorY(stage, x) - height,
    width, height, visualKey: key, hintPolicy: "none", lethal: true,
    counterplay: { action: "jump-before-zone", notes: "보이는 장애물 앞에서 점프한다." },
    outcome: { kind: "instant-death", deathCause: "trap" },
    seedGroup: id, chainIds: [`${id}-chain`],
  };
}

function outcome(kind: CoinKind): GimmickOutcome {
  if (kind === "fake-bone-reverse") return {
    kind: "forced-control-death", deathCause: "scripted", controlOverride: "drift-backward", durationMs: 1800,
  };
  if (kind === "fake-bone-fire") return {
    kind: "launch-death", deathCause: "scripted", controlOverride: "launch-up", durationMs: 1700,
  };
  return { kind: "instant-death", deathCause: "trap" };
}

function makeCoin(stage: Stage, kind: CoinKind, x: number): WorldGimmickDefinition {
  const id = `world01-stage-${stage}-${kind}-${x}`;
  return {
    id, worldId: "world-01", stageId: stageIdFor("world-01", stage),
    sectionIndex: section(x + 17), objectId: `${id}-object`,
    kind, trigger: "collect", x, y: getWorld01FloorY(stage, x) - 122,
    width: 34, height: 26, visualKey: "bone-coin",
    variantKey: kind === "fake-bone-green" ? "green-body" : kind === "fake-bone-reverse" ? "reverse-control" : "fire-launch",
    hintPolicy: "none", lethal: true,
    counterplay: { action: "do-not-collect", notes: "색이 다른 가짜 간식 코인을 피한다." },
    outcome: outcome(kind), seedGroup: id, chainIds: [`${id}-chain`],
  };
}

export const WORLD01_GIMMICKS: readonly WorldGimmickDefinition[] = ([1, 2, 3, 4] as const)
  .flatMap((stage) => [
    ...dangers[stage].map(([kind, x]) => makeDanger(stage, kind, x)),
    ...coins[stage].map(([kind, x]) => makeCoin(stage, kind, x)),
  ]);
export const WORLD01_GIMMICK_COUNT = WORLD01_GIMMICKS.length;
export const WORLD01_GIMMICK_MINIMUMS: Readonly<Partial<Record<GimmickKind, number>>> = {
  "ant-static": 4, "white-spike-static": 4, "pigeon-static": 4, "box-static": 4,
  "open-manhole": 2, "fake-bone-green": 2, "fake-bone-reverse": 2, "fake-bone-fire": 2,
};
export function getWorld01GimmicksForStage(stageId: StageId): readonly WorldGimmickDefinition[] {
  return WORLD01_GIMMICKS.filter((gimmick) => gimmick.stageId === stageId);
}
