import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, lstat, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { loadServerConfig } from "../api/src/config.ts";
import { ACCOUNT_IDS, parseDocument } from "../api/src/documents.ts";
import { CosmosGameRepository } from "../api/src/repository.ts";
import { bootstrapAccount } from "../api/src/services/account.ts";
import { acquireSession } from "../api/src/services/session.ts";
import { resetProgress, saveProgress } from "../api/src/services/save.ts";
import { GAME_AUTH_HEADER } from "../src/game/cloud/contracts.ts";

export const TARGET = Object.freeze({
  origin: "https://polite-rock-0f80d2a00.5.azurestaticapps.net",
  tenant: "69c1e470-4528-435a-a1ae-de98e0aac738",
  api: "a2e3f4fa-56e5-4ab5-ba41-43cb974b8722",
  web: "e467e8bc-c900-4d08-88be-7f0a5fce2474",
  endpoint: "https://maze-rescue-ms-b7af62a9.documents.azure.com/",
  database: "legendary-rib-corgi", container: "game-data",
});
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const freshResult = () => ({ passed: [], failed: [], remainingTestDocuments: 0 });
class SmokeError extends Error {}
function guard(ok, code) { if (!ok) throw new SmokeError(code); }
function statusOf(error) {
  for (let depth = 0; error && depth < 8; depth++, error = error.cause) {
    const status = Number(error.statusCode ?? error.status ?? error.code);
    if (status) return status;
  }
  return 0;
}
async function isMissing(item) {
  try { return (await item.read({ abortSignal: AbortSignal.timeout(10000) })).statusCode === 404; }
  catch (error) { if (statusOf(error) === 404) return true; throw error; }
}
export function safeFailure(error) {
  if (error instanceof SmokeError) return error.message;
  const status = statusOf(error);
  if ([401, 403, 404, 409, 412, 429, 503].includes(status)) return `STATUS_${status}`;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "TIMEOUT";
  if (error?.code === "ERR_ASSERTION") return "ASSERTION";
  return "UNAVAILABLE";
}
async function check(result, id, operation) {
  try { await operation(); result.passed.push(id); return true; }
  catch (error) { result.failed.push(`${id}:${safeFailure(error)}`); return false; }
}
export function validateOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new SmokeError("ORIGIN_GUARD"); }
  guard(url.origin === TARGET.origin && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash,
    "ORIGIN_GUARD");
  return url.origin;
}
export function validateConfig(config) {
  guard(config && config.tenantId === TARGET.tenant && config.cosmosTenantId === TARGET.tenant &&
    config.apiClientId === TARGET.api && config.cosmosClientId === TARGET.api && config.webClientId === TARGET.web &&
    config.database === TARGET.database && config.container === TARGET.container && config.scope === "access_as_user" && config.testObjectIds instanceof Set &&
    typeof config.cosmosClientSecret === "string" && config.cosmosClientSecret.trim().length > 0 &&
    !["key", "connectionString", "credential", "aadCredentials", "cosmosKey"].some(key => key in config), "CONFIG_GUARD");
  let endpoint;
  try { endpoint = new URL(config.cosmosEndpoint); } catch { throw new SmokeError("CONFIG_GUARD"); }
  guard(endpoint.href === TARGET.endpoint, "CONFIG_GUARD");
  return config;
}
export async function readLocalConfig(env = process.env) {
  // Only the explicitly ignored Functions settings file or process environment is accepted.
  let values = {};
  try {
    const local = JSON.parse(await readFile(resolve(ROOT, "api/local.settings.json"), "utf8"));
    guard(local.IsEncrypted === false && local.Values && typeof local.Values === "object", "LOCAL_CONFIG_INVALID");
    values = local.Values;
  } catch (error) { if (error.code !== "ENOENT") throw new SmokeError("LOCAL_CONFIG_INVALID"); }
  const combined = { ...values, ...env };
  guard(!["GAME_COSMOS_KEY", "COSMOS_KEY", "AZURE_COSMOS_KEY", "COSMOS_CONNECTION_STRING", "GAME_COSMOS_CONNECTION_STRING"]
    .some(key => combined[key]), "KEY_AUTH_FORBIDDEN");
  guard(combined.GAME_COSMOS_CLIENT_SECRET?.trim(), "CREDENTIAL_MISSING");
  return validateConfig(loadServerConfig(combined));
}

