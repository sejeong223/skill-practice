import { copyFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { apiOutputPath, noLinks, runNode, npmCli, workspace, requireNode22, isCli, safeErrorCode } from "./game-release-utils.mjs";

export async function packageGameApi({ sourceDir = join(workspace, "api"), outputDir } = {}) {
  requireNode22();
  const source = await noLinks(resolve(sourceDir));
  const output = await apiOutputPath(outputDir);
  // Validate every source and destination before removing only the generated package.
  const files = ["host.json", "package.json", "package-lock.json", "dist/functions/game.js"];
  for (const name of files) await noLinks(join(source, name));
  if (source === output || source.startsWith(output + "/") || source.startsWith(output + "\\")) throw new Error("SOURCE_OUTPUT_OVERLAP");
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, "dist/functions"), { recursive: true });
  for (const name of files) await copyFile(join(source, name), join(output, name));
  // Functions loads modules directly; npm CLI executable links are unnecessary.
  // Avoid platform-specific .bin symlinks in the self-contained deployment ZIP.
  await runNode([npmCli(), "ci", "--omit=dev", "--no-fund", "--bin-links=false"], { cwd: output });
  return { outputDir: output, entrypoint: "dist/functions/game.js" };
}
if (isCli(import.meta.url)) {
  try { await packageGameApi(); } catch (error) { console.error(safeErrorCode(error)); process.exitCode = 1; }
}
