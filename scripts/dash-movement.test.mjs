import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerController } = require('../src/game/systems/PlayerController.ts');

function harness({ facingLeft = false, grounded = true } = {}) {
  const input = { snapshot: { left: false, right: false, jumpPressed: false }, getSnapshot() { return this.snapshot; } };
  const player = {
    flipX: facingLeft, locked: false, override: null, events: [],
    body: { blocked: { down: grounded }, touching: { down: grounded }, velocity: { x: 0, y: 0 }, setGravityY() {} },
    setVelocityX(x) { this.body.velocity.x = x; },
    setVelocityY(y) { this.body.velocity.y = y; },
    setFlipX(value) { this.flipX = value; },
    getControlOverride() { return this.override; },
    isControlLocked() { return this.locked; },
    setAnimationState() {}, emit(name, payload) { this.events.push({ name, payload }); },
  };
  const tuning = { gravityY: 900, coyoteTimeMs: 100, jumpBufferMs: 100,
    jumpVelocity: -420, runSpeed: 240, acceleration: 1200, deceleration: 1600 };
  return { controller: new PlayerController(player, input, tuning), player, input };
}

test('ground and air dash hold launch direction for 250ms and travel 120px at 480px/s', () => {
  for (const grounded of [true, false]) {
    const { controller, player, input } = harness({ facingLeft: true, grounded });
    assert.equal(controller.startDash(), true);
    assert.equal(player.body.velocity.x, -480);
    input.snapshot.right = true;
    let distance = 0;
    for (let frame = 0; frame < 5; frame++) {
      distance += player.body.velocity.x * 0.05;
      if (frame < 4) {
        controller.update(0, 50);
        assert.equal(player.body.velocity.x, -480);
        assert.equal(player.flipX, true);
      }
    }
    assert.equal(distance, -120);
    controller.update(0, 50);
    assert.equal(controller.isDashing(), false);
    controller.update(0, 50);
    assert.ok(player.body.velocity.x > -480);
  }
});

test('dash keeps jump/gravity, ignores cement, and cancels on control loss', () => {
  const { controller, player, input } = harness();
  assert.equal(controller.startDash(), true);
  controller.applyCementSlow(1000);
  assert.equal(controller.getCementSlowRemainingMs(), 0);
  assert.equal(player.body.velocity.x, 480);
  input.snapshot.jumpPressed = true;
  controller.update(0, 16);
  assert.equal(player.body.velocity.y, -420);
  assert.equal(player.events[0].name, 'player-jump-started');
  assert.equal(controller.isDashing(), true);
  player.locked = true;
  controller.update(0, 16);
  assert.equal(controller.isDashing(), false);
  assert.ok(player.body.velocity.x < 480);
  player.locked = false;
  assert.equal(controller.startDash(), true);
  controller.setControlEnabled(false);
  assert.equal(controller.isDashing(), false);
  assert.equal(player.body.velocity.x, 0);
});
