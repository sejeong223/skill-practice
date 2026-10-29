import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rate = 44_100;
const clips = [
  { kind: "brick", start: 1.023, seconds: 0.22, highPass: 90, lowPass: 6_000, peak: 0.78 },
  { kind: "trowel", start: 11.744, seconds: 0.25, highPass: 300, lowPass: 9_000, peak: 0.82 },
  { kind: "cement", start: 1.65, seconds: 0.27, highPass: 70, lowPass: 2_500, peak: 0.72 },
];

function readMonoPcm16(bytes, kind) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF", kind);
  assert.equal(bytes.toString("ascii", 8, 16), "WAVEfmt ", kind);
  assert.equal(bytes.readUInt16LE(20), 1, kind);
  assert.equal(bytes.readUInt16LE(22), 1, kind);
  assert.equal(bytes.readUInt32LE(24), rate, kind);
  assert.equal(bytes.readUInt16LE(34), 16, kind);
  assert.equal(bytes.toString("ascii", 36, 40), "data", kind);
  return new Int16Array(bytes.buffer, bytes.byteOffset + 44, Math.floor((bytes.length - 44) / 2));
}

function encodePcm16(samples) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(samples[i], 44 + i * 2);
  return wav;
}

export async function renderBossAttackSfx(config) {
  const input = await readFile(path.join(root, `art/source/world03-boss-${config.kind}-cc0.wav`));
  const source = readMonoPcm16(input, config.kind);
  const first = Math.round(config.start * rate);
  const length = Math.round(config.seconds * rate);
  assert.ok(first + length <= source.length, `${config.kind}: source is too short`);
  const samples = new Float64Array(length);
  const hpCoef = 1 - Math.exp(-2 * Math.PI * config.highPass / rate);
  const lpCoef = 1 - Math.exp(-2 * Math.PI * config.lowPass / rate);
  let low = 0;
  let high = 0;
  let max = 0;
  for (let i = 0; i < length; i++) {
    const raw = source[first + i] / 32768;
    low += hpCoef * (raw - low);
    high += lpCoef * (raw - low - high);
    const fadeIn = Math.min(1, i / (rate * 0.001));
    const fadeOut = Math.min(1, (length - 1 - i) / (rate * 0.025));
    const value = high * fadeIn * fadeOut;
    samples[i] = value;
    max = Math.max(max, Math.abs(value));
  }
  assert.ok(max > 0.002, `${config.kind}: silent source range`);
  const pcm = Int16Array.from(samples, value => Math.round(value / max * config.peak * 32767));
  return encodePcm16(pcm);
}

for (const config of clips) {
  const output = path.join(root, `public/assets/audio/world-03-boss-${config.kind}.wav`);
  const wav = await renderBossAttackSfx(config);
  if (process.argv.includes("--check")) {
    assert.deepEqual(await readFile(output), wav, `${config.kind}: output differs from source`);
  } else {
    await writeFile(output, wav);
  }
}
