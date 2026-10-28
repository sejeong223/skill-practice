import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { FEEDBACK_AUDIO, SOUND_KEYS } from '../src/game/audio/audioManifest.ts';
import { renderWorld03SteelImpactSfx, writeOrCheckWorld03SteelImpactSfx } from './generate-world03-steel-impact.mjs';

test('steel impact is a reproducible, bright and short mono PCM clang', async () => {
  const wav = await readFile(new URL('../public/assets/audio/world-03-steel-impact.wav', import.meta.url));
  assert.ok(wav.equals(renderWorld03SteelImpactSfx()));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 44_100);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), Math.round(44_100 * 0.28) * 2);
  assert.equal(wav.length, 44 + Math.round(44_100 * 0.28) * 2);

  const samples = new Int16Array((wav.length - 44) / 2);
  for (let index = 0; index < samples.length; index++) samples[index] = wav.readInt16LE(44 + index * 2);
  const peak = Math.max(...samples.map(Math.abs)) / 32768;
  const rms = (from, to) => Math.sqrt(samples.slice(from, to)
    .reduce((sum, sample) => sum + (sample / 32768) ** 2, 0) / (to - from));
  const differenceRms = (from, to) => Math.sqrt(samples.slice(from + 1, to)
    .reduce((sum, sample, index) => sum + ((sample - samples[from + index]) / 32768) ** 2, 0) / (to - from - 1));
  assert.ok(peak >= 0.82 && peak <= 0.86);
  const attackSample = samples.findIndex(sample => Math.abs(sample / 32768) >= 0.03);
  assert.ok(attackSample >= 0 && attackSample < 44_100 * 0.00055);
  assert.ok(differenceRms(0, 1323) > rms(0, 1323) * 0.8);
  assert.ok(rms(0, 1323) > rms(2205, 4410) * 4);
  assert.ok(rms(6615, 11025) < rms(0, 1323) / 20);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 0);
  assert.doesNotThrow(() => writeOrCheckWorld03SteelImpactSfx(true));
});

test('steel impact uses the recorded pipe strike and prepared feedback audio path', async () => {
  const source = await readFile(new URL('../art/source/world03-steel-pipe-drop-bibow-cc0.wav', import.meta.url));
  assert.equal(source.toString('ascii', 0, 4), 'RIFF');
  assert.equal(source.readUInt32LE(24), 44_100);
  assert.ok(source.length > 44 + Math.round(44_100 * 0.28) * 2);
  assert.ok(SOUND_KEYS.includes('world-03-steel-impact'));
  assert.deepEqual(FEEDBACK_AUDIO['world-03-steel-impact'], {
    cacheKey: 'feedback-world-03-steel-impact',
    url: '/assets/audio/world-03-steel-impact.wav',
    gain: 1.0,
    duckMusic: true,
  });
  const manager = await readFile(new URL('../src/game/audio/AudioManager.ts', import.meta.url), 'utf8');
  assert.match(manager, /prepareFeedbackSound\("world-03-steel-impact"\)/);
  const attribution = await readFile(new URL('../public/assets/audio/ATTRIBUTION.md', import.meta.url), 'utf8');
  assert.match(attribution, /world-03-steel-impact\.wav/);
  assert.match(attribution, /Bibow/);
  assert.match(attribution, /Creative Commons Zero 1\.0/);
});
