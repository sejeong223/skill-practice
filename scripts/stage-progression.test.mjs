import assert from "node:assert/strict";
import test from "node:test";
import { STAGE_IDS, getNextStageId } from "../src/game/core/constants.ts";

test("normal campaign stages advance in the declared order", () => {
  assert.equal(getNextStageId("world-01-stage-1"), "world-01-stage-2");
  assert.equal(getNextStageId("world-01-stage-4"), "world-01-stage-boss");
  assert.equal(getNextStageId("world-02-stage-1"), "world-02-stage-2");
});

test("world-one boss route points to the manual World 2 handoff", () => {
  assert.equal(getNextStageId("world-01-stage-boss"), "world-02-stage-1");
});

test("unknown and final campaign stages have no next stage", () => {
  assert.equal(getNextStageId("world-05-stage-boss"), null);
  assert.equal(getNextStageId("unknown-stage"), null);
  assert.equal(getNextStageId(STAGE_IDS.at(-1)), null);
});
