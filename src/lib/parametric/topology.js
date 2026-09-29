/**
 * Topology 拓扑：决定单元之间「怎么连」，以及负空间如何处理。
 *
 * 与底场/调制/基元不同，拓扑是有状态的：它可能需要读取整张底场才能决定
 * 某个单元怎么画（Truchet 连通、迷宫通道）。
 */

import { cellRandom, evaluate } from './modulator.js';
import { fbm } from './hash.js';
import { build, sizeAt } from './primitive.js';
import { clampNum } from './lattice.js';
import { canvasSize, esc } from './compose.js';

const r2 = (n) => Math.round(n * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 主入口：把底场渲染成 SVG 片段数组。
 * p 为完整参数；ctx 提供 seed 与 palette。
 */
export function apply(cells, p, ctx) {
  const mode = p['topology.mode'];
  const jitter = clampNum(p['topology.jitter'], 0, 1);
  const warp = clampNum(p['topology.warp'], 0, 1);
  const density = clampNum(p['topology.density'], 0, 1);
  // Schema seeds span 0..99999; a 9999 cap aliased every larger seed together.
  const seed = Math.round(clampNum(p['modulator.seed'], 0, 99999));

  let work = cells;
  if (jitter > 0) work = work.map((c) => jitterCell(c, jitter, seed));
  if (warp > 0) work = work.map((c) => warpCell(c, warp, clampNum(p['topology.warpFreq'], 0.1, 8), seed));

  switch (mode) {
    case 'truchet':
      return truchet(work, p, ctx, density, seed);
    case 'maze':
      return maze(work, p, ctx, density, seed);
    case 'lattice':
      // 完整墙网络：底场每个单元都画出与邻居共享的边（iso/hex 即蜂窝）。
      // 参考图 #01 就是这个东西 —— 分析里写的"三正则图，Y 形与 T 形节点"正是蜂窝，
      // 而不是迷宫（迷宫会抽掉一整套生成树，墙网络稀疏得多）。
      return latticeWalls(work, p, ctx, density, seed);
    case 'halftone':
      return halftone(work, p, ctx, seed);
    case 'isolated':
    default:
      return plain(work, p, ctx, seed);
  }
}

/**
 * 位置形变：用噪声场把单元从网格上推开。
 * 这是参考图 #07（正弦扭曲点阵）与 #10（纵向消散扭曲网格）的核心手法 ——
 * 注意：它不是调制尺寸，而是调制**坐标**。
 */
function warpCell(c, amount, freq, seed) {
  const f = freq * 3.2;
  const dx = (fbm(c.u * f, c.v * f, seed, 3) - 0.5) * amount * c.unit * 2.4;
  const dy = (fbm(c.u * f + 5.2, c.v * f + 1.7, seed + 131, 3) - 0.5) * amount * c.unit * 2.4;
  return { ...c, x: c.x + dx, y: c.y + dy };
}

function jitterCell(c, amount, seed) {
  const jx = (cellRandom(c, seed) - 0.5) * amount * c.unit;
  const jy = (cellRandom({ i: c.j + 7717, j: c.i }, seed) - 0.5) * amount * c.unit;
  return { ...c, x: c.x + jx, y: c.y + jy };
}

/**
 * 强调色：palette[2] 只点缀一部分单元（确定性散布），不再是整片覆盖主色。
 * ponytail: 散布比例固定 28%；要可调比例时再加滑杆。
 */
function tint(c, frag, p, seed) {
  const accent = Array.isArray(p.palette) ? p.palette[2] : '';
  if (!accent || cellRandom(c, seed + 4242) < 0.72) return frag;
  const painting = !!p['shape.stroke'] || ['truchet', 'maze', 'lattice'].includes(p['topology.mode']);
  return `<g ${painting ? 'stroke' : 'fill'}="${esc(accent)}">${frag}</g>`;
}

function plain(cells, p, ctx, seed) {
  const out = [];
  for (const c of cells) {
    const m = evaluate(c, p);
    const frag = build(c, m, p, seed);
    if (frag) out.push(tint(c, frag, p, seed));
  }
  return out;
}

/** 半调：把调制值量化成 N 级，产生印刷网点感 */
function halftone(cells, p, ctx, seed) {
  // Schema key is topology.halftoneLevels; shape.halftoneLevels is not a parameter.
  const levels = Math.max(2, Math.round(lerp(2, 8, clampNum(p['topology.halftoneLevels'] ?? 0.5, 0, 1))));
  const out = [];
  for (const c of cells) {
    const m = evaluate(c, p);
    const q = Math.round(m * (levels - 1)) / (levels - 1);
    const frag = build(c, q, p, seed);
    if (frag) out.push(tint(c, frag, p, seed));
  }
  return out;
}

/** Truchet：按单元随机决定弧的朝向，形成连续通道 */
function truchet(cells, p, ctx, density, seed) {
  const out = [];
  const tp = { ...p, 'shape.type': 'arc' };
  for (const c of cells) {
    const rv = cellRandom(c, seed);
    if (rv > density * 1.15 + 0.1) continue;
    const flip = cellRandom({ i: c.i + 31, j: c.j + 17 }, seed) > 0.5;
    const m = evaluate(c, p);
    // 翻转决定弧的朝向，用户的旋转角叠加其上（rotation=0 时与旧实现一致）。
    // 尺寸与弧度交给 build()：sizeMin/sizeMax 随调制变化，sweep 用调参面板的值。
    const frag = build(c, m, {
      ...tp,
      'shape.rotation': (clampNum(p['shape.rotation'], 0, 360) + (flip ? 90 : 0)) % 360,
    }, seed);
    if (frag) out.push(tint(c, frag, p, seed));
  }
  return out;
}

/**
 * 迷宫：在底场网格上跑 DFS 回溯生成完美迷宫，只画墙。
 * 墙体方向随底场变化，这点很重要 —— 参考图 #01 是**等轴测**迷宫
 * （90°/60°/120° 三向线，Y 形节点），若一律画直角墙就完全不是那个东西了。
 */
/**
 * 六角点阵的墙网络 —— iso 与 hex 底场共用。
 *
 * 这两个底场其实是同一种点阵：每个格点到 6 个邻居的距离都等于 dx
 * （同行左右各 dx；上下两行的格点错开半格，斜向距离是 hypot(dx/2, dx*√3/2) = dx）。
 *
 * 所以墙的正确画法是「相邻两格点连线的中垂线」：围绕每个格点形成边长 dx/√3 的正六边形，
 * 顶点处三条边相接 —— 这正是参考图 #01 的"三正则图，Y 形与 T 形节点"。
 * 打通通道 = 抽掉两个格点共享的那一面墙，于是剩下的墙必然首尾相接。
 *
 * 踩过的坑：早先 iso 被画成"竖直主干 + 两条 60° 斜枝"的 Y 形，通道再按方向随手判，
 * 结果 151 条线断成 55 个连通分量（完美迷宫的墙网络应当连通），另有 29 条线画到
 * viewBox 外面。根因就是墙没有画在真正共享的边上 —— 斜枝既不对着邻居，也不在中点相接。
 *
 * 另外 DFS 的边界直接用实际存在的单元格，不再用参数里的 rows，
 * 所以不会出现"通道开向不存在的行"（旧实现里 iso/hex 会丢掉放不下的行，
 * cols=4/rows=40 时只有 j=0..3，六角底行整排丢边）。
 *
 * @param {boolean} withMaze true = 先跑 DFS 生成完美迷宫；false = 保留全部墙
 */
function hexWallNetwork(cells, p, density, seed, withMaze) {
  // apply() 拿到的是点号键名的原始参数，里面没有 w/h，画布尺寸必须从 canvasSize 取。
  // 早先直接读 p.w → undefined → dx = NaN → 坐标全是 NaN，一条线都画不出来。
  const { width: w, height: h } = canvasSize(p);
  const cols = Math.max(1, Math.round(clampNum(p['lattice.cols'], 1, 80)));
  const dx = w / cols;
  const halfEdge = dx / (2 * Math.sqrt(3)); // 六边形边长的一半
  if (!cells.length) return [];
  // 墙厚 = 尺寸（sizeAt），于是 sizeMin/sizeMax 与调制在墙模式下真正生效；
  // 线宽滑杆只属于 truchet / 描边基元（见 schema 的 showIf）。
  const thickAt = (c) => clampNum(sizeAt(evaluate(c, p), p, c), 0.1, 200);
  const maxThick = clampNum(sizeAt(1, p, cells[0]), 0.1, 200);

  const cellAt = new Map();
  for (const c of cells) cellAt.set(`${c.i},${c.j}`, c);
  const kk = (i, j) => `${i},${j}`;
  const wid = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  // 奇数行右移半格，邻接偏移随行奇偶变化。六个方向两两相对，等距。
  const offsets = (j) => (j % 2 === 0
    ? [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]
    : [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]);

  // 全部真实共享墙：只在两个格点都存在时才计入，所以不会越界
  const shared = new Set();
  for (const c of cells) {
    for (const [di, dj] of offsets(c.j)) {
      if (!cellAt.has(kk(c.i + di, c.j + dj))) continue;
      shared.add(wid(kk(c.i, c.j), kk(c.i + di, c.j + dj)));
    }
  }

  const open = new Set();
  if (withMaze) {
    const seen = new Set([kk(cells[0].i, cells[0].j)]);
    const stack = [[cells[0].i, cells[0].j]];
    const rnd = (i, j) => cellRandom({ i, j }, seed + 991);
    while (stack.length) {
      const [ci, cj] = stack[stack.length - 1];
      const next = [];
      for (const [di, dj] of offsets(cj)) {
        const ni = ci + di;
        const nj = cj + dj;
        if (!cellAt.has(kk(ni, nj)) || seen.has(kk(ni, nj))) continue;
        next.push([ni, nj, wid(kk(ci, cj), kk(ni, nj))]);
      }
      if (!next.length) {
        stack.pop();
        continue;
      }
      const k = Math.min(next.length - 1, Math.floor(rnd(ci * 13 + stack.length, cj * 7) * next.length));
      seen.add(kk(next[k][0], next[k][1]));
      open.add(next[k][2]);
      stack.push([next[k][0], next[k][1]]);
    }
  }

  // 连通密度：再拆掉一部分墙。0 = 全部隔开（最密），1 = 全部连通（最空），
  // 与 schema 里"连通密度 0 孤立 / 1 连通"的定义一致。旧实现完全没读这个值，
  // 所以滑杆在网格/等轴测/六角上都是死的（取 0 和 1 输出逐字节相同）。
  const strip = clampNum(density, 0, 1);
  if (strip > 0.001) {
    for (const id of shared) {
      if (open.has(id)) continue;
      const [a, b] = id.split('|');
      const [ai, aj] = a.split(',').map(Number);
      const [bi, bj] = b.split(',').map(Number);
      if (cellRandom({ i: ai * 131 + bi * 17, j: aj * 97 + bj * 7 }, seed + 1237) < strip) {
        open.add(id);
      }
    }
  }

  const out = [];
  const emitted = new Set();
  const margin = maxThick * 0.5 + 1;
  for (const c of cells) {
    for (const [di, dj] of offsets(c.j)) {
      const other = cellAt.get(kk(c.i + di, c.j + dj));
      if (!other) continue;
      const id = wid(kk(c.i, c.j), kk(other.i, other.j));
      if (open.has(id) || emitted.has(id)) continue;
      emitted.add(id);
      // 中垂线：中点 ± 垂直单位向量 * 半边长
      const mx = (c.x + other.x) / 2;
      const my = (c.y + other.y) / 2;
      const vx = other.x - c.x;
      const vy = other.y - c.y;
      const len = Math.hypot(vx, vy) || 1;
      const px = (-vy / len) * halfEdge;
      const py = (vx / len) * halfEdge;
      const x1 = mx + px;
      const y1 = my + py;
      const x2 = mx - px;
      const y2 = my - py;
      if (x1 < margin || x1 > w - margin || x2 < margin || x2 > w - margin) continue;
      if (y1 < margin || y1 > h - margin || y2 < margin || y2 > h - margin) continue;
      out.push(tint(c, `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke-width="${r2(thickAt(c))}"/>`, p, seed));
    }
  }
  return out;
}

/** 完整墙网络：把底场每个单元与邻居共享的边都画出来（iso / hex 的蜂窝）。 */
function latticeWalls(cells, p, ctx, density, seed) {
  // 只有点阵型底场才有"共享边"可言。面板的 showIf 挡不住手动组合
  // （比如 点阵簇 + 织网、同心环 + 织网），那些底场的 i,j 不是网格索引，
  // 硬画会得到一堆几何上无意义的线。这里退回普通基元绘制，宁可平淡也不出垃圾。
  if (!['iso', 'hex'].includes(p['lattice.type'])) return plain(cells, p, ctx, seed);
  return hexWallNetwork(cells, p, density, seed, false);
}

function maze(cells, p, ctx, density, seed) {
  const kind = p['lattice.type'];
  // iso 与 hex 是同一种点阵（每个格点到 6 个邻居等距），墙必须画在相邻格点连线的
  // 中垂线上 —— 详见 hexWallNetwork。按方向随手判通道会画出接不起来的碎片。
  if (kind === 'iso' || kind === 'hex') {
    return hexWallNetwork(cells, p, density, seed, true);
  }
  // 直角网格以外的底场（点阵簇 / 同心环 / 叶序 / 螺旋…）的 i,j 不是网格索引，
  // 硬当成网格会画出一堆无意义的线（实测 点阵簇+迷宫 → 695 个单元只有 61 组不同 i,j，
  // 产出 1474 条线）。退回普通基元绘制。
  if (kind !== 'grid') return plain(cells, p, ctx, seed);
  const cols = Math.max(1, Math.round(clampNum(p['lattice.cols'], 1, 80)));
  const rows = Math.max(1, Math.round(clampNum(p['lattice.rows'], 1, 80)));
  const cellAt = new Map();
  for (const c of cells) cellAt.set(`${c.i},${c.j}`, c);
  const visited = new Set();
  const walls = new Set();
  const key = (i, j) => `${i},${j}`;
  const stack = [[0, 0]];
  visited.add(key(0, 0));
  const rnd = (i, j) => cellRandom({ i, j }, seed + 991);

  while (stack.length) {
    const [ci, cj] = stack[stack.length - 1];
    const neighbors = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of dirs) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      if (visited.has(key(ni, nj))) continue;
      neighbors.push([ni, nj, di, dj]);
    }
    if (!neighbors.length) {
      stack.pop();
      continue;
    }
    const pickIdx = Math.min(neighbors.length - 1, Math.floor(rnd(ci * 13 + stack.length, cj * 7) * neighbors.length));
    const [ni, nj, di, dj] = neighbors[pickIdx];
    visited.add(key(ni, nj));
    walls.add(wallKey(ci, cj, di, dj));
    stack.push([ni, nj]);
  }

  // 墙厚 = 尺寸（sizeAt），见 hexWallNetwork 的说明。
  const thickAt = (c) => clampNum(sizeAt(evaluate(c, p), p, c), 0.1, 200);
  const out = [];
  const emit = (c, frag) => out.push(tint(c, frag, p, seed));

  for (const c of cells) {
    const ux = Math.max(2, c.unit);
    const sw = r2(thickAt(c));

    // 直角网格：水平墙 + 垂直墙
    const half = ux * 0.5;
    if (!walls.has(wallKey(c.i, c.j, 1, 0))) {
      emit(c, `<line x1="${r2(c.x + half)}" y1="${r2(c.y - half)}" x2="${r2(c.x + half)}" y2="${r2(c.y + half)}" stroke-width="${sw}"/>`);
    }
    if (!walls.has(wallKey(c.i, c.j, 0, 1))) {
      emit(c, `<line x1="${r2(c.x - half)}" y1="${r2(c.y + half)}" x2="${r2(c.x + half)}" y2="${r2(c.y + half)}" stroke-width="${sw}"/>`);
    }
    if (c.i === 0 && !walls.has(wallKey(-1, c.j, 1, 0))) {
      emit(c, `<line x1="${r2(c.x - half)}" y1="${r2(c.y - half)}" x2="${r2(c.x - half)}" y2="${r2(c.y + half)}" stroke-width="${sw}"/>`);
    }
    if (c.j === 0 && !walls.has(wallKey(c.i, -1, 0, 1))) {
      emit(c, `<line x1="${r2(c.x - half)}" y1="${r2(c.y - half)}" x2="${r2(c.x + half)}" y2="${r2(c.y - half)}" stroke-width="${sw}"/>`);
    }
  }
  return out;
}

function wallKey(i, j, di, dj) {
  if (di === 1) return `${i},${j}|v`;
  if (di === -1) return `${i - 1},${j}|v`;
  if (dj === 1) return `${i},${j}|h`;
  return `${i},${j - 1}|h`;
}

export const TOPOLOGIES = ['isolated', 'truchet', 'maze', 'lattice', 'halftone'];
