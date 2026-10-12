import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { CheckpointSystem } = require("../src/game/systems/CheckpointSystem.ts");
const { GameplayEventBus } = require("../src/game/core/events.ts");
const { createRuntimeStageState } = require("../src/game/core/constants.ts");

function setup() {
  const bus = new GameplayEventBus();
  const events = [];
  bus.on("checkpoint-reached", event => events.push(event));
  const runtime = createRuntimeStageState("world-01-stage-4", 123);
  const system = new CheckpointSystem({}, bus, "world-01-stage-4", runtime, undefined, id => id === "fake");
  return { system, runtime, events };
}

test("첫 체크포인트 활성화만 한 번 알리고 새 시도는 다시 알린다", () => {
  const { system, runtime, events } = setup();
  assert.equal(system.activate("real", 500, 512, 1, 10), true);
  assert.equal(system.activate("real", 505, 512, 1, 11), false);
  assert.equal(events.length, 1);
  assert.equal(runtime.checkpointId, "real");
  assert.equal(system.getSnapshot().x, 500);
  system.resetForStage();
  assert.equal(system.activate("real", 510, 512, -1, 20), true);
  assert.equal(events.length, 2);
});

test("가짜 체크포인트는 저장과 효과음 이벤트를 만들지 않는다", () => {
  const { system, runtime, events } = setup();
  assert.equal(system.activate("fake", 500, 512, 1, 10), false);
  assert.equal(system.getSnapshot(), null);
  assert.equal(runtime.checkpointId, null);
  assert.equal(events.length, 0);
});

test("자동 복원은 동일한 저장 상태를 만들지만 차임을 반복하지 않는다", () => {
  const normal = setup();
  const silent = setup();
  assert.equal(normal.system.activate("real", 500, 512, 1, 10), true);
  assert.equal(silent.system.activate("real", 500, 512, 1, 10, { silent: true }), true);
  assert.deepEqual(silent.system.getSnapshot(), normal.system.getSnapshot());
  assert.deepEqual(silent.runtime, normal.runtime);
  assert.equal(silent.system.activate("real", 510, 512, 1, 20), false);
  assert.equal(silent.events.length, 0);
});
