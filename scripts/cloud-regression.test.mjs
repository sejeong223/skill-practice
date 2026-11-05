import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { identity, fakeClock, InMemoryGameRepository } from "./cloud-test-support.mjs";
import { createGameService } from "../api/src/services/router.ts";
import { errorResponse } from "../api/src/http.ts";
import { GameApiClient } from "../src/game/persistence/cloud/GameApiClient.ts";
import { AccountCache } from "../src/game/persistence/cloud/AccountCache.ts";
import { CloudSaveCoordinator } from "../src/game/persistence/cloud/CloudSaveCoordinator.ts";
import { GAME_AUTH_HEADER } from "../src/game/cloud/contracts.ts";

async function fixture(t) {
  const repo = new InMemoryGameRepository(), now = fakeClock(), service = createGameService(repo, now);
  const accounts = new Map([["A", identity(randomUUID(), "test")], ["B", identity(randomUUID(), "test")]]);
  const routes = { bootstrap: "bootstrap", "session/acquire": "acquire", "session/heartbeat": "heartbeat",
    "session/release": "release", save: "save", reset: "reset", leaderboard: "leaderboard" };
  const requests = [], data = new Map();
  const cache = new AccountCache({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) });
  let loseNextSave = false;
  // Browser fetch checks its receiver; Node's fetch and arrow-function mocks do not.
  async function browserFetch(path, options) {
    if (this !== globalThis) throw new TypeError("Illegal invocation");
    assert.equal(options.headers.Authorization, undefined);
    const account = accounts.get(options.headers[GAME_AUTH_HEADER].slice(7));
    assert.ok(account);
    const route = routes[path.replace("/api/game/", "")];
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ account: account.playerId, route, body: structuredClone(body) });
    let response;
    try { response = await service(route, account, body); } catch (error) { response = errorResponse(error); }
    if (route === "save" && loseNextSave && response.status === 200) { loseNextSave = false; throw new TypeError("lost response"); }
    return new Response(response.status === 204 ? null : JSON.stringify(response.jsonBody), { status: response.status, headers: response.headers });
  }
  const apiFor = alias => new GameApiClient(async () => alias, browserFetch);
  async function session(alias = "A") {
    const api = apiFor(alias); await api.bootstrap();
    const sessionId = randomUUID(), bootstrap = await api.acquire({ requestId: randomUUID(), sessionId, takeover: false });
    const coordinator = new CloudSaveCoordinator({ api, cache, bootstrap, sessionId, now: () => now().getTime(),
      onStatus: () => {}, onAck: () => {}, random: () => 0 });
    t.after(() => coordinator.dispose());
    return { api, sessionId, coordinator, bootstrap };
  }
  return { repo, now, accounts, requests, cache, apiFor, session, loseSave: () => { loseNextSave = true; } };
}

test("browser receiver is valid for bootstrap and authenticated POST, without losing request options", async t => {
  const c = await fixture(t), a = await c.session();
  a.coordinator.observe({ kind: "state", stageId: "world-01-stage-1" }, a.bootstrap.current.progress);
  await a.coordinator.flush();
  assert.equal(a.coordinator.getStatus(), "idle");
  assert.equal(c.requests.filter(r => r.route === "save").length, 1);
  assert.equal(a.coordinator.getBootstrap().current.version, a.bootstrap.current.version + 1);
});

test("lost ACK retry across client, service and cache commits once and stays isolated from another account", async t => {
  const c = await fixture(t), a = await c.session(), b = await c.session("B"), otherBefore = await b.api.bootstrap();
  const progress = structuredClone(a.bootstrap.current.progress); progress.playerName = "검증코기";
  c.loseSave(); a.coordinator.observe({ kind: "state", stageId: "world-01-stage-1" }, progress);
  await assert.rejects(a.coordinator.flush(), e => e.status === 503);
  assert.equal(a.coordinator.getStatus(), "reconnecting");
  assert.ok(c.cache.read(c.accounts.get("A").playerId, a.sessionId).inFlight);
  assert.equal(c.cache.read(c.accounts.get("B").playerId, a.sessionId), null);
  c.now.advance(1001); await a.coordinator.retry();
  const saves = c.requests.filter(r => r.route === "save");
  assert.deepEqual(saves[0].body, saves[1].body);
  assert.equal(a.coordinator.getBootstrap().current.version, a.bootstrap.current.version + 1);
  assert.equal(c.cache.read(c.accounts.get("A").playerId, a.sessionId).inFlight, null);
  const otherAfter = await b.api.bootstrap();
  assert.deepEqual(otherAfter.current, otherBefore.current); assert.equal(otherAfter.displayName, otherBefore.displayName);
});

test("explicit takeover rejects old generation and freezes the old client without touching either account", async t => {
  const c = await fixture(t), a = await c.session(), b = await c.session("B");
  const otherBefore = await b.api.bootstrap(), competitor = { requestId: randomUUID(), sessionId: randomUUID(), takeover: false };
  await assert.rejects(a.api.acquire(competitor), e => e.code === "SESSION_CONFLICT");
  a.coordinator.observe({ kind: "state", stageId: "world-01-stage-1" }, a.bootstrap.current.progress);
  const takeover = await a.api.acquire({ ...competitor, takeover: true });
  assert.equal(takeover.lease.generation, a.bootstrap.lease.generation + 1);
  const snapshot = c.repo.snapshot();
  await assert.rejects(a.coordinator.flush(), e => e.code === "SESSION_LOST");
  assert.equal(a.coordinator.getStatus(), "session-lost"); assert.deepEqual(c.repo.snapshot(), snapshot);
  assert.deepEqual((await b.api.bootstrap()).current, otherBefore.current);
});

test("checkpoint ACK, restored checkpoint, and reset preserve the earned best through the real client", async t => {
  const c = await fixture(t), a = await c.session();
  const progress = structuredClone(a.bootstrap.current.progress), first = "world-01-stage-1", second = "world-01-stage-2";
  progress.playerName = "검증코기";
  a.coordinator.observe({ kind: "stage-enter", stageId: first, seed: 5, world02Travel: {} }, progress);
  progress.clearedStages.push(first); a.coordinator.observe({ kind: "stage-complete", stageId: first }, progress);
  a.coordinator.observe({ kind: "stage-enter", stageId: second, seed: 5, world02Travel: {} }, progress);
  progress.deathsTotal = 2; progress.deathsByStage[second] = 2;
  const checkpoint = { kind: "checkpoint", stageId: second, origin: "reached", snapshot: {
    checkpointId: second + "-checkpoint", stageId: second, x: 500, y: 440, facing: 1, randomSeed: 5,
    mapSnapshotVersion: 0, contentVersion: 1, capturedAt: 100, mapSnapshot: null } };
  a.coordinator.observe(checkpoint, progress); await a.coordinator.flush();
  const earned = a.coordinator.getBootstrap(); assert.equal(earned.best.progressRank, 101);
  a.coordinator.observe({ ...checkpoint, origin: "restored" }, progress); await a.coordinator.flush();
  assert.deepEqual(a.coordinator.getBootstrap().best, earned.best);
  const reset = await a.coordinator.reset();
  assert.notEqual(reset.current.runId, earned.current.runId); assert.deepEqual(reset.best, earned.best);
  assert.equal(reset.current.progress.deathsTotal, 0); assert.equal(reset.displayName, "검증코기");
  assert.equal((await c.repo.readAccount(c.accounts.get("A"))).best.value.eligible, false);
});
