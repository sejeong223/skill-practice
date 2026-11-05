import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { childEnvironment, publicBuildConfig, PUBLIC_IDS, apiOutputPath, noLinks, workspace, parseMode, validateProductionContext, safeErrorCode, fail } from "./game-release-utils.mjs";
import { validateTotals, validateStaticConfig, validateStaticOutput, validateApiPackage, validateManifest, outputDigest, SECRET_SENTINEL } from "./check-game-release.mjs";
import { packageGameApi } from "./package-game-api.mjs";

const config = JSON.parse(await readFile(new URL("../public/staticwebapp.config.json", import.meta.url), "utf8"));
const environment = { NEXT_PUBLIC_GAME_TENANT_ID: PUBLIC_IDS.tenantId, NEXT_PUBLIC_GAME_WEB_CLIENT_ID: PUBLIC_IDS.webClientId, NEXT_PUBLIC_GAME_API_CLIENT_ID: PUBLIC_IDS.apiClientId, NEXT_PUBLIC_GAME_REDIRECT_URI: "https://calm-corgi-123.1.azurestaticapps.net/", NEXT_PUBLIC_GAME_MODE: "cloud" };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "game-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, data) => { const file = join(root, name); await mkdir(resolve(file, ".."), { recursive: true }); await writeFile(file, data); };
  await put("index.html", "<html>game</html>"); await put("auth/redirect/index.html", "bridge");
  await put("_next/game.js", "console.log('game')"); await put("staticwebapp.config.json", JSON.stringify(config));
  return { root, put };
}
test("Standard totals include the exact byte/file boundary and reject excess/empty output", () => {
  validateTotals({ files: 15000, bytes: 500000000 });
  for (const totals of [{ files: 15001, bytes: 1 }, { files: 1, bytes: 500000001 }, { files: 0, bytes: 0 }, { files: -1, bytes: 5 }]) assert.throws(() => validateTotals(totals), /STATIC_LIMIT/);
});
test("SWA config requires the bridge headers and protects API routing", () => {
  validateStaticConfig(config);
  const variants = [c => { c.navigationFallback = { rewrite: "/index.html" }; }, c => { c.platform.apiRuntime = "node:20"; }, c => { c.responseOverrides = { 401: { rewrite: "/" } }; }, c => { c.routes[0].headers["Cache-Control"] = "public"; }, c => { c.routes[0].headers["Cross-Origin-Opener-Policy"] = "same-origin"; }, c => { c.routes[1].rewrite = "/index.html"; }, c => { c.routes[1].allowedRoles = ["authenticated"]; }, c => { c.routes.unshift({ route: "/*", redirect: "/" }); }];
  for (const mutate of variants) { const c = structuredClone(config); mutate(c); assert.throws(() => validateStaticConfig(c)); }
});
test("preflight overrides ambient values while production requires exact public IDs and SWA origin", () => {
  const local = publicBuildConfig("preflight", { ...environment, NEXT_PUBLIC_GAME_WEB_CLIENT_ID: "bad", NEXT_PUBLIC_GAME_MODE: "local-dev" });
  assert.equal(local.origin, "http://localhost:3000"); assert.equal(local.env.NEXT_PUBLIC_GAME_MODE, "cloud"); assert.equal(local.env.NEXT_PUBLIC_GAME_WEB_CLIENT_ID, PUBLIC_IDS.webClientId);
  assert.equal(publicBuildConfig("production", environment).origin, "https://calm-corgi-123.1.azurestaticapps.net");
  for (const uri of ["http://localhost:3000/", "https://evil.example/", "https://a.azurestaticapps.net:444/", "https://a.azurestaticapps.net/?token=x", "https://user@a.azurestaticapps.net/", "https://a.azurestaticapps.net/sub/"]) assert.throws(() => publicBuildConfig("production", { ...environment, NEXT_PUBLIC_GAME_REDIRECT_URI: uri }));
  assert.throws(() => publicBuildConfig("production", {}));
  assert.throws(() => publicBuildConfig("production", { ...environment, NEXT_PUBLIC_GAME_TENANT_ID: "11111111-1111-4111-8111-111111111111" }));
  assert.throws(() => publicBuildConfig("production", { ...environment, NEXT_PUBLIC_GAME_MODE: "local-dev" }));
});
test("production rejects dirty source, implicit env files and missing/wrong expected origin", () => {
  const clean = { dirty: false, files: [".env.example"], expectedOrigin: "https://a.azurestaticapps.net", origin: "https://a.azurestaticapps.net" };
  validateProductionContext(clean);
  for (const patch of [{ dirty: true }, { files: [".env.local"] }, { files: [".env.production"] }, { expectedOrigin: undefined }, { expectedOrigin: "https://b.azurestaticapps.net" }]) assert.throws(() => validateProductionContext({ ...clean, ...patch }));
});
test("build children receive system environment but no server credentials or arbitrary public keys", () => {
  const env = childEnvironment({ Path: "system", SystemRoot: "windows", GAME_COSMOS_CLIENT_SECRET: SECRET_SENTINEL, AZURE_CLIENT_SECRET: SECRET_SENTINEL, GITHUB_TOKEN: SECRET_SENTINEL, NEXT_PUBLIC_SECRET: SECRET_SENTINEL });
  assert.deepEqual(env, { Path: "system", SystemRoot: "windows" });
});
test("mode CLI accepts only explicit supported modes", () => {
  assert.equal(parseMode([]), "preflight"); assert.equal(parseMode(["--mode", "production"]), "production");
  for (const args of [["production"], ["--mode", "other"], ["--mode", "preflight", "extra"]]) assert.throws(() => parseMode(args));
});
test("CLI error reporting never echoes arbitrary JSON/parser/credential messages", () => {
  assert.equal(safeErrorCode(new Error(SECRET_SENTINEL)), "RELEASE_OPERATION_FAILED");
  try { fail("INVALID_RELEASE_MODE"); } catch (error) { assert.equal(safeErrorCode(error), "INVALID_RELEASE_MODE"); }
});
test("static output requires real bridge/bundle and scans secrets and private files", async t => {
  const { root, put } = await fixture(t); assert.equal((await validateStaticOutput(root)).files, 4);
  for (const text of [SECRET_SENTINEL, "GAME_COSMOS_CLIENT_SECRET", "@azure/cosmos"]) { await put("_next/game.js", text); await assert.rejects(validateStaticOutput(root), /SERVER_CONTENT/); }
  await put("_next/game.js", "safe"); await put(".env.local", "secret"); await assert.rejects(validateStaticOutput(root), /FORBIDDEN_STATIC_FILE/);
  await rm(join(root, ".env.local")); await rm(join(root, "auth/redirect/index.html")); await assert.rejects(validateStaticOutput(root), /MISSING_STATIC_FILE/);
});
test("output hashes detect same-size tampering", async t => {
  const { root, put } = await fixture(t), before = await outputDigest(root);
  await put("index.html", "<html>fake</html>"); assert.notEqual(await outputDigest(root), before);
});
test("symlinks/junctions are rejected in recursive output and generated paths", async t => {
  const { root } = await fixture(t), target = await mkdtemp(join(tmpdir(), "game-release-target-"));
  t.after(() => rm(target, { recursive: true, force: true }));
  await symlink(target, join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(validateStaticOutput(root), /LINK_NOT_ALLOWED/);
  await assert.rejects(noLinks(join(root, "linked/child"), root), /LINK_NOT_ALLOWED/);
});
test("packaging refuses escaping destinations without touching API dependencies", async () => {
  const file = join(workspace, "api/node_modules/@azure/functions/package.json"), before = await readFile(file);
  await assert.rejects(apiOutputPath(join(workspace, "api")), /INVALID_API_OUTPUT/);
  await assert.rejects(packageGameApi({ outputDir: join(workspace, "build/game-api/../../api") }), /INVALID_API_OUTPUT/);
  assert.deepEqual(await readFile(file), before);
  assert.equal(await apiOutputPath(), resolve(workspace, "build/game-api"));
});
test("API validator refuses bad runtime metadata before executing an entrypoint", async t => {
  const { root, put } = await fixture(t);
  await put("package.json", JSON.stringify({ type: "module", main: "dist/functions/*.js", engines: { node: "20.x" } }));
  await put("package-lock.json", "{}"); await put("host.json", "{}");
  await assert.rejects(validateApiPackage(root), /INVALID_API_PACKAGE/);
});
test("manifest cannot promote preflight output or change source/host/path", () => {
  const sha = "a".repeat(40), state = { sourceCommit: sha, dirty: false };
  const manifest = { schemaVersion: 1, mode: "preflight", ...state, builtAt: "2026-11-05T00:00:00.000Z", swaOrigin: "http://localhost:3000", ...PUBLIC_IDS, sku: "Standard", apiRuntime: "node:22", static: { directory: "out" }, api: { directory: "build/game-api", entrypoint: "dist/functions/game.js" } };
  validateManifest(manifest, { mode: "preflight", state });
  assert.throws(() => validateManifest(manifest, { mode: "production", state }), /INVALID_RELEASE_MANIFEST/);
  assert.throws(() => validateManifest(manifest, { mode: "preflight", state: { ...state, sourceCommit: "b".repeat(40) } }), /RELEASE_SOURCE/);
  const prod = { ...manifest, mode: "production", swaOrigin: "https://a.azurestaticapps.net" };
  const options = { mode: "production", expectedOrigin: prod.swaOrigin, state };
  validateManifest(prod, options);
  assert.throws(() => validateManifest({ ...prod, dirty: true }, options), /RELEASE_SOURCE/);
  assert.throws(() => validateManifest(prod, { ...options, expectedOrigin: "https://b.azurestaticapps.net" }), /ORIGIN/);
  assert.throws(() => validateManifest({ ...prod, api: { ...prod.api, directory: "../api" } }, options), /PATH/);
});
