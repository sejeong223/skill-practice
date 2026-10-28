import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44_100;
const DURATION_SECONDS = 0.28;
const SOURCE_LEAD_SAMPLES = Math.round(SAMPLE_RATE * 0.008);
const OUTPUT_PATH = fileURLToPath(new URL('../public/assets/audio/world-03-steel-impact.wav', import.meta.url));
const SOURCE_PATH = fileURLToPath(new URL('../art/source/world03-steel-pipe-drop-bibow-cc0.wav', import.meta.url));

export function renderWorld03SteelImpactSfx() {
  const count = Math.round(SAMPLE_RATE * DURATION_SECONDS);
  const source = readFileSync(SOURCE_PATH);
  if (source.toString('ascii', 0, 4) !== 'RIFF' || source.toString('ascii', 8, 16) !== 'WAVEfmt '
    || source.toString('ascii', 36, 40) !== 'data' || source.readUInt16LE(20) !== 1
    || source.readUInt16LE(22) !== 1 || source.readUInt32LE(24) !== SAMPLE_RATE
    || source.readUInt16LE(34) !== 16 || source.readUInt32LE(40) < (count + SOURCE_LEAD_SAMPLES) * 2) {
    throw new Error('Expected a 44.1 kHz mono PCM steel pipe source recording');
  }
  const samples = new Float64Array(count);
  let smoothedBody = 0;

  for (let index = 0; index < count; index += 1) {
    const t = index / SAMPLE_RATE;
    const body = source.readInt16LE(44 + (index + SOURCE_LEAD_SAMPLES) * 2) / 32768;
    smoothedBody += 0.12 * (body - smoothedBody);
    const brightEdge = body - smoothedBody;
    const decay = Math.exp(-t / 0.075);
    const fadeIn = Math.min(1, t / 0.001);
    const fadeOut = Math.min(1, (DURATION_SECONDS - t) / 0.012);
    samples[index] = (body + 0.22 * brightEdge) * decay * fadeIn * fadeOut;
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
  const scale = 0.84 / peak;
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
