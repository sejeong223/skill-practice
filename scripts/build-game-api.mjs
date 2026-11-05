import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { noLinks, workspace } from "./game-release-utils.mjs";
export async function buildGameApi() {
  await noLinks(resolve(workspace, "api/dist"));
  const result = await build({
    absWorkingDir: workspace,
    entryPoints: ["api/src/functions/game.ts"], outfile: "api/dist/functions/game.js",
    bundle: true, platform: "node", target: "node22", format: "esm", packages: "external",
    sourcemap: false, metafile: true,
  });
  const files = Object.keys(result.metafile.inputs);
  const imports = Object.values(result.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  if ([...files, ...imports].some(p => /(?:^|[/\\])(?:phaser|react|react-dom)(?:[/\\]|$)|@azure\/msal/.test(p))) {
    throw new Error("Browser dependency in API bundle");
  }
  if (imports.some(p => p.startsWith(".") || p.startsWith("/"))) {
    throw new Error("External source dependency in API bundle");
  }
  console.log("API build verified:", resolve(workspace, "api/dist/functions/game.js"));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildGameApi();

