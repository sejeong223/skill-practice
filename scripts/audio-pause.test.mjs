import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = filename => ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText;
require.extensions[".ts"] = (module, filename) => module._compile(compile(filename), filename);
globalThis.window = { addEventListener() {}, removeEventListener() {} };

function harness({ locked = false, cached = [] } = {}) {
  const nodes = [];
  const unlocks = [];
  const rawContext = { state: locked ? "suspended" : "running" };
  const context = { get state() { return rawContext.state; }, rawContext };
  const transport = {
    ticks: 0, state: "stopped", starts: 0, pauses: 0, stops: 0, resets: 0, bpm: { value: 100 },
    get position() { return this.ticks; },
    set position(value) { this.ticks = value; this.resets++; },
    start() { this.state = "started"; this.starts++; },
    pause() { this.state = "paused"; this.pauses++; },
    stop() { this.state = "stopped"; this.stops++; this.ticks = 0; },
    cancel() {},
  };
  class Node {
    disposed = false;
    attacks = [];
    constructor() { nodes.push(this); }
    connect() { return this; }
    toDestination() { return this; }
    triggerAttackRelease(...args) { this.attacks.push(args); }
    dispose() { this.disposed = true; }
  }
  class Gain extends Node {
    constructor(value) {
      super();
      this.gain = { value, cancelAndHoldAtTime() {}, linearRampToValueAtTime(next) { this.value = next; } };
    }
  }
  class Sequence extends Node {
    constructor(callback) { super(); this.callback = callback; }
    start() { return this; }
  }
  class NoAudioSoundManager {}
  const tone = {
    Synth: Node, PolySynth: Node, MonoSynth: Node, Gain, Sequence,
    getContext: () => context, getTransport: () => transport,
    now: () => 100.1, immediate: () => 100,
    start: () => new Promise(resolve => unlocks.push(() => { rawContext.state = "running"; resolve(); })),
  };
  const filename = path.resolve("src/game/audio/AudioManager.ts");
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const actualRequire = loaded.require.bind(loaded);
  loaded.require = id => id === "tone" ? tone : id === "phaser"
    ? { Sound: { NoAudioSoundManager, Events: { COMPLETE: "complete" } } }
    : actualRequire(id);
  loaded._compile(compile(filename), filename);
  const sounds = [];
  const scene = { cache: { audio: { exists: key => cached.includes(key) } }, sound: {
    locked: false,
    add(key) {
      const sound = Object.assign(new EventEmitter(), {
        key, isPaused: false, isPlaying: false, plays: 0, resumes: 0, destroyed: false,
        play() { this.plays++; this.isPlaying = true; },
        pause() { this.isPaused = true; this.isPlaying = false; },
        resume() { this.resumes++; this.isPaused = false; this.isPlaying = true; },
        stop() { this.isPlaying = false; this.isPaused = false; },
        destroy() { this.destroyed = true; this.removeAllListeners(); },
      });
      sounds.push(sound);
      return sound;
    },
  } };
  return {
    create: () => new loaded.exports.AudioManager(scene),
    createNoAudio: () => new loaded.exports.AudioManager({ ...scene, sound: new NoAudioSoundManager() }),
    transport, nodes, sounds, Sequence, Gain,
    async unlock() { unlocks.splice(0).forEach(resolve => resolve()); await Promise.resolve(); await Promise.resolve(); },
  };
}

test("정지·재개 10회에도 음악 위치와 시퀀스를 보존한다", () => {
  const h = harness(); const audio = h.create();
  audio.playMusic("world-01-peaceful");
  h.transport.ticks = 456;
  const resets = h.transport.resets;
  for (let index = 0; index < 10; index++) {
    audio.setPaused(true); audio.setPaused(true);
    assert.equal(h.transport.state, "paused");
    assert.equal(h.transport.ticks, 456);
    assert.equal(h.nodes.find(node => node instanceof h.Gain).gain.value, 0);
    audio.setPaused(false); audio.setPaused(false);
    assert.equal(h.transport.state, "started");
    assert.equal(h.transport.ticks, 456);
  }
  assert.equal(h.transport.resets, resets);
  assert.equal(h.transport.pauses, 10);
  assert.equal(h.nodes.filter(node => node instanceof h.Sequence).length, 3);
  audio.destroy(); assert.ok(h.nodes.every(node => node.disposed));
});

