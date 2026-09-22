/**
 * 生成「参考图 ↔ 引擎产出」并排对照页。
 * 运行：node spike/parametric-compare.mjs
 *
 * 参考图从 ~/Desktop/参数化几何图形参考图/ 复制到 out/refs/（不提交到仓库，
 * 因为那是华子收集的第三方图片，项目仓库是公开的）。
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { PRESETS, generate } from '../src/lib/parametric/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'engine-out');
const REFS_SRC = join(homedir(), 'Desktop', '参数化几何图形参考图');
const REFS_OUT = join(OUT, 'refs');
mkdirSync(REFS_OUT, { recursive: true });

/** ref-01 → 参考图文件名 */
const MAP = {
  'ref-01': '12782d6d72a27ca3ae18b763e3e9e632.jpg',
  'ref-02': '2155cb61359ba356980da44ba4aa3580.jpg',
  'ref-03': '350342e75cea9c83a97a7034596e4ba1.jpg',
  'ref-04': '36c4f9ee2831686aae0adb0ad04dba4e.jpg',
  'ref-05': '406823e4ac2619330bcf814d0f3fbd5c.jpg',
  'ref-06': '51d528cd6c7bcdf3f6a7fe9b1cd6b12f.jpg',
  'ref-07': '7c61a21bafd07cded9ca4b2c6558ea5a.jpg',
  'ref-08': '8b7c5dee042e0459a57827fa4030be68.jpg',
  'ref-09': 'a12ba5d1a1d57bd782dd13dfc6fef345.jpg',
  'ref-10': 'a4df17a494194f5ae1ad6533680c5f5d.jpg',
  'ref-11': 'a96d68e757514ba14435c225537e4c35.jpg',
  'ref-12': 'bfba7ef89fbb61824a493a97c8859763.jpg',
  'ref-13': 'cf6b94d95fb9b19e311670a77aed31f0.jpg',
  'ref-14': 'd6c9147f2abda54fc4e4c71f015abfa2.jpg',
};

const rows = [];
let missing = 0;
for (const preset of PRESETS) {
  const refId = preset.ref;
  const srcName = MAP[refId];
  let imgTag = '<div class="miss">缺少参考图</div>';
  if (srcName && existsSync(join(REFS_SRC, srcName))) {
    const dest = join(REFS_OUT, `${refId}.jpg`);
    if (!existsSync(dest)) copyFileSync(join(REFS_SRC, srcName), dest);
    imgTag = `<img src="refs/${refId}.jpg" alt="${refId}">`;
  } else {
    missing += 1;
  }
  const r = generate(preset.params);
  const svg = r.svg.replace(/width="\d+" height="\d+"/, '');
  rows.push(`
  <section>
    <header><b>${refId}</b> · ${preset.nameZh} <span>/ ${preset.name}</span> <code>${preset.id}</code></header>
    <div class="pair">
      <figure><div class="box">${imgTag}</div><figcaption>参考图</figcaption></figure>
      <figure><div class="box">${svg}</div><figcaption>引擎产出 · ${preset.nameZh}</figcaption></figure>
    </div>
  </section>`);
}

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>参考图 ↔ 引擎产出 对照</title><style>
:root{--ink:#101216;--paper:#f2eee6}
body{margin:0;background:#0d0d0f;color:#ddd;font:13px/1.6 -apple-system,"PingFang SC",sans-serif;padding:24px 28px}
h1{font-size:17px;margin:0 0 4px}
p.sub{color:#888;margin:0 0 24px;font-size:12px}
section{border:1px solid #232326;border-radius:12px;padding:12px 14px;margin:0 0 18px;background:#151517}
header{font-size:13px;color:#ccc;margin-bottom:10px}
header span{color:#777}
code{color:#7dd3fc;font-size:11px;margin-left:6px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
figure{margin:0}
.box{height:420px;display:flex;align-items:center;justify-content:center;background:var(--ink);border-radius:8px;overflow:hidden;padding:8px}
.box img{max-height:404px;max-width:100%;width:auto;height:auto;object-fit:contain;display:block}
.box svg{max-height:404px;max-width:100%;height:auto;width:auto;display:block}
figcaption{font-size:11px;color:#888;padding-top:6px;text-align:center}
.miss{color:#f87171;font-size:12px}
</style></head><body>
<h1>参考图 ↔ 引擎产出 对照（14 组）</h1>
<p class="sub">左：华子收集的参考图 · 右：参数化引擎同一套抽象生成的对应预设。评估的是结构语言是否一致，不是像素级复刻。</p>
${rows.join('')}
</body></html>`;

writeFileSync(join(OUT, 'compare.html'), html);
console.log(`✓ 生成 ${rows.length} 组对照，缺失参考图 ${missing} 张`);
console.log(`→ ${join(OUT, 'compare.html')}`);
