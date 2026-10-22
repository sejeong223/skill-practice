import type { SkillId, ToolId, WorldId } from "../core/types";

export interface BossCombatConfig {
  readonly worldId: WorldId;
  readonly maxHealth: number;
  readonly attackIntervalMs: number;
  readonly telegraphMs: number;
  readonly bossName: string;
  readonly rewardSkill: SkillId;
}

export const BOSS_COMBAT_CONFIG: Readonly<Record<Exclude<WorldId, "world-01">, BossCombatConfig>> = {
  "world-02": { worldId: "world-02", maxHealth: 15, attackIntervalMs: 3000, telegraphMs: 600, bossName: "치즈 태비", rewardSkill: "bite" },
  "world-03": { worldId: "world-03", maxHealth: 20, attackIntervalMs: 2600, telegraphMs: 600, bossName: "고등어", rewardSkill: "dash" },
  "world-04": { worldId: "world-04", maxHealth: 25, attackIntervalMs: 2200, telegraphMs: 600, bossName: "턱시도", rewardSkill: "double-jump" },
  "world-05": { worldId: "world-05", maxHealth: 40, attackIntervalMs: 1500, telegraphMs: 450, bossName: "메인쿤", rewardSkill: "tail-rotor" },
};

export function getBossDamage(toolId: ToolId): 1 | 2 | 3 {
  switch (toolId) {
    case "rolled-newspaper":
    case "pink-backscratcher":
    case "cardboard-tube":
      return 2;
    case "drumstick-boomerang":
    case "plastic-frisbee":
      return 3;
    default:
      return 1;
  }
}
