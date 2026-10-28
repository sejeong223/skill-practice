import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { assertFullBodyBitePoses } from "./bite-pose-assertions.mjs";

const ids = [
  "pink-caterpillar-suit",
  "banana-peel-suit",
  "bee-bodysuit",
  "hotdog-outfit",
  "diamond-armor",
  "custom-outfit-template",
];
const manifestUrl = new URL("../src/game/assets/assetManifest.json", import.meta.url);
const equipmentDir = new URL("../public/assets/pixel/characters/corgi/equipment/", import.meta.url);

const image = async (id, pose) => sharp(fileURLToPath(new URL(`${id}-${pose}.png`, equipmentDir)))
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

test("모든 의상과 직접 그리기 템플릿에 전신 물기 시트가 등록된다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  for (const id of ids) {
    const key = id === "custom-outfit-template" ? `${id}-bite` : `wear-${id}-bite`;
    const entry = manifest.find((asset) => asset.key === key);
    assert.deepEqual(entry && {
      kind: entry.kind, url: entry.url, frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight, frameCount: entry.frameCount, required: entry.required,
    }, {
      kind: "spritesheet",
      url: `/assets/pixel/characters/corgi/equipment/${id}-bite.png`,
      frameWidth: 112, frameHeight: 128, frameCount: 4, required: true,
    }, key);
  }
});

for (const id of ids) {
  test(`${id}: 옷을 입은 몸통과 다리까지 새 물기 자세로 움직인다`, async () => {
    const run = await image(id, "run");
    const bite = await image(id, "bite");
    assertFullBodyBitePoses(bite, run, id);
    const mouthShapes = new Set();
    for (let frame = 0; frame < 4; frame++) {
      let hash = 2166136261;
      for (let y = 43; y < 70; y++) for (let x = 86; x < 112; x++) {
        const at = (y * 448 + frame * 112 + x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          hash ^= bite.data[at + channel];
          hash = Math.imul(hash, 16777619) >>> 0;
        }
      }
      mouthShapes.add(hash);
    }
    assert.equal(mouthShapes.size, 4, `${id}: 입·턱 프레임도 달라야 한다`);
  });
}

test("직접 그린 의상의 넓은 흰색 몸통은 네 물기 자세에서도 칠할 수 있다", async () => {
  const bite = await image("custom-outfit-template", "bite");
  for (let frame = 0; frame < 4; frame++) {
    let paintable = 0;
    for (let y = 40; y < 96; y++) for (let x = 7; x < 85; x++) {
      const at = (y * 448 + frame * 112 + x) * 4;
      const pixel = bite.data.subarray(at, at + 4);
      if (pixel[3] >= 200 && Math.min(...pixel.subarray(0, 3)) >= 230 &&
          Math.max(...pixel.subarray(0, 3)) - Math.min(...pixel.subarray(0, 3)) <= 8) paintable++;
    }
    assert.ok(paintable > 500, `프레임 ${frame}: 흰색으로 칠할 수 있는 몸통 영역`);
  }
});