test("잠금 해제가 늦게 끝나도 정지 상태에서는 곡을 시작하지 않는다", async () => {
  const h = harness({ locked: true }); const audio = h.create();
  audio.playMusic("world-01-peaceful"); audio.unlock(); audio.setPaused(true);
  await h.unlock();
  assert.equal(h.nodes.length, 0);
  audio.setPaused(false);
  assert.equal(h.transport.starts, 1);
  audio.unlock(); audio.destroy(); await h.unlock();
  assert.equal(h.transport.starts, 1);
});

test("정지 중 곡 교체는 재개할 때 한 번 시작한다", () => {
  const h = harness(); const audio = h.create();
  audio.playMusic("world-01-peaceful"); audio.setPaused(true);
  audio.playMusic("world-01-calico");
  assert.equal(h.transport.starts, 1);
  assert.ok(h.nodes.every(node => node.disposed));
  audio.setPaused(false);
  assert.equal(h.transport.starts, 2);
  assert.equal(h.transport.bpm.value, 114);
  assert.equal(h.nodes.filter(node => !node.disposed && node instanceof h.Sequence).length, 3);
  audio.destroy();
});

test("이전 관리자의 정지·재개·폐기가 새 곡을 건드리지 않는다", async () => {
  const h = harness(); const old = h.create(); const next = h.create();
  old.playMusic("world-01-peaceful"); old.setPaused(true);
  next.playMusic("world-01-calico"); h.transport.ticks = 123;
  const starts = h.transport.starts; const stops = h.transport.stops;
  old.setPaused(false); old.unlock(); await h.unlock(); old.setPaused(true); old.destroy();
  assert.equal(h.transport.starts, starts); assert.equal(h.transport.stops, stops);
  assert.equal(h.transport.state, "started"); assert.equal(h.transport.ticks, 123);
  assert.equal(h.nodes.filter(node => !node.disposed && node instanceof h.Sequence).length, 3);
  next.destroy();
});

test("캐시 음악도 자신의 인스턴스만 pause/resume하고 효과음은 누적하지 않는다", () => {
  const h = harness({ cached: ["world-01-peaceful", "world-01-calico", "checkpoint"] });
  const old = h.create(); const next = h.create();
  old.playMusic("world-01-peaceful"); old.playSfx("checkpoint"); old.setPaused(true);
  assert.equal(h.sounds[0].isPaused, true); assert.equal(h.sounds[1].destroyed, true);
  old.playSfx("checkpoint"); assert.equal(h.sounds.length, 2);
  old.setPaused(false); assert.equal(h.sounds[0].plays, 1); assert.equal(h.sounds[0].resumes, 1);
  next.playMusic("world-01-calico"); old.destroy();
  assert.equal(h.sounds[2].isPlaying, true); assert.equal(h.sounds[2].destroyed, false);
  next.destroy();
});

test("처리가 지연된 음표와 중복 예약을 건너뛰고 다음 음표부터 재생한다", () => {
  const h = harness(); const audio = h.create();
  audio.playMusic("world-01-peaceful");
  const sequences = h.nodes.filter(node => node instanceof h.Sequence);
  const voices = h.nodes.filter(node => !(node instanceof h.Sequence) && !(node instanceof h.Gain));
  sequences.forEach((sequence, index) => {
    const note = index === 1 ? "C" : "C4";
    [99.5, 99.9, 100, 100.001, 100.2, 100.2, 100.1, 100.4].forEach(time => sequence.callback(time, note));
    assert.deepEqual(voices[index].attacks.map(attack => attack[2]), [100.2, 100.4]);
  });
  audio.setPaused(true);
  sequences.forEach(sequence => sequence.callback(100.6, "C"));
  assert.ok(voices.every(voice => voice.attacks.length === 2));
  audio.destroy();
});

test("NoAudio 환경과 폐기 후 정지 요청은 재생을 만들지 않는다", () => {
  const h = harness(); const audio = h.createNoAudio();
  audio.playMusic("world-01-peaceful"); audio.setPaused(true); audio.setPaused(false); audio.destroy();
  audio.setPaused(true); audio.playMusic("world-01-calico");
  assert.equal(h.nodes.length, 0);
});
