import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FEEDBACK_AUDIO, SOUND_KEYS } from "../src/game/audio/audioManifest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kinds = ["brick", "trowel", "cement"];

test("세 실제 재질 준비음은 0.3초 안에 시작·종료하며 클리핑이 없다", async () => {
  const attribution = await readFile(path.join(root, "public/assets/audio/ATTRIBUTION.md"), "utf8");
  const fingerprints = new Set();
  for (const kind of kinds) {
    const key = `world-03-boss-${kind}`;
    const wav = await readFile(path.join(root, `public/assets/audio/${key}.wav`));
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
    assert.equal(wav.toString("ascii", 36, 40), "data");
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 44_100);
    assert.equal(wav.readUInt16LE(34), 16);
    const duration = (wav.length - 44) / (2 * 44_100);
    assert.ok(duration >= 0.12 && duration <= 0.3, `${kind}: duration ${duration}`);
    const samples = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2);
    const peak = Math.max(...samples.subarray(0, Math.min(11_000, samples.length)).map(Math.abs));
    const fullPeak = samples.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
    const firstTenMsPeak = samples.subarray(0, 441).reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
    assert.ok(fullPeak > 1_000 && fullPeak < 30_000, `${kind}: silent or clipped`);
    assert.ok(peak > 0 && firstTenMsPeak >= fullPeak * 0.1, `${kind}: late onset`);
    fingerprints.add(wav.toString("base64"));
    assert.ok(SOUND_KEYS.includes(key));
    assert.equal(FEEDBACK_AUDIO[key].cacheKey, `feedback-${key}`);
    assert.equal(FEEDBACK_AUDIO[key].duckMusic, false);
    assert.ok(attribution.includes(`${key}.wav`));
    assert.ok(attribution.includes(`world03-boss-${kind}-cc0.wav`));
  }
  assert.equal(fingerprints.size, 3);
  for (const url of ["freesound.org/people/deleted_user_2104797/sounds/325268/", "freesound.org/people/Sheyvan/sounds/831386/", "bigsoundbank.com/stir-concrete-with-a-trowel-s0623.html"]) {
    assert.ok(attribution.includes(url));
  }
});
