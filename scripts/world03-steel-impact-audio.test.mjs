import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { FEEDBACK_AUDIO, SOUND_KEYS } from '../src/game/audio/audioManifest.ts';
import { renderWorld03SteelImpactSfx, writeOrCheckWorld03SteelImpactSfx } from './generate-world03-steel-impact.mjs';

test('steel impact is a reproducible, bounded mono PCM strike with a decaying tail', async () => {
  const wav = await readFile(new URL('../public/assets/audio/world-03-steel-impact.wav', import.meta.url));
  assert.ok(wav.equals(renderWorld03SteelImpactSfx()));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 44_100);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), Math.round(44_100 * 0.85) * 2);
  assert.equal(wav.length, 44 + Math.round(44_100 * 0.85) * 2);

  const samples = new Int16Array((wav.length - 44) / 2);
  for (let index = 0; index < samples.length; index++) samples[index] = wav.readInt16LE(44 + index * 2);
  const peak = Math.max(...samples.map(Math.abs)) / 32768;
  const rms = (from, to) => Math.sqrt(samples.slice(from, to)
    .reduce((sum, sample) => sum + (sample / 32768) ** 2, 0) / (to - from));
  assert.ok(peak >= 0.75 && peak <= 0.8);
  assert.ok(rms(0, 1543) > rms(4410, 8820) * 1.4);
  assert.ok(rms(4410, 8820) > rms(26460, 35280) * 4);
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 0);
  assert.doesNotThrow(() => writeOrCheckWorld03SteelImpactSfx(true));
});

test('steel impact is registered on the prepared feedback audio path with source notes', async () => {
  assert.ok(SOUND_KEYS.includes('world-03-steel-impact'));
  assert.deepEqual(FEEDBACK_AUDIO['world-03-steel-impact'], {
    cacheKey: 'feedback-world-03-steel-impact',
    url: '/assets/audio/world-03-steel-impact.wav',
    gain: 0.52,
    duckMusic: true,
  });
  const manager = await readFile(new URL('../src/game/audio/AudioManager.ts', import.meta.url), 'utf8');
  assert.match(manager, /prepareFeedbackSound\("world-03-steel-impact"\)/);
  const attribution = await readFile(new URL('../public/assets/audio/ATTRIBUTION.md', import.meta.url), 'utf8');
  assert.match(attribution, /world-03-steel-impact\.wav/);
  assert.match(attribution, /no external recordings or samples used/);
});
