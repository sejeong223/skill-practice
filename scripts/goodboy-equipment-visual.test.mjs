import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { EquipmentVisual } = require("../src/game/entities/EquipmentVisual.ts");
const { CombatSystem } = require("../src/game/systems/CombatSystem.ts");
const { GameplayEventBus } = require("../src/game/core/events.ts");
const { TOOL_DEFINITIONS } = require("../src/game/data/tools.ts");

function harness() {
  const images = [], listeners = new Map();
  const scene = {
    time: { now: 1000 }, textures: { exists: () => true },
    events: { on: (name, callback, context) => listeners.set(name, { callback, context }), off: name => listeners.delete(name) },
    add: { image(x, y, key) {
      const image = { x, y, texture: { key }, destroyed: false,
        setDepth(value) { this.depth = value; return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        setAngle(value) { this.angle = value; return this; },
        setFlipX(value) { this.flipX = value; return this; },
        setDisplaySize(width, height) { this.width = width; this.height = height; return this; },
        setVisible(value) { this.visible = value; return this; },
        destroy() { this.destroyed = true; } };
      images.push(image); return image;
    } },
  };
  const player = { scene, x: 100, y: 200, flipX: false, active: true, visible: true, depth: 10 };
  return { scene, player, images, listeners };
}

test("장착 무기와 방패가 코기의 전면에서 방향과 공격 동작을 따른다", () => {
  const h = harness();
  const visual = new EquipmentVisual(h.scene, h.player);
  visual.setTools("rolled-newspaper", "umbrella");
  assert.deepEqual(h.images.map(image => image.texture.key), ["held-rolled-newspaper", "held-umbrella"]);
  assert.deepEqual(h.images.map(image => image.depth), [11, 13]);
  assert.ok(h.images.every(image => image.x > h.player.x));
  h.player.flipX = true; h.player.x = 300;
  visual.sync();
  assert.ok(h.images.every(image => image.x < h.player.x && image.flipX));
  const heldX = h.images[0].x;
  visual.showAttack(1000, "melee");
  h.scene.time.now = 1100; visual.sync();
  assert.ok(h.images[0].x < heldX, "weapon should swing forward");
  visual.setTools("squeaky-ball", "cushion-pad");
  assert.ok(h.images.slice(0, 2).every(image => image.destroyed));
  visual.setEnabled(false);
  assert.ok(h.images.slice(2).every(image => !image.visible));
  visual.destroy();
  assert.equal(h.listeners.size, 0);
  assert.ok(h.images.every(image => image.destroyed));
});

test("새 무기는 기본 슬리퍼 콤보 이벤트를 발생시키지 않는다", () => {
  const bus = new GameplayEventBus();
  const events = [];
  bus.on("slipper-hit", () => events.push("slipper"));
  const scene = { add: { image: () => ({ setDisplaySize() { return this; }, setDepth() { return this; }, setFlipX() { return this; }, destroy() {} }) },
    physics: { world: { bounds: { left: 0, right: 2000, top: 0, bottom: 720 } } } };
  const player = { scene, body: { center: { x: 100, y: 480 } }, x: 100, y: 500, depth: 10,
    setAnimationState() {}, lockControl() {}, unlockControl() {}, setVelocityX() {}, setVelocityY() {}, flipX: false };
  const combat = new CombatSystem(player, bus, TOOL_DEFINITIONS);
  combat.setAttackTool("squeaky-ball");
  assert.equal(combat.tryAttack(1000).kind, "tool-preview");
  assert.equal(combat.tryAttack(1100).accepted, false);
  assert.deepEqual(events, []);
  combat.setAttackTool("rabbit-slipper");
  assert.equal(combat.tryAttack(1400).kind, "slipper-hit");
  assert.deepEqual(events, ["slipper"]);
});
