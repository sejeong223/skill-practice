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

test("세 방어만 깡을 내며 마지막에 사모예드5마리를 한 번 부른다", () => {
  const bus = new GameplayEventBus();
  const events = [];
  for (const key of ["clang", "bowl-broken", "stray-dog-surge", "drawback-triggered"]) bus.on(key, payload => events.push({ key, ...payload }));
  const defense = new DefenseToolSystem(bus, TOOL_DEFINITIONS);
  const dogs = new StrayDogEvent(bus, () => ({ x: 500, y: 512 }), { count: 5 });
  const weak = { id: "fish", kind: "weak", damage: 1 };
  assert.equal(defense.tryBlock({ ...weak, kind: "lethal-trap" }, 0).blocked, false);
  assert.equal(defense.getRemainingCharges(), 3);
  const charges = [1, 2, 3].map(now => defense.tryBlock({ ...weak, id: `fish-${now}` }, now).remainingCharges);
  assert.deepEqual(charges, [2, 1, 0]);
  assert.equal(defense.tryBlock({ ...weak, id: "fourth" }, 4).blocked, false);
  assert.deepEqual(events.map(e => e.key), ["clang", "clang", "clang", "bowl-broken", "stray-dog-surge", "drawback-triggered"]);
  assert.equal(events.find(e => e.key === "stray-dog-surge").count, 5);
  assert.equal(dogs.getActiveDogs().length, 5);
  assert.ok(dogs.getActiveDogs().every(d => !d.attacksEnemies && !d.collidesWithPlayer && d.blocksPlayerRoute));
  dogs.clear(); defense.resetForStage(); events.length = 0;
  for (let i = 0; i < 3; i++) defense.tryBlock(weak, i);
  assert.equal(events.filter(e => e.key === "clang").length, 3);
  assert.equal(events.filter(e => e.key === "stray-dog-surge").length, 1);
  dogs.destroy(); defense.resetForStage(); events.length = 0;
  for (let i = 0; i < 3; i++) defense.tryBlock(weak, i);
  assert.equal(events.filter(e => e.key === "stray-dog-surge").length, 0);
});

test("기존 소비자는 사모예드3마리 기본값을 유지한다", () => {
  const bus = new GameplayEventBus(); const dogs = new StrayDogEvent(bus);
  bus.emit("bowl-broken", { toolId: "upside-down-bowl", now: 0 });
  assert.equal(dogs.getActiveDogs().length, 3);
  dogs.destroy();
});
