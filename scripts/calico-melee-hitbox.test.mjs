import assert from "node:assert/strict";
import test from "node:test";
import { isCalicoInSlipperReach } from "../src/game/systems/calicoMeleeHitbox.ts";

const calico = { x: 1232, y: 424, width: 96, height: 96 };

test("slipper hits from the left even when the corgi overlaps the boss center", () => {
  assert.equal(isCalicoInSlipperReach(1170, 500, 1, calico), true);
  assert.equal(isCalicoInSlipperReach(1270, 500, 1, calico), true);
  assert.equal(isCalicoInSlipperReach(1350, 500, -1, calico), true);
});

test("slipper misses out of reach, behind the corgi, and above the cat", () => {
  assert.equal(isCalicoInSlipperReach(1100, 500, 1, calico), false);
  assert.equal(isCalicoInSlipperReach(1200, 500, -1, calico), false);
  assert.equal(isCalicoInSlipperReach(1170, 300, 1, calico), false);
  assert.equal(isCalicoInSlipperReach(1120, 500, 1, calico), false);
});
