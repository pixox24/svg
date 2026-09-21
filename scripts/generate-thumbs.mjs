import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svg } from 'css-doodle/generator';
import { allSketches } from '../src/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'static', 'thumbs');

fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
let fail = 0;

for (const sketch of allSketches()) {
  if (!sketch.code || sketch.kind === 'tabbied') continue;
  const dest = path.join(outDir, `${sketch.id}.svg`);
  try {
    let markup = String(svg(sketch.code));
    if (!markup.includes('<svg')) {
      throw new Error('generator returned empty markup');
    }
    markup = markup
      .replace(/\sviewbox=/gi, ' viewBox=')
      .replace(/\spreserveaspectratio=/gi, ' preserveAspectRatio=');
    fs.writeFileSync(dest, markup);
    ok += 1;
    console.log(`ok  ${sketch.id}.svg`);
  } catch (error) {
    fail += 1;
    console.error(`fail ${sketch.id}: ${error.message}`);
  }
}

console.log(`done: ${ok} thumbs, ${fail} failed`);
if (fail) process.exit(1);
