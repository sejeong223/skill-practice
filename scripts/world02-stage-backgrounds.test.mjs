import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: file,
}).outputText, file);
const { STAGE_DEFINITIONS } = require("../src/game/data/worlds.ts");
const { WORLD_MAP_THEMES, getWorld02StageTheme } = require("../src/game/data/worldMaps.ts");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
const base = WORLD_MAP_THEMES.find((theme) => theme.worldId === "world-02");
const midKey = (layers) => layers.find((layer) => layer.kind === "background-mid")?.assetKey;

test("맵 2·3만 고유 중경을 사용하고 나머지 레이어 설정은 유지한다", () => {
  for (const number of [1, 2, 3, 4]) {
    const id = "world-02-stage-" + number;
    const theme = getWorld02StageTheme(id, base);
    const stage = STAGE_DEFINITIONS.find((candidate) => candidate.id === id);
    const key = number === 2 || number === 3
      ? "world-02-background-mid-stage-" + number : "world-02-background-mid";
    assert.equal(midKey(theme.layers), key);
    assert.equal(midKey(stage.map.layers), key);
    assert.deepEqual(theme.layers.map((layer, index) => ({
      ...layer, assetKey: base.layers[index].assetKey,
    })), base.layers);
  }
});

test("새 중경은 기존 캔버스 크기와 투명한 하늘·바닥 여백을 유지한다", async () => {
  for (const number of [2, 3]) {
    const key = "world-02-background-mid-stage-" + number;
    const asset = manifest.find((entry) => entry.key === key);
    assert.deepEqual(asset, {
      key, kind: "image",
      url: "/assets/pixel/backgrounds/world-02/world-02-mid-stage-" + number + ".png",
      worldId: "world-02", required: true,
    });
    const { data, info } = await sharp(path.join(root, "public", asset.url))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [1672, 941]);
    const opaqueInRow = (y) => {
      let count = 0;
      for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] >= 160) count++;
      return count;
    };
    assert.equal(opaqueInRow(100), 0, "transparent sky must remain");
    assert.ok(opaqueInRow(700) > 1500, "playground should reach shared ground line");
    assert.equal(opaqueInRow(720), 0, "sand floor must not be painted into midground");
  }
});
