import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { isDeepStrictEqual } from "node:util";

const require = createRequire(import.meta.url);

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  WORLD01_STAGE_MAPS,
} = require(path.join(root, "src/game/data/world01Maps.ts"));
const {
  WORLD01_GIMMICK_MINIMUMS,
  WORLD01_GIMMICKS,
  getWorld01FloorY,
  getWorld01OpenManholes,
} = require(path.join(root, "src/game/data/world01Gimmicks.ts"));
const outputDirectory = path.join(root, "public/assets/pixel/maps/world-01");
const tileWidth = 16;
const tileHeight = 16;

function tiledProperties(object) {
  const values = {
    ...object.properties,
    mapObjectId: object.id,
    kind: object.kind,
    visualKey: object.visualKey,
    layerId: object.layerId,
    collision: object.collision,
    ...(object.chainId ? { chainId: object.chainId } : {}),
    ...(object.seedGroup ? { seedGroup: object.seedGroup } : {}),
  };

  return Object.entries(values).map(([name, value]) => ({
    name,
    type: typeof value === "boolean" ? "bool" : typeof value === "number" ? "int" : "string",
    value,
  }));
}

function makeTiledObject(object, index) {
  return {
    id: index + 1,
    name: object.id,
    type: object.kind,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: 0,
    visible: true,
    properties: tiledProperties(object),
  };
}

function makeMap(stageNumber, definition) {
  const width = definition.mapWidth / tileWidth;
  const height = definition.mapHeight / tileHeight;
  const ground = Array(width * height).fill(0);

  for (let column = 0; column < width; column += 1) {
    const x = column * tileWidth + tileWidth / 2;
    if (getWorld01OpenManholes(stageNumber).some((hole) => x >= hole.x && x < hole.x + hole.width)) {
      continue;
    }
    const floorY = getWorld01FloorY(stageNumber, x);
    const firstRow = Math.floor(floorY / tileHeight);
    for (let row = firstRow; row < height; row += 1) {
      ground[row * width + column] = row === firstRow ? 1 : 13;
    }
  }

  const allObjects = definition.objectDefinitions.map(makeTiledObject);
  const interactiveObjects = allObjects.filter((object) =>
    ["interactive", "trap", "collectible"].includes(object.type),
  );
  const entityObjects = allObjects.filter((object) =>
    ["enemy-spawn", "checkpoint", "exit"].includes(object.type),
  );
  const emptyLayer = (id, name) => ({
    id,
    name,
    type: "tilelayer",
    x: 0,
    y: 0,
    width,
    height,
    opacity: 1,
    visible: true,
    data: Array(width * height).fill(0),
  });

  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers: [
      emptyLayer(1, "world-01-background-far"),
      emptyLayer(2, "world-01-background-mid"),
      {
        ...emptyLayer(3, "world-01-gameplay"),
        data: ground,
      },
      emptyLayer(4, "world-01-foreground"),
      {
        draworder: "topdown",
        id: 5,
        name: "gimmicks",
        opacity: 1,
        type: "objectgroup",
        visible: true,
        x: 0,
        y: 0,
        objects: interactiveObjects,
      },
      {
        draworder: "topdown",
        id: 6,
        name: "entities",
        opacity: 1,
        type: "objectgroup",
        visible: true,
        x: 0,
        y: 0,
        objects: entityObjects,
      },
    ],
    nextlayerid: 7,
    nextobjectid: allObjects.length + 1,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.10.2",
    tilesets: [
      {
        columns: 12,
        firstgid: 1,
        image: "../../tiles/world-01/world-01-tileset.svg",
        imageheight: 144,
        imagewidth: 192,
        margin: 0,
        name: "world-01-tileset",
        spacing: 0,
        tilecount: 108,
        tileheight: tileHeight,
        tilewidth: tileWidth,
      },
    ],
    type: "map",
    version: "1.10",
    width,
    tilewidth: tileWidth,
    tileheight: tileHeight,
  };
}

