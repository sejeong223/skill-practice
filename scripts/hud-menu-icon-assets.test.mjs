import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const icons = [
  "menu-palette.png",
  "menu-bag.png",
  "menu-shop.png",
  "menu-pause.png",
  "menu-play.png",
  "menu-reset-clockwise.png",
  "menu-map.png",
];

test("우측 메뉴 컬러 아이콘 일곱 장은 각각 투명한 20×20 PNG다", async () => {
  assert.equal(new Set(icons).size, 7);
  const hashes = new Set();
  for (const name of icons) {
    const filename = fileURLToPath(new URL(`../public/assets/pixel/ui/${name}`, import.meta.url));
    const bytes = await readFile(filename);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "png", name);
    assert.equal(metadata.width, 20, name);
    assert.equal(metadata.height, 20, name);
    assert.equal(metadata.hasAlpha, true, name);

    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4, name);
    const colors = new Set();
    let opaque = 0;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const index = (y * 20 + x) * 4;
      const alpha = data[index + 3];
      if (x === 0 || x === 19 || y === 0 || y === 19) {
        assert.equal(alpha, 0, `${name}: transparent 1px edge at ${x},${y}`);
      }
      if (alpha >= 128) {
        opaque++;
        colors.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
      }
    }
    assert.ok(opaque >= 30 && opaque <= 260, `${name}: visible silhouette (${opaque} pixels)`);
    assert.ok(colors.size >= 2, `${name}: needs more than one visible color`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 7, "all seven icons must be different");
});
