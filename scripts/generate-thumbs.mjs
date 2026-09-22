import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svg } from 'css-doodle/generator';
import { PRESETS as PARAMETRIC_PRESETS } from '../src/lib/parametric/presets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'static', 'thumbs');

fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
let fail = 0;

function write(id, markup) {
  const dest = path.join(outDir, `${id}.svg`);
  let out = String(markup);
  if (!out.includes('<svg')) throw new Error('generator returned empty markup');
  out = out
    .replace(/\sviewbox=/gi, ' viewBox=')
    .replace(/\spreserveaspectratio=/gi, ' preserveAspectRatio=');
  fs.writeFileSync(dest, out);
}

/**
 * Parametric family thumbs.
 *
 * These are generated straight from the engine's presets rather than through
 * `allSketches()`, for two reasons:
 *   1. The engine compiles to a finished SVG document, not a css-doodle DSL
 *      string, so css-doodle's svg() must not be applied to it.
 *   2. `allSketches()` reaches into tabbied's catalog.json, which Node 22 refuses
 *      to import without `with { type: 'json' }` — a pre-existing issue in this
 *      repo that should not be able to break thumb generation for other families.
 */
for (const preset of PARAMETRIC_PRESETS) {
  try {
    const { generate } = await import('../src/lib/parametric/index.js');
    write(preset.id, generate(preset.params).svg);
    ok += 1;
    console.log(`ok  ${preset.id}.svg`);
  } catch (error) {
    fail += 1;
    console.error(`fail ${preset.id}: ${error.message}`);
  }
}

// The remaining families go through the normal css-doodle path. A failure to
// load the catalog is reported but does not abort the run.
try {
  const { allSketches } = await import('../src/catalog.js');
  for (const sketch of allSketches()) {
    if (!sketch.code || sketch.kind === 'tabbied') continue;
    if (PARAMETRIC_PRESETS.some((preset) => preset.id === sketch.id)) continue;
    try {
      const isRawSvg = String(sketch.code).trimStart().startsWith('<svg');
      write(sketch.id, isRawSvg ? sketch.code : svg(sketch.code));
      ok += 1;
      console.log(`ok  ${sketch.id}.svg`);
    } catch (error) {
      fail += 1;
      console.error(`fail ${sketch.id}: ${error.message}`);
    }
  }
} catch (error) {
  // 不要静默降级：加载不到 catalog 意味着除 parametric 之外的 family 全都没被重写，
  // 而进程照样退 0，调用方会以为缩略图是完整的。计入 fail，让退出码说实话。
  fail += 1;
  console.error(`fail: could not load catalog families (${error.message})`);
  console.error('      only parametric thumbs were regenerated; the others are untouched.');
}

console.log(`done: ${ok} thumbs, ${fail} failed`);
if (fail) process.exit(1);
