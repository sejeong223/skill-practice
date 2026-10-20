import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { MARKET_PRODUCTS } = require("../src/game/data/marketCatalog.ts");
const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
const cosmetics = MARKET_PRODUCTS.filter(product => product.cosmeticId !== undefined);

test("의상·장신구 10종마다 코기 달리기 4프레임과 짖기 파츠가 등록된다", async () => {
  assert.equal(cosmetics.length, 10);
  for (const product of cosmetics) {
    const id = product.id;
    const run = manifest.find(asset => asset.key === `wear-${id}-run`);
    const bark = manifest.find(asset => asset.key === `wear-${id}-bark`);
    assert.deepEqual(run, {
      key: `wear-${id}-run`, kind: "spritesheet", url: `/assets/pixel/characters/corgi/equipment/${id}-run.png`,
      frameWidth: 112, frameHeight: 128, frameCount: 4, required: true,
    });
    assert.deepEqual(bark, {
      key: `wear-${id}-bark`, kind: "image", url: `/assets/pixel/characters/corgi/equipment/${id}-bark.png`, required: true,
    });
    for (const [asset, width] of [[run, 448], [bark, 112]]) {
      const { data, info } = await sharp(path.join(root, "public", asset.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([info.width, info.height], [width, 128], asset.key);
      const frames = width / 112;
      for (let frame = 0; frame < frames; frame++) {
        let opaque = 0;
        for (let y = 0; y < 128; y++) for (let x = frame * 112; x < (frame + 1) * 112; x++) {
          if (data[(y * width + x) * 4 + 3] >= 160) opaque++;
        }
        assert.ok(opaque > 30 && opaque < 112 * 128 * 0.24, `${asset.key} frame ${frame} needs a small transparent part`);
      }
    }
  }
});
