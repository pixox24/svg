/**
 * 预设定量体检 v2 —— 补上 <path> 多边形的真实面积（Shoelace），
 * 并输出大尺寸对照页（2 列），避免缩略图失真导致误判。
 *
 * 运行：node spike/parametric-audit.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRESETS, generate, canvasSize, normalize } from '../src/lib/parametric/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'engine-out');

const INK = '#101216';
const PAPER = '#f2eee6';

/** 从 path 的 d 属性算多边形面积（Shoelace，支持 Q 用控制点近似） */
function pathArea(d) {
  // 抽取所有坐标对（M/L/Q 后的 x y）
  const cmds = d.match(/[MLQ][^MLQZ]*/g) || [];
  const pts = [];
  for (const c of cmds) {
    const v = c.slice(1).trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) {
      if (Number.isFinite(v[i]) && Number.isFinite(v[i + 1])) pts.push([v[i], v[i + 1]]);
    }
  }
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function audit(preset) {
  const p = normalize(preset.params);
  const { width: W, height: H } = canvasSize(p);
  const svg = readFileSync(join(OUT, `${preset.id}.svg`), 'utf8');
  const area = W * H;

  let covered = 0;
  const bands = new Array(10).fill(0);
  const addAt = (y, a) => {
    const b = Math.max(0, Math.min(9, Math.floor((y / H) * 10)));
    bands[b] += a;
  };

  for (const m of svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/g)) {
    const a = Math.PI * +m[3] * +m[3];
    covered += a; addAt(+m[2], a);
  }
  for (const m of svg.matchAll(/<ellipse cx="([-\d.]+)" cy="([-\d.]+)" rx="([-\d.]+)" ry="([-\d.]+)"/g)) {
    const a = Math.PI * +m[3] * +m[4];
    covered += a; addAt(+m[2], a);
  }
  for (const m of svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)"/g)) {
    const w = +m[3]; const h = +m[4]; const rr = +m[5];
    const a = w * h - (4 - Math.PI) * rr * rr;
    covered += a; addAt(+m[2] + h / 2, a);
  }
  for (const m of svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke-width="([\d.]+)"/g)) {
    const a = Math.hypot(+m[3] - +m[1], +m[4] - +m[2]) * +m[5];
    covered += a; addAt((+m[2] + +m[4]) / 2, a);
  }
  // 弧：从起点算真实扫掠角
  for (const m of svg.matchAll(/<path d="M ([-\d.]+) ([-\d.]+) A ([\d.]+) [\d.]+ 0 0 1 ([-\d.]+) ([-\d.]+)" fill="none" stroke-width="([\d.]+)"/g)) {
    const x0 = +m[1]; const y0 = +m[2]; const r = +m[3]; const x1 = +m[4]; const y1 = +m[5]; const sw = +m[6];
    const chord = Math.hypot(x1 - x0, y1 - y0);
    const ratio = Math.min(1, chord / (2 * r));
    const sweep = 2 * Math.asin(ratio);
    const a = r * sweep * sw;
    covered += a; addAt((y0 + y1) / 2, a);
  }
  // 多边形 / 曲边多边形：Shoelace
  for (const m of svg.matchAll(/<path d="([^"]+)"\/>/g)) {
    const a = pathArea(m[1]);
    if (a > 0) { covered += a; addAt(H / 2, a); }
  }

  const coverage = covered / area;
  let touch = null;
  if (['truchet', 'maze'].includes(p['topology.mode']) && p['topology.mode'] === 'truchet') {
    const spacingX = W / p['lattice.cols'];
    const spacingY = ['hex', 'iso'].includes(p['lattice.type']) ? spacingX * 0.866 : H / p['lattice.rows'];
    touch = p['shape.sizeMax'] / Math.min(spacingX, spacingY);
  }
  return { coverage, bands: bands.map((b) => b / (area / 10)), touch };
}

console.log('预设体检 v2（覆盖率 / 分带走向 / 连通性）\n');
const lines = [];
let flagged = 0;
for (const preset of PRESETS) {
  const r = audit(preset);
  const cov = (r.coverage * 100).toFixed(1).padStart(6);
  const prof = r.bands.map((b) => Math.min(9, Math.round(b * 9))).join('');
  const t = r.touch === null ? '  —  ' : r.touch.toFixed(2);
  let v = 'OK ';
  if (r.coverage < 0.06) { v = 'THIN'; flagged += 1; } else if (r.coverage > 1.2) { v = 'SOLID'; }
  if (r.touch !== null && r.touch < 0.85) { v = 'GAP'; flagged += 1; }
  console.log(`  ${v.padEnd(5)} ${preset.id.padEnd(18)} 覆盖 ${cov}%  弧/间距 ${t}  上下走向 ${prof}  ${preset.nameZh}`);
  lines.push({ preset, r });
}
console.log(`\n低于 6% 覆盖率（可能太稀）或弧不连通的预设数: ${flagged}`);

