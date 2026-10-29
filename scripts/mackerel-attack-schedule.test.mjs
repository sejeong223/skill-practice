import assert from "node:assert/strict";
import test from "node:test";
import { MackerelAttackSchedule } from "../src/game/systems/mackerelAttackSchedule.ts";

function fire(schedule, count) {
  return Array.from({ length: count }, () => {
    schedule.reserve();
    return schedule.commit();
  });
}

test("첫 세 발사는 각 공격 한 번씩, 이후와 두 발 연계는 직전 중복 없이 나온다", () => {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const schedule = new MackerelAttackSchedule("world-03-stage-boss", attempt);
    const sequence = fire(schedule, 60);
    assert.deepEqual(new Set(sequence.slice(0, 3)), new Set(["brick", "cement-wave", "cement-lump"]));
    for (let index = 1; index < sequence.length; index += 1) {
      assert.notEqual(sequence[index], sequence[index - 1]);
    }
    assert.equal(schedule.getLastAttack(), sequence.at(-1));
  }
});

test("준비 취소는 발사 순서를 소비하지 않고, 재예약은 같은 공격이다", () => {
  const schedule = new MackerelAttackSchedule("world-03-stage-boss", 3);
  assert.throws(() => schedule.commit(), /reserved/);
  const first = schedule.reserve();
  assert.equal(schedule.reserve(), first);
  schedule.cancel();
  assert.equal(schedule.reserve(), first);
  assert.equal(schedule.commit(), first);
  fire(schedule, 2);
  const fourth = schedule.reserve();
  schedule.cancel();
  assert.equal(schedule.reserve(), fourth);
  schedule.commit();
});

test("같은 시도로 리셋하면 재현되고, 새 시도에는 다른 순서가 나온다", () => {
  const schedule = new MackerelAttackSchedule("world-03-stage-boss", 1);
  const original = fire(schedule, 20);
  schedule.reset(1);
  assert.deepEqual(fire(schedule, 20), original);
  const sequences = new Set();
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    schedule.reset(attempt);
    sequences.add(fire(schedule, 10).join(","));
  }
  assert.ok(sequences.size > 1);
  for (const invalid of [0, -1, 1.5, NaN]) assert.throws(() => schedule.reset(invalid), /positive integer/);
});
