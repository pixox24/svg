/**
 * Topology 拓扑：决定单元之间「怎么连」，以及负空间如何处理。
 *
 * 与底场/调制/基元不同，拓扑是有状态的：它可能需要读取整张底场才能决定
 * 某个单元怎么画（Truchet 连通、迷宫通道）。
 */

import { cellRandom, evaluate } from './modulator.js';
import { fbm } from './hash.js';
import { build } from './primitive.js';
import { clampNum } from './lattice.js';

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
  const seed = Math.round(clampNum(p['modulator.seed'], 0, 9999));

  let work = cells;
  if (jitter > 0) work = work.map((c) => jitterCell(c, jitter, seed));
  if (warp > 0) work = work.map((c) => warpCell(c, warp, clampNum(p['topology.warpFreq'], 0.1, 8), seed));

  switch (mode) {
    case 'truchet':
      return truchet(work, p, ctx, density, seed);
    case 'maze':
      return maze(work, p, ctx, density, seed);
    case 'halftone':
      return halftone(work, p, ctx, seed);
    case 'invert':
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

function plain(cells, p, ctx, seed) {
  const out = [];
  for (const c of cells) {
    const m = evaluate(c, p);
    const frag = build(c, m, p, seed);
    if (frag) out.push(frag);
  }
  return out;
}

/** 半调：把调制值量化成 N 级，产生印刷网点感 */
function halftone(cells, p, ctx, seed) {
  const levels = Math.max(2, Math.round(lerp(2, 8, clampNum(p['shape.halftoneLevels'] ?? 0.5, 0, 1))));
  const out = [];
  for (const c of cells) {
    const m = evaluate(c, p);
    const q = Math.round(m * (levels - 1)) / (levels - 1);
    const frag = build(c, q, p, seed);
    if (frag) out.push(frag);
  }
  return out;
}

/** Truchet：按单元随机决定弧的朝向，形成连续通道 */
function truchet(cells, p, ctx, density, seed) {
  const out = [];
  const tp = { ...p, 'shape.type': 'arc' };
  const size = clampNum(p['shape.sizeMax'], 1, 4000) || 20;
  tp['shape.strokeWidth'] = clampNum(p['shape.strokeWidth'], 0.1, 200);
  for (const c of cells) {
    const rv = cellRandom(c, seed);
    if (rv > density * 1.15 + 0.1) continue;
    const flip = cellRandom({ i: c.i + 31, j: c.j + 17 }, seed) > 0.5;
    const rot = flip ? Math.PI / 2 : 0;
    const local = { ...c };
    const frag = build(local, 0, {
      ...tp,
      'shape.sizeMin': size,
      'shape.sizeMax': size,
      'shape.rotMode': 'grid',
      'shape.rotation': (rot * 180) / Math.PI,
      'shape.sweep': 0.5,
    }, seed);
    if (frag) out.push(frag);
  }
  return out;
}

/**
 * 迷宫：在底场网格上跑 DFS 回溯生成完美迷宫，只画墙。
 * 仅对 grid / hex / iso 这类有 i,j 索引的底场生效。
 */
function maze(cells, p, ctx, density, seed) {
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
    // 用确定性随机而不是 Math.random，保证同种子同结果
    const pickIdx = Math.min(neighbors.length - 1, Math.floor(rnd(ci * 13 + stack.length, cj * 7) * neighbors.length));
    const [ni, nj, di, dj] = neighbors[pickIdx];
    visited.add(key(ni, nj));
    // 打通墙：记录被移除的墙
    walls.add(wallKey(ci, cj, di, dj));
    stack.push([ni, nj]);
  }

  const out = [];
  const sw = clampNum(p['shape.strokeWidth'], 0.1, 200);
  const useHex = p['lattice.type'] === 'hex';
  const step = density;

  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      const a = cellAt.get(key(Math.min(i, cols - 1), Math.min(j, rows - 1)));
      if (!a) continue;
      const ux = a.unit;
      // 水平墙
      if (j <= rows && !walls.has(wallKey(i, j - 1, 0, 1)) && j > 0 && i < cols) {
        const x0 = a.x - ux / 2;
        const y0 = a.y - ux / 2;
        out.push(`<line x1="${r2(x0)}" y1="${r2(y0)}" x2="${r2(x0 + ux)}" y2="${r2(y0)}" stroke-width="${r2(sw)}"/>`);
      }
      // 垂直墙（六角底场用 60° 斜线）
      if (i <= cols && !walls.has(wallKey(i - 1, j, 1, 0)) && i > 0 && j < rows) {
        const x0 = a.x - ux / 2;
        const y0 = a.y - ux / 2;
        if (useHex) {
          out.push(`<line x1="${r2(x0)}" y1="${r2(y0)}" x2="${r2(x0 + ux * 0.5)}" y2="${r2(y0 + ux * 0.866)}" stroke-width="${r2(sw)}"/>`);
        } else {
          out.push(`<line x1="${r2(x0)}" y1="${r2(y0)}" x2="${r2(x0)}" y2="${r2(y0 + ux)}" stroke-width="${r2(sw)}"/>`);
        }
      }
      void step;
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

export const TOPOLOGIES = ['isolated', 'truchet', 'maze', 'invert', 'halftone'];
