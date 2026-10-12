import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { STAGE_IDS } = require("../src/game/core/constants.ts");
const { MUSIC_KEYS } = require("../src/game/audio/audioManifest.ts");
const { getStageMusicKey } = require("../src/game/audio/stageMusic.ts");
const { MUSIC_ARRANGEMENTS, CHORD_VOICINGS } = require("../src/game/audio/musicArrangements.ts");

test("25개 장면에 곡을 지정하고 월드 1 일반·보스를 오프닝과 분리한다", () => {
  assert.equal(STAGE_IDS.length, 25);
  for (const stageId of STAGE_IDS) assert.ok(MUSIC_KEYS.includes(getStageMusicKey(stageId)));
  for (let index = 1; index <= 4; index++) assert.equal(getStageMusicKey(`world-01-stage-${index}`), "world-01-peaceful");
  assert.equal(getStageMusicKey("world-01-stage-boss"), "world-01-calico");
  assert.ok(MUSIC_ARRANGEMENTS["birthday-warm"]);
  assert.ok(MUSIC_ARRANGEMENTS["world-01-alley"]);
  assert.equal(getStageMusicKey("world-02-stage-boss"), "boss");
});

test("신규 두 곡의 16마디 반주 길이가 일치하고 서로 다른 멜로디다", () => {
  for (const key of ["world-01-peaceful", "world-01-calico"]) {
    const arrangement = MUSIC_ARRANGEMENTS[key];
    assert.equal(arrangement.melody.length, 128);
    assert.equal(arrangement.chords.length, 32);
    assert.equal(arrangement.bass.length, 64);
    assert.equal(arrangement.melody.length / 2, arrangement.chords.length * 2);
    assert.equal(arrangement.bass.length, arrangement.chords.length * 2);
    assert.ok(arrangement.melody.includes(null));
    for (const chord of arrangement.chords) assert.ok(CHORD_VOICINGS[chord]);
    for (const note of [...arrangement.melody, ...arrangement.bass].filter(Boolean)) assert.match(note, /^[A-G](?:#|b)?[0-8]$/);
    assert.notDeepEqual(arrangement.melody, MUSIC_ARRANGEMENTS["world-01-alley"].melody);
    assert.notDeepEqual(arrangement.melody, MUSIC_ARRANGEMENTS["birthday-warm"].melody);
  }
  assert.notDeepEqual(MUSIC_ARRANGEMENTS["world-01-peaceful"].melody, MUSIC_ARRANGEMENTS["world-01-calico"].melody);
});
