import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FEEDBACK_AUDIO, SOUND_KEYS } from "../src/game/audio/audioManifest.ts";
import {
  renderConstructionDrillSfx,
  renderConstructionExcavatorSfx,
  writeOrCheckWorld03IntroSfx,
} from "./generate-world03-intro-sfx.mjs";

const sounds = [
  ["world-03-drill", "world-03-construction-drill.wav", 0.55, renderConstructionDrillSfx],
  ["world-03-excavator", "world-03-construction-excavator.wav", 0.85, renderConstructionExcavatorSfx],
];

test("공사장 효과음은 재현 가능한 짧은 단일 채널 PCM이다", async () => {
  for (const [key, filename, seconds, render] of sounds) {
    const wav = await readFile(new URL(`../public/assets/audio/${filename}`, import.meta.url));
    assert.ok(wav.equals(render()), `${key}: 생성 결과가 파일과 같음`);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 44_100);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), Math.round(44_100 * seconds) * 2);
    assert.equal(wav.length, 44 + Math.round(44_100 * seconds) * 2);
    let peak = 0;
    for (let offset = 44; offset < wav.length; offset += 2) {
      peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
    }
    assert.ok(peak > 1000 && peak < 32767, `${key}: 무음이나 클리핑이 아님`);
    assert.equal(wav.readInt16LE(wav.length - 2), 0);
    assert.ok(SOUND_KEYS.includes(key));
    assert.equal(FEEDBACK_AUDIO[key].url, `/assets/audio/${filename}`);
    assert.equal(FEEDBACK_AUDIO[key].duckMusic, false);
  }
  assert.ok(!renderConstructionDrillSfx().equals(renderConstructionExcavatorSfx()));
  assert.doesNotThrow(() => writeOrCheckWorld03IntroSfx(true));
});

test("원본 합성음의 출처를 기록한다", async () => {
  const attribution = await readFile(new URL("../public/assets/audio/ATTRIBUTION.md", import.meta.url), "utf8");
  for (const [, filename] of sounds) assert.ok(attribution.includes(filename));
  assert.ok(attribution.includes("no external recordings or samples used"));
});
