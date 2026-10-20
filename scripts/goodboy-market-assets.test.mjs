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

async function inspectPng(filename, width, height, minMargin) {
  const bytes = await readFile(filename);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [width, height], filename);
  let left = width, top = height, right = -1, bottom = -1;
  let opaque = 0, green = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    const [r, g, b, a] = data.subarray(index, index + 4);
    if (a < 160) continue;
    opaque++;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
    if (g > r * 1.1 && g > b * 1.2) green++;
  }
  assert.ok(opaque > 100 && opaque < width * height * 0.85, `${filename}: silhouette and transparency`);
  assert.ok(left >= minMargin && top >= minMargin && width - 1 - right >= minMargin && height - 1 - bottom >= minMargin,
    `${filename}: all sides need ${minMargin}px transparent margin, got ${[left, top, width - 1 - right, height - 1 - bottom]}`);
  return { bytes, green };
}

test("연두 조끼의 리트리버 주인은 투명한 256px 픽셀 아트다", async () => {
  const owner = await inspectPng(path.join(root, "public/assets/pixel/shop/goodboy-retriever.png"), 256, 256, 4);
  assert.ok(owner.green > 400, "lime vest should have enough visible pixels");
});

test("상점 19종의 PNG는 카탈로그와 경로가 같고 각자 구별된다", async () => {
  assert.equal(MARKET_PRODUCTS.length, 19);
  const bytes = [];
  for (const product of MARKET_PRODUCTS) {
    assert.equal(product.iconUrl, `/assets/pixel/shop/items/${product.id}.png`);
    const result = await inspectPng(path.join(root, "public", product.iconUrl), 64, 64, 4);
    bytes.push(result.bytes.toString("base64"));
  }
  assert.equal(new Set(bytes).size, 19);
});
