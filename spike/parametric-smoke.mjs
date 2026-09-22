/**
 * 引擎冒烟测试 + 预设对照页生成。
 * 运行：node spike/parametric-smoke.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  generate, selfCheck, PRESETS, randomize, encodeParams, decodeParams, randomSeed,
} from '../src/lib/parametric/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'engine-out');
mkdirSync(OUT, { recursive: true });

console.log('== selfCheck ==');
const check = selfCheck();
console.log(check.ok ? '  ✓ 全部通过' : `  ✗ 失败项:\n   - ${check.failures.join('\n   - ')}`);

console.log('\n== 14 个预设 ==');
const cards = [];
for (const preset of PRESETS) {
  const r = generate(preset.params);
  const w = r.svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  writeFileSync(join(OUT, `${preset.id}.svg`), r.svg);
  const warn = r.warnings.length ? ` ⚠ ${r.warnings.join('; ')}` : '';
  const dim = w ? `${w[1]}x${w[2]}` : '?';
  console.log(
    `  ${preset.id.padEnd(20)} ${dim.padEnd(11)}`
    + `元素 ${String(r.stats.elements).padStart(5)}  单元 ${String(r.stats.cells).padStart(5)}  `
    + `${String(r.stats.ms).padStart(4)}ms  ${preset.nameZh}${warn}`,
  );
  let svg = r.svg.replace(/width="\d+" height="\d+"/, '');
  cards.push(`<div class="c"><div class="f">${svg}</div><div class="l">${preset.id}<br>${preset.nameZh}</div></div>`);
}

console.log('\n== 随机 + 往返编码 ==');
const seed = randomSeed();
const rnd = randomize(PRESETS[4].params, seed, ['shape.type']);
const back = decodeParams(encodeParams(rnd));
const same = JSON.stringify(back) === JSON.stringify(rnd);
console.log(`  种子 ${seed} → ${rnd.stats ? '' : ''}元素 ${generate(rnd).stats.elements}`);
console.log(`  encode/decode 往返一致: ${same ? '✓' : '✗'}`);
console.log(`  locked 生效（shape.type 未变）: ${rnd['shape.type'] === PRESETS[4].params['shape.type'] ? '✓' : '✗'}`);

console.log('\n== 确定性 ==');
const s1 = generate(PRESETS[7].params).svg;
const s2 = generate(PRESETS[7].params).svg;
console.log(`  两次生成逐字节一致: ${s1 === s2 ? '✓' : '✗'} (${s1.length} 字节)`);

console.log('\n== 随机参数压力测试（50 组，找崩溃/空白）==');
let bad = 0;
for (let i = 0; i < 50; i += 1) {
  const r = generate(randomize(PRESETS[i % PRESETS.length].params, i * 977 + 13));
  if (!r.svg.startsWith('<svg') || r.stats.elements < 4) {
    bad += 1;
    console.log(`  ✗ seed=${i * 977 + 13} 元素=${r.stats.elements} ${r.warnings.join(';')}`);
  }
}
console.log(`  失败 ${bad}/50`);

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>引擎预设对照</title><style>
body{margin:0;background:#000;padding:10px;font:10px -apple-system,"PingFang SC",sans-serif;color:#888}
.g{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.c{background:#191919;border-radius:6px;overflow:hidden}
.f{height:200px;display:flex;align-items:center;justify-content:center;background:#000}
.f svg{max-height:192px;max-width:100%;height:auto;width:auto}
.l{padding:4px;text-align:center;font-size:9px;line-height:1.3}
</style></head><body><div class="g">${cards.join('')}</div></body></html>`;
writeFileSync(join(OUT, 'contact.html'), html);
console.log(`\n→ ${join(OUT, 'contact.html')}`);
process.exit(check.ok && bad === 0 ? 0 : 1);
