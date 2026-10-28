import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const equipment = new URL("public/assets/pixel/characters/corgi/equipment/", root);
const frameWidth = 112, frameHeight = 128, frames = 8, width = frameWidth * frames;
const outfits = ["pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor"];
const accessories = ["shinchan-eyebrow-sticker", "birthday-party-hat", "strawberry-headpiece", "propeller-hat", "prince-crown"];
const manifest = JSON.parse(await readFile(new URL("src/game/assets/assetManifest.json", root), "utf8"));
const image = async (name) => sharp(fileURLToPath(new URL(name, equipment))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function alphaBounds(data, frame) {
  let count = 0, top = frameHeight, bottom = -1;
  for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
    const at = (y * width + frame * frameWidth + x) * 4;
    if (data[at + 3] < 128) continue;
    count++;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { count, top, bottom };
}

test("의상 5종·장신구 5종·색칠 의상·UV 지도는 모두 필수 에셋이다", () => {
  for (const id of [...outfits, ...accessories, "custom-outfit-template"]) {
    for (const suffix of ["", "-mirror"]) {
      const key = id === "custom-outfit-template"
        ? `custom-outfit-template-pirouette${suffix}` : `wear-${id}-pirouette${suffix}`;
      const entry = manifest.find((asset) => asset.key === key);
      assert.deepEqual(entry, { key, kind: "spritesheet",
        url: `/assets/pixel/characters/corgi/equipment/${id}-pirouette${suffix}.png`,
        frameWidth, frameHeight, frameCount: frames, required: true });
    }
  }
  for (const suffix of ["", "-mirror"]) {
    const key = `custom-outfit-template-pirouette${suffix}-uv`;
    assert.deepEqual(manifest.find((asset) => asset.key === key), { key, kind: "image",
      url: `/assets/pixel/characters/corgi/equipment/${key}.png`, required: true });
  }
});

for (const id of outfits) {
  test(`${id}: 여덟 방향 모두 새 전신 코기와 같은 발 앵커를 가진다`, async () => {
    const { data, info } = await image(`${id}-pirouette.png`);
    assert.deepEqual([info.width, info.height], [width, frameHeight]);
    for (let frame = 0; frame < frames; frame++) {
      const bounds = alphaBounds(data, frame);
      assert.ok(bounds.count > 1200, `${id}/${frame}: missing dressed body`);
      assert.ok(bounds.top < 15, `${id}/${frame}: ears missing`);
      assert.equal(bounds.bottom, 99, `${id}/${frame}: foot anchor`);
    }
  });
}

for (const id of accessories) {
  test(`${id}: 장신구 레이어는 머리 근처에만 있고 몸통을 복제하지 않는다`, async () => {
    const { data, info } = await image(`${id}-pirouette.png`);
    assert.deepEqual([info.width, info.height], [width, frameHeight]);
    let total = 0;
    for (let frame = 0; frame < frames; frame++) {
      const bounds = alphaBounds(data, frame);
      assert.ok(bounds.count < (id === "strawberry-headpiece" ? 1600 : 550),
        `${id}/${frame}: body was pasted into accessory layer`);
      if (bounds.count > 0) assert.ok(bounds.bottom <= 48, `${id}/${frame}: accessory detached from head`);
      total += bounds.count;
    }
    assert.ok(total > 20, `${id}: invisible accessory`);
    if (id === "shinchan-eyebrow-sticker") {
      assert.equal(alphaBounds(data, 5).count, 0);
      assert.equal(alphaBounds(data, 6).count, 0);
    }
  });
}

test("색칠용 흰 천과 56×32 UV 셀이 픽셀 단위로 일치한다", async () => {
  const template = await image("custom-outfit-template-pirouette.png");
  const uv = await image("custom-outfit-template-pirouette-uv.png");
  assert.deepEqual([template.info.width, template.info.height, uv.info.width, uv.info.height],
    [width, frameHeight, width, frameHeight]);
  for (let frame = 0; frame < frames; frame++) {
    let count = 0;
    for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
      const at = (y * width + frame * frameWidth + x) * 4;
      if (uv.data[at + 3] < 128) continue;
      const encoded = uv.data[at] + (uv.data[at + 1] << 8);
      assert.ok(encoded >= 1 && encoded <= 1792, `UV cell ${encoded}`);
      assert.deepEqual([...template.data.subarray(at, at + 4)], [255, 255, 255, 255]);
      count++;
    }
    assert.ok(count > 250, `frame ${frame}: no paintable fabric`);
    assert.equal(alphaBounds(template.data, frame).bottom, 99);
  }
});

test("모든 wardrobe mirror 시트와 UV는 프레임 순서를 보존한 좌우 반전이다", async () => {
  for (const id of [...outfits, ...accessories, "custom-outfit-template"]) {
    const original = (await image(`${id}-pirouette.png`)).data;
    const mirrored = (await image(`${id}-pirouette-mirror.png`)).data;
    for (let frame = 0; frame < frames; frame++) for (let y = 0; y < frameHeight; y++) {
      for (let x = 0; x < frameWidth; x++) {
        const a = (y * width + frame * frameWidth + x) * 4;
        const b = (y * width + frame * frameWidth + frameWidth - 1 - x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          assert.equal(mirrored[a + channel], original[b + channel], `${id}/${frame}/${x}/${y}`);
        }
      }
    }
  }
  const uv = (await image("custom-outfit-template-pirouette-uv.png")).data;
  const mirrorUv = (await image("custom-outfit-template-pirouette-mirror-uv.png")).data;
  for (let frame = 0; frame < frames; frame++) for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const a = (y * width + frame * frameWidth + x) * 4;
      const b = (y * width + frame * frameWidth + frameWidth - 1 - x) * 4;
      assert.deepEqual(mirrorUv.subarray(a, a + 4), uv.subarray(b, b + 4));
    }
  }
});
