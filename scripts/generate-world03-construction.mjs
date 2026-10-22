import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = 'public/assets/pixel';
const ink = '#473b42';
const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`);
const rect = (x, y, w, h, fill, stroke = 'none', sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (x1, y1, x2, y2, color = ink, sw = 3) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
const polygon = (points, fill, stroke = ink, sw = 3) => `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const ellipse = (cx, cy, rx, ry, fill, stroke = ink, sw = 2) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const cloud = (x, y) => rect(x, y + 10, 68, 12, '#f7f0dc') + rect(x + 10, y + 4, 42, 20, '#f7f0dc') + rect(x + 22, y, 20, 24, '#f7f0dc');
const building = (x, y, w, h, color) => rect(x, y, w, h, color, '#85929a', 2) + Array.from({length: Math.floor(w / 24)}, (_, i) => rect(x + 8 + i * 24, y + 16, 9, 14, '#849aa1')).join('');
const skyline = Array.from({ length: 12 }, (_, i) => building(i * 86 - 5, 280 + (i % 4) * 22, 74, 180, i % 3 === 0 ? '#a9b5b1' : '#bdc2b5')).join('');
const crane = (x, y, reach = 180) => rect(x, y, 10, 360 - y, '#d29447', ink) + rect(x - 44, y - 4, reach, 12, '#efb850', ink) + line(x + reach - 48, y + 9, x + reach - 48, y + 74, '#716257', 3) + rect(x + reach - 56, y + 70, 16, 8, '#695f60', ink);
const scaffold = (x, y) => rect(x, y, 150, 8, '#8b7968', ink) + rect(x, y + 55, 150, 8, '#8b7968', ink) + [8, 72, 136].map(o => rect(x + o, y - 38, 6, 145, '#82736a', ink, 1)).join('') + line(x + 12, y + 55, x + 138, y - 35, '#82736a', 2);
const mixer = (x, y) => rect(x, y + 54, 102, 20, '#8b918e', ink) + polygon(`${x + 5},${y + 18} ${x + 70},${y + 8} ${x + 92},${y + 35} ${x + 22},${y + 47}`, '#eea854') + ellipse(x + 20, y + 79, 9, 9, '#545356') + ellipse(x + 82, y + 79, 9, 9, '#545356');
const excavator = (x, y) => rect(x, y + 66, 114, 15, '#5f5551', ink) + rect(x + 30, y + 26, 63, 39, '#e8ac47', ink) + polygon(`${x + 90},${y + 40} ${x + 146},${y + 8} ${x + 152},${y + 17} ${x + 115},${y + 62}`, '#ebae4b') + polygon(`${x + 111},${y + 59} ${x + 148},${y + 60} ${x + 138},${y + 75}`, '#8b7667') + rect(x + 39, y + 32, 25, 25, '#87a9b2', ink);
const stack = (x, y) => [0, 1, 2].map(row => Array.from({length: 4 - row}, (_, col) => rect(x + row * 9 + col * 20, y - row * 13, 18, 12, row % 2 ? '#c87955' : '#d89463', ink, 1)).join('')).join('');

const far = svg(960, 720, rect(0, 0, 960, 720, '#b9d9d8') + rect(0, 180, 960, 280, '#d6d9c5') + cloud(76, 65) + cloud(430, 93) + cloud(840, 52) + skyline + rect(0, 460, 960, 260, '#c5b5a0'));
const mids = [
  crane(168, 85, 215) + crane(730, 142, 170) + rect(0, 453, 960, 84, '#ad9a87') + scaffold(474, 358) + stack(54, 446) + stack(834, 457),
  mixer(92, 425) + mixer(680, 447) + rect(0, 480, 960, 46, '#b49f88') + crane(468, 150, 160) + stack(344, 474) + stack(870, 480),
  scaffold(75, 330) + scaffold(315, 382) + scaffold(625, 340) + rect(0, 486, 960, 42, '#a99986') + crane(850, 150, 140),
  excavator(76, 404) + excavator(610, 419) + stack(300, 466) + stack(410, 450) + stack(805, 472) + rect(0, 488, 960, 42, '#a99986'),
].map((scene, i) => svg(960, 720, rect(0, 0, 960, 720, '#ffffff', 'none').replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity="0"') + rect(0, 520, 960, 200, ['#ac9983', '#a59583', '#a29482', '#a89786'][i]) + scene));
const foreground = svg(960, 720, rect(0, 0, 960, 720, '#ffffff', 'none').replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity="0"') + rect(0, 666, 960, 54, '#584f4e') + Array.from({length: 12}, (_, i) => rect(i * 80, 665, 42, 7, i % 2 ? '#efb954' : '#d99452')).join(''));

const floor = svg(128, 216, polygon('0,6 10,6 10,3 19,3 19,5 33,5 33,7 49,7 49,4 65,4 65,6 78,6 78,2 94,2 94,5 111,5 111,6 128,6 128,216 0,216', '#8e8174', 'none') + rect(0, 10, 128, 13, '#b4a292') + rect(0, 23, 128, 9, '#9b8b7b') + Array.from({length: 24}, (_, i) => rect((i * 47) % 128, 42 + (i * 59) % 164, 3 + (i % 3), 2, i % 2 ? '#b09d89' : '#6d625b')).join(''));
const tileset = svg(64, 32, rect(0, 0, 64, 32, '#8d8074') + rect(0, 0, 64, 5, '#bcaa94') + Array.from({length: 4}, (_, i) => rect(i * 16, 6, 14, 3, '#aa9581')).join('') + [3, 22, 41, 56].map(x => rect(x, 16, 5, 2, '#655b55')).join(''));
const props = {
  'traffic-cone': svg(32, 40, polygon('5,36 10,32 15,5 18,5 24,32 28,36', '#e98240') + polygon('12,15 20,15 22,21 10,21', '#f4e5c5', 'none') + rect(3, 35, 26, 3, '#5c4d4c', ink, 1)),
  'brick-stack': svg(36, 35, stack(2, 28)),
  'cement-bag': svg(34, 36, polygon('6,3 27,3 31,30 26,34 5,34 2,30', '#d8c5a2') + rect(8, 12, 17, 8, '#849391') + rect(12, 23, 10, 2, '#b4a481', 'none')),
  'steel-pipe': svg(40, 30, ellipse(12, 22, 8, 6, '#6b7b7b') + rect(12, 16, 21, 12, '#829594', ink, 2) + ellipse(12, 22, 7, 5, '#abc0b9') + ellipse(12, 22, 3, 2, '#5f7271', 'none')),
};

const outputs = [
  ['backgrounds/world-03/world-03-far.png', far],
  ...mids.map((bytes, index) => [`backgrounds/world-03/world-03-mid-${index + 1}.png`, bytes]),
  ['backgrounds/world-03/world-03-foreground.png', foreground],
  ['tiles/world-03/world-03-tileset.png', tileset],
  ['tiles/world-03/world-03-construction-floor.png', floor],
  ...Object.entries(props).map(([name, bytes]) => [`objects/world-03/${name}.png`, bytes]),
];

for (const [relative, source] of outputs) {
  const destination = path.join(root, assets, relative);
  const bytes = await sharp(source).png({compressionLevel: 9}).toBuffer();
  if (process.argv.includes('--check')) {
    assert.deepEqual(await readFile(destination), bytes, `${relative} is out of date`);
  } else {
    await mkdir(path.dirname(destination), {recursive: true});
    await writeFile(destination, bytes);
  }
}
