import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "public/assets/pixel");
const ink = "#35263d";
const rect = (x, y, w, h, fill, stroke = "none", sw = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const pathShape = (d, fill, stroke = ink, sw = 3) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`);

function maineCoon(frame) {
  if (frame === 3) return [
    pathShape("M13 113H31V101H49V94H116V101H135V112H146V128H137V137H22V129H13Z", "#bb8c66"),
    rect(41, 105, 12, 5, "#966b5b"), rect(68, 99, 11, 5, "#966b5b"),
    rect(20, 127, 24, 5, "#e0bf91"),
  ].join("");
  const pawY = frame === 1 ? 57 : frame === 2 ? 87 : 103;
  return [
    pathShape("M19 82H31V62H42V55H75V62H110V69H129V86H139V114H130V136H37V129H24V118H19Z", "#b9875c"),
    pathShape("M24 75H12V65H7V47H15V55H24V62H30V85H24Z", "#9d6b52"),
    rect(36, 71, 10, 35, "#d2a373"), rect(55, 65, 9, 43, "#986950"),
    rect(77, 64, 9, 47, "#d5a473"), rect(102, 74, 8, 33, "#916853"),
    pathShape("M91 51H102V28H109V19H116V28H130V18H136V34H142V49H150V73H146V91H134V100H110V92H98V80H91Z", "#bc8c65"),
    pathShape("M103 29L110 13L119 32L132 13L140 31H137V41H105Z", "#bc8c65"),
    rect(110, 27, 5, 12, "#d89b91"), rect(129, 26, 5, 12, "#d89b91"),
    pathShape("M105 70H111V87H118V100H128V94H137V76H146V92H140V109H129V119H111V108H101V91H96V76Z", "#dfbb8a", "none"),
    rect(119, 49, 7, 6, "#2f2835"), rect(143, 65, 5, 5, "#8b6061"),
    rect(124, 75, 14, 3, ink),
    pathShape(`M103 95H118V${pawY + 13}H127V${pawY + 23}H110V117H101Z`, "#ad7c5c"),
    pathShape("M27 117H43V137H28Z", "#a77558"),
    pathShape("M84 112H103V137H87Z", "#a77558"),
    frame === 1 ? pathShape("M112 48H130V61H122V67H111Z", "#8f6655") + rect(123, 52, 14, 10, "#9a9b9e", ink, 2) : "",
    frame === 2 ? rect(126, 67, 20, 11, "#d1a176", ink, 2) : "",
  ].join("");
}

const sprite = svg(640, 160, [0, 1, 2, 3].map(frame => `<g transform="translate(${frame * 160},0)">${maineCoon(frame)}</g>`).join(""));
const mouse = svg(32, 24, [
  pathShape("M7 11H11V6H16V10H22V7H26V12H29V18H25V21H12V18H7Z", "#a5a5a9", ink, 2),
  rect(12, 7, 4, 3, "#d89caa"), rect(22, 8, 3, 3, "#d89caa"),
  rect(25, 13, 2, 2, ink), rect(29, 17, 2, 2, "#d68d98"),
  pathShape("M8 17H4V19H1V16H4V14H8Z", "#a78c9a", "none"),
].join(""));
const furball = svg(28, 28, [
  pathShape("M8 3H14V5H20V8H24V13H26V19H22V23H17V26H11V23H5V19H2V12H5V7H8Z", "#d1b08a", ink, 2),
  rect(8, 9, 5, 4, "#ead0a3"), rect(17, 14, 5, 4, "#b68e70"),
  rect(11, 20, 4, 3, "#e5c79c"),
].join(""));

const towerColumns = Array.from({ length: 10 }, (_, index) => {
  const x = index * 83 + 12;
  const height = 26 + index % 3 * 21;
  return rect(x, 204 - height, 14, height, "#4b3b59") + rect(x - 7, 201 - height, 29, 5, "#66516b");
}).join("");
const background = svg(800, 280, [
  rect(0, 0, 800, 280, "#675473"),
  rect(0, 161, 800, 119, "#55465f"),
  pathShape("M0 168H127V156H196V170H326V150H402V166H534V155H632V173H800V214H0Z", "#5d4b68", "none"),
  towerColumns,
  rect(95, 103, 14, 113, "#3e324d"), rect(75, 105, 62, 10, "#756079"),
  rect(473, 71, 15, 150, "#3e324d"), rect(448, 72, 69, 11, "#7d667e"),
  rect(585, 127, 12, 91, "#3f334b"), rect(565, 126, 57, 10, "#7b627d"),
  rect(0, 219, 800, 61, "#3c304b"),
  rect(56, 228, 91, 17, "#655068"), rect(272, 231, 102, 16, "#5d4b61"),
  rect(482, 227, 113, 20, "#69536c"), rect(658, 232, 85, 15, "#5c4a62"),
  rect(0, 255, 800, 25, "#2d273b"),
].join(""));

for (const [relative, source] of [
  ["characters/world-05/maine-coon-boss.png", sprite],
  ["objects/world-05/homing-mouse.png", mouse],
  ["objects/world-05/falling-furball.png", furball],
  ["backgrounds/world-05/boss-cat-tower.png", background],
]) {
  const file = path.join(base, relative);
  const bytes = await sharp(source).png({ compressionLevel: 9 }).toBuffer();
  if (process.argv.includes("--check")) assert.deepEqual(await readFile(file), bytes, relative);
  else { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); }
}
