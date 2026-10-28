import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const DRILL_PATH = fileURLToPath(new URL("../public/assets/audio/world-03-construction-drill.wav", import.meta.url));
const EXCAVATOR_PATH = fileURLToPath(new URL("../public/assets/audio/world-03-construction-excavator.wav", import.meta.url));

function wave(samples) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(samples.length * 2, 40);

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak ? 0.78 / peak : 0;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / SAMPLE_RATE;
    const fade = Math.min(1, t / 0.008, (samples.length - 1 - index) / (SAMPLE_RATE * 0.02));
    const value = index === samples.length - 1 ? 0 : Math.max(-1, Math.min(1, samples[index] * scale * fade));
    wav.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return wav;
}

function nextNoise(state) {
  let seed = state.value;
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  state.value = seed;
  return (seed >>> 0) / 0xffffffff * 2 - 1;
}

export function renderConstructionDrillSfx() {
  const samples = new Float64Array(Math.round(SAMPLE_RATE * 0.55));
  const state = { value: 0x34d411 };
  let filteredNoise = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / SAMPLE_RATE;
    const chatter = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 32 * t)), 0.38);
    filteredNoise += 0.32 * (nextNoise(state) - filteredNoise);
    const motor = 0.28 * Math.sin(2 * Math.PI * 235 * t)
      + 0.11 * Math.sin(2 * Math.PI * 470 * t);
    samples[index] = (motor + filteredNoise * 0.53) * (0.18 + 0.82 * chatter);
  }
  return wave(samples);
}

export function renderConstructionExcavatorSfx() {
  const samples = new Float64Array(Math.round(SAMPLE_RATE * 0.85));
  const state = { value: 0x3ec0a7 };
  let filteredNoise = 0;
  let phase = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / SAMPLE_RATE;
    const progress = t / 0.85;
    const frequency = 115 - 48 * progress;
    phase += 2 * Math.PI * frequency / SAMPLE_RATE;
    filteredNoise += 0.055 * (nextNoise(state) - filteredNoise);
    const rumble = 0.48 * Math.sin(phase) + 0.16 * Math.sin(phase * 2);
    const enginePulse = 0.68 + 0.32 * Math.sin(2 * Math.PI * 12 * t);
    samples[index] = (rumble * enginePulse + 0.42 * filteredNoise) * (1 - 0.32 * progress);
  }
  return wave(samples);
}

export function writeOrCheckWorld03IntroSfx(check) {
  for (const [path, rendered] of [
    [DRILL_PATH, renderConstructionDrillSfx()],
    [EXCAVATOR_PATH, renderConstructionExcavatorSfx()],
  ]) {
    if (check) {
      if (!readFileSync(path).equals(rendered)) throw new Error(`${path} differs from the generated sound`);
    } else {
      writeFileSync(path, rendered);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    throw new Error("Usage: node scripts/generate-world03-intro-sfx.mjs [--check]");
  }
  writeOrCheckWorld03IntroSfx(args[0] === "--check");
}
