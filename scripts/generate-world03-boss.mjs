import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'public/assets/pixel');
const ink = '#40323e';
const rect = (x,y,w,h,fill,stroke='none',sw=3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const pathShape = (d,fill,stroke=ink,sw=3) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
const svg = (w,h,body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`);
const cat = (pose) => {
  if (pose === 3) return pathShape('M14 93H26V79H40V73H91V79H106V90H116V108H109V114H24V108H14Z','#aebbc3')+
    rect(33,79,9,11,'#657e8c')+rect(54,74,7,13,'#657e8c')+rect(76,77,8,11,'#657e8c')+
    rect(29,99,4,3,ink)+rect(14,104,20,4,'#ebd4a8')+
    rect(45,72,41,5,'#f0be50',ink,1)+rect(66,66,18,5,'#e4a542',ink,1);
  const armY = pose === 1 ? 50 : pose === 2 ? 67 : 77;
  const headShift = pose === 2 ? -3 : 0;
  return [
    pathShape('M15 80H24V63H29V58H43V64H78V59H87V66H98V77H106V97H99V105H88V112H35V108H23V101H15Z','#adbcc2'),
    pathShape('M24 69H42V78H65V91H78V101H36V98H25Z','#c9d3cd','none'),
    rect(32,65,7,25,'#6d8794')+rect(47,71,7,19,'#6d8794')+rect(65,67,7,25,'#6d8794')+rect(84,73,6,20,'#6d8794'),
    pathShape('M31 105H48V114H35Z','#718895')+pathShape('M75 103H92V114H78Z','#718895'),
    pathShape('M18 77H10V68H5V57H13V64H22Z','#899eaa'),
    pathShape(`M74 ${49+headShift}H81V35H88V25H96V32H101V38H112V47H118V64H113V72H101V78H88V72H79V65H74Z`,'#b5c5ca'),
    pathShape('M89 27L91 18L98 25L106 19L107 36H94Z','#adbdc1'),
    rect(88,48+headShift,7,4,'#778d99')+rect(88,54+headShift,7,4,'#778d99')+
    rect(101,42+headShift,6,5,ink)+rect(116,55+headShift,4,4,'#c87f75')+
    rect(100,61+headShift,11,3,ink)+rect(115,66+headShift,7,2,'#ead6b3')+
    pathShape('M82 33H113V40H78V36Z','#e8b548')+rect(86,27,22,7,'#efc460',ink,2)+rect(90,25,14,4,'#f5d37a'),
    pathShape(`M67 78H84V${armY+12}H92V${armY+20}H81V92H66Z`,'#a5b7bc'),
    pose === 1 ? rect(87,44,23,14,'#cb7d57',ink,2)+rect(99,46,2,10,'#e6a36f') : '',
    pose === 2 ? rect(90,61,21,12,'#cb7d57',ink,2) : '',
  ].join('');
};

const sprite = svg(512,128,[0,1,2,3].map(index => `<g transform="translate(${index*128},0)">${cat(index)}</g>`).join(''));
const brick = svg(32,32,
  pathShape('M3 5H25V8H30V23H26V28H5V24H2V9H3Z','#bf7253')+
  rect(6,9,18,5,'#e6a46f')+rect(8,17,2,8,'#8c5551')+rect(21,17,3,8,'#a25c50')+
  rect(25,12,3,9,'#dc9063'));

for (const [relative, source] of [
  ['characters/world-03/mackerel-boss.png', sprite],
  ['objects/world-03/mackerel-brick.png', brick],
]) {
  const file = path.join(base, relative);
  const bytes = await sharp(source).png({compressionLevel:9}).toBuffer();
  if (process.argv.includes('--check')) assert.deepEqual(await readFile(file),bytes,relative);
  else { await mkdir(path.dirname(file),{recursive:true}); await writeFile(file,bytes); }
}
