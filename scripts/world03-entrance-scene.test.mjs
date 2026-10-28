import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
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

const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { WORLD03_ENTRANCE_CUTSCENE } = require("../src/game/data/cutscenes/worlds.ts");
globalThis.window = { innerWidth: 1280 };

const audioInstances = [];
class AudioManagerMock {
  constructor(_scene, _gameplayBus, eventBus) {
    this.sounds = [];
    this.music = [];
    this.destroyed = false;
    this.unsubscribe = eventBus.on("cutscene-beat", ({ beat }) => {
      if (beat.soundCue) this.playSfx(beat.soundCue);
      if (beat.musicKey) this.music.push(beat.musicKey);
    });
    audioInstances.push(this);
  }
  playSfx(key) { this.sounds.push(key); }
  destroy() { this.destroyed = true; this.unsubscribe(); }
}

function gameObject(width = 1254, height = 1254) {
  return {
    width, height, scaleX: 1, scaleY: 1, destroyed: false,
    setDisplaySize(displayWidth, displayHeight) { this.displayWidth = displayWidth; this.displayHeight = displayHeight; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setOrigin() { return this; },
    destroy() { this.destroyed = true; },
  };
}

class SceneMock {
  constructor(key) {
    this.key = key;
    const emitter = new EventEmitter();
    this.events = {
      once: (name, callback, context) => emitter.once(name, (...args) => callback.apply(context, args)),
      emit: (name, ...args) => emitter.emit(name, ...args),
    };
    this.timers = [];
    this.images = [];
    this.starts = [];
    this.fadeOuts = [];
    this.tweenCalls = [];
    this.registryValues = new Map();
    this.missingTexture = null;
    this.registry = { get: key => this.registryValues.get(key) };
    this.textures = { exists: key => key !== this.missingTexture };
    this.cameras = { main: {
      setZoom() {}, centerOn() {}, setBackgroundColor() {},
      fadeOut: (...args) => this.fadeOuts.push(args),
    } };
    this.add = {
      rectangle: () => gameObject(),
      text: () => gameObject(),
      image: (_x, _y, key) => {
        const object = gameObject(key === "world-03-entrance-construction" ? 1672 : 1254,
          key === "world-03-entrance-construction" ? 941 : 1254);
        object.key = key;
        this.images.push(object);
        return object;
      },
    };
    this.time = { delayedCall: (delay, callback) => {
      const timer = { delay, callback, removed: false, remove() { this.removed = true; } };
      this.timers.push(timer);
      return timer;
    } };
    this.tweens = {
      add: options => this.tweenCalls.push(options),
      killTweensOf() {},
    };
    this.keyboardHandlers = new Map();
    this.input = { keyboard: {
      on: (name, handler, context) => this.keyboardHandlers.set(name, () => handler.call(context)),
      off: name => this.keyboardHandlers.delete(name),
    } };
    this.scene = { start: (key, data) => {
      this.starts.push({ key, data });
      this.events.emit("shutdown");
    } };
  }
}

const filename = path.resolve("src/game/scenes/World03EntranceScene.ts");
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = loaded.require.bind(loaded);
loaded.require = id => id === "phaser"
  ? { Scene: SceneMock, Scenes: { Events: { SHUTDOWN: "shutdown" } } }
  : id === "../audio/AudioManager" ? { AudioManager: AudioManagerMock } : originalRequire(id);
loaded._compile(compile(filename), filename);
const { World03EntranceScene } = loaded.exports;

function setup(seen = false) {
  const scene = new World03EntranceScene();
  const progress = { playerName: "초코", seenCutsceneIds: seen ? ["world-03-intro"] : [] };
  const eventBus = new GameEventBus();
  const events = [];
  for (const name of ["cutscene-started", "cutscene-beat", "cutscene-finished"]) {
    eventBus.on(name, payload => events.push({ name, payload }));
  }
  scene.registryValues.set("progressState", progress);
  scene.registryValues.set("gameEventBus", eventBus);
  return { scene, progress, eventBus, events };
}

function fire(timer) {
  assert.ok(timer && !timer.removed);
  timer.removed = true;
  timer.callback();
}

test("여섯 beat와 전경·초상화·음악·효과음이 순서대로 재생된다", () => {
  const { scene, progress, events } = setup();
  scene.create({ nextStageId: "world-03-stage-1" });
  const audio = audioInstances.at(-1);
  assert.equal(scene.images[0].key, "world-03-entrance-construction");
  assert.ok(Math.abs(scene.images[0].displayWidth / scene.images[0].displayHeight - 1672 / 941) < 0.001);
  assert.deepEqual(audio.music, ["world-03-factory"]);
  assert.equal(events[0].name, "cutscene-started");
  assert.equal(events[0].payload.skipAllowed, false);
  assert.deepEqual(events.filter(event => event.name === "cutscene-beat").map(event => event.payload.index), [0]);
  fire(scene.beatTimer);
  assert.deepEqual(audio.sounds, ["world-03-drill"]);
  fire(scene.excavatorTimer);
  assert.deepEqual(audio.sounds, ["world-03-drill", "world-03-excavator"]);
  for (let index = 2; index <= 6; index += 1) fire(scene.beatTimer);
  assert.deepEqual(scene.images.slice(1).map(image => image.key), [
    "world-03-entrance-corgi-cough", "world-03-entrance-corgi-resolved",
  ]);
  assert.deepEqual(events.filter(event => event.name === "cutscene-beat").map(event => event.payload.beat.id),
    WORLD03_ENTRANCE_CUTSCENE.beats.map(beat => beat.id));
  assert.deepEqual(scene.fadeOuts, [[400, 0, 0, 0]]);
  fire(scene.beatTimer);
  assert.deepEqual(progress.seenCutsceneIds, ["world-03-intro"]);
  assert.deepEqual(scene.starts, [{ key: "StageScene", data: { stageId: "world-03-stage-1", playerName: "초코" } }]);
  assert.equal(events.at(-1).payload.skipped, false);
  assert.equal(audio.destroyed, true);
});

test("첫 시청 Escape는 무효이고 본 뒤 스킵은 예약 효과음을 취소한다", () => {
  const first = setup();
  first.scene.create({ nextStageId: "world-03-stage-1" });
  first.scene.keyboardHandlers.get("keydown-ESC")();
  first.eventBus.emit("cutscene-skip-requested", {});
  assert.equal(first.scene.starts.length, 0);
  first.scene.events.emit("shutdown");

  const replay = setup(true);
  replay.scene.create({ nextStageId: "world-03-stage-1" });
  fire(replay.scene.beatTimer);
  const queued = replay.scene.excavatorTimer;
  const audio = audioInstances.at(-1);
  replay.eventBus.emit("cutscene-skip-requested", {});
  assert.equal(queued.removed, true);
  assert.equal(audio.destroyed, true);
  assert.deepEqual(audio.sounds, ["world-03-drill"]);
  assert.equal(replay.events.at(-1).payload.skipped, true);
  assert.equal(replay.scene.starts.length, 1);
  assert.deepEqual(replay.progress.seenCutsceneIds, ["world-03-intro"]);
  replay.eventBus.emit("cutscene-skip-requested", {});
  assert.equal(replay.scene.starts.length, 1);
});

test("진입 데이터나 필수 그림이 없으면 기록과 진행을 바꾸지 않는다", () => {
  const invalid = setup();
  invalid.scene.create({ nextStageId: "world-02-stage-1" });
  assert.equal(invalid.scene.starts.length, 0);
  assert.deepEqual(invalid.progress.seenCutsceneIds, []);
  const missing = setup();
  missing.scene.missingTexture = "world-03-entrance-corgi-cough";
  missing.scene.create({ nextStageId: "world-03-stage-1" });
  assert.equal(missing.scene.starts.length, 0);
  assert.deepEqual(missing.progress.seenCutsceneIds, []);
});

test("월드 2와 3 인트로에 같은 자막 스타일과 HUD 숨김을 적용한다", () => {
  const overlay = fs.readFileSync("src/components/game/CutsceneOverlay.tsx", "utf8");
  const shell = fs.readFileSync("src/components/game/GameShell.tsx", "utf8");
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  const config = fs.readFileSync("src/game/config.ts", "utf8");
  assert.match(config, /World03EntranceScene/);
  assert.match(overlay, /\["world-02-intro", "world-03-intro"\]\.includes\(state\.cutsceneId\)/);
  assert.match(overlay, /cutscene-overlay--world-entrance/);
  assert.match(css, /\.cutscene-overlay--world-entrance \.cutscene-caption-frame/);
  assert.match(shell, /payload\.cutsceneId === "world-03-intro"/);
  assert.match(shell, /!worldEntranceActive && <GameOverlay/);
  assert.match(shell, /!worldEntranceActive && <SnackCoinCounter/);
  assert.match(shell, /onExit && !worldEntranceActive/);
});
