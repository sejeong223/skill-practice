import fs from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("새 효과음 WAV는 서로 다르고 무음·클리핑 없이 부드럽게 끝난다", () => {
  const sounds = ["coin-pickup.wav", "checkpoint-chime.wav"].map(name => fs.readFileSync(`public/assets/audio/${name}`));
  assert.notDeepEqual(sounds[0], sounds[1]);
  sounds.forEach((wav, index) => {
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt32LE(24), 44100);
    assert.equal(wav.readUInt16LE(34), 16);
    const count = (wav.length - 44) / 2, duration = count / 44100;
    assert.ok(index === 0 ? duration > 0.3 && duration < 0.5 : duration > 0.8 && duration < 1.2);
    let peak = 0, square = 0;
    for (let i = 44; i < wav.length; i += 2) { const value = wav.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(value)); square += value * value; }
    assert.ok(peak > 0.5 && peak < 0.8); assert.ok(Math.sqrt(square / count) > 0.04);
    assert.equal(wav.readInt16LE(44), 0); assert.equal(wav.readInt16LE(wav.length - 2), 0);
  });
});
