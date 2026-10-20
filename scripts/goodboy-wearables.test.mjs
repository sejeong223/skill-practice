import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerWearables } = require("../src/game/entities/PlayerWearables.ts");
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
    texture: { key: "corgi-run" }, frame: { name: 0 }, body: { width: 72, height: 40 } };
  const emitPostupdate = () => listeners.get("postupdate")?.callback.call(listeners.get("postupdate").context);
  return { scene, player, images, listeners, emitPostupdate };
}

test("의상·장신구가 코기 4프레임·방향·정지·짖기 포즈에 붙는다", () => {
  const h = harness();
  const wearables = new PlayerWearables(h.scene, h.player);
  wearables.setEquipment("bee-bodysuit", "prince-crown");
  assert.equal(h.images.length, 2);
  assert.deepEqual(h.images.map(image => image.texture.key), ["wear-bee-bodysuit-run", "wear-prince-crown-run"]);
  assert.deepEqual(h.images.map(image => image.depth), [11, 12]);
  const body = { ...h.player.body };
  h.player.x = 240; h.player.y = 504; h.player.flipX = true;
  h.player.originY = 104 / 128; h.player.frame.name = 3;
  h.emitPostupdate();
  assert.ok(h.images.every(image => image.x === 240 && image.y === 504 && image.flipX && image.frame.name === 3));
  assert.ok(h.images.every(image => image.originY === 104 / 128));
  assert.deepEqual(h.player.body, body, "wearable layers must not change collisions");
  h.player.texture.key = "corgi-bark"; h.player.frame.name = "__BASE";
  h.emitPostupdate();
  assert.deepEqual(h.images.map(image => image.texture.key), ["wear-bee-bodysuit-bark", "wear-prince-crown-bark"]);
  h.player.texture.key = "corgi-run"; h.player.frame.name = 0; h.player.visible = false;
  h.emitPostupdate();
  assert.ok(h.images.every(image => image.visible === false && image.frame.name === 0));
  wearables.destroy();
  assert.equal(h.listeners.size, 0);
  assert.ok(h.images.every(image => image.destroyed));
});

test("즉시 교체·벗기기·없는 에셋은 기존 코기 표시를 방해하지 않는다", () => {
  const h = harness(new Set(["wear-banana-peel-suit-run"]));
  const wearables = new PlayerWearables(h.scene, h.player);
  wearables.setEquipment("bee-bodysuit", "prince-crown");
  const firstBody = h.images[0];
  wearables.setEquipment("banana-peel-suit", "prince-crown");
  assert.equal(firstBody.destroyed, true);
  assert.equal(h.images.length, 2, "missing outfit asset should be skipped");
  wearables.setEquipment("pink-caterpillar-suit", null);
  assert.equal(h.images.length, 3);
  assert.equal(h.images[1].destroyed, true);
  assert.equal(h.images[2].texture.key, "wear-pink-caterpillar-suit-run");
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
