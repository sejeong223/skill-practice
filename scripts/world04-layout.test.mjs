import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { getWorld04Layout, isWorld04StageId } = require('../src/game/data/world04Scrapyard.ts');
const { validateWorld04Layout } = require('../src/game/data/world04LayoutValidation.ts');
const { overlapRect, overlapCircleRect, sweepRect, sweepCircleRect } = require('../src/game/systems/world04Geometry.ts');
const rect = (x, y, width = 72, height = 40) => ({ x, y, width, height });

test('four dense deterministic maps, nested immutability and old coin IDs', () => {
  for (let i = 1; i <= 4; i++) {
    const id = `world-04-stage-${i}`, l = getWorld04Layout(id);
    assert.equal(isWorld04StageId(id), true);
    assert.deepEqual(validateWorld04Layout(l), []);
    assert.ok(l.objects.length + l.terrain.length >= 20);
    assert.ok(Object.isFrozen(l.objects[0]));
    assert.equal(getWorld04Layout(id), l);
    for (let c = 0; c < 15; c++) assert.equal(l.coins[c].id, `${id}-segment-${Math.floor(c / 3) + 1}-coin-${c % 3 + 1}`);
  }
  for (const id of ['world-04-stage-boss', 'world-03-stage-1', 'world-04-stage-10']) {
    assert.equal(getWorld04Layout(id), null); assert.equal(isWorld04StageId(id), false);
  }
  const l = getWorld04Layout('world-04-stage-4');
  assert.deepEqual([...new Set(l.objects.map(o => o.kind))].sort(), ['belt', 'cable', 'crane', 'oil', 'plate-gate', 'press', 'saw', 'scrap', 'swing', 'tire']);
  assert.deepEqual(l.terrain.map(t => t.kind).sort(), ['collapse', 'rise']);
});
test('corruption catches blocked retreat, unsafe checkpoints, nonfinite and overlapping holes', () => {
  const l = structuredClone(getWorld04Layout('world-04-stage-1'));
  const rise = l.terrain.find(t => t.kind === 'rise');
  l.objects.push({ id: 'bad', kind: 'scrap', triggerX: 2800, rect: rect(rise.rect.x - 100, 472, 48, 32) });
  assert.ok(validateWorld04Layout(l).some(s => s.includes('retreat')));
  l.objects.at(-1).rect.x = 2496;
  assert.ok(validateWorld04Layout(l).some(s => s.includes('safe zone')));
  l.objects.at(-1).rect.x = NaN;
  assert.ok(validateWorld04Layout(l).some(s => s.includes('nonfinite')));
  l.gaps.push({ ...l.gaps[0] });
  assert.ok(validateWorld04Layout(l).some(s => s.includes('gap alignment')));
});
test('cable tunnel requires dash and denies normal jump bypass', () => {
  const l = getWorld04Layout('world-04-stage-1'), cable = l.objects.find(o => o.kind === 'cable');
  const ceiling = l.solids.find(o => o.role === 'ceiling');
  assert.ok((72 + cable.rect.width) / 240 * 1000 > cable.offMs);
  assert.ok((72 + cable.rect.width) / 480 * 1000 < 250);
  assert.ok(504 - ceiling.y - ceiling.height - 40 < cable.rect.height);
});
test('strict edges, circle corners, NaN and both-direction relative sweeps', () => {
  assert.equal(overlapRect(rect(0, 0), rect(72, 0)), false);
  assert.equal(overlapCircleRect({ x: 90, y: 58 }, 22, rect(0, 0)), false);
  assert.equal(overlapCircleRect({ x: 80, y: 20 }, 22, rect(0, 0)), true);
  assert.equal(overlapRect(rect(NaN, 0), rect(0, 0)), false);
  for (const [from, to] of [[0, 240], [240, 0]]) {
    assert.equal(sweepRect(rect(from, 0), rect(to, 0), rect(120, 0, 16, 44), rect(120, 0, 16, 44)), true);
    assert.equal(sweepCircleRect(rect(from, 0), rect(to, 0), { x: 120, y: 20 }, { x: 120, y: 20 }, 22), true);
    assert.equal(sweepCircleRect(rect(from, 0), rect(to, 0), { x: 120, y: 70 }, { x: 120, y: 70 }, 22), false);
  }
  assert.equal(sweepRect(rect(0, 0), rect(0, 0), rect(-100, 10, 16, 16), rect(100, 10, 16, 16)), true);
  assert.equal(sweepCircleRect(rect(0, 0), rect(0, 0), { x: -100, y: 20 }, { x: 100, y: 20 }, 5), true);
});
