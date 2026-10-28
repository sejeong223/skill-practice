import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const SAMPLE_COUNT = 8_820;
const OUTPUT = fileURLToPath(new URL("../public/assets/audio/corgi-bite.wav", import.meta.url));

export function renderBiteSfx() {
  const samples = new Float64Array(SAMPLE_COUNT);
  let seed = 0xC0B61;
  let low = 0;
  let peak = 0;
  const burst = (elapsed) => elapsed < 0 || elapsed >= 0.1
    ? 0
    : Math.min(1, elapsed / 0.002) * Math.exp(-40 * elapsed);

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed >>> 0) / 0xffffffff * 2 - 1;
    low += 0.25 * (noise - low);
    const time = index / SAMPLE_RATE;
    const phase = 2 * Math.PI * (180 * time - 175 * time * time);
    const sample = low * (0.75 * burst(time) + 0.40 * burst(time - 0.075))
      + 0.18 * Math.sin(phase) * Math.exp(-30 * time);
    samples[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const wav = Buffer.alloc(44 + SAMPLE_COUNT * 2);
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
  wav.writeUInt32LE(SAMPLE_COUNT * 2, 40);

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    const time = index / SAMPLE_RATE;
    const fade = Math.min(1, time / 0.003, (SAMPLE_COUNT - 1 - index) / (SAMPLE_RATE * 0.003));
    const sample = index === SAMPLE_COUNT - 1 ? 0 : samples[index] * 0.82 / peak * fade;
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  }
  return wav;
}

export function writeOrCheckBiteSfx(check) {
  const wav = renderBiteSfx();
  if (check) {
    if (!readFileSync(OUTPUT).equals(wav)) throw new Error("corgi-bite.wav differs from the generated sound");
  } else {
    writeFileSync(OUTPUT, wav);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    throw new Error("Usage: node scripts/generate-bite-sfx.mjs [--check]");
  }
  writeOrCheckBiteSfx(args[0] === "--check");
}
