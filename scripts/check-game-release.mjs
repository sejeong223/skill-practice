import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { workspace, walkFiles, noLinks, fail, runNode, isCli, parseMode, publicBuildConfig, gitState, PUBLIC_IDS, validateProductionContext, safeErrorCode } from "./game-release-utils.mjs";

export const STATIC_LIMITS = Object.freeze({ files: 15000, bytes: 500000000 });
export const SECRET_SENTINEL = "GAME_RELEASE_SECRET_SENTINEL_DO_NOT_SHIP";
const json = async path => JSON.parse(await readFile(path, "utf8"));
export function validateTotals({ files, bytes }) {
  if (!Number.isSafeInteger(files) || !Number.isSafeInteger(bytes) || files < 1 || bytes < 1 || files > STATIC_LIMITS.files || bytes > STATIC_LIMITS.bytes) fail("STATIC_LIMIT_EXCEEDED");
}
export function validateStaticConfig(config) {
  if (config.platform?.apiRuntime !== "node:22" || config.navigationFallback || config.responseOverrides?.[401] || config.responseOverrides?.[403]) fail("INVALID_SWA_CONFIG");
  if (!Array.isArray(config.routes) || config.routes.some(r => r.rewrite || r.redirect || r.allowedRoles || r.methods || r.statusCode)) fail("INVALID_SWA_ROUTE");
  if (config.routes.some(r => !["/api/*", "/auth/redirect/*"].includes(r.route))) fail("INVALID_SWA_ROUTE");
  const bridge = config.routes.find(r => r.route === "/auth/redirect/*");
  if (bridge?.headers?.["Cache-Control"] !== "no-store" || bridge?.headers?.["Cross-Origin-Opener-Policy"] !== "") fail("INVALID_BRIDGE_HEADERS");
  if (config.routes.filter(r => r.route === "/auth/redirect/*").length !== 1 || config.routes.filter(r => r.route === "/api/*").length !== 1) fail("INVALID_SWA_ROUTE");
}
export async function validateStaticOutput(root) {
  const entries = await walkFiles(root);
  const totals = { files: entries.length, bytes: entries.reduce((n, f) => n + f.bytes, 0) };
  validateTotals(totals);
  for (const required of ["index.html", "auth/redirect/index.html", "staticwebapp.config.json"]) if (!entries.some(f => f.relative === required && f.bytes > 0)) fail("MISSING_STATIC_FILE");
  if (!entries.some(f => f.relative.startsWith("_next/") && f.relative.endsWith(".js"))) fail("MISSING_BROWSER_BUNDLE");
  await validateStaticConfig(await json(join(root, "staticwebapp.config.json")));
  for (const file of entries) {
    if (/(^|\/)(?:\.env(?:\..*)?|local\.settings\.json|host\.json|node_modules|\.git)(\/|$)|\.(?:map|pem|key|pfx)$/i.test(file.relative)) fail("FORBIDDEN_STATIC_FILE");
    if (/\.(?:js|html|json|txt|css)$/.test(file.relative)) {
      const text = await readFile(file.path, "utf8");
      if (/GAME_COSMOS_CLIENT_SECRET|GAME_COSMOS_ENDPOINT|AZURE_CLIENT_SECRET|AZURE_STATIC_WEB_APPS_API_TOKEN|@azure\/(?:cosmos|identity|functions)/.test(text) || text.includes(SECRET_SENTINEL)) fail("SERVER_CONTENT_IN_BROWSER");
    }
  }
  return totals;
}
export async function validateApiPackage(root) {
  await walkFiles(root); // rejects junctions in installed dependencies too
  const pkg = await json(join(root, "package.json")), lock = await json(join(root, "package-lock.json")), host = await json(join(root, "host.json"));
  const expected = { "@azure/functions": "4.17.0", "@azure/cosmos": "4.10.1", "@azure/identity": "4.14.1", jose: "6.2.15" };
  if (pkg.type !== "module" || pkg.main !== "dist/functions/*.js" || pkg.engines?.node !== "22.x" || host.version !== "2.0" || host.extensions?.http?.routePrefix !== "api" || !isDeepStrictEqual(pkg.dependencies, expected) || !isDeepStrictEqual(lock.packages?.[""].dependencies, expected)) fail("INVALID_API_PACKAGE");
  const top = (await walkFiles(root)).filter(f => !f.relative.startsWith("node_modules/"));
  if (top.some(f => !["host.json", "package.json", "package-lock.json", "dist/functions/game.js"].includes(f.relative))) fail("FORBIDDEN_API_FILE");
  const bundle = await readFile(join(root, "dist/functions/game.js"), "utf8");
  if (/(?:from\s*|import\s*\(|require\s*\()\s*["'](?:\.|\/|phaser|react|@azure\/msal)/.test(bundle) || bundle.includes(SECRET_SENTINEL)) fail("INVALID_API_IMPORT");
  // Load in a fresh process whose dependency resolution starts inside the package.
  const registration = await runNode(["--input-type=commonjs", "-e", `
    const {app}=require('@azure/functions');const {pathToFileURL}=require('node:url');
    const rows=[];app.http=(name,o)=>{if(typeof o.handler!=='function')throw Error('HANDLER');rows.push([name,o.methods,o.route,o.authLevel]);};
    import(pathToFileURL(require('node:path').resolve('dist/functions/game.js')).href).then(()=>process.stdout.write(JSON.stringify(rows))).catch(()=>process.exit(1));
  `], { cwd: resolve(root), capture: true });
  const rows = JSON.parse(registration);
  const expectedRows = [["bootstrap", "GET", "game/bootstrap"], ["acquire", "POST", "game/session/acquire"], ["heartbeat", "POST", "game/session/heartbeat"], ["release", "POST", "game/session/release"], ["save", "POST", "game/save"], ["reset", "POST", "game/reset"], ["leaderboard", "GET", "game/leaderboard"]].map(([n, m, r]) => ["game-" + n, [m], r, "anonymous"]);
  if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) fail("INVALID_API_ROUTES");
}
// Hashes bind the checked output to the manifest; equal byte counts alone are not sufficient.
export async function outputDigest(root) {
  const hash = createHash("sha256");
  for (const file of (await walkFiles(root)).sort((a, b) => a.relative.localeCompare(b.relative, "en"))) {
    hash.update(file.relative); hash.update("\0"); hash.update(await readFile(file.path)); hash.update("\0");
  }
  return hash.digest("hex");
}
export function validateManifest(manifest, { mode, expectedOrigin, state }) {
  if (manifest.schemaVersion !== 1 || manifest.mode !== mode || manifest.sku !== "Standard" || manifest.apiRuntime !== "node:22" || !/^[0-9a-f]{40}$/.test(manifest.sourceCommit) || typeof manifest.builtAt !== "string" || !Number.isFinite(Date.parse(manifest.builtAt)) || typeof manifest.dirty !== "boolean") fail("INVALID_RELEASE_MANIFEST");
  for (const [key, value] of Object.entries(PUBLIC_IDS)) if (manifest[key] !== value) fail("INVALID_PUBLIC_IDS");
  const env = { NEXT_PUBLIC_GAME_TENANT_ID: manifest.tenantId, NEXT_PUBLIC_GAME_WEB_CLIENT_ID: manifest.webClientId, NEXT_PUBLIC_GAME_API_CLIENT_ID: manifest.apiClientId, NEXT_PUBLIC_GAME_REDIRECT_URI: manifest.swaOrigin + "/", NEXT_PUBLIC_GAME_MODE: "cloud" };
  const config = publicBuildConfig(mode, env);
  if (manifest.swaOrigin !== config.origin || expectedOrigin && manifest.swaOrigin !== expectedOrigin) fail("RELEASE_ORIGIN_MISMATCH");
  if (manifest.sourceCommit !== state.sourceCommit || mode === "production" && (state.dirty || manifest.dirty)) fail("RELEASE_SOURCE_MISMATCH");
  if (manifest.static?.directory !== "out" || manifest.api?.directory !== "build/game-api" || manifest.api?.entrypoint !== "dist/functions/game.js") fail("INVALID_RELEASE_PATH");
  if (mode === "production" && !expectedOrigin) fail("EXPECTED_ORIGIN_REQUIRED");
}
export async function validateRelease({ mode, expectedOrigin, env = process.env } = {}) {
  const manifest = await json(join(workspace, "build/game-release.json")), state = gitState();
  validateManifest(manifest, { mode, expectedOrigin, state });
  if (mode === "production") {
    const config = publicBuildConfig(mode, env);
    validateProductionContext({ ...state, files: await readdir(workspace), expectedOrigin, origin: config.origin });
    if (config.origin !== manifest.swaOrigin) fail("RELEASE_ORIGIN_MISMATCH");
  }
  await noLinks(join(workspace, "out")); await noLinks(join(workspace, "build/game-api"));
  const totals = await validateStaticOutput(join(workspace, "out"));
  await validateApiPackage(join(workspace, "build/game-api"));
  if (totals.files !== manifest.static.files || totals.bytes !== manifest.static.bytes || await outputDigest(join(workspace, "out")) !== manifest.static.sha256 || await outputDigest(join(workspace, "build/game-api")) !== manifest.api.sha256) fail("RELEASE_OUTPUT_CHANGED");
  return manifest;
}
if (isCli(import.meta.url)) {
  try { const m = await validateRelease({ mode: parseMode(), expectedOrigin: process.env.GAME_EXPECTED_SWA_ORIGIN }); console.log(`Release verified: ${m.mode}, ${m.static.files} files, ${m.static.bytes} bytes`); }
  catch (error) { console.error(safeErrorCode(error)); process.exitCode = 1; }
}
