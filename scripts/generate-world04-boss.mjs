import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "public/assets/pixel");
const ink = "#241d2c";
const box = (x, y, w, h, fill, stroke = "none", sw = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const shape = (d, fill, stroke = ink, sw = 3) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
const svg = (w, h, art) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${art}</svg>`);

function tuxedo(frame) {
  if (frame === 3) return [
    shape("M12 94H25V83H43V78H96V82H111V91H118V106H109V114H22V109H12Z", "#34303d"),
    box(37, 80, 12, 8, "#f0e9dd"), box(55, 78, 9, 7, "#f0e9dd"),
    box(15, 104, 24, 4, "#e8bf77"),
  ].join("");
  const armY = frame === 1 ? 48 : frame === 2 ? 68 : 79;
  return [
    shape("M15 81H25V65H32V58H48V63H78V56H87V66H100V76H108V99H99V111H85V114H36V109H24V103H15Z", "#34303d"),
    shape("M29 68H47V86H62V101H35V98H29Z", "#45414b", "none"),
    shape("M23 77H12V70H7V58H14V66H23Z", "#34303d"),
    shape("M76 49H82V33H89V25H96V33H103V25H110V42H118V62H114V74H103V78H87V72H78V64H74Z", "#3b3641"),
    shape("M87 28L93 18L99 30L108 18L112 37H86Z", "#3c3541"),
    box(93, 43, 6, 5, "#f0d6b0"), box(112, 55, 5, 4, "#e3928d"),
    shape("M89 60H107V64H101V69H92Z", "#f4eee4", "none"),
    shape("M62 62H86V85H79V103H60V91H55V74Z", "#f0ece7", ink, 2),
    shape("M64 67L76 78L86 66V81L77 90H69Z", "#fff9ed", "none"),
    box(73, 83, 4, 3, "#d27e77"), box(74, 93, 4, 3, "#d27e77"),
    shape(`M68 80H82V${armY + 10}H90V${armY + 19}H79V93H68Z`, "#39343e"),
    shape("M94 77H106V108H100V113H89V108H92Z", "#38343e"),
    frame === 1 ? shape("M83 43H103V49H110V61H103V55H90V61H84Z", "#dd7168", ink, 2) : "",
    frame === 2 ? box(91, 58, 20, 10, "#7eb7bf", ink, 2) : "",
  ].join("");
}

const sprite = svg(512, 128, [0, 1, 2, 3].map(frame => `<g transform="translate(${frame * 128},0)">${tuxedo(frame)}</g>`).join(""));
const scrap = svg(40, 40, [
  shape("M4 7H13V4H32V10H36V29H31V36H8V32H3V14H4Z", "#7d8b94"),
  box(9, 11, 21, 5, "#bdc8c8"), box(6, 21, 25, 6, "#a46e62"),
  box(26, 29, 7, 4, "#d9c17d"), box(13, 30, 3, 3, ink),
].join(""));

const junkPiles = Array.from({ length: 23 }, (_, i) => {
  const x = i * 36 - 12;
  const height = 15 + (i * 17 % 32);
  const color = ["#55515b", "#67636a", "#4e4b55"][i % 3];
  return box(x, 245 - height, 33, height, color) + box(x + 5, 239 - height, 23, 4, "#817d80");
}).join("");
const background = svg(800, 280, [
  box(0, 0, 800, 280, "#8a8990"),
  box(0, 166, 800, 114, "#77757a"),
  box(0, 205, 800, 75, "#66636a"),
  box(0, 244, 800, 36, "#4c494f"),
  shape("M0 168H137V154H244V174H410V160H510V178H800V206H0Z", "#77747b", "none"),
  box(96, 61, 11, 155, "#5c5a61"), box(89, 61, 105, 8, "#67636b"),
  box(173, 67, 3, 57, "#494851"), box(164, 124, 22, 16, "#a66859", ink, 2),
  shape("M169 140H182V150H177V156H173V150H169Z", "#d57f65", ink, 2),
  box(638, 78, 10, 123, "#57545b"), box(582, 78, 69, 8, "#706a70"),
  box(592, 86, 3, 53, "#4b4952"), box(584, 139, 20, 13, "#a66859", ink, 2),
  junkPiles,
  box(238, 204, 62, 26, "#58515a", ink), box(244, 210, 50, 5, "#958e87"),
  box(449, 204, 52, 29, "#4b4b53", ink), box(456, 211, 38, 6, "#817a7b"),
  box(0, 255, 800, 25, "#3c3942"),
].join(""));

for (const [relative, source] of [
  ["characters/world-04/tuxedo-boss.png", sprite],
  ["objects/world-04/magnet-scrap.png", scrap],
  ["backgrounds/world-04/boss-scrapyard.png", background],
]) {
  const file = path.join(base, relative);
  const bytes = await sharp(source).png({ compressionLevel: 9 }).toBuffer();
  if (process.argv.includes("--check")) assert.deepEqual(await readFile(file), bytes, relative);
  else { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); }
}
