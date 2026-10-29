import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { advanceCementLump, advanceCementWave, cementTrailBounds, feetTouchCement,
  sweptCementBounds, CEMENT_PUDDLE_MS, CEMENT_SLOW_MS, CEMENT_SLOW_SPEED } from "../src/game/systems/mackerelCementPhysics.ts";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "phaser") return { Geom: { Rectangle: class Rectangle {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height, right: x + width, bottom: y + height }); }
  } } };
  return originalLoad.call(this, request, parent, isMain);
};
const { MackerelConstructionPattern } = require("../src/game/systems/MackerelConstructionPattern.ts");
Module._load = originalLoad;
const { BossEncounter } = require("../src/game/systems/BossEncounter.ts");
const { PlayerController } = require("../src/game/systems/PlayerController.ts");
const { BOSS_COMBAT_CONFIG } = require("../src/game/data/bossCombat.ts");
const { GameplayEventBus } = require("../src/game/core/events.ts");

function patternHarness(attempt = 1) {
  const images = [], sounds = [], sprite = { x: 1280, y: 454, frame: 0,
    setFrame(frame) { this.frame = frame; return this; } };
  const player = { body: { center: { x: 920 }, left: 890, right: 950, bottom: 506 } };
  const image = (x, y, key) => {
    const item = { x, y, key, destroyed: false, setDisplaySize() { return this; }, setDepth() { return this; },
      setAlpha() { return this; }, setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
      setAngle() { return this; }, destroy() { this.destroyed = true; } };
    images.push(item); return item;
  };
  const scene = { add: { image, zone: () => ({ body: { updateFromGameObject() {} }, destroy() {} }) },
    physics: { world: { bounds: { right: 1600 } }, add: { existing() {}, collider: () => ({ destroy() {} }) } } };
  let slowContacts = 0;
  const pattern = new MackerelConstructionPattern(scene, player, sprite, attempt,
    key => sounds.push(key), () => { slowContacts++; });
  return { pattern, player, sprite, images, sounds, getSlowContacts: () => slowContacts };
}

test("세 공격은 각자 전신 준비 프레임과 재질 효과음을 사용하며 바닥 예고가 없다", () => {
  const { pattern, sprite, images, sounds } = patternHarness();
  const kinds = new Set();
  for (let serial = 1; serial <= 3; serial++) {
    pattern.telegraph(920, serial);
    kinds.add(sprite.frame);
    assert.equal(images.filter(image => !image.destroyed).length, 0, "preparation must not add ground marker");
    pattern.launch(920, serial);
    assert.ok([2, 5, 7].includes(sprite.frame));
    pattern.clear();
  }
  assert.deepEqual(kinds, new Set([1, 4, 6]));
  assert.deepEqual(new Set(sounds), new Set(["world-03-boss-brick", "world-03-boss-trowel", "world-03-boss-cement"]));
  assert.equal(BOSS_COMBAT_CONFIG["world-03"].telegraphMs, 300);
  assert.equal(BOSS_COMBAT_CONFIG["world-03"].showWarning, false);
  pattern.destroy();
});

test("파도와 덩어리의 속도·궤적·잔류 범위와 발 접촉을 검증한다", () => {
  assert.equal(advanceCementWave(1000, -1, 500), 982);
  assert.deepEqual(cementTrailBounds(800, -1), { x: 800, y: 493, width: 160, height: 16 });
  assert.equal(CEMENT_PUDDLE_MS, 1500);
  assert.equal(CEMENT_SLOW_MS, 1000);
  assert.equal(CEMENT_SLOW_SPEED, 120);
  const start = { x: 1200, y: 414, startX: 1200, startY: 414, targetX: 800, elapsedMs: 0, durationMs: 700 };
  let motion = start;
  for (let step = 0; step < 7; step++) motion = advanceCementLump(motion, 50).motion;
  assert.ok(motion.y < start.y);
  const bounds = sweptCementBounds(start, motion, 18, 18);
  assert.ok(bounds.width >= 36 && bounds.height >= 36);
  for (let step = 0; step < 7; step++) motion = advanceCementLump(motion, 50).motion;
  assert.equal(motion.x, 800);
  assert.equal(motion.y, 492);
  assert.equal(feetTouchCement({ left: 900, right: 950, bottom: 506 }, { x: 920, width: 96 }), true);
  assert.equal(feetTouchCement({ left: 900, right: 950, bottom: 460 }, { x: 920, width: 96 }), false);
});

