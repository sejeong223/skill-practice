import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { CombatSystem } = require("../src/game/systems/CombatSystem.ts");
const { WeaponHitTracker } = require("../src/game/systems/weaponHitbox.ts");
const { GameplayEventBus } = require("../src/game/core/events.ts");
const { TOOL_DEFINITIONS } = require("../src/game/data/tools.ts");
const { DrawbackDiscovery } = require("../src/game/systems/DrawbackDiscovery.ts");
const { createDefaultProgressState } = require("../src/game/core/constants.ts");

function harness() {
  const events = [], images = [], locks = new Set();
  const bus = new GameplayEventBus();
  for (const type of ["weapon-fired", "weapon-hit", "drawback-triggered"]) bus.on(type, data => events.push({ type, ...data }));
  const scene = {
    add: {
      image(x, y, key) {
        const image = { x, y, key, destroyed: false,
          setDisplaySize() { return this; }, setDepth() { return this; }, setFlipX() { return this; },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this; }, setAngle() { return this; },
          destroy() { this.destroyed = true; } };
        images.push(image); return image;
      },
      ellipse() { return { setDepth() { return this; }, destroy() { this.destroyed = true; } }; },
    },
    physics: { world: { bounds: { left: 0, right: 2000, top: 0, bottom: 720 } } },
  };
  const player = { scene, x: 1100, y: 505, flipX: false, depth: 10,
    body: { center: { x: 1100, y: 479 } },
    lockControl: reason => locks.add(reason), unlockControl: reason => locks.delete(reason),
    setAnimationState() {}, setVelocityX() {}, setVelocityY() {} };
  const combat = new CombatSystem(player, bus, TOOL_DEFINITIONS);
  return { bus, combat, events, images, locks, player };
}

function advance(combat, start, duration) {
  for (let passed = 50; passed <= duration; passed += 50) combat.update(start + passed, 50);
}

test("신문지 사거리는 24px 길고 450ms 후딜레이, 효자손은 위로 닿아 명중 후 18px 밀린다", () => {
  const h = harness();
  h.combat.setAttackTool("rolled-newspaper");
  const paper = h.combat.tryAttack(1000);
  assert.equal(paper.contacts.length, 1);
  assert.equal(paper.contacts[0].bounds.width, 120);
  assert.equal(h.combat.tryAttack(1100).accepted, false);
  advance(h.combat, 1000, 450);
  assert.equal(h.combat.tryAttack(1450).accepted, true);
  assert.ok(h.events.some(event => event.drawbackId === "newspaper-slow-recovery"));
  h.combat.setAttackTool("pink-backscratcher");
  const scratch = h.combat.tryAttack(1500).contacts[0];
  assert.equal(scratch.bounds.y, h.player.body.center.y - 125);
  h.combat.registerHit(scratch);
  assert.equal(h.player.x, 1082);
  assert.ok(h.events.some(event => event.drawbackId === "backscratcher-recoil"));
  h.combat.destroy();
});

test("삑삑이 공은 한 번 튀고 세 번째 투척 때 고양이 그림자에 잠시 막힌다", () => {
  const h = harness();
  h.combat.setAttackTool("squeaky-ball");
  for (let index = 0; index < 3; index++) {
    assert.equal(h.combat.tryAttack(1000 + index * 350).accepted, true);
    advance(h.combat, 1000 + index * 350, 350);
  }
  assert.equal(h.events.filter(event => event.drawbackId === "squeak-summons-cats").length, 1);
  assert.ok(h.locks.has("squeaky-cat-shadows"));
  advance(h.combat, 2050, 500);
  assert.ok(!h.locks.has("squeaky-cat-shadows"));
  assert.ok(h.images.some(image => image.key === "held-squeaky-ball"));
  h.combat.destroy();
  assert.ok(h.images.every(image => image.destroyed));
});

test("부메랑은 회수 전 재투척이 막히고 원반은 빗나간 뒤 900ms 대기한다", () => {
  const h = harness();
  h.combat.setAttackTool("drumstick-boomerang");
  assert.equal(h.combat.tryAttack(1000).accepted, true);
  h.combat.update(1300, 300);
  assert.equal(h.combat.tryAttack(1300).accepted, false);
  for (let i = 0; i < 30; i++) h.combat.update(1300 + i * 50, 50);
  assert.equal(h.combat.tryAttack(3000).accepted, true);
  h.combat.setAttackTool("plastic-frisbee");
  assert.equal(h.combat.tryAttack(3100).accepted, true);
  for (let i = 0; i < 40; i++) h.combat.update(3150 + i * 50, 50);
  assert.ok(h.events.some(event => event.drawbackId === "frisbee-miss-cooldown"));
  assert.equal(h.combat.tryAttack(5200).accepted, false);
  for (let i = 0; i < 18; i++) h.combat.update(5250 + i * 50, 50);
  assert.equal(h.combat.tryAttack(6200).accepted, true);
  h.combat.destroy();
});

test("같은 공격 ID는 왕복 프레임에서 1회만 맞고 단점 발견도 1회 저장한다", () => {
  const h = harness();
  const tracker = new WeaponHitTracker();
  const contact = { attackId: "bone-1", toolId: "drumstick-boomerang", kind: "projectile", facing: 1, now: 1000,
    bounds: { x: 1220, y: 440, width: 60, height: 50 } };
  const boss = { x: 1232, y: 424, width: 96, height: 96 };
  assert.equal(tracker.accept(contact, boss), true);
  assert.equal(tracker.accept(contact, boss), false);
  tracker.reset();
  assert.equal(tracker.accept(contact, boss), true);
  const progress = createDefaultProgressState();
  const persistence = { emit: (...args) => h.events.push({ type: "saved", args }) };
  const discovery = new DrawbackDiscovery(progress, h.bus, persistence);
  h.bus.emit("drawback-triggered", { toolId: "rolled-newspaper", drawbackId: "newspaper-slow-recovery", now: 1 });
  h.bus.emit("drawback-triggered", { toolId: "rolled-newspaper", drawbackId: "newspaper-slow-recovery", now: 2 });
  assert.deepEqual(progress.discoveredDrawbackIds, ["newspaper-slow-recovery"]);
  assert.equal(h.events.filter(event => event.type === "saved").length, 1);
  discovery.destroy(); h.combat.destroy();
});
