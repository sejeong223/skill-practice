import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { DeathSystem } = require("../src/game/systems/DeathSystem.ts");
const { GameplayEventBus } = require("../src/game/core/events.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { createDefaultProgressState, createRuntimeStageState } = require("../src/game/core/constants.ts");

function setup() {
  const progress = createDefaultProgressState();
  progress.deathsTotal = 7;
  progress.deathsByStage["world-01-stage-4"] = 3;
  progress.bankedCoins = 57;
  const runtime = createRuntimeStageState("world-01-stage-4");
  runtime.currentStageCoins = 2;
  const events = [];
  const bus = new GameplayEventBus();
  const persistence = new GameEventBus();
  for (const type of ["death", "death-count-updated"]) persistence.on(type, payload => events.push({ type, payload }));
  bus.on("death", payload => events.push({ type: "gameplay-death", payload }));
  const state = { status: "play", restarts: 0, onRestart: () => {} };
  const controller = { restartAtCheckpointOrSpawn() { state.restarts++; state.onRestart(); } };
  const system = new DeathSystem(progress, runtime, controller, bus, persistence, () => state.status === "play");
  const request = extra => bus.emit("death-requested", {
    stageId: runtime.stageId, cause: "trap", checkpointId: null, now: 100, ...extra,
  });
  return { system, state, progress, runtime, events, request, bus };
}

test("한 업데이트의 순차·재진입 사망 요청은 통계와 부활을 한 번만 발생시킨다", async () => {
  const s = setup();
  const attemptBefore = s.runtime.attempt;
  s.state.onRestart = () => s.request();
  s.bus.on("death", () => s.request());
  s.request();
  s.request({ cause: "fall" });
  s.request({ cause: "enemy" });
  assert.equal(s.progress.deathsTotal, 8);
  assert.equal(s.progress.deathsByStage["world-01-stage-4"], 4);
  assert.equal(s.runtime.attempt, attemptBefore + 1);
  assert.equal(s.state.restarts, 1);
  assert.equal(s.events.length, 3);
  assert.equal(s.runtime.currentStageCoins, 0);
  assert.equal(s.progress.bankedCoins, 57);

  await Promise.resolve();
  s.request();
  assert.equal(s.progress.deathsTotal, 9);
  assert.equal(s.state.restarts, 2);
  s.system.destroy();
});

test("다른 스테이지와 비플레이 상태의 사망 요청은 저장하지 않는다", async () => {
  const s = setup();
  s.request({ stageId: "world-01-stage-boss" });
  s.request({ stageId: "invalid" });
  for (const status of ["enter", "paused", "cutscene", "dying", "completed"]) {
    s.state.status = status;
    s.request();
    await Promise.resolve();
  }
  assert.equal(s.progress.deathsTotal, 7);
  assert.equal(s.state.restarts, 0);
  assert.equal(s.events.length, 0);
  assert.equal(s.runtime.currentStageCoins, 2);
  s.state.status = "play";
  s.request();
  assert.equal(s.progress.deathsTotal, 8);
  s.system.destroy();
});

test("씬 정리 이후 남은 직접 호출과 이벤트는 사망을 추가하지 않는다", async () => {
  const s = setup();
  s.request();
  s.system.destroy();
  await Promise.resolve();
  s.request();
  s.system.handleDeath({ stageId: s.runtime.stageId, cause: "fall", checkpointId: null });
  assert.equal(s.progress.deathsTotal, 8);
  assert.equal(s.state.restarts, 1);
});
