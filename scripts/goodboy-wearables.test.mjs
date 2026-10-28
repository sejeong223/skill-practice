import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerWearables } = require("../src/game/entities/PlayerWearables.ts");
const { colorizeCustomOutfitPixels, isWhiteSuitPixel } = require("../src/game/entities/customOutfitTexture.ts");
const { createDefaultProgressState } = require("../src/game/core/constants.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");

function harness(missing = new Set()) {
  const listeners = new Map();
  const images = [];
  const scene = {
    textures: { exists: key => !missing.has(key) },
    events: {
      on(name, callback, context) { listeners.set(name, { callback, context }); },
      off(name) { listeners.delete(name); },
    },
    add: { image(x, y, key, frame = 0) {
      const image = { x, y, texture: { key }, frame: { name: frame }, destroyed: false,
        setDepth(value) { this.depth = value; return this; },
        setTexture(next, nextFrame = "__BASE") { this.texture.key = next; this.frame.name = nextFrame; return this; },
        setFrame(value) { this.frame.name = value; return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        setOrigin(nx, ny) { this.originX = nx; this.originY = ny; return this; },
        setScale(nx, ny) { this.scaleX = nx; this.scaleY = ny; return this; },
        setFlipX(value) { this.flipX = value; return this; },
        setVisible(value) { this.visible = value; return this; },
        destroy() { this.destroyed = true; } };
      images.push(image); return image;
    } },
  };
  const player = { scene, x: 100, y: 200, originX: 0.5, originY: 99 / 128,
    scaleX: 1, scaleY: 1, flipX: false, visible: true, active: true, depth: 10,
    texture: { key: "corgi-run" }, frame: { name: 0 }, body: { width: 72, height: 40 },
    appearance: { run: "corgi-run", bark: "corgi-bark", bite: "corgi-bite" },
    getAppearanceTextures() { return this.appearance; },
    setAppearanceTextures(value) { this.appearance = value; },
    setTexture(key, frame = 0) { this.texture.key = key; this.frame.name = frame; return this; },
  };
  const emitPostupdate = () => listeners.get("postupdate")?.callback.call(listeners.get("postupdate").context);
  return { scene, player, images, listeners, emitPostupdate };
}

test("의상은 코기 자체 이미지로 바뀌고 장신구는 달리기·짖기 자세에 맞는다", () => {
  const h = harness();
  const wearables = new PlayerWearables(h.scene, h.player);
  wearables.setEquipment("bee-bodysuit", "prince-crown");
  assert.equal(h.player.texture.key, "wear-bee-bodysuit-run");
  assert.equal(h.player.getAppearanceTextures().bite, "wear-bee-bodysuit-bite");
  assert.equal(h.images.length, 1);
  assert.deepEqual(h.images.map(image => image.texture.key), ["wear-prince-crown-run"]);
  assert.deepEqual(h.images.map(image => image.depth), [11]);
  const body = { ...h.player.body };
  h.player.x = 240; h.player.y = 504; h.player.flipX = true;
  h.player.originY = 104 / 128; h.player.frame.name = 3;
  h.emitPostupdate();
  assert.ok(h.images.every(image => image.x === 240 && image.y === 504 && image.flipX && image.frame.name === 3));
  assert.ok(h.images.every(image => image.originY === 104 / 128));
  assert.deepEqual(h.player.body, body, "dressed sprites must not change collisions");
  h.player.setTexture("wear-bee-bodysuit-bark");
  h.emitPostupdate();
  assert.deepEqual(h.images.map(image => image.texture.key), ["wear-prince-crown-bark"]);
  h.player.setTexture("wear-bee-bodysuit-bite", 2);
  h.emitPostupdate();
  assert.deepEqual(h.images.map(image => image.texture.key), ["wear-prince-crown-run"]);
  h.player.setTexture("wear-bee-bodysuit-run", 0); h.player.visible = false;
  h.emitPostupdate();
  assert.ok(h.images.every(image => image.visible === false && image.frame.name === 0));
  wearables.destroy();
  assert.equal(h.listeners.size, 0);
  assert.ok(h.images.every(image => image.destroyed));
});

test("의상 즉시 교체·벗기기·없는 에셋은 기본 코기 이미지로 복귀한다", () => {
  const h = harness(new Set(["wear-banana-peel-suit-run"]));
  const wearables = new PlayerWearables(h.scene, h.player);
  wearables.setEquipment("bee-bodysuit", "prince-crown");
  wearables.setEquipment("banana-peel-suit", "prince-crown");
  assert.equal(h.player.texture.key, "corgi-run");
  assert.equal(h.images.length, 1, "missing outfit asset should fall back to bare corgi");
  wearables.setEquipment("pink-caterpillar-suit", null);
  assert.equal(h.player.texture.key, "wear-pink-caterpillar-suit-run");
  assert.equal(h.images[0].destroyed, true);
  wearables.setEquipment(null, null);
  assert.equal(h.player.texture.key, "corgi-run");
  wearables.destroy();
});

test("물기 텍스처만 빠진 의상은 옷을 유지하고 물기 연출만 생략한다", () => {
  const h = harness(new Set(["wear-banana-peel-suit-bite"]));
  const wearables = new PlayerWearables(h.scene, h.player);
  wearables.setEquipment("banana-peel-suit", null);
  assert.equal(h.player.texture.key, "wear-banana-peel-suit-run");
  assert.equal(h.player.getAppearanceTextures().bite, null);
  wearables.destroy();
});

test("외형 장착 이벤트는 저장에서 다시 복원된다", async () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  const bus = new GameEventBus();
  const save = new AutoSaveCoordinator(store, progress, bus, 0);
  progress.ownedCosmeticIds.push("bee-bodysuit", "prince-crown");
  progress.equippedOutfitId = "bee-bodysuit";
  progress.equippedAccessoryId = "prince-crown";
  bus.emit("cosmetic-change-requested", { outfitId: "bee-bodysuit", accessoryId: "prince-crown" });
  await new Promise(resolve => setTimeout(resolve, 5));
  const loaded = store.load();
  assert.equal(loaded.equippedOutfitId, "bee-bodysuit");
  assert.equal(loaded.equippedAccessoryId, "prince-crown");
  save.destroy();
});

