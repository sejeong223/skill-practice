import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
const outfitIds = ["pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor"];
const accessoryIds = ["shinchan-eyebrow-sticker", "birthday-party-hat", "strawberry-headpiece", "propeller-hat", "prince-crown"];

async function pixels(key) {
  const entry = manifest.find(asset => asset.key === key);
  assert.ok(entry?.required, key);
  const { data, info } = await sharp(path.join(root, "public", entry.url)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [448, 128], key);
  return { entry, data, info };
}

test("기본 대시는 112×128 전신 4프레임이며 발 행과 투명 배경을 유지한다", async () => {
  const { entry, data, info } = await pixels("corgi-dash");
  assert.deepEqual([entry.frameWidth, entry.frameHeight, entry.frameCount], [112, 128, 4]);
  assert.equal(data[3], 0);
  for (let frame = 0; frame < 4; frame++) {
    let count = 0, bottom = -1;
    for (let y = 0; y < 128; y++) for (let x = frame * 112; x < frame * 112 + 112; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 128) continue;
      count++; bottom = y;
    }
    assert.ok(count > 1800, `complete body in frame ${frame}`);
    assert.equal(bottom, 99);
  }
});

test("다섯 의상은 각각 대시 전신, 다섯 장신구는 별도 레이어다", async () => {
  const base = (await pixels("corgi-dash")).data;
  for (const id of outfitIds) {
    const { data } = await pixels(`wear-${id}-dash`);
    assert.notDeepEqual(data, base, id);
    for (let frame = 0; frame < 4; frame++) {
      let count = 0, bottom = -1;
      for (let y = 0; y < 128; y++) for (let x = frame * 112; x < frame * 112 + 112; x++) {
        if (data[(y * 448 + x) * 4 + 3] < 128) continue;
        count++; bottom = y;
      }
      assert.ok(count > 1800, `${id} frame ${frame} full body`);
      assert.equal(bottom, 99);
    }
  }
  for (const id of accessoryIds) {
    const { data } = await pixels(`wear-${id}-dash`);
    let count = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 448; x++) {
      if (data[(y * 448 + x) * 4 + 3] < 128) continue;
      count++;
      assert.ok(y < 90, `${id} must stay near head`);
    }
    assert.ok(count > 25, id);
    assert.ok(count < 5000, `${id} must not copy body`);
  }
});
