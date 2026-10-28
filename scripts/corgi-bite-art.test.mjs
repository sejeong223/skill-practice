import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertFullBodyBitePoses } from "./bite-pose-assertions.mjs";

const base = new URL("../public/assets/pixel/characters/corgi/", import.meta.url);

test("물기 네 프레임은 기존 코기를 바탕으로 몸통과 네 발까지 새 자세로 그린다", async () => {
  const manifest = JSON.parse(await readFile(new URL("../src/game/assets/assetManifest.json", import.meta.url), "utf8"));
  const entry = manifest.find((asset) => asset.key === "corgi-bite");
  assert.deepEqual({ kind: entry.kind, frameWidth: entry.frameWidth,
    frameHeight: entry.frameHeight, frameCount: entry.frameCount, required: entry.required },
  { kind: "spritesheet", frameWidth: 112, frameHeight: 128, frameCount: 4, required: true });
  const bite = await sharp(fileURLToPath(new URL("corgi-bite.png", base)))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const run = await sharp(fileURLToPath(new URL("corgi-run.png", base)))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assertFullBodyBitePoses(bite, run, "기본 코기");
});
