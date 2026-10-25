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
const { isWhiteSuitPixel } = require("../src/game/entities/customOutfitTexture.ts");
const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
const cosmetics = MARKET_PRODUCTS.filter(product => product.cosmeticId !== undefined);

test("approved full-corgi suits have five complete, foot-aligned poses", async () => {
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
    for (const [asset, frames] of [[run, 4], [bark, 1]]) {
      const { data, info } = await sharp(path.join(root, "public", asset.url))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([info.width, info.height], [frames * 112, 128]);
      for (let frame = 0; frame < frames; frame++) {
        let opaque = 0;
        let top = 128;
        let bottom = -1;
        let left = 112;
        let right = -1;
        for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
          const alpha = data[(y * info.width + frame * 112 + x) * 4 + 3];
          if (alpha < 160) continue;
          opaque++;
          top = Math.min(top, y); bottom = Math.max(bottom, y);
          left = Math.min(left, x); right = Math.max(right, x);
        }
        if (product.category === "outfit") {
          assert.ok(opaque > 3000, `${asset.key}/${frame}: incomplete dressed corgi`);
          assert.ok(top > 0 && left > 0 && right < 111, `${asset.key}/${frame}: clipped head or suit`);
          assert.equal(bottom, asset === run ? [99, 99, 100, 104][frame] : 99,
            `${asset.key}/${frame}: paws must meet the original corgi foot anchor`);
        } else {
          assert.ok(opaque > 30 && opaque < 2000, `${asset.key}/${frame}: invalid head accessory`);
        }
      }
    }
  }
});

test("the blank painting template is the complete approved white-suit corgi", async () => {
  for (const [pose, frames] of [["run", 4], ["bark", 1]]) {
    const file = path.join(root, `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-${pose}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8ClampedArray(data);
    assert.deepEqual([info.width, info.height], [frames * 112, 128]);
    for (let frame = 0; frame < frames; frame++) {
      let fabric = 0;
      let dog = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
        const absoluteX = frame * 112 + x;
        if (data[(y * info.width + absoluteX) * 4 + 3] >= 160) dog++;
        if (isWhiteSuitPixel(pixels, info.width, absoluteX, y)) fabric++;
      }
      assert.ok(dog > 3000, `${pose}/${frame}: corgi missing`);
      assert.ok(fabric > 900, `${pose}/${frame}: white fabric missing`);
    }
  }
});

test("the birthday hat follows both ears while leaving the face clear", async () => {
  for (const [pose, frames] of [["run", 4], ["bark", 1]]) {
    const { data, info } = await sharp(path.join(root,
      `public/assets/pixel/characters/corgi/equipment/birthday-party-hat-${pose}.png`))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (frame, x, y) => data[(y * info.width + frame * 112 + x) * 4 + 3];
    for (let frame = 0; frame < frames; frame++) {
      const earY = frame === 3 ? 35 : 25;
      const earBaseY = frame === 3 ? 50 : 42;
      for (const earX of [64, 78]) {
        assert.ok(alpha(frame, earX, earY) >= 200, `${pose}/${frame}: ear tip uncovered`);
        assert.ok(alpha(frame, earX, earBaseY) >= 200, `${pose}/${frame}: ear base uncovered`);
      }
      assert.equal(alpha(frame, 96, frame === 3 ? 59 : 49), 0,
        `${pose}/${frame}: face must remain visible`);
    }
  }
});
