import { mkdir, rm, writeFile, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildGameApi } from "./build-game-api.mjs";
import { packageGameApi } from "./package-game-api.mjs";
import { validateStaticOutput, validateApiPackage, outputDigest } from "./check-game-release.mjs";
import { workspace, PUBLIC_IDS, publicBuildConfig, childEnvironment, gitState, noLinks, runNode, requireNode22, isCli, parseMode, fail, validateProductionContext, safeErrorCode } from "./game-release-utils.mjs";

export async function validateBuildContext(mode, env = process.env) {
  const config = publicBuildConfig(mode, env), state = gitState();
  if (mode === "production") {
    validateProductionContext({ ...state, files: await readdir(workspace), expectedOrigin: env.GAME_EXPECTED_SWA_ORIGIN, origin: config.origin });
  }
  return { config, state };
}
export async function buildRelease({ mode = "preflight", env = process.env } = {}) {
  requireNode22();
  await noLinks(join(workspace, "build"));
  await mkdir(join(workspace, "build"), { recursive: true });
  const manifestPath = join(workspace, "build/game-release.json");
  await noLinks(manifestPath); await noLinks(manifestPath + ".tmp");
  await rm(manifestPath, { force: true }); await rm(manifestPath + ".tmp", { force: true });
  const { config, state } = await validateBuildContext(mode, env);
  const frontEnv = { ...childEnvironment(env), ...config.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  await noLinks(join(workspace, "out")); await noLinks(join(workspace, ".next"));
  await runNode(["node_modules/next/dist/bin/next", "build"], { env: frontEnv });
  await buildGameApi();
  const api = await packageGameApi();
  const totals = await validateStaticOutput(join(workspace, "out"));
  await validateApiPackage(api.outputDir);
  const finalState = gitState();
  if (finalState.sourceCommit !== state.sourceCommit || mode === "production" && finalState.dirty) fail("SOURCE_CHANGED_DURING_BUILD");
  const manifest = { schemaVersion: 1, mode, ...state, builtAt: new Date().toISOString(), swaOrigin: config.origin,
    ...PUBLIC_IDS, sku: "Standard", apiRuntime: "node:22",
    static: { directory: "out", ...totals, sha256: await outputDigest(join(workspace, "out")) },
    api: { directory: "build/game-api", entrypoint: api.entrypoint, sha256: await outputDigest(api.outputDir) } };
  await writeFile(manifestPath + ".tmp", JSON.stringify(manifest, null, 2) + "\n");
  await rename(manifestPath + ".tmp", manifestPath);
  return manifest;
}
if (isCli(import.meta.url)) {
  try { const m = await buildRelease({ mode: parseMode() }); console.log(`Release built: ${m.mode}, ${m.static.files} files, ${m.static.bytes} bytes`); }
  catch (error) { console.error(safeErrorCode(error)); process.exitCode = 1; }
}
