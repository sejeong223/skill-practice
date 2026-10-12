import { test } from "node:test";
import assert from "node:assert/strict";
import { createSamoyedSurge, sampleSamoyedDog, SAMOYED_SIZE } from "../src/game/systems/samoyedSurge.ts";

test("화면 밖5마리가 코기 주변으로 연속 진입하고 퇴장한다", () => {
  for (const left of [0, 320, 640]) {
    const origin = { x: left + 640, floorY: 512 };
    const surge = createSamoyedSurge(origin, { left, right: left + 1280 }, 99);
    assert.equal(surge.dogs.length, 5);
    assert.ok(surge.dogs.every(d => sampleSamoyedDog(d, 0).x + SAMOYED_SIZE.width / 2 < left));
    assert.deepEqual(surge.dogs.map(d => sampleSamoyedDog(d, 930).x - origin.x), [-64, -32, 0, 32, 64]);
    for (const dog of surge.dogs) {
      for (const time of [dog.delayMs, dog.delayMs + 650, 2200, 2500]) {
        const before = sampleSamoyedDog(dog, time - 0.001);
        const after = sampleSamoyedDog(dog, time + 0.001);
        assert.ok(Math.abs(after.x - before.x) < 0.1);
        assert.ok(Math.abs(after.y - before.y) < 0.1);
      }
      assert.equal(sampleSamoyedDog(dog, 1000).phase, "covering");
      assert.equal(sampleSamoyedDog(dog, 1000).y, 512);
      assert.equal(sampleSamoyedDog(dog, 2200).phase, "leaving");
      assert.equal(sampleSamoyedDog(dog, 2500).phase, "done");
      assert.ok(sampleSamoyedDog(dog, 2500).x - SAMOYED_SIZE.width / 2 > left + 1280);
      for (let t = 0; t <= 2500; t += 10) assert.ok(Math.abs(sampleSamoyedDog(dog, t).y - 512) <= 2);
    }
  }
});

test("위치는 dt 분할과 무관하고 잘못된 마릿수는 최소1로 정규화한다", () => {
  for (const count of [0, -1, NaN, Infinity, 1.2]) {
    assert.equal(createSamoyedSurge({ x: 600, floorY: 512 }, { left: 0, right: 1280 }, 0, count).dogs.length, 1);
  }
  const path = createSamoyedSurge({ x: 600, floorY: 512 }, { left: 0, right: 1280 }, 0).dogs[0];
  for (const steps of [1, 30, 60, 120]) {
    let elapsed = 0;
    for (let i = 0; i < steps; i++) elapsed += 900 / steps;
    assert.deepEqual(sampleSamoyedDog(path, elapsed), sampleSamoyedDog(path, 900));
  }
});
