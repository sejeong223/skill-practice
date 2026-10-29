import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "art/source/world03-mackerel-boss-poses.png");
const output = path.join(root, "public/assets/pixel/characters/world-03/mackerel-boss.png");

test("승인된 고등어 태비는 각기 다른 8개 전신 자세와 같은 발 기준선을 사용한다", async () => {
  assert.deepEqual(await readFile(output), await readFile(source));
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [896, 112]);
  const hashes = new Set();
  for (let frame = 0; frame < 8; frame++) {
    let left = 112;
    let right = 0;
    let top = 112;
    let bottom = 0;
    const pixels = [];
    for (let y = 0; y < 112; y++) {
      for (let x = 0; x < 112; x++) {
        const index = (y * 896 + frame * 112 + x) * 4;
        pixels.push(...data.subarray(index, index + 4));
        if (data[index + 3] < 128) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    assert.ok(right - left >= 80, `frame ${frame} is missing its full body`);
    assert.equal(bottom, 105, `frame ${frame} is off the floor`);
    assert.ok(top >= 0 && right < 112, `frame ${frame} clips its art`);
    hashes.add(createHash("sha256").update(Buffer.from(pixels)).digest("hex"));
  }
  assert.equal(hashes.size, 8);
});

test("대기 자세의 실루엣은 치즈보다 크고 턱시도보다 작다", async () => {
  const bounds = async (file, size) => {
    const { data } = await sharp(file).extract({ left: 0, top: 0, width: size, height: size })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = size, right = 0, top = size, bottom = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { width: right - left + 1, height: bottom - top + 1 };
  };
  const cat = path.join(root, "public/assets/pixel/characters");
  const cheese = await bounds(path.join(cat, "world-02/cheese-tabby-boss.png"), 96);
  const mackerel = await bounds(output, 112);
  const tuxedo = await bounds(path.join(cat, "world-04/tuxedo-boss.png"), 128);
  assert.ok(cheese.width < mackerel.width && mackerel.width < tuxedo.width);
  assert.ok(cheese.height < mackerel.height && mackerel.height < tuxedo.height);
});
