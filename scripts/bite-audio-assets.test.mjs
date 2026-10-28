import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { renderBiteSfx } from "./generate-bite-sfx.mjs";

test("물기 효과음은 짖기와 다른 재현 가능한 0.20초 PCM 음원이다", () => {
  const wav = fs.readFileSync(new URL("../public/assets/audio/corgi-bite.wav", import.meta.url));
  const bark = fs.readFileSync(new URL("../public/assets/audio/corgi-bark.wav", import.meta.url));
  assert.ok(wav.equals(renderBiteSfx()));
  assert.ok(!wav.equals(bark));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.toString("ascii", 12, 16), "fmt ");
  assert.equal(wav.readUInt32LE(16), 16);
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 44_100);
  assert.equal(wav.readUInt32LE(28), 88_200);
  assert.equal(wav.readUInt16LE(32), 2);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), 17_640);
  assert.equal(wav.length, 44 + 17_640);

  const sampleCount = wav.readUInt32LE(40) / 2;
  assert.equal(sampleCount, 8_820);
  const samples = Array.from({ length: sampleCount }, (_, index) => wav.readInt16LE(44 + index * 2) / 32_768);
  const peak = Math.max(...samples.map(Math.abs));
  const rms = Math.sqrt(samples.reduce((total, sample) => total + sample * sample, 0) / sampleCount);
  assert.ok(peak >= 0.75 && peak <= 0.86, `peak ${peak}`);
  assert.ok(rms > 0.02, `rms ${rms}`);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 0);
  assert.ok(Math.abs(samples[1]) < 0.02);
  assert.ok(Math.abs(samples.at(-2)) < 0.02);
});

test("물기 효과음은 필수 피드백 에셋으로 등록되어 있다", () => {
  const manifest = fs.readFileSync(new URL("../src/game/audio/audioManifest.ts", import.meta.url), "utf8");
  assert.match(manifest, /bite: \{ cacheKey: "feedback-bite", url: "\/assets\/audio\/corgi-bite\.wav", gain: 0\.50 \}/);
  const attribution = fs.readFileSync(new URL("../public/assets/audio/ATTRIBUTION.md", import.meta.url), "utf8");
  assert.match(attribution, /## corgi-bite\.wav/);
});
