import assert from "node:assert/strict";
import test from "node:test";
import {
  BARK_BOSS_RANGE_PX,
  BARK_BOSS_RESTUN_MS,
  BARK_BOSS_STUN_MS,
  beginBossBarkStun,
  tickBossBarkStun,
} from "../src/game/systems/bossBarkStun.ts";

const ready = { remainingMs: 0, nextAllowedAt: 0 };

test("짖기는 활성 보스의 320px 경계 안에서만 경직을 시작한다", () => {
  assert.equal(beginBossBarkStun(ready, 1000, BARK_BOSS_RANGE_PX + 1, true), null);
  assert.equal(beginBossBarkStun(ready, 1000, 100, false), null);
  assert.deepEqual(beginBossBarkStun(ready, 1000, BARK_BOSS_RANGE_PX, true), {
    remainingMs: BARK_BOSS_STUN_MS,
    nextAllowedAt: 1000 + BARK_BOSS_RESTUN_MS,
  });
});

test("1200ms 경직 중 또는 3000ms 재경직 대기 중에는 다시 멈추지 않는다", () => {
  const started = beginBossBarkStun(ready, 1000, 120, true);
  assert.ok(started);
  assert.equal(beginBossBarkStun(started, 2000, 120, true), null);

  let current = started;
  for (let frame = 0; frame < 24; frame += 1) {
    current = tickBossBarkStun(current, 50);
  }
  assert.equal(current.remainingMs, 0);
  assert.equal(current.nextAllowedAt, 4000);
  assert.equal(beginBossBarkStun(current, 3999, 120, true), null);
  assert.deepEqual(beginBossBarkStun(current, 4000, 120, true), {
    remainingMs: BARK_BOSS_STUN_MS,
    nextAllowedAt: 4000 + BARK_BOSS_RESTUN_MS,
  });
});

test("경직 시간은 음수 프레임을 무시하고 0 아래로 내려가지 않는다", () => {
  const started = beginBossBarkStun(ready, 1000, 120, true);
  assert.ok(started);
  assert.deepEqual(tickBossBarkStun(started, -200), started);
  assert.deepEqual(tickBossBarkStun(started, 5000), {
    remainingMs: 0,
    nextAllowedAt: started.nextAllowedAt,
  });
});
