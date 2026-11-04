import { build } from "esbuild";
import { resolve } from "node:path";
export async function buildGameApi() {
  const result = await build({
    entryPoints: ["api/src/functions/game.ts"], outfile: "api/dist/functions/game.js",
    bundle: true, platform: "node", target: "node22", format: "esm", packages: "external",
    sourcemap: false, metafile: true,
  });
  const files = Object.keys(result.metafile.inputs);
  const imports = Object.values(result.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  if ([...files, ...imports].some(p => /(?:^|[/\\])(?:phaser|react|react-dom)(?:[/\\]|$)|@azure\/msal/.test(p))) {
    throw new Error("Browser dependency in API bundle");
  }
  console.log("API build verified:", resolve("api/dist/functions/game.js"));
}
await buildGameApi();

