import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Original, deterministic bell designs. No sampled or reused sound files.
export const SAMPLE_RATE = 44100;
const designs = [
  { file: "coin-pickup.wav", duration: 0.40, notes: [[0, 1318.51, 0.10, 0.8], [0.065, 1975.53, 0.18, 1]], partials: [[1, 1], [2.76, 0.15], [4.07, 0.045]] },
  { file: "checkpoint-chime.wav", duration: 1.05, notes: [[0, 783.99, 0.14, 0.8], [0.11, 987.77, 0.16, 0.85], [0.22, 1174.66, 0.19, 0.9], [0.34, 1567.98, 0.32, 1]], partials: [[1, 1], [2, 0.22], [3.01, 0.07]] },
];

export function renderFeedbackAudio() {
  return designs.map(design => {
    const samples = new Float64Array(Math.ceil(design.duration * SAMPLE_RATE));
    for (const [start, frequency, decay, level] of design.notes) {
      for (let i = Math.floor(start * SAMPLE_RATE); i < samples.length; i++) {
        const t = i / SAMPLE_RATE - start;
        if (t < 0) continue;
        const attack = Math.min(1, t / 0.0035);
        for (const [ratio, strength] of design.partials) {
          samples[i] += level * strength * attack * Math.exp(-t / (decay / (1 + ratio * 0.12)))
            * Math.sin(2 * Math.PI * frequency * ratio * t);
        }
      }
    }
    const peak = samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(SAMPLE_RATE, 24); wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
    wav.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((sample, i) => {
      const fade = Math.min(1, (samples.length - 1 - i) / (SAMPLE_RATE * 0.035));
      wav.writeInt16LE(Math.round(sample / peak * 0.65 * fade * 32767), 44 + i * 2);
    });
    return { file: design.file, wav, duration: design.duration };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = fileURLToPath(new URL("../public/assets/audio/", import.meta.url));
  const check = process.argv.includes("--check");
  if (!check) fs.mkdirSync(directory, { recursive: true });
  for (const { file, wav, duration } of renderFeedbackAudio()) {
    const target = path.join(directory, file);
    if (check) {
      if (!fs.existsSync(target) || !wav.equals(fs.readFileSync(target))) throw new Error(`Generated audio differs: ${file}`);
    } else fs.writeFileSync(target, wav);
    console.log(`${check ? "Verified" : "Created"}: ${file}, ${duration}s, mono PCM16 / ${SAMPLE_RATE}Hz`);
  }
}
