import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44_100;
const DURATION_SECONDS = 0.85;
const OUTPUT_PATH = fileURLToPath(new URL('../public/assets/audio/world-03-steel-impact.wav', import.meta.url));
const RESONANCES = [
  { frequency: 313, decay: 0.28, gain: 0.22 },
  { frequency: 521, decay: 0.44, gain: 0.16 },
  { frequency: 997, decay: 0.63, gain: 0.12 },
  { frequency: 1678, decay: 0.40, gain: 0.075 },
];

function nextNoise(state) {
  let seed = state.value;
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  state.value = seed;
  return (seed >>> 0) / 0xffffffff * 2 - 1;
}

function transient(t, onset, decay) {
  return t < onset ? 0 : Math.exp(-(t - onset) / decay);
}

export function renderWorld03SteelImpactSfx() {
  const count = Math.round(SAMPLE_RATE * DURATION_SECONDS);
  const samples = new Float64Array(count);
  const noiseState = { value: 0x5e31b00f };
  let lowPhase = 0;
  let lowNoise = 0;

  for (let index = 0; index < count; index += 1) {
    const t = index / SAMPLE_RATE;
    const whiteNoise = nextNoise(noiseState);
    lowNoise += 0.09 * (whiteNoise - lowNoise);
    const attack = 0.85 * whiteNoise * transient(t, 0, 0.012)
      + 0.22 * lowNoise * transient(t, 0, 0.035);
    const frequency = 118 - 46 * Math.min(1, t / 0.22);
    lowPhase += 2 * Math.PI * frequency / SAMPLE_RATE;
    const lowImpact = (0.65 * Math.sin(lowPhase) + 0.12 * Math.sin(lowPhase * 2.03))
      * transient(t, 0, 0.22);
    const ring = RESONANCES.reduce((sum, { frequency: resonantHz, decay, gain }, voice) =>
      sum + gain * Math.sin(2 * Math.PI * resonantHz * t + voice * 0.37)
        * transient(t, 0, decay), 0);
    const firstRattle = transient(t, 0.095, 0.012);
    const secondRattle = transient(t, 0.18, 0.018);
    const rattles = (0.24 * firstRattle + 0.14 * secondRattle)
      * (0.72 * whiteNoise + 0.28 * Math.sin(2 * Math.PI * 1297 * t));
    const fadeIn = Math.min(1, t / 0.001);
    const fadeOut = Math.min(1, (DURATION_SECONDS - t) / 0.02);
    samples[index] = (attack + lowImpact + ring + rattles) * fadeIn * fadeOut;
  }

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (!Number.isFinite(peak) || peak === 0) throw new Error('Steel impact synthesis produced no valid samples');

  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(count * 2, 40);
  const scale = 0.78 / peak;
  for (let index = 0; index < count; index += 1) {
    const value = index === count - 1 ? 0 : samples[index] * scale;
    wav.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return wav;
}

export function writeOrCheckWorld03SteelImpactSfx(check) {
  const rendered = renderWorld03SteelImpactSfx();
  if (check) {
    if (!readFileSync(OUTPUT_PATH).equals(rendered)) {
      throw new Error(`${OUTPUT_PATH} differs from the generated sound`);
    }
  } else {
    writeFileSync(OUTPUT_PATH, rendered);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node scripts/generate-world03-steel-impact.mjs [--check]');
  }
  writeOrCheckWorld03SteelImpactSfx(args[0] === '--check');
}
