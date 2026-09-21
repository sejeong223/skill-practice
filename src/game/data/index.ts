import type {
  ContentRegistry,
  WorldDefinition,
} from "../core/contentTypes";
import type {
  SkillDefinition,
  StageDefinition,
  ToolDefinition,
} from "../core/types";
import { BOSS_DEFINITIONS, CUTSCENE_DEFINITIONS, STAGE_DEFINITIONS, WORLD_DEFINITIONS } from "./worlds";
import { SKILL_DEFINITIONS } from "./skills";
import { TOOL_DEFINITIONS } from "./tools";
import {
  ContentRegistryError,
  validateContentRegistry,
} from "./validateContent";

export const CONTENT_REGISTRY: ContentRegistry = {
  worlds: WORLD_DEFINITIONS,
  stages: STAGE_DEFINITIONS,
  bosses: BOSS_DEFINITIONS,
  skills: SKILL_DEFINITIONS,
  tools: TOOL_DEFINITIONS,
  cutscenes: CUTSCENE_DEFINITIONS,
};

validateContentRegistry(CONTENT_REGISTRY);

const worldById = new Map<string, WorldDefinition>(
  CONTENT_REGISTRY.worlds.map((world) => [world.id, world]),
);
const stageById = new Map<string, StageDefinition>(
  CONTENT_REGISTRY.stages.map((stage) => [stage.id, stage]),
);
const skillById = new Map<string, SkillDefinition>(
  CONTENT_REGISTRY.skills.map((skill) => [skill.id, skill]),
);
const toolById = new Map<string, ToolDefinition>(
  CONTENT_REGISTRY.tools.map((tool) => [tool.id, tool]),
);

function missingContentError(kind: string, id: string): ContentRegistryError {
  return new ContentRegistryError(["Unknown " + kind + " ID: " + id]);
}

export function getWorldDefinition(worldId: string): WorldDefinition {
  const world = worldById.get(worldId);

  if (!world) {
    throw missingContentError("world", worldId);
  }

  return world;
}

export function getStageDefinition(stageId: string): StageDefinition {
  const stage = stageById.get(stageId);

  if (!stage) {
    throw missingContentError("stage", stageId);
  }

  return stage;
}

export function getSkillDefinition(skillId: string): SkillDefinition {
  const skill = skillById.get(skillId);

  if (!skill) {
    throw missingContentError("skill", skillId);
  }

  return skill;
}

export function getToolDefinition(toolId: string): ToolDefinition {
  const tool = toolById.get(toolId);

  if (!tool) {
    throw missingContentError("tool", toolId);
  }

  return tool;
}

export {
  BOSS_DEFINITIONS,
  CUTSCENE_DEFINITIONS,
  SKILL_DEFINITIONS,
  STAGE_DEFINITIONS,
  TOOL_DEFINITIONS,
  WORLD_DEFINITIONS,
  ContentRegistryError,
  validateContentRegistry,
};
