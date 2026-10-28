import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = filename => ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText;
require.extensions[".ts"] = (module, filename) => module._compile(compile(filename), filename);

const { STAGE_IDS, createDefaultProgressState } = require("../src/game/core/constants.ts");
const { getWorld03Entry } = require("../src/game/systems/world03IntroRouting.ts");

class SceneMock {
  constructor(key) {
    this.key = key;
    this.values = new Map();
    this.registry = { get: name => this.values.get(name) };
    this.starts = [];
    this.scene = { start: (sceneKey, data) => this.starts.push({ sceneKey, data }) };
  }
}

function loadScene(relativePath, mocks = {}) {
  const filename = path.resolve(relativePath);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = id => id === "phaser"
    ? { Scene: SceneMock }
    : id in mocks ? mocks[id] : originalRequire(id);
  loaded._compile(compile(filename), filename);
  return loaded.exports;
}

const { PreloadScene } = loadScene("src/game/scenes/PreloadScene.ts", {
  "../assets/assetManifest": { PIXEL_ASSETS: [] },
});
const { World01SkillUnlockScene } = loadScene("src/game/scenes/World01SkillUnlockScene.ts");

function world03Progress() {
  const progress = createDefaultProgressState("초코");
  progress.onboardingCompleted = true;
  progress.selectedWorldId = null;
  progress.clearedStages.push(...STAGE_IDS.slice(0, STAGE_IDS.indexOf("world-03-stage-1")));
  return progress;
}

function preload(progress, development = false) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = development ? "development" : "production";
  try {
    const scene = new PreloadScene();
    scene.values.set("progressState", progress);
    scene.create();
    return scene.starts;
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function unlock(progress, stageId = "world-02-stage-boss") {
  const scene = new World01SkillUnlockScene();
  scene.values.set("progressState", progress);
  scene.canContinue = true;
  scene.stageData = {
    stageId,
    nextStageId: stageId === "world-02-stage-boss" ? "world-03-stage-1" : "world-02-stage-1",
    skillId: stageId === "world-02-stage-boss" ? "bite" : "bark",
  };
  scene.continueToStageClear();
  return scene.starts;
}

test("첫 방문 판별은 본 기록만 읽고 원본을 변경하지 않는다", () => {
  const progress = createDefaultProgressState("초코");
  assert.deepEqual(getWorld03Entry(progress), {
    sceneKey: "World03EntranceScene", data: { nextStageId: "world-03-stage-1" },
  });
  assert.deepEqual(progress.seenCutsceneIds, []);
  progress.seenCutsceneIds.push("world-03-intro");
  assert.deepEqual(getWorld03Entry(progress), {
    sceneKey: "StageScene", data: { stageId: "world-03-stage-1", playerName: "초코" },
  });
  assert.deepEqual(progress.seenCutsceneIds, ["world-03-intro"]);
});

test("물기 모달 이후 처음에는 인트로, 재방문은 스테이지로 이어진다", () => {
  const progress = world03Progress();
  assert.deepEqual(unlock(progress), [getWorld03Entry(progress)]);
  progress.seenCutsceneIds.push("world-03-intro");
  assert.deepEqual(unlock(progress), [getWorld03Entry(progress)]);
  const world01 = unlock(progress, "world-01-stage-boss");
  assert.deepEqual(world01, [{ sceneKey: "World01StageClearScene", data: {
    stageId: "world-01-stage-boss", nextStageId: "world-02-stage-1",
  } }]);
});

test("일반 저장 복귀는 월드 3 첫 스테이지만 인트로로 보내고 후속 진행을 유지한다", () => {
  const progress = world03Progress();
  assert.deepEqual(preload(progress), [getWorld03Entry(progress)]);
  progress.seenCutsceneIds.push("world-03-intro");
  assert.deepEqual(preload(progress), [getWorld03Entry(progress)]);
  progress.seenCutsceneIds.length = 0;
  progress.clearedStages.push("world-03-stage-1");
  assert.deepEqual(preload(progress), [{ sceneKey: "StageScene", data: {
    stageId: "world-03-stage-2", playerName: "초코",
  } }]);
});

test("선택한 월드 1·2 재도전은 월드 3 미시청 기록보다 우선한다", () => {
  const progress = world03Progress();
  progress.selectedWorldId = "world-02";
  assert.deepEqual(preload(progress), [{ sceneKey: "StageScene", data: {
    stageId: "world-02-stage-1", playerName: "초코",
  } }]);
  progress.selectedWorldId = "world-01";
  assert.equal(preload(progress)[0].sceneKey, "StageScene");
  assert.ok(preload(progress)[0].data.stageId.startsWith("world-01-"));
});

test("개발 모드는 첫 실행에 인트로, 본 기록이 있는 재시작에 첫 스테이지다", () => {
  const progress = world03Progress();
  assert.deepEqual(preload(progress, true), [getWorld03Entry(progress)]);
  progress.seenCutsceneIds.push("world-03-intro");
  assert.deepEqual(preload(progress, true), [getWorld03Entry(progress)]);
  const shell = fs.readFileSync("src/components/game/GameShell.tsx", "utf8");
  assert.match(shell, /prepareDevelopmentWorld03Progress/);
});
