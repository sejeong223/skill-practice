import assert from 'node:assert/strict';
import test from 'node:test';
import { requireTS, world04Harness } from './world04-test-fixtures.mjs';
const { PlayerController } = requireTS('../src/game/systems/PlayerController.ts');
const { DEFAULT_PLAYER_TUNING } = requireTS('../src/game/entities/playerTypes.ts');
function setup() { const h = world04Harness(); const input = { snapshot: { left: false, right: false, jumpPressed: false }, getSnapshot() { return this.snapshot; } }; return { ...h, input, controller: new PlayerController(h.player, input, DEFAULT_PLAYER_TUNING) }; }
test('surface modifiers affect target speed once and clear on departure', () => {
  const { player, controller, input } = setup();
  player.body.velocity.x = 0; input.snapshot.right = true; controller.update(0, 50); assert.equal(player.body.velocity.x, 90);
  controller.setSurfaceModifier({ acceleration: 900, deceleration: 360, conveyorVelocityX: -90 });
  player.body.velocity.x = 0; controller.update(0, 50); assert.equal(player.body.velocity.x, 45);
  for (let i = 0; i < 100; i++) controller.update(0, 50); assert.equal(player.body.velocity.x, 150);
  input.snapshot.right = false; controller.update(0, 50); assert.equal(player.body.velocity.x, 132);
  controller.clearSurfaceModifier(); controller.update(0, 50); assert.equal(player.body.velocity.x, 22);
  controller.update(0, 50); assert.equal(player.body.velocity.x, 0);
});
test('air, dash and disabled control ignore conveyor; surface launch preserves dash and normal jump event', () => {
  const { player, controller, input } = setup();
  controller.setSurfaceModifier({ acceleration: 900, deceleration: 360, conveyorVelocityX: -90 });
  player.body.blocked.down = false; player.body.touching.down = false; player.body.velocity.x = 0;
  input.snapshot.right = true; controller.update(0, 50); assert.equal(player.body.velocity.x, 90);
  controller.startDash(); controller.update(0, 50); assert.equal(player.body.velocity.x, 480);
  assert.equal(controller.launchFromSurface(-620), true); assert.equal(player.body.velocity.y, -620); assert.equal(controller.isDashing(), true);
  assert.deepEqual(player.events[0], ['player-jump-started', { kind: 'normal', facingLeft: false }]);
  controller.setControlEnabled(false); assert.equal(controller.launchFromSurface(-620), false);
  controller.update(0, 50); assert.equal(player.body.velocity.x, 0);
  assert.throws(() => controller.launchFromSurface(0)); assert.throws(() => controller.launchFromSurface(NaN));
  assert.throws(() => controller.setSurfaceModifier({ acceleration: -1, deceleration: null, conveyorVelocityX: 0 }));
});