/* ── 设计意图断言：把"参考图的设计意图"写成可机械验证的判据 ──
   这些判据替代了主观视觉评审 —— 每次问视觉模型都会得到含糊答案，
   而这些不等式一跑就知道对不对。 */
console.log('\n设计意图断言：');
const intent = [];
const assert = (name, ok, detail) => {
  intent.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

{
  // ref-01 等轴测迷宫：参考图的实际比例是"线宽 ≈ 间距（1:1）"（见 01-reference-analysis.md）。
  // 所以这里不是"越细越好"，而是要求落在这个比例带内：
  //   低于 0.30 太细（失去参考图的厚重感），高于 0.62 相邻墙会连成一团（曾经的实际 bug：
  //   当时 3 长段/格 + 61% 比例 → 视觉上糊成有机团块）。
  const p = PRESETS[0].params;
  const unit = (500 / p['lattice.cols']) * (1 - p['lattice.gap']);
  const ratio = p['shape.strokeWidth'] / unit;
  assert('ref-01 线宽/间距落在 0.30~0.62（参考图为 1:1）', ratio >= 0.30 && ratio <= 0.62, `${(ratio * 100).toFixed(0)}%`);
}
{
  // ref-02 圆脉：最大半径须超过半间距（重叠才能挤出星形负空间），
  //           最小半径须明显小于半间距（中部才有缝隙）
  const p = PRESETS[1].params;
  const half = 500 / p['lattice.cols'] / 2;
  const rMax = p['shape.sizeMax'] / 2;
  const rMin = p['shape.sizeMin'] / 2;
  assert('ref-02 两端有重叠（出星形）', rMax > half * 1.05, `r=${rMax.toFixed(1)} vs 半间距 ${half.toFixed(1)}`);
  assert('ref-02 中部有缝隙（有节奏）', rMin < half * 0.82, `r=${rMin.toFixed(1)}`);
}
{
  // ref-03 胶囊场：形状要接近单元尺寸才会"咬合"，否则是浮球感
  const p = PRESETS[2].params;
  const cell = 1000 / p['lattice.cols'];
  assert('ref-03 形状接近咬合 ≥85% 单元', p['shape.sizeMax'] / cell >= 0.85, `${((p['shape.sizeMax'] / cell) * 100).toFixed(0)}%`);
  assert('ref-03 最小形状不至于成点 ≥45%', p['shape.sizeMin'] / cell >= 0.45, `${((p['shape.sizeMin'] / cell) * 100).toFixed(0)}%`);
}
{
  // ref-14 六角回纹：弧要够到邻居
  const p = PRESETS[13].params;
  const span = (1000 / p['lattice.cols']) * 0.866;
  assert('ref-14 弧可达邻居 ≥85%', p['shape.sizeMax'] / span >= 0.85, `${(p['shape.sizeMax'] / span).toFixed(2)}`);
}
const intentFailed = intent.filter((x) => !x.ok).length;
console.log(`\n设计意图断言: ${intent.length - intentFailed}/${intent.length} 通过`);

// 把覆盖率导出成 JSON，供 spike/ref-density.py 做"参考图墨量 vs 引擎覆盖"比对
writeFileSync(
  join(OUT, 'coverage.json'),
  JSON.stringify(Object.fromEntries(lines.map(({ preset, r }) => [preset.ref, +(r.coverage * 100).toFixed(1)])), null, 1),
);

// 大尺寸对照页：2 列，每格 ~470px
const cards = lines.map(({ preset }) => {
  const r = generate(preset.params);
  const svg = r.svg.replace(/width="\d+" height="\d+"/, '');
  return `<figure><div class="f">${svg}</div><figcaption><b>${preset.nameZh}</b> · ${preset.name}<br><code>${preset.id}</code></figcaption></figure>`;
});
writeFileSync(join(OUT, 'contact-large.html'), `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>预设大图对照</title><style>
body{margin:0;background:#111;color:#ddd;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;padding:20px}
h1{font-size:16px;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
figure{margin:0;background:#1b1b1b;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden}
.f{background:${INK};display:flex;align-items:center;justify-content:center;height:480px;padding:10px}
.f svg{max-height:460px;max-width:100%;height:auto;width:auto;display:block}
figcaption{padding:8px 12px;font-size:12px}
code{color:#7dd3fc}
</style></head><body><h1>14 个预设 · 大尺寸对照（每格 480px 高）</h1><div class="g">${cards.join('')}</div></body></html>`);
console.log(`→ ${join(OUT, 'contact-large.html')}`);
