import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, realpath, readdir } from "node:fs/promises";
import { resolve, join, relative, dirname, delimiter, basename, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const workspace = fileURLToPath(new URL("../", import.meta.url));
export const PUBLIC_IDS = Object.freeze({
  tenantId: "69c1e470-4528-435a-a1ae-de98e0aac738",
  webClientId: "e467e8bc-c900-4d08-88be-7f0a5fce2474",
  apiClientId: "a2e3f4fa-56e5-4ab5-ba41-43cb974b8722",
});
export const PUBLIC_KEYS = Object.freeze({
  tenantId: "NEXT_PUBLIC_GAME_TENANT_ID", webClientId: "NEXT_PUBLIC_GAME_WEB_CLIENT_ID",
  apiClientId: "NEXT_PUBLIC_GAME_API_CLIENT_ID",
});
class ReleaseError extends Error {}
export const fail = code => { throw new ReleaseError(code); };
export const safeErrorCode = error => error instanceof ReleaseError ? error.message : "RELEASE_OPERATION_FAILED";
export const isCli = url => process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href;
export function parseMode(args = process.argv.slice(2)) {
  if (!args.length) return "preflight";
  if (args.length !== 2 || args[0] !== "--mode" || !["preflight", "production"].includes(args[1])) fail("INVALID_RELEASE_MODE");
  return args[1];
}
export function requireNode22() {
  if (process.versions.node.split(".")[0] !== "22") fail("NODE_22_REQUIRED");
}
export function childEnvironment(env = process.env) {
  const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|LANG|LC_ALL|CI|GITHUB_ACTIONS|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i;
  return Object.fromEntries(Object.entries(env).filter(([key, value]) => allowed.test(key) && typeof value === "string"));
}
export function publicBuildConfig(mode, env = process.env) {
  if (!["preflight", "production"].includes(mode)) fail("INVALID_RELEASE_MODE");
  const values = Object.fromEntries(Object.entries(PUBLIC_KEYS).map(([field, key]) => [key, mode === "preflight" ? PUBLIC_IDS[field] : env[key]]));
  if (mode === "production" && Object.entries(PUBLIC_KEYS).some(([field, key]) => values[key] !== PUBLIC_IDS[field])) fail("INVALID_PUBLIC_IDS");
  const redirect = mode === "preflight" ? "http://localhost:3000/" : env.NEXT_PUBLIC_GAME_REDIRECT_URI;
  let uri;
  try { uri = new URL(redirect); } catch { fail("INVALID_REDIRECT"); }
  if (uri.pathname !== "/" || uri.search || uri.hash || uri.username || uri.password ||
      mode === "production" && (uri.protocol !== "https:" || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:[0-9]+\.)?azurestaticapps\.net$/.test(uri.hostname) || uri.port || env.NEXT_PUBLIC_GAME_MODE !== "cloud")) fail("INVALID_REDIRECT");
  return { env: { ...values, NEXT_PUBLIC_GAME_MODE: "cloud", NEXT_PUBLIC_GAME_REDIRECT_URI: uri.href }, origin: uri.origin };
}
export function gitState(root = workspace) {
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
  return { sourceCommit: git(["rev-parse", "HEAD"]), dirty: !!git(["status", "--porcelain", "--untracked-files=all"]) };
}
export function validateProductionContext({ dirty, files, expectedOrigin, origin }) {
  if (dirty) fail("PRODUCTION_REQUIRES_CLEAN_CHECKOUT");
  if (files.some(name => name === ".env" || name.startsWith(".env.") && name !== ".env.example")) fail("PRODUCTION_DOTENV_NOT_ALLOWED");
  if (!expectedOrigin || expectedOrigin !== origin) fail("EXPECTED_ORIGIN_REQUIRED");
}
export async function noLinks(path, boundary = workspace) {
  const base = resolve(boundary), target = resolve(path), rel = relative(base, target);
  if (rel === ".." || rel.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) || isAbsolute(rel)) fail("PATH_OUTSIDE_WORKSPACE");
  let current = base;
  for (const part of ["", ...rel.split(/[\\/]/).filter(Boolean)]) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) fail("LINK_NOT_ALLOWED"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (existsSync(target)) {
    const physical = await realpath(target), physicalBase = await realpath(base);
    const r = relative(physicalBase, physical);
    if (r.startsWith("..") || isAbsolute(r)) fail("LINK_NOT_ALLOWED");
  }
  return target;
}
export async function apiOutputPath(outputDir = join(workspace, "build/game-api")) {
  const base = resolve(workspace, "build/game-api"), target = resolve(outputDir), rel = relative(base, target);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) fail("INVALID_API_OUTPUT");
  return noLinks(target);
}
export async function walkFiles(root) {
  const result = [];
  async function walk(path) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) fail("LINK_NOT_ALLOWED");
    if (info.isDirectory()) for (const name of await readdir(path)) await walk(join(path, name));
    else if (info.isFile()) result.push({ path, relative: relative(root, path).replaceAll("\\", "/"), bytes: info.size });
    else fail("UNSUPPORTED_FILE_TYPE");
  }
  await walk(root);
  return result;
}
export function runNode(args, { cwd = workspace, env = childEnvironment(), capture = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, shell: false, windowsHide: true, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let stdout = "";
    if (capture) { child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.resume(); }
    child.on("error", () => reject(new ReleaseError("CHILD_START_FAILED")));
    child.on("close", code => code === 0 ? resolveRun(stdout) : reject(new ReleaseError("CHILD_CHECK_FAILED")));
  });
}
export function npmCli() {
  const dirs = (process.env.PATH ?? process.env.Path ?? "").split(delimiter);
  const candidates = [process.env.npm_execpath, ...dirs.map(p => join(p, "node_modules/npm/bin/npm-cli.js")), resolve(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
  const found = candidates.find(p => p && basename(p) === "npm-cli.js" && existsSync(p));
  if (!found) fail("NPM_CLI_NOT_FOUND");
  return found;
}