export async function runHttpSmoke(baseUrl, { fetchImpl = fetch } = {}) {
  const result = freshResult();
  if (!await check(result, "H00_ORIGIN", () => validateOrigin(baseUrl))) return result;
  const origin = validateOrigin(baseUrl);
  async function request(path, options = {}) {
    let url = new URL(path, origin);
    const signal = AbortSignal.timeout(10000);
    for (let attempt = 0; attempt < 5; attempt++) {
      guard(url.origin === origin && !url.username && !url.password, "REDIRECT_GUARD");
      const response = await fetchImpl(url, { ...options, redirect: "manual", signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        guard(location && (!options.method || options.method === "GET"), "REDIRECT_GUARD");
        url = new URL(location, url); await response.body?.cancel(); continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      guard(bytes.length <= 10 * 1024 * 1024, "RESPONSE_SIZE");
      return { response, bytes, body: bytes.toString("utf8") };
    }
    throw new SmokeError("REDIRECT_LIMIT");
  }
  const typeIs = (r, type) => guard(type.test(r.headers.get("content-type") ?? ""), "CONTENT_TYPE");
  const noStore = r => guard(/(?:^|[,\s])no-store(?:[,\s]|$)/i.test(r.headers.get("cache-control") ?? ""), "CACHE_CONTROL");
  let scriptPath;
  await check(result, "H01_ROOT", async () => {
    const { response, body } = await request("/");
    assert.equal(response.status, 200); typeIs(response, /text\/html/i);
    scriptPath = body.match(/src=["']([^"']*\/_next\/static\/[^"']+\.js(?:\?[^"']*)?)["']/)?.[1];
    guard(scriptPath, "SCRIPT_MISSING");
  });
  await check(result, "H02_JS", async () => {
    guard(scriptPath, "SCRIPT_MISSING");
    const { response, body } = await request(scriptPath);
    assert.equal(response.status, 200); typeIs(response, /(?:javascript|ecmascript)/i);
    guard(!/^\s*</.test(body) && body.length > 0, "ASSET_FALLBACK");
  });
  await check(result, "H03_PNG", async () => {
    const { response, bytes } = await request("/assets/pixel/ui/menu-shop.png");
    assert.equal(response.status, 200); typeIs(response, /image\/png/i);
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
  await check(result, "H04_BRIDGE", async () => {
    const { response } = await request("/auth/redirect/");
    assert.equal(response.status, 200); typeIs(response, /text\/html/i); noStore(response);
    guard(!response.headers.get("cross-origin-opener-policy"), "COOP_PRESENT");
  });
  for (const [id, path] of [
    ["H05_MISSING", "/assets/pixel/__release-smoke-missing__.png"], ["H09_ENV", "/.env"],
    ["H10_LOCAL_SETTINGS", "/api/local.settings.json"], ["H11_SERVER_SOURCE", "/api/src/config.ts"],
    ["H12_SERVER_PACKAGE", "/build/game-api/package.json"], ["H13_SERVER_DIST", "/api/dist/functions/game.js"],
  ]) await check(result, id, async () => { assert.equal((await request(path)).response.status, 404); });
  const malformed = "release-smoke-invalid." + randomUUID();
  for (const [id, path, options] of [
    ["H06_NO_AUTH", "/api/game/bootstrap", {}],
    ["H07_FORGED_GET", "/api/game/bootstrap", { headers: { [GAME_AUTH_HEADER]: "Bearer " + malformed } }],
    ["H08_FORGED_POST", "/api/game/save", { method: "POST", headers: { [GAME_AUTH_HEADER]: "Bearer " + malformed, "content-type": "application/json" }, body: "{}" }],
    ["H14_PLATFORM_HEADER", "/api/game/bootstrap", { headers: { authorization: "Bearer " + malformed } }],
  ]) await check(result, id, async () => {
    const { response, body } = await request(path, options);
    assert.equal(response.status, 401); typeIs(response, /application\/json/i); noStore(response);
    guard(!body.includes(malformed), "TOKEN_REFLECTED");
    assert.equal(JSON.parse(body).error?.code, "UNAUTHENTICATED");
  });
  return result;
}

export function validateManifest(manifest) {
  guard(manifest && Object.keys(manifest).sort().join() === "container,database,endpoint,runs,version" &&
    manifest.version === 1 && manifest.endpoint === TARGET.endpoint && manifest.database === TARGET.database &&
    manifest.container === TARGET.container && Array.isArray(manifest.runs) && manifest.runs.length <= 100, "MANIFEST_GUARD");
  const seen = new Set();
  for (const run of manifest.runs) {
    guard(run && Object.keys(run).sort().join() === "docIds,playerId,runId" && UUID.test(run.runId) &&
      run.playerId === `test:${TARGET.tenant}:${run.runId}` && !seen.has(run.runId) &&
      Array.isArray(run.docIds) && run.docIds.length <= 100 && new Set(run.docIds).size === run.docIds.length &&
      run.docIds.every(id => ACCOUNT_IDS.includes(id) || typeof id === "string" && id.startsWith("receipt:") && UUID.test(id.slice(8))),
    "MANIFEST_GUARD");
    seen.add(run.runId);
  }
  return manifest;
}
const emptyManifest = () => ({ version: 1, endpoint: TARGET.endpoint, database: TARGET.database, container: TARGET.container, runs: [] });
export async function cleanupOwned(config, container, manifest, persist, pace = async () => {}) {
  validateConfig(config); validateManifest(manifest);
  guard(container.id === TARGET.container && container.database?.id === TARGET.database, "CONTAINER_GUARD");
  guard(manifest.runs.every(run => !config.testObjectIds.has(run.runId)), "REAL_TEST_ACCOUNT_GUARD");
  for (const run of [...manifest.runs]) {
    for (const docId of [...run.docIds]) {
      try {
        const item = container.item(docId, run.playerId);
        await pace();
        const response = await item.read({ abortSignal: AbortSignal.timeout(10000) });
        if (response.statusCode !== 404) {
          const doc = parseDocument(response.resource, run.playerId);
          guard(doc.id === docId && doc.namespace === "test" && response.resource._etag, "DOCUMENT_GUARD");
          await pace();
          await item.delete({ accessCondition: { type: "IfMatch", condition: response.resource._etag }, abortSignal: AbortSignal.timeout(10000) });
          // A successful response alone is not evidence that the partition is clean.
          await pace(); guard(await isMissing(item), "DELETE_UNCONFIRMED");
        }
      } catch (error) { if (statusOf(error) !== 404) continue; }
      run.docIds = run.docIds.filter(id => id !== docId);
      await persist(manifest);
    }
    if (!run.docIds.length) { manifest.runs = manifest.runs.filter(r => r !== run); await persist(manifest); }
  }
  return manifest.runs.reduce((sum, run) => sum + run.docIds.length, 0);
}
async function fileManifestStore() {
  const directory = resolve(ROOT, "build"), path = resolve(directory, "cloud-smoke-cleanup.json"), lockPath = path + ".lock";
  await mkdir(directory, { recursive: true });
  guard(!(await lstat(directory)).isSymbolicLink(), "MANIFEST_PATH_GUARD");
  const lock = await open(lockPath, "wx").catch(() => { throw new SmokeError("SMOKE_LOCKED"); });
  const close = async () => { await lock.close(); await unlink(lockPath); };
  try {
    let manifest = emptyManifest();
    try {
      const info = await lstat(path);
      guard(info.isFile() && !info.isSymbolicLink() && info.size <= 1024 * 1024, "MANIFEST_PATH_GUARD");
      manifest = validateManifest(JSON.parse(await readFile(path, "utf8")));
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return { manifest, close, persist: async value => {
      validateManifest(value);
      const temporary = path + "." + randomUUID() + ".tmp";
      await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
      await rename(temporary, path);
    } };
  } catch (error) { await close(); throw error; }
}

export async function runCosmosSmoke(config) {
  const result = freshResult();
  if (!await check(result, "C00_CONFIG", () => validateConfig(config))) return result;
  let client, store, container;
  // The game has 400 RU/s. Bound smoke traffic instead of increasing throughput.
  let lastRequest = 0;
  const pace = async () => { await delay(Math.max(0, lastRequest + 350 - Date.now())); lastRequest = Date.now(); };
  try {
    store = await fileManifestStore();
    const requireApi = createRequire(new URL("../api/package.json", import.meta.url));
    const { ClientSecretCredential } = requireApi("@azure/identity"), { CosmosClient } = requireApi("@azure/cosmos");
    client = new CosmosClient({ endpoint: config.cosmosEndpoint,
      aadCredentials: new ClientSecretCredential(config.cosmosTenantId, config.cosmosClientId, config.cosmosClientSecret),
      connectionPolicy: { requestTimeout: 10000, retryOptions: { maxRetryAttemptCount: 0 } } });
    container = client.database(config.database).container(config.container);
    result.remainingTestDocuments = await cleanupOwned(config, container, store.manifest, store.persist, pace);
    guard(result.remainingTestDocuments === 0, "PREVIOUS_CLEANUP_INCOMPLETE");
    result.passed.push("C01_PREVIOUS_CLEANUP");
    guard(await check(result, "C02_DB_LIST_FORBIDDEN", async () => {
      await assert.rejects(client.databases.readAll({ abortSignal: AbortSignal.timeout(10000) }).fetchNext(), error => statusOf(error) === 403);
    }), "SCOPE_CHECK_FAILED");
    const runId = randomUUID(), id = { tenantId: TARGET.tenant, objectId: runId, namespace: "test", playerId: `test:${TARGET.tenant}:${runId}` };
    guard(!config.testObjectIds.has(runId), "REAL_TEST_ACCOUNT_GUARD");
    const baseRepo = new CosmosGameRepository(container);
    guard(await baseRepo.readAccount(id) === null, "PARTITION_ALREADY_EXISTS");
    const run = { runId, playerId: id.playerId, docIds: [] };
    store.manifest.runs.push(run); await store.persist(store.manifest);
    const track = async doc => {
      const parsed = parseDocument(doc, id.playerId);
      guard(parsed.namespace === "test", "DOCUMENT_GUARD");
      if (!run.docIds.includes(parsed.id)) { run.docIds.push(parsed.id); await store.persist(store.manifest); }
    };
    // Write-ahead ownership survives an interrupted process or an ambiguous network response.
    const repo = { readAccount: async i => { await pace(); return baseRepo.readAccount(i); },
      readReceipt: async (p, r) => { await pace(); return baseRepo.readReceipt(p, r); },
      commit: async (p, ops) => { guard(p === id.playerId, "OWNER_GUARD"); for (const op of ops) await track(op.doc); await pace(); return baseRepo.commit(p, ops); } };
    const now = () => new Date(), read = () => bootstrapAccount(id, repo, now);
    await read();
    const sessionId = randomUUID();
    const acquired = await acquireSession(id, { requestId: randomUUID(), sessionId, takeover: false }, repo, now);
    const lease = { sessionId, generation: acquired.lease.generation };
    const input = async (event, change = () => {}) => {
      const b = await read(), progress = structuredClone(b.current.progress); change(progress);
      const mutation = { schemaVersion: 1, requestId: randomUUID(), ...lease, runId: b.current.runId,
        expectedVersion: b.current.version, sequence: b.current.lastSequence + 1 };
      return event ? { ...mutation, event, progress } : mutation;
    };
    const send = async (event, change) => saveProgress(id, await input(event, change), repo, now);
    const first = await input({ kind: "stage-enter", stageId: "world-01-stage-1", seed: 5, world02Travel: {} });
    const ack = await saveProgress(id, first, repo, now);
    assert.deepEqual(await saveProgress(id, first, repo, now), ack);
    assert.equal((await read()).current.version, first.expectedVersion + 1);
    result.passed.push("C03_DUPLICATE_ACK");
    await send({ kind: "stage-complete", stageId: "world-01-stage-1" }, p => p.clearedStages.push("world-01-stage-1"));
    await send({ kind: "stage-enter", stageId: "world-01-stage-2", seed: 5, world02Travel: {} });
    await send({ kind: "state", stageId: "world-01-stage-2" }, p => { p.playerName = "검증코기"; p.deathsTotal = 2; p.deathsByStage["world-01-stage-2"] = 2; });
    await send({ kind: "checkpoint", stageId: "world-01-stage-2", origin: "reached", snapshot: {
      checkpointId: "world-01-stage-2-checkpoint", stageId: "world-01-stage-2", x: 500, y: 440, facing: 1,
      randomSeed: 5, mapSnapshotVersion: 0, contentVersion: 1, capturedAt: 100, mapSnapshot: null } });
    const beforeReset = await read();
    assert.equal(beforeReset.best.progressRank, 101); assert.equal(beforeReset.best.deaths, 2);
    assert.equal((await repo.readAccount(id)).best.value.eligible, false);
    await resetProgress(id, await input(), repo, now);
    const reset = await read();
    assert.notEqual(reset.current.runId, beforeReset.current.runId); assert.deepEqual(reset.best, beforeReset.best);
    assert.equal(reset.displayName, beforeReset.displayName); assert.equal(reset.current.progress.deathsTotal, 0);
    result.passed.push("C04_RESET_PRESERVES_BEST");
    const original = await container.item("profile", id.playerId).read({ abortSignal: AbortSignal.timeout(10000) });
    const receipt = { ...await baseRepo.readReceipt(id.playerId, first.requestId), id: "receipt:" + randomUUID() };
    await track(receipt);
    const response = await container.items.batch([
      { operationType: "Replace", id: "profile", resourceBody: { ...parseDocument(original.resource, id.playerId), displayName: "실패검증" }, ifMatch: '"' + randomUUID() + '"' },
      { operationType: "Create", resourceBody: receipt },
    ], id.playerId, { abortSignal: AbortSignal.timeout(10000) });
    assert.deepEqual(response.result?.map(r => r.statusCode), [412, 424]);
    const after = await container.item("profile", id.playerId).read({ abortSignal: AbortSignal.timeout(10000) });
    assert.deepEqual(after.resource, original.resource);
    assert.equal(await isMissing(container.item(receipt.id, id.playerId)), true);
    result.passed.push("C05_BATCH_ATOMICITY");
    const competing = { requestId: randomUUID(), sessionId: randomUUID(), takeover: false };
    await assert.rejects(acquireSession(id, competing, repo, now), e => e.status === 409 && e.code === "SESSION_CONFLICT");
    const stale = await input({ kind: "state", stageId: "world-01-stage-1" });
    const taken = await acquireSession(id, { ...competing, takeover: true }, repo, now);
    assert.equal(taken.lease.generation, lease.generation + 1);
    const beforeStale = await repo.readAccount(id);
    await assert.rejects(saveProgress(id, stale, repo, now), e => e.status === 409 && e.code === "SESSION_LOST");
    assert.deepEqual(await repo.readAccount(id), beforeStale);
    result.passed.push("C06_SESSION_TAKEOVER");
  } catch (error) { result.failed.push(`C_RUN:${safeFailure(error)}`); }
  finally {
    if (store && container) {
      await check(result, "C07_CLEANUP", async () => {
        result.remainingTestDocuments = store.manifest.runs.reduce((sum, run) => sum + run.docIds.length, 0);
        result.remainingTestDocuments = await cleanupOwned(config, container, store.manifest, store.persist, pace);
        guard(result.remainingTestDocuments === 0, "CLEANUP_INCOMPLETE");
      });
    }
    client?.dispose();
    if (store) await check(result, "C08_UNLOCK", store.close);
  }
  return result;
}

async function main(args) {
  guard(args.length === 2 || args.length === 3 && args[2] === "--cosmos", "ARGUMENTS");
  guard(args[0] === "--base-url", "ARGUMENTS");
  const result = await runHttpSmoke(args[1]);
  if (args.includes("--cosmos") && !result.failed.length) {
    let cosmos;
    try { cosmos = await runCosmosSmoke(await readLocalConfig()); }
    catch (error) { cosmos = { ...freshResult(), failed: [`C_CONFIG:${safeFailure(error)}`] }; }
    result.passed.push(...cosmos.passed); result.failed.push(...cosmos.failed);
    result.remainingTestDocuments = cosmos.remainingTestDocuments;
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.failed.length || result.remainingTestDocuments ? 1 : 0;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.log(JSON.stringify({ ...freshResult(), failed: [`CLI:${safeFailure(error)}`] })); process.exitCode = 1; });
}
