/**
 * 引擎行为探针 —— 供 spike/parametric-accept.mjs 的 C7/C8/C9 断言使用。
 *
 * 存在的理由：验收脚本原来的 C 组几乎全是"读源码跑正则"，评审明确指出这只能证明
 * 代码里写了某句话，不能证明它按预期工作。这里把评审发现过的每一个问题都变成
 * 一次真实测量 —— 修好的bug会永久留在这条防线上。
 *
 * 输出一行 JSON 到 stdout。
 * 运行：node spike/engine-guards.mjs
 */

import {
  PRESETS,
  PRESET_BY_ID,
  generate,
  normalize,
  randomize,
} from '../src/lib/parametric/index.js';

/** 量一张 SVG 的墙网络：线段数、连通分量、越界数、墨量占比 */
function wallStats(params) {
  const svg = generate(params).svg;
  const segs = [...svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)]
    .map((x) => ({ x1: +x[1], y1: +x[2], x2: +x[3], y2: +x[4] }));
  if (!segs.length) return { n: 0, comps: 0, oob: 0, ink: 0 };
  const sw = +(svg.match(/stroke-width="([\d.]+)"/) || [0, 0])[1];
  const vb = (svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []).slice(1).map(Number);
  const segDist = (p, s) => {
    const vx = s.x2 - s.x1;
    const vy = s.y2 - s.y1;
    const wx = p.x - s.x1;
    const wy = p.y - s.y1;
    const L = vx * vx + vy * vy;
    const t = L ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / L)) : 0;
    return Math.hypot(p.x - (s.x1 + t * vx), p.y - (s.y1 + t * vy));
  };
  // 按线宽判定相接，然后数连通分量
  const par = segs.map((_, i) => i);
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  const uni = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) par[ra] = rb;
  };
  segs.forEach((a, i) => segs.forEach((b, j) => {
    if (j <= i) return;
    if (segDist({ x: a.x1, y: a.y1 }, b) < sw || segDist({ x: a.x2, y: a.y2 }, b) < sw
      || segDist({ x: b.x1, y: b.y1 }, a) < sw || segDist({ x: b.x2, y: b.y2 }, a) < sw) uni(i, j);
  }));
  const oob = segs.filter((s) => [s.x1, s.x2].some((x) => x < 0 || x > vb[0])
    || [s.y1, s.y2].some((y) => y < 0 || y > vb[1])).length;
  const ink = segs.reduce((acc, s) => acc + Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * sw, 0) / (vb[0] * vb[1]);
  return { n: segs.length, comps: new Set(segs.map((_, i) => find(i))).size, oob, ink: +ink.toFixed(4) };
}

const base = PRESET_BY_ID['p-iso-maze'].params;
const at = (over) => ({ ...base, ...over });

// —— 1) 墙网络几何 ——
const walls = {
  // 完整蜂窝：墙网络应当连通（这是它作为"三正则图"的必然结果）
  latticeIso: wallStats(at({ 'topology.mode': 'lattice', 'topology.density': 0 })),
  latticeHex: wallStats(at({ 'lattice.type': 'hex', 'topology.mode': 'lattice', 'topology.density': 0 })),
  // 密度必须真的起作用：越高拆掉的墙越多
  density0: wallStats(at({ 'topology.mode': 'maze', 'topology.density': 0 })),
  density50: wallStats(at({ 'topology.mode': 'maze', 'topology.density': 0.5 })),
  density100: wallStats(at({ 'topology.mode': 'maze', 'topology.density': 1 })),
};

// —— 2) 种子归一化：界面显示的值必须等于实际参与绘制的值 ——
const seeds = [-5, 0, 7123.9, 100000, 99999].map((v) => [v, normalize({ 'modulator.seed': v })['modulator.seed']]);

// —— 3) 锁定：锁住的键在随机后必须原封不动 ——
const locked = ['shape.sizeMax', 'modulator.seed', 'lattice.cols'];
const lockOut = randomize(
  at({ 'shape.sizeMax': 10, 'modulator.seed': 42, 'lattice.cols': 9 }),
  777,
  locked,
);

// —— 4) 不兼容组合必须优雅降级，不能崩也不能出垃圾 ——
// 点阵簇 / 同心环 / 叶序 的 i,j 不是网格索引
const incompatible = {};
for (const type of ['cluster', 'ring', 'phyllotaxis']) {
  for (const mode of ['maze', 'lattice']) {
    try {
      const r = generate(normalize({ 'canvas.aspect': 'square', 'lattice.type': type, 'topology.mode': mode, 'modulator.seed': 11 }));
      incompatible[`${type}+${mode}`] = r.stats.elements;
    } catch (e) {
      incompatible[`${type}+${mode}`] = `THREW: ${e.message}`;
    }
  }
}

// —— 5) 空强调色必须解析为前景色，而不是黑色 ——
const accentSvg = generate(normalize({ palette: ['#101216', '#ffffff', ''], 'shape.stroke': true })).svg;
const accentStroke = (accentSvg.match(/<g[^>]*stroke="([^"]*)"/) || [])[1];

// —— 6) 14 个预设的基本健康度 ——
const presets = PRESETS.map((p) => {
  const r = generate(p.params);
  return { id: p.id, elements: r.stats.elements, ref: p.ref };
});
const blankPresets = presets.filter((p) => p.elements < 15);

console.log(JSON.stringify({
  walls,
  seeds,
  lock: {
    sizeMax: lockOut['shape.sizeMax'],
    seed: lockOut['modulator.seed'],
    cols: lockOut['lattice.cols'],
  },
  incompatible,
  accentStroke,
  blankPresets,
  presetCount: presets.length,
}));
