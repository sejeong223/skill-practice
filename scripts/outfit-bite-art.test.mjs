import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ids = [
  "pink-caterpillar-suit",
  "banana-peel-suit",
  "bee-bodysuit",
  "hotdog-outfit",
  "diamond-armor",
  "custom-outfit-template",
];
const eyeSpots = [[87, 40], [86, 40], [87, 41], [87, 41]];
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
  test(`${id}: 기존 의상·안광 없는 눈·발을 유지하고 입 4프레임을 표현한다`, async () => {
    const run = await image(id, "run");
    const bite = await image(id, "bite");
    assert.deepEqual([run.info.width, run.info.height, run.info.channels], [448, 128, 4]);
    assert.deepEqual([bite.info.width, bite.info.height, bite.info.channels], [448, 128, 4]);
    const mouthChecksums = [];
    for (let frame = 0; frame < 4; frame++) {
      let opaque = 0;
      let lowest = -1;
      let runLowest = -1;
      let hasTail = false;
      let hasMuzzle = false;
      let mouthChecksum = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
        const at = (y * 448 + frame * 112 + x) * 4;
        const source = run.data.subarray(at, at + 4);
        const current = bite.data.subarray(at, at + 4);
        if ((x < 65 || y >= 82) && source[3] >= 128) {
          assert.ok(source.equals(current), `${id} 프레임 ${frame}: 의상·발 픽셀 손실 (${x},${y})`);
        }
        if (x >= 85 && x < 112 && y >= 45 && y < 65) {
          for (const channel of current) mouthChecksum = (mouthChecksum * 31 + channel) >>> 0;
        }
        if (current[3] >= 128) {
          opaque++;
          lowest = y;
          if (x <= 25) hasTail = true;
          if (x >= 90) hasMuzzle = true;
        }
        if (source[3] >= 128) runLowest = y;
      }
      assert.ok(opaque >= 3000 && hasTail && hasMuzzle, `${id} 프레임 ${frame}: 전신이 보여야 한다`);
      assert.equal(lowest, runLowest, `${id} 프레임 ${frame}: 기존 의상 run과 같은 발 높이`);
      const [eyeX, eyeY] = eyeSpots[frame];
      const eye = (eyeY * 448 + frame * 112 + eyeX) * 4;
      assert.ok(bite.data[eye] < 120 && bite.data[eye + 1] < 120 &&
        bite.data[eye + 2] < 120 && bite.data[eye + 3] >= 128,
      `${id} 프레임 ${frame}: 코기 눈에 흰 안광이 없어야 한다`);
      mouthChecksums.push(mouthChecksum);
    }
    assert.equal(new Set(mouthChecksums).size, 4, `${id}: 네 입 모양이 서로 달라야 한다`);
    assert.equal(bite.data[3], 0);
    assert.equal(bite.data[((127 * 448 + 447) * 4) + 3], 0);
  });
}

test("직접 그린 의상의 기존 56×32 색칠 영역을 물기 템플릿도 유지한다", async () => {
  const run = await image("custom-outfit-template", "run");
  const bite = await image("custom-outfit-template", "bite");
  for (let frame = 0; frame < 4; frame++) {
    let white = 0;
    for (let y = 40; y < 96; y++) for (let x = 7; x < 85; x++) {
      const at = (y * 448 + frame * 112 + x) * 4;
      const source = run.data.subarray(at, at + 4);
      const isWhite = source[3] >= 200 && Math.min(...source.subarray(0, 3)) >= 230 &&
        Math.max(...source.subarray(0, 3)) - Math.min(...source.subarray(0, 3)) <= 8;
      if (!isWhite) continue;
      white++;
      assert.ok(source.equals(bite.data.subarray(at, at + 4)),
        `프레임 ${frame}의 색칠 가능한 셀 픽셀이 변경됨 (${x},${y})`);
    }
    assert.ok(white > 500, `프레임 ${frame}에 흰색 의상 영역이 있어야 한다`);
  }
});
