import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Original voiced burst and breath noise; no third-party samples.
export function renderBarkAudio() {
  const sampleRate = 44100, duration = 0.4;
  const samples = new Float64Array(sampleRate * duration);
  let seed = 0x434f5247, phase = 0, low = 0, high = 0;
  const lowRate = 1 - Math.exp(-2 * Math.PI * 4500 / sampleRate);
  const highRate = 1 - Math.exp(-2 * Math.PI * 300 / sampleRate);
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const frequency = 105 + 195 * Math.exp(-t / 0.055);
    phase += 2 * Math.PI * frequency / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    low += lowRate * (noise - low);
    high += highRate * (low - high);
    let voice = 0;
    for (let harmonic = 1; harmonic <= 18; harmonic++) {
      const hz = frequency * harmonic;
      const formant = 0.15 + 1.8 * Math.exp(-(((hz - 900) / 350) ** 2)) + Math.exp(-(((hz - 1800) / 550) ** 2));
      voice += Math.sin(phase * harmonic + 0.18 * harmonic) * formant / harmonic;
    }
    const attack = Math.min(1, t / 0.003);
    const envelope = attack * Math.exp(-t / 0.065) * Math.min(1, Math.max(0, (0.3 - t) / 0.025));
    samples[i] = voice * envelope + (low - high) * 0.55 * Math.min(1, t / 0.008) * Math.exp(-t / 0.045);
  }
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(1, i / (sampleRate * 0.001), (samples.length - 1 - i) / (sampleRate * 0.02));
    samples[i] = (samples[i] - mean) * fade;
  }
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, i) => wav.writeInt16LE(Math.round(sample / peak * 0.65 * 32767), 44 + i * 2));
  return { file: "corgi-bark.wav", wav, duration };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { file, wav } = renderBarkAudio();
  const target = fileURLToPath(new URL("../public/assets/audio/" + file, import.meta.url));
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || !wav.equals(fs.readFileSync(target))) throw new Error("Bark audio differs");
  } else fs.writeFileSync(target, wav);
  console.log("Bark: mono PCM16 / 44100Hz / 0.4s");
}