function verifyMap(stageNumber, definition, tiledMap) {
  const errors = [];
  const stageGimmicks = definition.gimmicks;
  const mapObjects = tiledMap.layers
    .filter((layer) => layer.type === "objectgroup")
    .flatMap((layer) => layer.objects);
  const gimmickObjects = mapObjects.filter((object) =>
    object.properties.some((property) => property.name === "gimmickId"),
  );
  const ids = gimmickObjects.map((object) =>
    object.properties.find((property) => property.name === "mapObjectId")?.value,
  );
  const expected = stageGimmicks.map((gimmick) => gimmick.objectId);
  if (new Set(ids).size !== ids.length) errors.push("기믹 object ID 중복");
  if (expected.length !== ids.length || expected.some((id) => !ids.includes(id))) {
    errors.push("기믹 카탈로그와 Tiled 객체 ID가 1:1이 아님");
  }
  if (definition.sections.length !== 5) errors.push("5개 구간이 아님");
  if (definition.sections[0].width !== 192 || definition.sections[4].width !== 192) {
    errors.push("진입·탈출 안전 구간이 192px가 아님");
  }
  if (definition.sections[0].mapObjectIds.length || definition.sections[4].mapObjectIds.some((id) =>
    stageGimmicks.some((gimmick) => gimmick.objectId === id),
  )) errors.push("안전 구간에 기믹이 있음");
  if (tiledMap.layers.filter((layer) => layer.type === "tilelayer").length !== 4) {
    errors.push("타일 레이어가 4개가 아님");
  }
  if (tiledMap.width * tileWidth !== 2560) errors.push("맵 너비가 2560px가 아님");
  const expectedCheckpointX = stageNumber === 2 ? 1520 : stageNumber === 4 ? 2320 : null;
  const checkpoints = mapObjects.filter((object) => object.type === "checkpoint");
  if (checkpoints.length !== (expectedCheckpointX === null ? 0 : 1)) {
    errors.push("진짜 체크포인트 개수가 맞지 않음");
  }
  if (expectedCheckpointX !== null && checkpoints[0]) {
    if (checkpoints[0].x !== expectedCheckpointX ||
      !checkpoints[0].properties.some((property) => property.name === "trueCheckpoint" && property.value === true)) {
      errors.push("체크포인트 위치 또는 trueCheckpoint 속성이 맞지 않음");
    }
  }
  if (mapObjects.some((object) => object.properties.some((property) => property.name === "fakeCheckpoint" && property.value === true))) {
    errors.push("가짜 체크포인트가 남음");
  }

  const dangerKinds = new Set(["ant-static", "white-spike-static", "pigeon-static", "box-static", "open-manhole"]);
  const dangers = stageGimmicks.filter((gimmick) => dangerKinds.has(gimmick.kind)).sort((a, b) => a.x - b.x);
  const staticDangers = dangers.filter((gimmick) => gimmick.kind !== "open-manhole");
  if (staticDangers.length !== 4 || dangers.length !== (stageNumber === 2 || stageNumber === 4 ? 5 : 4)) {
    errors.push("정적 장애물 또는 열린 맨홀 개수가 맞지 않음");
  }
  for (let index = 1; index < dangers.length; index += 1) {
    const gap = dangers[index].x - dangers[index - 1].x;
    if (gap < 448 || gap > 640) errors.push("물리 위험 간격이 448~640px 범위 밖");
  }
  const coins = stageGimmicks.filter((gimmick) => gimmick.kind.startsWith("fake-bone-"));
  if (coins.some((coin) => coin.y + coin.height > getWorld01FloorY(stageNumber, coin.x) - 80)) {
    errors.push("가짜 코인이 바닥에서 너무 낮음");
  }
  if (stageGimmicks.some((gimmick) => ["fake-checkpoint", "forward-jump-wall", "ground-collapse", "ground-rise"].includes(gimmick.kind))) {
    errors.push("돌발 기믹 또는 가짜 체크포인트가 남음");
  }
  const ground = tiledMap.layers.find((layer) => layer.name === "world-01-gameplay")?.data;
  if (!ground) {
    errors.push("게임플레이 바닥 타일 없음");
  } else {
    for (let column = 0; column < tiledMap.width; column += 1) {
      const x = column * tileWidth + tileWidth / 2;
      const hole = getWorld01OpenManholes(stageNumber).some((item) => x >= item.x && x < item.x + item.width);
      const firstRow = Math.floor(getWorld01FloorY(stageNumber, x) / tileHeight);
      for (let row = firstRow; row < tiledMap.height; row += 1) {
        if (hole ? ground[row * tiledMap.width + column] !== 0 : ground[row * tiledMap.width + column] === 0) {
          errors.push(`바닥/맨홀 타일 불일치: 열 ${column}`);
          break;
        }
      }
    }
  }

  return errors;
}

function run() {
  const checkOnly = process.argv.includes("--check");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const totalCounts = new Map();
  let totalObjects = 0;
  const problems = [];

  for (const stageNumber of [1, 2, 3, 4]) {
    const definition = WORLD01_STAGE_MAPS[stageNumber];
    const file = path.join(outputDirectory, `world-01-stage-${stageNumber}.json`);
    const tiledMap = makeMap(stageNumber, definition);
    if (checkOnly) {
      if (!fs.existsSync(file)) {
        problems.push(`stage ${stageNumber}: Tiled 파일 없음`);
        continue;
      }
      const existing = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!isDeepStrictEqual(existing, tiledMap)) {
        problems.push(`stage ${stageNumber}: 생성 정의와 JSON 타일·오브젝트·속성이 다름`);
      }
      problems.push(...verifyMap(stageNumber, definition, existing).map((problem) => `stage ${stageNumber}: ${problem}`));
      if (existing.width !== tiledMap.width || existing.height !== tiledMap.height) {
        problems.push(`stage ${stageNumber}: 메타데이터와 JSON 맵 크기가 다름`);
      }
      const mapObjects = existing.layers
        .filter((layer) => layer.type === "objectgroup")
        .flatMap((layer) => layer.objects);
      totalObjects += mapObjects.length;
    } else {
      fs.writeFileSync(file, JSON.stringify(tiledMap));
      totalObjects += definition.objectDefinitions.length;
    }

    for (const gimmick of definition.gimmicks) {
      totalCounts.set(gimmick.kind, (totalCounts.get(gimmick.kind) ?? 0) + 1);
    }
  }

  if (WORLD01_GIMMICKS.length !== 24) problems.push("전체 기믹 카탈로그가 24개가 아님");
  for (const [kind, minimum] of Object.entries(WORLD01_GIMMICK_MINIMUMS)) {
    if ((totalCounts.get(kind) ?? 0) < minimum) {
      problems.push(`${kind}: ${totalCounts.get(kind) ?? 0}/${minimum}개`);
    }
  }

  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`${checkOnly ? "검증" : "생성"}: World 1 4개 맵, 기믹 ${WORLD01_GIMMICKS.length}개, Tiled 객체 ${totalObjects}개`);
  for (const [kind, count] of totalCounts) {
    console.log(`- ${kind}: ${count}개`);
  }
}

run();
