import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { colorizeCustomOutfitPixels } = require("../src/game/entities/customOutfitTexture.ts");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("색칠한 의상은 대시의 흰 천 영역만 채우고 4프레임 무늬를 유지한다", async () => {
  const directory = path.join(root, "public/assets/pixel/characters/corgi/equipment");
  const template = await sharp(path.join(directory, "custom-outfit-template-dash.png"))
    .ensureAlpha().raw().toBuffer();
  const uv = await sharp(path.join(directory, "custom-outfit-template-dash-uv.png"))
    .ensureAlpha().raw().toBuffer();
  const design = { id: "test", updatedAt: "2026-10-29", cells: Array(56 * 32).fill("#E95F68") };
  const painted = colorizeCustomOutfitPixels(new Uint8ClampedArray(template), 448, 128, "dash", design,
    new Uint8ClampedArray(uv));
  for (let frame = 0; frame < 4; frame++) {
    let colored = 0;
    for (let y = 0; y < 128; y++) for (let x = frame * 112; x < frame * 112 + 112; x++) {
      const at = (y * 448 + x) * 4;
      if (uv[at + 3] > 200) {
        assert.deepEqual(Array.from(painted.subarray(at, at + 3)), [233, 95, 104]);
        colored++;
      } else assert.deepEqual(Array.from(painted.subarray(at, at + 4)), Array.from(template.subarray(at, at + 4)));
    }
    assert.ok(colored > 100, `paintable dash fabric in frame ${frame}`);
  }
});
