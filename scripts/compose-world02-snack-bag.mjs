import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, ".memory/test-plans/assets/2026-10-20-blue-snack-source-v2.png");
const outputPath = path.join(root, "public/assets/pixel/props/world-02/empty-snack-bag.png");
const width = 80;
const height = 84;

const { data, info } = await sharp(await readFile(sourcePath))
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// Strip the faint glow outside the imagegen silhouette before scaling it into
// the game's sharp, transparent pixel-art palette.
for (let index = 0; index < data.length; index += 4) {
  const alpha = data[index + 3];
  data[index + 3] = alpha < 160 ? 0 : 255;
}

const bag = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .extract({ left: 120, top: 70, width: 990, height: 1170 })
  .resize({ width: 76, height: 80, fit: "inside", kernel: sharp.kernel.nearest })
  .png().toBuffer();
const bagSize = await sharp(bag).metadata();
assert.ok(bagSize.width && bagSize.height);

const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="84" viewBox="0 0 80 84">
  <text x="40" y="37" text-anchor="middle" font-family="Malgun Gothic" font-size="13" font-weight="900"
    paint-order="stroke fill" stroke="#391c40" stroke-width="1.2" fill="#fff8e5">포카칩</text>
</svg>`);

const composed = await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([
  { input: bag, left: Math.floor((width - bagSize.width) / 2), top: height - bagSize.height },
  { input: label, left: 0, top: 0 },
]).png().toBuffer();

if (process.argv.includes("--check")) {
  assert.deepEqual(await readFile(outputPath), composed, "포카칩 PNG가 생성 원본과 일치해야 합니다.");
  console.log("포카칩 봉지 이미지 재생성 검사 통과");
} else {
  await writeFile(outputPath, composed);
  console.log(`포카칩 봉지 이미지 생성: ${outputPath}`);
}