test("직접 그린 색은 달리기·물기 네 프레임과 짖기에 칠하고 외곽선은 보존한다", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const design = { id: "custom-outfit-1", cells: Array(56 * 32).fill("#E95F68"), updatedAt: "2026-10-22T00:00:00.000Z" };
  for (const [pose, frames] of [["run", 4], ["bark", 1], ["bite", 4]]) {
    const { data, info } = await sharp(path.join(root, `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-${pose}.png`))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const source = new Uint8ClampedArray(data);
    const colored = colorizeCustomOutfitPixels(source, info.width, info.height, pose, design);
    for (let frame = 0; frame < frames; frame++) {
      let redPixels = 0;
      for (let y = 0; y < 128; y++) for (let x = frame * 112; x < (frame + 1) * 112; x++) {
        const offset = (y * info.width + x) * 4;
        if (colored[offset] === 0xE9 && colored[offset + 1] === 0x5F && colored[offset + 2] === 0x68) redPixels++;
        if (source[offset + 3] === 0) assert.equal(colored[offset + 3], 0);
        if (source[offset] < 100 && source[offset + 3] > 200) {
          assert.deepEqual([...colored.slice(offset, offset + 3)], [...source.slice(offset, offset + 3)]);
        }
      }
      assert.ok(redPixels > 350, `${pose} frame ${frame} must contain the painted garment`);
    }
  }
});

test("사용자 옷 교체·재저장·파괴 때 해당 장면의 동적 텍스처만 정리한다", () => {
  const h = harness();
  const dynamic = new Set();
  const removed = [];
  h.scene.textures = {
    exists: key => dynamic.has(key) || key.startsWith("custom-outfit-template") || key.startsWith("corgi-"),
    get: () => ({ getSourceImage: () => ({}) }),
    addCanvas: key => {
      dynamic.add(key);
      return { add: () => ({}), refresh: () => {} };
    },
    remove: key => { removed.push(key); dynamic.delete(key); },
  };
  const originalDocument = global.document;
  global.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {}, clearRect() {}, getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4); data.fill(255); return { data };
    }, putImageData() {} }),
  }) };
  try {
    const wearables = new PlayerWearables(h.scene, h.player);
    const design = { id: "custom-outfit-1", cells: Array(56 * 32).fill("#123456"), updatedAt: "2026-10-22T00:00:00.000Z" };
    wearables.setEquipment(null, null, design);
    assert.equal(dynamic.size, 3);
    assert.ok(h.player.getAppearanceTextures().bite.endsWith("-bite"));
    assert.ok(h.player.texture.key.includes("wear-custom-custom-outfit-1"));
    h.player.frame.name = 3; h.player.flipX = true; h.emitPostupdate();
    assert.equal(h.player.frame.name, 3);
    h.player.setTexture(h.player.getAppearanceTextures().bite, 2); h.emitPostupdate();
    assert.ok(h.player.texture.key.endsWith("-bite"));
    wearables.setEquipment(null, null, { ...design, updatedAt: "2026-10-22T00:00:01.000Z" });
    assert.equal(dynamic.size, 3);
    assert.equal(removed.length, 3);
    assert.ok(h.player.texture.key.endsWith("-bite"));
    assert.equal(h.player.frame.name, 2);
    wearables.destroy();
    assert.equal(dynamic.size, 0);
    assert.equal(removed.length, 6);
  } finally {
    global.document = originalDocument;
  }
});

test("painted white suit remains fitted in every running, barking and biting frame", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const design = { id: "custom-outfit-1", cells: Array(56 * 32).fill("#E95F68"), updatedAt: "2026-10-22T00:00:00.000Z" };
  for (const [pose, frames] of [["run", 4], ["bark", 1], ["bite", 4]]) {
    const width = frames * 112;
    const template = await sharp(path.join(root, `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-${pose}.png`))
      .ensureAlpha().raw().toBuffer();
    const source = new Uint8ClampedArray(template);
    const colored = colorizeCustomOutfitPixels(source, width, 128, pose, design);
    for (let frame = 0; frame < frames; frame++) {
      let painted = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
        const index = (y * width + frame * 112 + x) * 4;
        if (isWhiteSuitPixel(source, width, frame * 112 + x, y)) {
          assert.deepEqual([...colored.subarray(index, index + 3)], [0xE9, 0x5F, 0x68]);
          painted++;
        } else {
          assert.deepEqual([...colored.subarray(index, index + 4)], [...template.subarray(index, index + 4)],
            `${pose}/${frame}: non-fabric pixels changed`);
        }
      }
      assert.ok(painted > 900, `${pose}/${frame}: painted suit disappeared`);
    }
  }
});
