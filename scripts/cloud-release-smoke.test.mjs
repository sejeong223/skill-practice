import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { TARGET, validateOrigin, validateConfig, validateManifest, cleanupOwned, runHttpSmoke, safeFailure } from "./cloud-release-smoke.mjs";
import { activeAccount } from "./cloud-test-support.mjs";
import { GAME_AUTH_HEADER } from "../src/game/cloud/contracts.ts";

const config = () => ({ tenantId: TARGET.tenant, cosmosTenantId: TARGET.tenant, apiClientId: TARGET.api,
  webClientId: TARGET.web, scope: "access_as_user", cosmosClientId: TARGET.api, cosmosClientSecret: "fixture-only",
  cosmosEndpoint: TARGET.endpoint, database: TARGET.database, container: TARGET.container, testObjectIds: new Set() });
const manifestFor = run => ({ version: 1, endpoint: TARGET.endpoint, database: TARGET.database, container: TARGET.container, runs: [run] });
const manifest = () => { const runId = randomUUID(); return manifestFor({ runId, playerId: `test:${TARGET.tenant}:${runId}`, docIds: ["profile", "receipt:" + randomUUID()] }); };

test("origin rejects arbitrary hosts, credentials, ports, query and paths before any HTTP request", async () => {
  assert.equal(validateOrigin(TARGET.origin + "/"), TARGET.origin);
  for (const value of ["http://" + new URL(TARGET.origin).host, "https://other.azurestaticapps.net", TARGET.origin + "/api", TARGET.origin + "?x=1",
    TARGET.origin + "#x", TARGET.origin + ":444", TARGET.origin.replace("https://", "https://user:pass@"), "garbage"]) {
    let calls = 0;
    const result = await runHttpSmoke(value, { fetchImpl: () => { calls++; } });
    assert.equal(calls, 0); assert.deepEqual(result.failed, ["H00_ORIGIN:ORIGIN_GUARD"]);
  }
});
test("SDK guards reject other scopes and key authentication", () => {
  assert.equal(validateConfig(config()).database, TARGET.database);
  for (const patch of [{ tenantId: randomUUID() }, { apiClientId: randomUUID() }, { cosmosClientId: randomUUID() }, { webClientId: randomUUID() },
    { cosmosTenantId: randomUUID() }, { database: "other" }, { container: "other" }, { cosmosEndpoint: TARGET.endpoint.replace(".com/", ".com:444/") },
    { cosmosClientSecret: "" }, { key: "fixture-only" }, { credential: {} }, { connectionString: "fixture-only" }]) {
    assert.throws(() => validateConfig({ ...config(), ...patch }));
  }
});
function httpFixture(transform = () => {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url.origin, TARGET.origin); assert.equal(options.redirect, "manual"); assert.ok(options.signal instanceof AbortSignal);
    const path = url.pathname;
    let status = 200, body = "ok", headers = { "content-type": "text/html" };
    if (path === "/") body = '<script src="/_next/static/chunks/test.js"></script>';
    else if (path.endsWith("test.js")) { body = "const ok=true;"; headers["content-type"] = "application/javascript"; }
    else if (path.endsWith("menu-shop.png")) { body = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); headers["content-type"] = "image/png"; }
    else if (path === "/auth/redirect/") headers["cache-control"] = "no-store";
    else if (path === "/api/game/bootstrap" || path === "/api/game/save") {
      status = 401; body = JSON.stringify({ error: { code: "UNAUTHENTICATED" } });
      headers = { "content-type": "application/json", "cache-control": "no-store" };
    } else status = 404;
    const value = { status, body, headers }; transform(path, value, options);
    return new Response(value.body, { status: value.status, headers: value.headers });
  };
  return { calls, fetchImpl };
}
test("HTTP smoke covers assets, bridge, denied API calls and hidden server files", async () => {
  const fixture = httpFixture(), result = await runHttpSmoke(TARGET.origin, fixture);
  assert.deepEqual(result.failed, []); assert.equal(result.passed.length, 15); assert.equal(fixture.calls.length, 14);
  assert.ok(fixture.calls.some(c => c.options.method === "POST"));
});
test("HTTP detects SPA fallback, unsafe bridge headers, token reflection and cross-origin redirects", async () => {
  for (const [path, change, expected] of [
    ["/.env", value => { value.status = 200; }, "H09_ENV:ASSERTION"],
    ["/auth/redirect/", value => { value.headers["cross-origin-opener-policy"] = "same-origin"; }, "H04_BRIDGE:COOP_PRESENT"],
    ["/api/game/save", (value, options) => { value.body = JSON.stringify({ error: { code: "UNAUTHENTICATED", message: options.headers[GAME_AUTH_HEADER] } }); }, "H08_FORGED_POST:TOKEN_REFLECTED"],
    ["/", value => { value.status = 302; value.headers.location = "https://unrelated.example/"; }, "H01_ROOT:REDIRECT_GUARD"],
    ["/", value => { value.status = 302; value.headers.location = TARGET.origin + "/"; }, "H01_ROOT:REDIRECT_LIMIT"],
  ]) {
    const fixture = httpFixture((p, value, options) => { if (p === path) change(value, options); });
    const result = await runHttpSmoke(TARGET.origin, fixture); assert.ok(result.failed.includes(expected));
  }
});
test("manifest rejects prod, another tenant/scope, unmatched run ownership, paths and unknown properties", () => {
  const good = manifest(); assert.equal(validateManifest(good), good);
  for (const modify of [m => { m.database = "other"; }, m => { m.container = "other"; }, m => { m.secret = "fixture"; },
    m => { m.runs[0].playerId = m.runs[0].playerId.replace("test:", "prod:"); },
    m => { m.runs[0].runId = randomUUID(); }, m => { m.runs[0].docIds.push("../other"); },
    m => { m.runs[0].docIds.push("receipt:bad"); }, m => { m.runs.push(m.runs[0]); }]) {
    const value = structuredClone(good); modify(value); assert.throws(() => validateManifest(value));
  }
});
async function cleanupFixture(resolved404 = false) {
  const owned = manifest(), run = owned.runs[0];
  const id = { tenantId: TARGET.tenant, objectId: run.runId, namespace: "test", playerId: run.playerId };
  const account = await activeAccount(undefined, id), docs = new Map(), deleted = [], persisted = [];
  const profile = (await account.repo.readAccount(id)).profile.value;
  docs.set("profile", { ...profile, _etag: "etag-fixture" });
  const container = { id: TARGET.container, database: { id: TARGET.database }, item: (docId, playerId) => {
    assert.equal(playerId, run.playerId); assert.ok(run.docIds.includes(docId));
    return { read: async () => {
      if (!docs.has(docId)) { if (resolved404) return { statusCode: 404 }; throw { code: 404 }; }
      return { statusCode: 200, resource: docs.get(docId) };
    },
      delete: async options => { assert.equal(options.accessCondition.condition, "etag-fixture"); deleted.push(docId); docs.delete(docId); } };
  } };
  return { owned, run, docs, deleted, container, persisted, persist: async value => persisted.push(structuredClone(value)) };
}
test("cleanup deletes only exact owned documents, verifies absence, and resumes retained failures", async () => {
  for (const resolved404 of [false, true]) {
    const f = await cleanupFixture(resolved404);
    assert.equal(await cleanupOwned(config(), f.container, f.owned, f.persist), 0);
    assert.deepEqual(f.deleted, ["profile"]); assert.deepEqual(f.owned.runs, []); assert.ok(f.persisted.length);
  }
  const retry = await cleanupFixture(), original = retry.container.item;
  retry.container.item = (...args) => ({ ...original(...args), delete: async () => { throw { code: 403 }; } });
  assert.equal(await cleanupOwned(config(), retry.container, retry.owned, retry.persist), 1);
  assert.deepEqual(retry.owned.runs[0].docIds, ["profile"]); assert.deepEqual(retry.deleted, []);
  retry.container.item = original;
  assert.equal(await cleanupOwned(config(), retry.container, retry.owned, retry.persist), 0);
});
test("cleanup refuses real test accounts, wrong container and wrong document owner", async () => {
  const f = await cleanupFixture(), cfg = config(); cfg.testObjectIds.add(f.run.runId);
  await assert.rejects(cleanupOwned(cfg, f.container, f.owned, f.persist)); assert.deepEqual(f.deleted, []);
  await assert.rejects(cleanupOwned(config(), { ...f.container, id: "other" }, f.owned, f.persist));
  f.docs.get("profile").playerId = "prod:" + TARGET.tenant + ":" + f.run.runId;
  assert.equal(await cleanupOwned(config(), f.container, f.owned, f.persist), 1); assert.deepEqual(f.deleted, []);
});
test("errors expose only safe categories, never SDK response text or credential values", () => {
  assert.equal(safeFailure(new Error("fixture-private-value")), "UNAVAILABLE");
  assert.equal(safeFailure({ cause: { statusCode: 403, message: "fixture-private-value" } }), "STATUS_403");
  assert.equal(safeFailure({ statusCode: 429, body: "fixture-private-value" }), "STATUS_429");
});
