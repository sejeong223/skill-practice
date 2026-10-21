import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { GameplayEventBus } = require("../src/game/core/events.ts");
const { DefenseToolSystem } = require("../src/game/systems/DefenseToolSystem.ts");
const { StrayDogEvent } = require("../src/game/systems/StrayDogEvent.ts");
const { TOOL_DEFINITIONS } = require("../src/game/data/tools.ts");
const { EquipmentVisual } = require("../src/game/entities/EquipmentVisual.ts");

const frontFish = { id: "fish", kind: "weak", damage: 1, sourceX: 1200, defenderX: 500, facing: 1, projectile: true };
const rearFish = { ...frontFish, sourceX: 100 };

function harness(toolId) {
  const bus = new GameplayEventBus();
  const events = [];
  for (const type of ["clang", "bowl-broken", "shield-blocked", "shield-broken", "stray-dog-surge", "drawback-triggered"])
    bus.on(type, payload => events.push({ type, ...payload }));
  const dogs = new StrayDogEvent(bus, () => ({ x: 500, y: 512 }), { count: 5 });
  const defense = new DefenseToolSystem(bus, TOOL_DEFINITIONS);
  defense.setDefenseTool(toolId);
  return { bus, events, dogs, defense };
}

test("쿠션은 정면 두 번만 막고 깨질 때 옆밀림 단점만 공개한다", () => {
  const h = harness("cushion-pad");
  assert.equal(h.defense.tryBlock(rearFish, 1).reason, "wrong-direction");
  assert.equal(h.defense.getRemainingCharges(), 2);
  assert.deepEqual([1, 2].map(now => h.defense.tryBlock({ ...frontFish, id: `fish-${now}` }, now).remainingCharges), [1, 0]);
  assert.equal(h.defense.tryBlock(frontFish, 3).blocked, false);
  assert.equal(h.events.filter(event => event.type === "shield-blocked").length, 2);
  assert.deepEqual(h.events.filter(event => event.type === "drawback-triggered").map(event => event.drawbackId), ["cushion-side-bounce"]);
  assert.equal(h.events.filter(event => event.type === "stray-dog-surge").length, 0);
  h.dogs.destroy();
});

test("피자 상자는 두 번 막을 때마다 350ms 미끄럼 단점을 발동한다", () => {
  const h = harness("greasy-pizza-box");
  assert.equal(h.defense.tryBlock(frontFish, 1).blocked, true);
  assert.equal(h.defense.tryBlock(frontFish, 2).blocked, true);
  assert.deepEqual(h.events.filter(event => event.type === "drawback-triggered").map(event => event.drawbackId),
    ["pizza-grease-slide", "pizza-grease-slide"]);
  assert.equal(h.dogs.getActiveDogs().length, 0);
  h.dogs.destroy();
});

test("우산은 앞의 투사체 두 번만 막고 뒤쪽 공격은 통과한다", () => {
  const h = harness("umbrella");
  assert.equal(h.defense.tryBlock({ ...frontFish, projectile: false }, 1).reason, "unsupported-kind");
  assert.equal(h.defense.tryBlock(rearFish, 2).reason, "wrong-direction");
  assert.ok(h.events.some(event => event.drawbackId === "umbrella-rear-gap"));
  assert.deepEqual([3, 4].map(now => h.defense.tryBlock(frontFish, now).remainingCharges), [1, 0]);
  assert.equal(h.defense.tryBlock({ ...frontFish, kind: "lethal-trap" }, 5).blocked, false);
  assert.equal(h.dogs.getActiveDogs().length, 0);
  h.dogs.destroy();
});

test("양은 뚜껑은 세 번 막아도 개를 부르지 않고 마지막에 귀울림 단점만 발동한다", () => {
  const h = harness("yellow-pot-lid");
  assert.deepEqual([1, 2, 3].map(now => h.defense.tryBlock(frontFish, now).remainingCharges), [2, 1, 0]);
  assert.deepEqual(h.events.filter(event => event.type === "drawback-triggered").map(event => event.drawbackId), ["pot-lid-ear-ringing"]);
  assert.equal(h.events.filter(event => event.type === "bowl-broken").length, 0);
  h.bus.emit("bowl-broken", { toolId: "yellow-pot-lid", now: 10 });
  assert.equal(h.dogs.getActiveDogs().length, 0, "other tool must never trigger bowl dog surge");
  h.dogs.destroy();
});

test("방패 교체와 재시작은 선택한 방패의 방어 횟수를 복원한다", () => {
  const h = harness("cushion-pad");
  h.defense.tryBlock(frontFish, 1);
  assert.equal(h.defense.getRemainingCharges(), 1);
  assert.equal(h.defense.setDefenseTool("yellow-pot-lid"), true);
  assert.equal(h.defense.getRemainingCharges(), 3);
  assert.equal(h.defense.setDefenseTool("rolled-newspaper"), false);
  assert.equal(h.defense.getToolId(), "yellow-pot-lid");
  h.defense.tryBlock(frontFish, 2);
  h.defense.resetForStage(h.defense.getToolId());
  assert.equal(h.defense.getRemainingCharges(), 3);
  h.dogs.destroy();
});

test("소진된 방패는 코기 앞에서 사라지고 교체하면 다시 보인다", () => {
  const listeners = new Map(), images = [];
  const scene = { time: { now: 0 }, textures: { exists: () => true },
    events: { on: (name, callback, context) => listeners.set(name, { callback, context }), off: name => listeners.delete(name) },
    add: { image(x, y, key) {
      const image = { x, y, key, setDepth() { return this; }, setPosition() { return this; }, setFlipX() { return this; },
        setAngle() { return this; }, setDisplaySize() { return this; }, setVisible(value) { this.visible = value; return this; },
        destroy() { this.destroyed = true; } }; images.push(image); return image;
    } },
  };
  const player = { scene, x: 100, y: 200, depth: 10, flipX: false, visible: true, active: true };
  const visual = new EquipmentVisual(scene, player);
  visual.setTools("rabbit-slipper", "cushion-pad");
  visual.setShieldCharges(2); assert.equal(images[0].visible, true);
  visual.setShieldCharges(0); assert.equal(images[0].visible, false);
  visual.setTools("rabbit-slipper", "umbrella"); visual.setShieldCharges(2);
  assert.equal(images[1].visible, true);
  visual.destroy(); assert.equal(listeners.size, 0);
});
