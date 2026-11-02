import assert from 'node:assert/strict';
import test from 'node:test';
import { requireTS, world04Harness } from './world04-test-fixtures.mjs';
const { getWorld04Layout } = requireTS('../src/game/data/world04Scrapyard.ts');
const { evaluateWorld04Air, advanceWorld04AirClock } = requireTS('../src/game/systems/world04AirState.ts');
const { World04AirSystem } = requireTS('../src/game/systems/World04AirSystem.ts');
const l = getWorld04Layout('world-04-stage-4'), crane = l.objects.find(o => o.kind === 'crane'), saw = l.objects.find(o => o.kind === 'saw'), swing = l.objects.find(o => o.kind === 'swing');
const near = (a, b) => assert.ok(Math.abs(a - b) < .001, `${a} vs ${b}`);
test('all eight crane leg boundaries join continuously, raised payload permits walking but blocks jumping', () => {
  for (const ms of [0, 800, 1400, 2000, 2600, 3400, 4000, 4600, 5200]) {
    const pose = evaluateWorld04Air(crane, ms); const next = evaluateWorld04Air(crane, ms + .001);
    assert.ok(Math.abs(pose.rect.x - next.rect.x) < .001); assert.ok(Math.abs(pose.rect.y - next.rect.y) < .001);
  }
  assert.deepEqual(evaluateWorld04Air(crane, 0), evaluateWorld04Air(crane, 5200 * 9));
  assert.equal(evaluateWorld04Air(crane, 550).warning, true);
  const high = evaluateWorld04Air(crane, 1400).rect; assert.equal(high.y + high.height, 410);
  assert.ok(high.y + high.height < 464); assert.ok(high.y + high.height > 371);
  assert.equal(evaluateWorld04Air(crane, NaN).rect.y, crane.payload.y);
});
test('swing and saw exact endpoints and local clocks start only at crossing', () => {
  near(evaluateWorld04Air(swing, 0).circle.center.y, swing.pivot.y + 150);
  near(evaluateWorld04Air(swing, 550).circle.center.x, swing.pivot.x + 150 * Math.sin(.75));
  near(evaluateWorld04Air(swing, 1650).circle.center.x, swing.pivot.x - 150 * Math.sin(.75));
  near(evaluateWorld04Air(saw, 0).circle.center.x, saw.fromX); near(evaluateWorld04Air(saw, 900).circle.center.x, saw.toX);
  near(evaluateWorld04Air(saw, 1800).circle.center.x, saw.fromX);
  let s = { id: saw.id, started: false, elapsedMs: 0 };
  s = advanceWorld04AirClock(saw, s, 0, 10, 50); assert.equal(s.started, false);
  s = advanceWorld04AirClock(saw, s, saw.triggerX - 1, saw.triggerX, 50); assert.equal(s.elapsedMs, 0);
  s = advanceWorld04AirClock(saw, s, saw.triggerX, saw.triggerX + 1, 50); assert.equal(s.elapsedMs, 50);
});
test('runtime circle damage, dash exception, physical sweep, pause and reset cannot damage across teleport', () => {
  const h = world04Harness(96), system = new World04AirSystem(h.scene, h.player, { ...l, objects: [saw, crane] }, h.port);
  h.port.kill = (id, risk) => { if (risk === 'attack' && h.port.isDashing()) return false; h.deaths.push({ id, risk }); h.move(96); system.resetForAttempt(96); return true; };
  h.setDashing(true); h.move(saw.fromX, saw.centerY + 20); assert.equal(system.update(16), false);
  h.setDashing(false); assert.equal(system.update(16), true); assert.equal(h.deaths[0].risk, 'attack');
  assert.equal(system.update(16), false);
  h.setDashing(true); h.move(crane.payload.x - 100); system.resetForAttempt(h.player.x); h.move(crane.payload.x + 200);
  assert.equal(system.update(16), true); assert.equal(h.deaths.at(-1).risk, 'physical');
  const old = structuredClone(system.getDebugState()); h.setActive(false); system.update(50); assert.deepEqual(system.getDebugState(), old);
  system.destroy(); system.destroy(); assert.ok(h.objects.every(o => o.destroyed)); assert.ok(h.colliders.every(c => c.destroyed));
});
