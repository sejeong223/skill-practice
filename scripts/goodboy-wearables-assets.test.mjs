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
          if (data[(y * width + x) * 4 + 3] >= 160) {
            opaque++;
            if (product.category === "outfit") {
              const localX = x - frame * 112;
              assert.ok(localX >= 18 && localX <= 74 && y >= 40 && y <= 89,
                `${asset.key} frame ${frame}: pixel outside clothing silhouette at ${localX},${y}`);
            }
          }
        }
        assert.ok(opaque > 30 && opaque < 112 * 128 * 0.24, `${asset.key} frame ${frame} needs a small transparent part`);
      }
    }
  }
});

test("흰 옷 템플릿은 모든 자세의 코기 몸에 맞고 그림판 밖은 투명하다", async () => {
  const run = manifest.find(asset => asset.key === "custom-outfit-template-run");
  const bark = manifest.find(asset => asset.key === "custom-outfit-template-bark");
  assert.deepEqual(run, {
    key: "custom-outfit-template-run", kind: "spritesheet",
    url: "/assets/pixel/characters/corgi/equipment/custom-outfit-template-run.png",
    frameWidth: 112, frameHeight: 128, frameCount: 4, required: true,
  });
  assert.deepEqual(bark, {
    key: "custom-outfit-template-bark", kind: "image",
    url: "/assets/pixel/characters/corgi/equipment/custom-outfit-template-bark.png", required: true,
  });

  for (const [asset, corgiFile, frames] of [
    [run, "corgi-run.png", 4], [bark, "corgi-bark.png", 1],
  ]) {
    const [outfit, corgi] = await Promise.all([
      sharp(path.join(root, "public", asset.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(path.join(root, "public/assets/pixel/characters/corgi", corgiFile)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    assert.deepEqual([outfit.info.width, outfit.info.height], [112 * frames, 128]);
    for (let frame = 0; frame < frames; frame++) {
      let opaque = 0;
      let onCorgi = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
        const index = (y * outfit.info.width + frame * 112 + x) * 4 + 3;
        if (outfit.data[index] < 128) continue;
        opaque++;
        assert.ok(x >= 18 && x <= 74 && y >= 53 && y <= 88, `${asset.key} frame ${frame}: pixel outside torso at ${x},${y}`);
        if (corgi.data[index] >= 128) onCorgi++;
      }
      assert.ok(opaque > 300, `${asset.key} frame ${frame} must not be empty`);
      assert.ok(onCorgi / opaque > 0.94, `${asset.key} frame ${frame} must follow corgi body`);
    }
  }
});

test("생일 고깔모자는 다섯 자세의 두 귀를 덮고 얼굴은 드러낸다", async () => {
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
        `${pose}/${frame}: nose and expression must remain visible`);
    }
  }
});
