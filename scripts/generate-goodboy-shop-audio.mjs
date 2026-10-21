import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/assets/audio");
const sampleRate = 44100;
const tempo = 88;
const beat = 60 / tempo;
const twoPi = Math.PI * 2;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

function pcm16(samples) {
  const dataBytes = samples.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return wav;
}

function strike(buffer, midi, atBeat, beatLength, volume, voice) {
  const start = Math.round(atBeat * beat * sampleRate);
  const noteLength = beatLength * beat;
  const renderLength = Math.min(noteLength + (voice === "bass" ? 0.15 : 0.22), buffer.length / sampleRate - start / sampleRate);
  const hz = frequency(midi);
  for (let i = 0; i < Math.floor(renderLength * sampleRate); i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / (voice === "bass" ? 0.014 : 0.003));
    const release = Math.min(1, Math.max(0, (renderLength - t) / 0.1));
    const decay = Math.exp(-t * (voice === "bass" ? 3.2 : voice === "harmony" ? 4.8 : 6.8));
    const tone = voice === "bass"
      ? Math.sin(twoPi * hz * t) + 0.17 * Math.sin(twoPi * hz * 2 * t)
      : Math.sin(twoPi * hz * t) + 0.38 * Math.sin(twoPi * hz * 3.01 * t) + 0.11 * Math.sin(twoPi * hz * 5.02 * t);
    buffer[start + i] += tone * volume * attack * release * decay;
  }
}

function makeLoop() {
  const samples = new Float32Array(Math.round(32 * beat * sampleRate));
  // Each bar has its own response, so the 8 bars form one complete, original phrase.
  const melody = [
    [74, 76, 79, 76], [74, 71, 72, 74], [76, 79, 81, 79], [76, 74, 72, 71],
    [74, 76, 79, 83], [81, 79, 76, 74], [72, 74, 76, 72], [71, 72, 74, 67],
  ];
  const roots = [55, 52, 48, 50, 55, 52, 48, 50]; // G / Em / C / D
  const thirds = [71, 67, 64, 66, 71, 67, 64, 66];
  for (let bar = 0; bar < 8; bar += 1) {
    for (let tick = 0; tick < 4; tick += 1) {
      strike(samples, melody[bar][tick], bar * 4 + tick, 0.7, 0.11, "marimba");
      if (tick % 2 === 0) strike(samples, roots[bar] - 12, bar * 4 + tick, 1.6, 0.085, "bass");
      if (tick === 0 || tick === 2) strike(samples, thirds[bar], bar * 4 + tick + 0.5, 0.85, 0.042, "harmony");
    }
  }
  // A 12 ms crossfade-sized silence at the seam prevents a loop click.
  const edge = Math.round(sampleRate * 0.012);
  for (let i = 0; i < edge; i += 1) {
    samples[i] *= i / edge;
    samples[samples.length - 1 - i] *= i / edge;
  }
  return pcm16(samples);
}

function makeBell() {
  const samples = new Float32Array(Math.round(sampleRate * 0.82));
  const taps = [{ at: 0, hz: 1318.5, strength: 0.27 }, { at: 0.14, hz: 1568, strength: 0.24 }, { at: 0.29, hz: 1975.5, strength: 0.2 }];
  for (const tap of taps) {
    const start = Math.round(tap.at * sampleRate);
    for (let i = start; i < samples.length; i += 1) {
      const t = (i - start) / sampleRate;
      const envelope = (1 - Math.exp(-t * 240)) * Math.exp(-t * 8.8) * Math.min(1, (samples.length - i) / (sampleRate * 0.025));
      samples[i] += tap.strength * envelope * (
        Math.sin(twoPi * tap.hz * t) +
        0.36 * Math.sin(twoPi * tap.hz * 2.02 * t) +
        0.11 * Math.sin(twoPi * tap.hz * 3.87 * t)
      );
    }
  }
  return pcm16(samples);
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "goodboy-shop-loop.wav"), makeLoop());
await writeFile(path.join(outDir, "goodboy-shop-bell.wav"), makeBell());
