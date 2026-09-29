import type {
  ContentRegistry,
  GimmickCounterplay,
  GimmickKind,
  MapObjectDefinition,
  MapSectionDefinition,
  StageMapDefinition,
  WorldMapThemeDefinition,
} from "../core/contentTypes";
import { STAGE_IDS } from "../core/constants";
import type { StageDefinition, StageId } from "../core/types";
import {
  WORLD01_GIMMICK_MINIMUMS,
  WORLD01_STATIC_KINDS,
} from "./world01Gimmicks";

export interface MapValidationReport {
  readonly stageId: StageId;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface CampaignMapValidationReport {
  readonly reports: readonly MapValidationReport[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly valid: boolean;
}

export function validateStageMap(
  stage: StageDefinition,
  theme: WorldMapThemeDefinition,
  map: StageMapDefinition,
): MapValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const objects = map.objectDefinitions;
  const objectById = new Map<string, MapObjectDefinition>();
  const ruleIds = new Set(map.chainRules.map((rule) => rule.id));
  const layerIds = new Set(map.layers.map((layer) => layer.layerId));

  if (map.mapWidth !== stage.mapWidth || map.mapHeight !== stage.mapHeight) {
    errors.push("맵 크기와 스테이지 크기가 일치하지 않습니다.");
  }

  if (
    map.tileWidth <= 0 ||
    map.tileHeight <= 0 ||
    map.mapWidth % map.tileWidth !== 0 ||
    map.mapHeight % map.tileHeight !== 0
  ) {
    errors.push("맵 크기는 타일 크기로 정확히 나누어져야 합니다.");
  }

  for (const object of objects) {
    if (objectById.has(object.id)) {
      errors.push("중복된 맵 오브젝트 ID: " + object.id);
    }
    objectById.set(object.id, object);

    if (!layerIds.has(object.layerId)) {
      errors.push("존재하지 않는 레이어를 참조한 오브젝트: " + object.id);
    }
  }

  const sections = [...map.sections].sort((a, b) => a.index - b.index);
  if (stage.kind === "normal") {
    validateNormalSections(stage, sections, objects, errors);
  } else if (sections.length > 0) {
    errors.push("보스 맵에는 일반 스테이지 구간을 등록할 수 없습니다.");
  }

  const gameplayLayer = map.layers.find((layer) => layer.kind === "gameplay");
  if (!gameplayLayer) {
    errors.push("게임플레이 레이어가 없습니다.");
  }

  const checkpoints = objects.filter((object) => object.kind === "checkpoint");
  const exits = objects.filter((object) => object.kind === "exit");

  if (stage.kind === "normal") {
    if (checkpoints.length !== stage.checkpointIds.length) {
      errors.push("checkpoint 오브젝트 수가 스테이지 정의와 일치하지 않습니다.");
    }

    const checkpointId = stage.checkpointIds[0];
    const checkpoint = checkpoints.find((object) => object.id === checkpointId);
    const checkpointSection = sections.find(
      (section) => section.index === stage.checkpointSectionIndex,
    );

    if (checkpointId && !checkpoint) {
      errors.push("스테이지 checkpoint ID가 맵 오브젝트와 일치하지 않습니다.");
    } else if (checkpoint &&
      checkpointSection &&
      !isObjectInsideSection(checkpoint, checkpointSection)
    ) {
      errors.push("checkpoint가 지정된 구간에 배치되지 않았습니다.");
    }
    if (checkpointId && !checkpointSection) {
      errors.push("checkpoint 구간이 지정되지 않았습니다.");
    }
    if (!checkpointId && stage.checkpointSectionIndex !== undefined) {
      errors.push("체크포인트가 없는 스테이지에 checkpointSectionIndex가 있습니다.");
    }
  } else if (checkpoints.length > 0) {
    errors.push("보스 맵에는 checkpoint를 배치할 수 없습니다.");
  }

  if (exits.length !== 1) {
    errors.push("맵은 출구를 정확히 하나 가져야 합니다.");
  } else if (stage.kind === "normal") {
    const exitSection = sections.find((section) => section.role === "safe-exit");
    if (!exitSection || !isObjectInsideSection(exits[0], exitSection)) {
      errors.push("출구가 safe-exit 구간 안에 없습니다.");
    }
  }

  validateChainReferences(objects, map, objectById, ruleIds, theme, errors);
  validateGimmicks(stage, map, objectById, sections, errors);
  validateSafeSections(sections, objects, map, objectById, errors);

  if (theme.tilesetKey.length === 0 || map.layers.some((layer) => !layer.assetKey)) {
    warnings.push("테마 또는 레이어의 asset key가 비어 있습니다.");
  }

  const foreground = map.layers.find((layer) => layer.kind === "foreground");
  if (foreground && gameplayLayer && foreground.depth >= gameplayLayer.depth) {
    warnings.push("전경 레이어가 게임플레이 오브젝트를 가릴 수 있습니다.");
  }

  for (const collectible of objects.filter((object) => object.kind === "collectible")) {
    if (
      collectible.x < 0 ||
      collectible.y < 0 ||
      collectible.x > map.mapWidth ||
      collectible.y > map.mapHeight
    ) {
      warnings.push("맵 밖에 있어 도달할 수 없는 수집품: " + collectible.id);
    }
  }

  return { stageId: stage.id, errors, warnings };
}

export function validateCampaignMaps(
  registry: Pick<ContentRegistry, "stages" | "worldMaps">,
): CampaignMapValidationReport {
  const themeByWorld = new Map(
    registry.worldMaps.map((theme) => [theme.worldId, theme]),
  );
  const reports = STAGE_IDS.map((stageId) => {
    const stage = registry.stages.find((candidate) => candidate.id === stageId);
    if (!stage) {
      return {
        stageId,
        errors: ["스테이지 정의가 없습니다."],
        warnings: [],
      } satisfies MapValidationReport;
    }

    const theme = themeByWorld.get(stage.worldId);
    if (!theme) {
      return {
        stageId: stage.id,
        errors: ["월드 테마가 없습니다: " + stage.worldId],
        warnings: [],
      } satisfies MapValidationReport;
    }

    if (!stage.map) {
      return {
        stageId: stage.id,
        errors: ["스테이지 맵 메타데이터가 없습니다."],
        warnings: [],
      } satisfies MapValidationReport;
    }

    return validateStageMap(stage, theme, stage.map);
  });

  const errors = reports.flatMap((report) =>
    report.errors.map((error) => report.stageId + ": " + error),
  );
  const warnings = reports.flatMap((report) =>
    report.warnings.map((warning) => report.stageId + ": " + warning),
  );

  const world01Stages = registry.stages.filter(
    (stage) => stage.worldId === "world-01" && stage.kind === "normal",
  );
  const world01Gimmicks = world01Stages.flatMap(
    (stage) => stage.map?.gimmicks ?? [],
  );
  const world01Checkpoints = world01Stages.flatMap((stage) =>
    stage.map?.objectDefinitions.filter((object) => object.kind === "checkpoint") ?? [],
  );
  if (world01Checkpoints.length !== 2) {
    errors.push("world-01: 진짜 체크포인트는 정확히 2개여야 합니다.");
  }
  if (world01Gimmicks.length !== 24) {
    errors.push("world-01: 기믹 카탈로그는 정확히 24개여야 합니다.");
  }

  const counts = new Map<GimmickKind, number>();
  for (const gimmick of world01Gimmicks) {
    counts.set(gimmick.kind, (counts.get(gimmick.kind) ?? 0) + 1);
  }
  for (const [kind, minimum] of Object.entries(WORLD01_GIMMICK_MINIMUMS) as [GimmickKind, number][]) {
    if ((counts.get(kind) ?? 0) < minimum) {
      errors.push(
        "world-01: " + kind + " 기믹이 최소 " + minimum + "개 필요합니다.",
      );
    }
  }

  for (const stage of world01Stages) {
    const map = stage.map;
    if (!map) {
      continue;
    }

    const dangers = map.gimmicks
      .filter((gimmick) => WORLD01_STATIC_KINDS.includes(gimmick.kind as typeof WORLD01_STATIC_KINDS[number]) || gimmick.kind === "open-manhole")
      .sort((left, right) => left.x - right.x);
    if (dangers.filter((gimmick) => gimmick.kind !== "open-manhole").length !== 4) {
      errors.push(stage.id + ": 정적 장애물은 정확히 4개여야 합니다.");
    }
    for (let index = 1; index < dangers.length; index += 1) {
      if (dangers[index].x - dangers[index - 1].x < 656) {
        errors.push(stage.id + ": 물리 위험 간격은 656px 이상이어야 합니다.");
      }
    }
    if (map.gimmicks.some((gimmick) => ["fake-checkpoint", "forward-jump-wall"].includes(gimmick.kind))) {
      errors.push(stage.id + ": 가짜 체크포인트 또는 투명 벽이 남아 있습니다.");
    }
  }

  const gimmicksByWorld = new Map<string, number>();
  for (const stage of registry.stages) {
    const count = stage.map?.gimmicks.length ?? 0;
    if (count > 0) {
      gimmicksByWorld.set(stage.worldId, (gimmicksByWorld.get(stage.worldId) ?? 0) + count);
    }
  }
  for (const [worldId, count] of gimmicksByWorld) {
    if (worldId !== "world-01" && count < 30) errors.push(worldId + ": 기믹은 최소 30개여야 합니다.");
  }

  return {
    reports,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

function validateGimmicks(
  stage: StageDefinition,
  map: StageMapDefinition,
  objectById: ReadonlyMap<string, MapObjectDefinition>,
  sections: readonly MapSectionDefinition[],
  errors: string[],
): void {
  for (const gimmick of map.gimmicks) {
    if (gimmick.stageId !== stage.id) {
      errors.push("기믹 stageId가 맵 스테이지와 일치하지 않습니다: " + gimmick.id);
    }
    if (stage.kind === "boss") {
      errors.push("보스 맵에는 일반 기믹을 배치할 수 없습니다: " + gimmick.id);
    }
    if (![2, 3, 4].includes(gimmick.sectionIndex)) {
      errors.push("기믹은 구간 2~4에만 배치할 수 있습니다: " + gimmick.id);
    }
    const section = sections.find((candidate) => candidate.index === gimmick.sectionIndex);
    const object = objectById.get(gimmick.objectId);
    if (!object) {
      errors.push("기믹 오브젝트가 없습니다: " + gimmick.objectId);
    } else if (section && !isObjectInsideSection(object, section)) {
      errors.push("기믹이 지정된 구간 밖에 배치되었습니다: " + gimmick.id);
    }
    if (gimmick.hintPolicy !== "none") {
      errors.push("월드1 기믹은 힌트를 가질 수 없습니다: " + gimmick.id);
    }
    if (gimmick.lethal !== true) {
      errors.push("월드1 기믹은 lethal이어야 합니다: " + gimmick.id);
    }
    if (gimmick.chainIds.length === 0) {
      errors.push("기믹 chainId가 비어 있습니다: " + gimmick.id);
    }
    for (const chainId of gimmick.chainIds) {
      if (!map.chainRules.some((rule) => rule.id === chainId && rule.sourceId === gimmick.objectId)) {
        errors.push("기믹 chainId가 source 오브젝트에 연결되지 않았습니다: " + gimmick.id);
      }
    }
    const expectedCounterplay: Partial<Record<GimmickKind, GimmickCounterplay["action"]>> = {
      "ant-static": "jump-before-zone",
      "white-spike-static": "jump-before-zone",
      "seagull-static": "jump-before-zone",
      "box-static": "jump-before-zone",
      "open-manhole": "jump-before-zone",
      "ant-trip": "move-backward",
      "forward-jump-wall": "move-backward",
      "ground-collapse": "jump-before-zone",
      "ground-rise": "micro-forward-then-back",
      "revealed-white-spike": "precision-movement",
      "jump-pigeon": "precision-movement",
      "fake-bone-green": "do-not-collect",
      "fake-bone-reverse": "do-not-collect",
      "fake-bone-fire": "do-not-collect",
      "fake-checkpoint": "move-backward",
      "box-cat-arm": "jump-then-back",
      "cloud-rain": "precision-movement",
      "name-bubble-control-loss": "mash-jump",
    };
    if (expectedCounterplay[gimmick.kind] !== gimmick.counterplay.action) {
      errors.push("기믹 counterplay가 정의와 일치하지 않습니다: " + gimmick.id);
    }
    if (
      gimmick.counterplay.action === "mash-jump" &&
      (gimmick.counterplay.requiredPresses !== 100 ||
        !gimmick.counterplay.windowMs || gimmick.counterplay.windowMs <= 0 ||
        gimmick.outcome.controlOverride !== "run-left")
    ) {
      errors.push("연타 탈출 기믹은 왼쪽 강제 이동 중 100회 제한 시간 입력이어야 합니다: " + gimmick.id);
    }
    if (
      gimmick.kind === "fake-bone-reverse" &&
      (gimmick.outcome.kind !== "forced-control-death" || gimmick.outcome.controlOverride !== "drift-backward")
    ) {
      errors.push("역방향 가짜 코인은 강제 후진 사망 결과여야 합니다: " + gimmick.id);
    }
    if (
      gimmick.kind === "fake-bone-fire" &&
      (gimmick.outcome.kind !== "launch-death" || gimmick.outcome.controlOverride !== "launch-up")
    ) {
      errors.push("불붙은 가짜 코인은 발사 사망 결과여야 합니다: " + gimmick.id);
    }
  }
}

function validateNormalSections(
  stage: StageDefinition,
  sections: readonly MapSectionDefinition[],
  objects: readonly MapObjectDefinition[],
  errors: string[],
): void {
  if (sections.length !== 5) {
    errors.push("일반 스테이지는 정확히 5개 구간을 가져야 합니다.");
  }

  const expectedRoles = [
    "safe-entry",
    "gauntlet",
    stage.checkpointSectionIndex === 3 ? "checkpoint-gauntlet" : "gauntlet",
    stage.checkpointSectionIndex === 4 ? "checkpoint-gauntlet" : "gauntlet",
    "safe-exit",
  ] as const;
  let cursor = 0;
  const seenIndexes = new Set<number>();

  for (const [position, section] of sections.entries()) {
    if (seenIndexes.has(section.index)) {
      errors.push("중복된 구간 번호: " + section.index);
    }
    seenIndexes.add(section.index);

    if (section.index !== position + 1) {
      errors.push("구간 번호가 순서와 일치하지 않습니다: " + section.id);
    }
    if (section.role !== expectedRoles[position]) {
      errors.push("구간 역할이 올바르지 않습니다: " + section.id);
    }
    const expectedCheckpointId = section.index === stage.checkpointSectionIndex
      ? stage.checkpointIds[0]
      : undefined;
    if (section.checkpointId !== expectedCheckpointId) {
      errors.push("구간 checkpointId가 스테이지 정의와 일치하지 않습니다: " + section.id);
    }
    if (section.width <= 0 || section.x !== cursor) {
      errors.push("구간 사이에 겹침 또는 공백이 있습니다: " + section.id);
    }
    cursor = Math.max(cursor, section.x + section.width);

    for (const objectId of section.mapObjectIds) {
      if (!objects.some((object) => object.id === objectId)) {
        errors.push("구간이 존재하지 않는 오브젝트를 참조합니다: " + objectId);
      }
    }
  }

  if (cursor !== stage.mapWidth) {
    errors.push("구간이 전체 맵 너비를 정확히 채우지 않습니다.");
  }
}

function validateChainReferences(
  objects: readonly MapObjectDefinition[],
  map: StageMapDefinition,
  objectById: ReadonlyMap<string, MapObjectDefinition>,
  ruleIds: ReadonlySet<string>,
  theme: WorldMapThemeDefinition,
  errors: string[],
): void {
  const seedGroups = new Map<string, number>();

  for (const object of objects) {
    if (object.chainId && !ruleIds.has(object.chainId)) {
      errors.push("존재하지 않는 chainId: " + object.chainId);
    }
    if (object.triggerId && !ruleIds.has(object.triggerId)) {
      errors.push("존재하지 않는 triggerId: " + object.triggerId);
    }
    for (const variant of object.variantPool ?? []) {
      if (!theme.objectVisualKeys.includes(variant)) {
        errors.push("테마에 등록되지 않은 variantPool 항목: " + variant);
      }
    }
    if (object.seedGroup) {
      seedGroups.set(object.seedGroup, (seedGroups.get(object.seedGroup) ?? 0) + 1);
    }
  }

  const ruleIdsSeen = new Set<string>();
  for (const rule of map.chainRules) {
    if (ruleIdsSeen.has(rule.id)) {
      errors.push("중복된 chain rule ID: " + rule.id);
    }
    ruleIdsSeen.add(rule.id);

    if (rule.sourceId && !objectById.has(rule.sourceId)) {
      errors.push("존재하지 않는 chain sourceId: " + rule.sourceId);
    }
    if (rule.seedGroup) {
      seedGroups.set(rule.seedGroup, (seedGroups.get(rule.seedGroup) ?? 0) + 1);
    }
    for (const action of rule.actions) {
      if (action.targetId && !objectById.has(action.targetId)) {
        errors.push("존재하지 않는 chain targetId: " + action.targetId);
      }
    }
  }

  for (const [seedGroup, count] of seedGroups) {
    if (count < 2) {
      errors.push("참조가 하나뿐인 seedGroup: " + seedGroup);
    }
  }
}

function validateSafeSections(
  sections: readonly MapSectionDefinition[],
  objects: readonly MapObjectDefinition[],
  map: StageMapDefinition,
  objectById: ReadonlyMap<string, MapObjectDefinition>,
  errors: string[],
): void {
  const safeSections = sections.filter(
    (section) => section.safe || section.role === "safe-entry" || section.role === "safe-exit",
  );

  for (const section of safeSections) {
    for (const object of objects) {
      if (!isObjectInsideSection(object, section)) {
        continue;
      }

      if (object.properties.lethal === true || object.properties.forcedMovement === true) {
        errors.push("safe 구간에 lethal 또는 forced movement 오브젝트가 있습니다: " + object.id);
      }
      if (object.properties.blocking === true) {
        errors.push("safe 구간에 blocking 오브젝트가 있습니다: " + object.id);
      }
    }

    for (const rule of map.chainRules) {
      const source = rule.sourceId ? objectById.get(rule.sourceId) : undefined;
      const targets = rule.actions
        .map((action) => (action.targetId ? objectById.get(action.targetId) : undefined))
        .filter((object): object is MapObjectDefinition => Boolean(object));
      const touchesSection = [source, ...targets].some(
        (object) => object && isObjectInsideSection(object, section),
      );
      const blocksMovement = rule.actions.some(
        (action) =>
          action.type === "move-object" ||
          (action.type === "set-collision" && action.value === true),
      );

      if (touchesSection && blocksMovement) {
        errors.push("safe 구간에 forced movement 또는 blocking chain이 있습니다: " + rule.id);
      }
    }
  }
}

function isObjectInsideSection(
  object: MapObjectDefinition,
  section: MapSectionDefinition,
): boolean {
  const objectCenterX = object.x + object.width / 2;
  return objectCenterX >= section.x && objectCenterX <= section.x + section.width;
}
