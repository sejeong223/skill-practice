import {
  BOSS_STAGE_CHECKPOINT_COUNT,
  BOSS_STAGE_IDS,
  NORMAL_STAGE_CHECKPOINT_COUNT,
  NORMAL_STAGE_NUMBERS,
  STAGE_IDS,
  WORLD_IDS,
} from "../core/constants";
import type { ContentRegistry } from "../core/contentTypes";
import type { SkillId, StageId } from "../core/types";

export class ContentRegistryError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super("Content registry validation failed:\n" + issues.join("\n"));
    this.name = "ContentRegistryError";
    this.issues = issues;
  }
}

const EXPECTED_SKILL_ORDER: readonly SkillId[] = [
  "bark",
  "bite",
  "dash",
  "double-jump",
  "tail-rotor",
];

export function validateContentRegistry(registry: ContentRegistry): void {
  const issues: string[] = [];
  const stageIds = new Set<string>();
  const bossIds = new Set<string>();
  const skillIds = new Set<string>();
  const toolIds = new Set<string>();

  if (registry.worlds.length !== WORLD_IDS.length) {
    issues.push("Exactly five world definitions are required.");
  }

  if (registry.worldMaps.length !== WORLD_IDS.length) {
    issues.push("Exactly five world map themes are required.");
  }

  if (registry.stages.length !== STAGE_IDS.length) {
    issues.push("Exactly twenty-five stage definitions are required.");
  }

  for (const expectedStageId of STAGE_IDS) {
    if (!registry.stages.some((stage) => stage.id === expectedStageId)) {
      issues.push("Missing stage definition: " + expectedStageId);
    }
  }

  for (const stage of registry.stages) {
    if (stageIds.has(stage.id)) {
      issues.push("Duplicate stage ID: " + stage.id);
    }
    stageIds.add(stage.id);

    const isBossStage = stage.id.endsWith("-boss");
    const expectedCheckpointCount = isBossStage
      ? BOSS_STAGE_CHECKPOINT_COUNT
      : NORMAL_STAGE_CHECKPOINT_COUNT;

    if (stage.kind === "boss" !== isBossStage) {
      issues.push("Stage kind does not match its ID: " + stage.id);
    }

    if (stage.checkpointIds.length !== expectedCheckpointCount) {
      issues.push(
        "Invalid checkpoint count for " +
          stage.id +
          ": expected " +
          expectedCheckpointCount,
      );
    }

    if (stage.segments.length === 0) {
      issues.push("Stage has no segments: " + stage.id);
    }

    if (!isBossStage && !NORMAL_STAGE_NUMBERS.some((number) =>
      stage.id.endsWith("-stage-" + number)
    )) {
      issues.push("Normal stage uses an invalid stage number: " + stage.id);
    }
  }

  for (const [index, worldId] of WORLD_IDS.entries()) {
    const world = registry.worlds.find((candidate) => candidate.id === worldId);

    if (!world) {
      issues.push("Missing world definition: " + worldId);
      continue;
    }

    const theme = registry.worldMaps.find(
      (candidate) => candidate.worldId === worldId,
    );

    if (!theme) {
      issues.push("Missing world map theme: " + worldId);
    }

    if (world.order !== index + 1) {
      issues.push("World order is invalid for " + worldId);
    }

    if (world.stageIds.length !== 5) {
      issues.push("World must reference four normal stages and one boss: " + worldId);
    }

    for (const stageId of world.stageIds) {
      const stage = registry.stages.find((candidate) => candidate.id === stageId);

      if (!stage) {
        issues.push("World references missing stage: " + stageId);
      } else if (stage.worldId !== worldId) {
        issues.push("Stage belongs to the wrong world: " + stageId);
      }
    }

    const boss = registry.bosses.find((candidate) => candidate.id === world.bossId);

    if (!boss) {
      issues.push("World references missing boss: " + world.bossId);
    } else {
      const arenaStage = registry.stages.find(
        (candidate) => candidate.id === boss.arenaStageId,
      );

      if (!arenaStage || arenaStage.kind !== "boss") {
        issues.push("Boss arena must reference a boss stage: " + boss.id);
      }
    }
  }

  for (const expectedBossStageId of BOSS_STAGE_IDS) {
    const stage = registry.stages.find((candidate) => candidate.id === expectedBossStageId);

    if (!stage || stage.kind !== "boss") {
      issues.push("Missing boss stage: " + expectedBossStageId);
    }
  }

  for (const boss of registry.bosses) {
    if (bossIds.has(boss.id)) {
      issues.push("Duplicate boss ID: " + boss.id);
    }
    bossIds.add(boss.id);

    if (boss.phases.length < 2) {
      issues.push("Boss must have at least two phases: " + boss.id);
    }
  }

  if (registry.skills.length !== EXPECTED_SKILL_ORDER.length) {
    issues.push("Exactly five skills are required in fixed unlock order.");
  }

  for (const [index, expectedSkillId] of EXPECTED_SKILL_ORDER.entries()) {
    const skill = registry.skills.find((candidate) => candidate.id === expectedSkillId);

    if (!skill) {
      issues.push("Missing skill definition: " + expectedSkillId);
      continue;
    }

    if (skillIds.has(skill.id)) {
      issues.push("Duplicate skill ID: " + skill.id);
    }
    skillIds.add(skill.id);

    const expectedBossId = WORLD_IDS[index] + "-boss";
    if (skill.unlockAfterBossId !== expectedBossId) {
      issues.push(
        "Skill unlock order is invalid for " +
          skill.id +
          ": expected " +
          expectedBossId,
      );
    }

    if (!Number.isInteger(skill.cooldownMs) || skill.cooldownMs < 0) {
      issues.push("Skill cooldown must be a non-negative integer: " + skill.id);
    }
  }

  for (const boss of registry.bosses) {
    const rewardSkill = registry.skills.find(
      (candidate) => candidate.id === boss.rewardSkill,
    );

    if (!rewardSkill || rewardSkill.unlockAfterBossId !== boss.id) {
      issues.push("Boss reward does not match its unlock skill: " + boss.id);
    }
  }

  for (const tool of registry.tools) {
    if (toolIds.has(tool.id)) {
      issues.push("Duplicate tool ID: " + tool.id);
    }
    toolIds.add(tool.id);

    if (!Number.isInteger(tool.price) || tool.price < 0) {
      issues.push("Tool price must be a non-negative integer: " + tool.id);
    }

    if (
      tool.charges !== null &&
      (!Number.isInteger(tool.charges) || tool.charges <= 0)
    ) {
      issues.push("Tool charges must be null or a positive integer: " + tool.id);
    }

    if (!tool.hiddenDrawbackId) {
      issues.push("Every tool needs a hidden drawback: " + tool.id);
    }
  }

  if (issues.length > 0) {
    throw new ContentRegistryError(issues);
  }
}

export function isStageId(value: string): value is StageId {
  return STAGE_IDS.includes(value as StageId);
}
