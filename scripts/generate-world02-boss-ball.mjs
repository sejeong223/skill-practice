import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'public/assets/pixel/objects/world-02/cheese-tabby-rubber-ball.png');
const source = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <path fill="#3f3444" d="M10 2h12v2h4v3h3v5h2v9h-2v5h-3v3h-5v2H11v-2H6v-3H3v-5H1v-9h2V7h3V4h4z"/>
  <path fill="#f08a44" d="M11 4h10v2h4v3h3v4h2v7h-2v5h-3v2h-5v2h-8v-2H7v-2H4v-5H3v-7h2V9h3V6h3z"/>
  <path fill="#ffd572" d="M11 5h8v2h4v3h3v5h1v5h-4v-3h-4v-4h-4V9h-4z"/>
  <path fill="#f8edca" d="M10 7h5v2h-3v3H9V9h1z"/>
  <path fill="#d76153" d="M6 21h5v3h4v3H9v-2H6z"/>
</svg>`);
const bytes = await sharp(source).png({compressionLevel: 9}).toBuffer();
if (process.argv.includes('--check')) assert.deepEqual(await readFile(destination), bytes);
else { await mkdir(path.dirname(destination), {recursive:true}); await writeFile(destination, bytes); }
