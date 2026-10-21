import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { ShopAudioController } = require(path.resolve("src/game/audio/ShopAudioController.ts"));

function samplesOf(file) {
  const wav = fs.readFileSync(path.resolve("public/assets/audio", file));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 44100);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  const samples = new Int16Array((wav.length - 44) / 2);
  for (let i = 0; i < samples.length; i += 1) samples[i] = wav.readInt16LE(44 + i * 2);
  return samples;
}

test("market loop is audible, unclipped, and seamless at its 8-bar boundary", () => {
  const samples = samplesOf("goodboy-shop-loop.wav");
  assert.ok(Math.abs(samples.length / 44100 - 32 * 60 / 88) < 0.001);
  let sum = 0, peak = 0;
  for (const sample of samples) { sum += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
  assert.ok(Math.sqrt(sum / samples.length) > 500);
  assert.ok(peak < 30000);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 0);
  assert.ok(Math.abs(samples[1] - samples.at(-2)) < 500);
});

test("entry bell has three clear strikes and a quiet tail", () => {
  const samples = samplesOf("goodboy-shop-bell.wav");
  assert.ok(samples.length / 44100 > 0.8 && samples.length / 44100 < 0.85);
  for (const at of [0.02, 0.16, 0.31]) {
    const slice = samples.slice(Math.floor(at * 44100), Math.floor((at + 0.04) * 44100));
    assert.ok(Math.max(...slice) > 1000);
  }
  assert.ok(Math.abs(samples.at(-1)) < 20);
  assert.ok(Math.max(...samples) < 30000);
});

function harness(rejectMusic = false) {
  const audios = [];
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    fire(name) { listeners.get(name)?.(); },
  };
  const makeAudio = url => {
    const audio = { url, paused: true, loop: false, volume: 1, currentTime: 0, plays: 0, pauses: 0,
      play() { this.plays++; if (rejectMusic && url.includes("loop") && this.plays === 1) return Promise.reject(new Error("blocked")); this.paused = false; return Promise.resolve(); },
      pause() { this.pauses++; this.paused = true; },
      removeAttribute() { this.url = ""; }, load() {},
    };
    audios.push(audio); return audio;
  };
  return { audios, document, controller: new ShopAudioController(makeAudio, document), listeners };
}

test("repeated entry and exit use one music and bell element and reset loop position", async () => {
  const { audios, controller } = harness();
  assert.equal(audios.length, 2);
  const [music, bell] = audios;
  await controller.enter();
  await controller.enter();
  assert.equal(music.plays, 1);
  assert.equal(bell.plays, 1);
  music.currentTime = 3;
  await controller.exit();
  assert.equal(music.currentTime, 0);
  assert.equal(music.paused, true);
  assert.equal(bell.plays, 2);
  await controller.enter();
  assert.equal(music.plays, 2);
  controller.destroy();
  assert.equal(music.url, "");
  assert.equal(bell.paused, true);
});

test("hidden tab pauses music and a blocked start retries on next gesture", async () => {
  const { audios, document, controller, listeners } = harness(true);
  await controller.enter();
  assert.equal(audios[0].paused, true);
  document.fire("pointerdown");
  await Promise.resolve();
  assert.equal(audios[0].paused, false);
  document.hidden = true;
  document.fire("visibilitychange");
  assert.equal(audios[0].paused, true);
  document.hidden = false;
  document.fire("visibilitychange");
  await Promise.resolve();
  assert.equal(audios[0].paused, false);
  controller.destroy();
  assert.equal(listeners.size, 0);
});
