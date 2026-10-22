import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "public/assets/pixel/props/world-02");
const file = (name) => path.join(base, name + ".png");
const pixels = async (name) => sharp(file(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function count(image, predicate) {
  let result = 0;
  const { data, info } = image;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const [r, g, b, a] = data.subarray(i, i + 4);
    if (a >= 160 && predicate(r, g, b, x, y)) result++;
  }
  return result;
}

test("사이다·환타 캔은 찌그러진 크기를 유지하고 색으로 구분된다", async () => {
  const cider = await pixels("crushed-cider-can");
  const fanta = await pixels("crushed-fanta-can");
  assert.deepEqual([cider.info.width, cider.info.height], [40, 28]);
  assert.deepEqual([fanta.info.width, fanta.info.height], [40, 28]);
  const green = (r, g, b) => g > r * 1.25 && g > b * 0.75;
  const orange = (r, g, b) => r > g * 1.2 && g > b * 1.25 && r > 100;
  assert.ok(count(cider, green) > 180);
  assert.ok(count(fanta, orange) > 160);
  assert.ok(count(cider, green) > count(fanta, green) * 20);
});

test("치토스 봉지는 주황 밀봉부·검은 포장·노란 글씨가 보인다", async () => {
  const bag = await pixels("empty-cheetos-bag-ground");
  assert.deepEqual([bag.info.width, bag.info.height], [1536, 1024]);
  const orange = count(bag, (r, g, b) => r > g * 1.2 && g > b * 1.25 && r > 100);
  const dark = count(bag, (r, g, b) => r < 85 && g < 85 && b < 95);
  const yellow = count(bag, (r, g, b) => r > 160 && g > 120 && b < 105);
  assert.ok(orange > 100_000);
  assert.ok(dark > 100_000);
  assert.ok(yellow > 70_000);
});

test("두 고양이의 무늬와 잠든·할퀴는 포즈가 각각 다르다", async () => {
  for (const color of ["orange", "tuxedo"]) {
    const sleepingName = "sleeping-" + color + "-cat";
    const scratchingName = "scratching-" + color + "-cat";
    const [sleeping, scratching] = await Promise.all([pixels(sleepingName), pixels(scratchingName)]);
    assert.deepEqual([sleeping.info.width, sleeping.info.height], [96, 56]);
    assert.deepEqual([scratching.info.width, scratching.info.height], [96, 56]);
    assert.notDeepEqual(await readFile(file(sleepingName)), await readFile(file(scratchingName)));
    const leftPaw = (r, g, b, x) => x < 16 && r > 190 && g > 185 && b > 170;
    assert.ok(count(scratching, leftPaw) > count(sleeping, leftPaw) + 10,
      color + " cat should extend its pale front paw to scratch");
    if (color === "orange") {
      assert.ok(count(sleeping, (r, g, b) => r > g * 1.2 && g > b * 1.25) > 2000);
    } else {
      assert.ok(count(sleeping, (r, g, b) => r < 85 && g < 85 && b < 95) > 2500);
    }
  }
});
