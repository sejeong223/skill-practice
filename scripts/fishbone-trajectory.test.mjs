import assert from "node:assert/strict";
import test from "node:test";
import {
  createFishboneTrajectory,
  fishbonePositionAt,
} from "../src/game/systems/fishboneTrajectory.ts";

function assertNear(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`);
}

test("calico cycles a straight low throw and two distinct arcs", () => {
  const throws = [1, 2, 3, 4].map((index) =>
    createFishboneTrajectory(1224, 784, 500, index),
  );
  assert.deepEqual(throws.map(({ pattern }) => pattern), ["low", "mid", "high", "low"]);

  for (const trajectory of throws) {
    const start = fishbonePositionAt(trajectory, 0);
    const end = fishbonePositionAt(trajectory, trajectory.durationSeconds);
    assertNear(start.x, trajectory.startX);
    assertNear(start.y, trajectory.startY);
    assertNear(end.x, trajectory.targetX);
    assertNear(end.y, trajectory.targetY);
  }

  const middle = throws.map((trajectory) =>
    fishbonePositionAt(trajectory, trajectory.durationSeconds / 2).y,
  );
  assertNear(middle[0], 498);
  assert.ok(middle[1] < middle[0] - 40);
  assert.ok(middle[2] < middle[1] - 40);
});

test("throws travel toward the player from either side and clamp aerial aim", () => {
  const left = createFishboneTrajectory(1224, 784, 500, 2);
  const right = createFishboneTrajectory(1336, 1700, 300, 3);
  assert.ok(left.velocityX < 0);
  assert.ok(right.velocityX > 0);
  assert.equal(right.targetY, 435);
  assertNear(fishbonePositionAt(right, right.durationSeconds).x, 1700);
  assertNear(fishbonePositionAt(right, right.durationSeconds).y, 435);
});