test("시멘트 접촉은 즉시 가로 속도를 절반으로 제한하고 1초 뒤 회복한다", () => {
  const player = { body: { velocity: { x: 240, y: 0 }, blocked: { down: true }, touching: { down: false },
    setGravityY() {} }, setVelocityX(value) { this.body.velocity.x = value; },
    setFlipX() {}, setAnimationState() {}, getControlOverride: () => null, isControlLocked: () => false };
  const input = { getSnapshot: () => ({ right: true, left: false, jumpPressed: false }) };
  const tuning = { gravityY: 900, runSpeed: 240, acceleration: 1200, deceleration: 1200,
    coyoteTimeMs: 100, jumpBufferMs: 100 };
  const controller = new PlayerController(player, input, tuning);
  controller.applyCementSlow(1000);
  assert.equal(player.body.velocity.x, 120);
  controller.update(0, 500);
  assert.equal(player.body.velocity.x, 120);
  assert.equal(controller.getCementSlowRemainingMs(), 500);
  controller.update(0, 500);
  assert.equal(controller.getCementSlowRemainingMs(), 0);
  assert.ok(player.body.velocity.x > 120);
  controller.applyCementSlow(1000);
  controller.clearCementSlow();
  assert.equal(controller.getCementSlowRemainingMs(), 0);
});

test("체력 절반 이하 첫 발사 0.8초 뒤 두 번째 준비, 0.3초 뒤 다른 공격 발사", () => {
  const log = { prep: [], launch: [] };
  const scene = { textures: { exists: () => true }, add: {
    graphics: () => ({ setDepth() { return this; }, clear() {}, fillStyle() {}, fillRect() {}, destroy() {} }),
    text: () => ({ setOrigin() { return this; }, setDepth() { return this; }, setVisible() { return this; },
      setText() { return this; }, destroy() {} }),
  }, time: { now: 0, delayedCall() {} } };
  const sprite = { x: 1280, y: 454, texture: { key: "boss" }, setTintFill() { return this; },
    clearTint() { return this; }, setFlipX() { return this; }, setFrame() { return this; } };
  const player = { x: 920, flipX: false, body: { center: { x: 920 } },
    clearTint() {}, setTintFill() {}, unlockControl() {} };
  const pattern = { telegraph: (_x, serial) => log.prep.push(serial),
    launch: (_x, serial) => log.launch.push(serial), update: () => [], clear() {}, destroy() {} };
  const events = new GameplayEventBus();
  const defense = { getToolId: () => "upside-down-bowl", resetForStage() {} };
  const dogs = { clear() {} };
  const boss = new BossEncounter(scene, player, sprite, "world-03-stage-boss", BOSS_COMBAT_CONFIG["world-03"],
    defense, dogs, events, pattern, () => {}, () => {});
  boss.start();
  for (let hit = 0; hit < 5; hit++) boss.acceptToolHit({ attackId: `hit-${hit}`, toolId: "rolled-newspaper",
    kind: "projectile", now: 0, bounds: { x: 1250, y: 450, width: 20, height: 20 }, facing: 1 });
  assert.equal(boss.getState().health, 10);
  const advance = ms => { for (let n = 0; n < ms / 50; n++) boss.update(50); };
  advance(1800);
  assert.deepEqual(log.launch, [1]);
  advance(750);
  assert.equal(log.prep.length, 1);
  advance(50);
  assert.deepEqual(log.prep, [1, 2]);
  advance(300);
  assert.deepEqual(log.launch, [1, 2]);
  advance(100);
  assert.equal(log.prep.length, 2, "combo must not recursively schedule itself");
  boss.destroy();
});
