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
  // Schema key is topology.halftoneLevels; shape.halftoneLevels is not a parameter.
  const levels = Math.max(2, Math.round(lerp(2, 8, clampNum(p['topology.halftoneLevels'] ?? 0.5, 0, 1))));
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
 * 墙体方向随底场变化，这点很重要 —— 参考图 #01 是**等轴测**迷宫
 * （90°/60°/120° 三向线，Y 形节点），若一律画直角墙就完全不是那个东西了。
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
    const pickIdx = Math.min(neighbors.length - 1, Math.floor(rnd(ci * 13 + stack.length, cj * 7) * neighbors.length));
    const [ni, nj, di, dj] = neighbors[pickIdx];
    visited.add(key(ni, nj));
    walls.add(wallKey(ci, cj, di, dj));
    stack.push([ni, nj]);
  }

  const sw = clampNum(p['shape.strokeWidth'], 0.1, 200);
  const kind = p['lattice.type'];
  const out = [];

  for (const c of cells) {
    const ux = Math.max(2, c.unit);
    const X = r2(c.x);
    const Y = r2(c.y);

    if (kind === 'iso') {
      // 等轴测三向骨架：竖直主干 + 两条 60° 斜枝（Y 形节点）。
      //
      // 注意边标识的语义必须与几何一致。早期版本用 wallKey(i, j, -1, 1) 判斜枝，
      // 而该函数对 di=-1 返回 `${i-1},${j}|v` —— 与"左邻居通道"是同一个键，
      // 于是"某个方向打通"会拆掉"另一个方向的墙"，整张图退化成 incoherent 的噪声。
      // 现在只按真实共享关系判断：竖直段由上下通道决定，两条斜枝分别由左右通道决定。
      const half = ux * 0.5;
      const dx60 = ux * 0.866;
      const up = walls.has(wallKey(c.i, c.j, 0, -1));
      const down = walls.has(wallKey(c.i, c.j, 0, 1));
      const left = walls.has(wallKey(c.i, c.j, -1, 0));
      const right = walls.has(wallKey(c.i, c.j, 1, 0));
      if (!up && !down) {
        out.push(`<line x1="${X}" y1="${r2(c.y - half)}" x2="${X}" y2="${r2(c.y + half)}" stroke-width="${r2(sw)}"/>`);
      }
      const footY = r2(c.y + half);
      if (!left) {
        out.push(`<line x1="${X}" y1="${footY}" x2="${r2(c.x - dx60)}" y2="${r2(c.y + half * 2)}" stroke-width="${r2(sw)}"/>`);
      }
      if (!right) {
        out.push(`<line x1="${X}" y1="${footY}" x2="${r2(c.x + dx60)}" y2="${r2(c.y + half * 2)}" stroke-width="${r2(sw)}"/>`);
      }
      continue;
    }

    if (kind === 'hex') {
      // 六角：六条边，按轴向邻居裁剪
      const R = ux * 0.54;
      const verts = [];
      for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3;
        verts.push([c.x + Math.cos(a) * R, c.y + Math.sin(a) * R]);
      }
      for (let k = 0; k < 6; k += 1) {
        // 偶数索引边对应水平邻居，奇数索引对应斜向
        const di = k === 0 ? 1 : k === 3 ? -1 : 0;
        const dj = k === 0 || k === 3 ? 0 : (k < 3 ? 1 : -1);
        if (di || dj) {
          if (walls.has(wallKey(c.i, c.j, di, dj))) continue;
        }
        const a = verts[k];
        const b = verts[(k + 1) % 6];
        out.push(`<line x1="${r2(a[0])}" y1="${r2(a[1])}" x2="${r2(b[0])}" y2="${r2(b[1])}" stroke-width="${r2(sw)}"/>`);
      }
      continue;
    }

    // 直角网格：水平墙 + 垂直墙
    const half = ux * 0.5;
    if (!walls.has(wallKey(c.i, c.j, 1, 0))) {
      out.push(`<line x1="${r2(c.x + half)}" y1="${r2(c.y - half)}" x2="${r2(c.x + half)}" y2="${r2(c.y + half)}" stroke-width="${r2(sw)}"/>`);
    }
    if (!walls.has(wallKey(c.i, c.j, 0, 1))) {
      out.push(`<line x1="${r2(c.x - half)}" y1="${r2(c.y + half)}" x2="${r2(c.x + half)}" y2="${r2(c.y + half)}" stroke-width="${r2(sw)}"/>`);
    }
    if (c.i === 0 && !walls.has(wallKey(-1, c.j, 1, 0))) {
      out.push(`<line x1="${r2(c.x - half)}" y1="${r2(c.y - half)}" x2="${r2(c.x - half)}" y2="${r2(c.y + half)}" stroke-width="${r2(sw)}"/>`);
    }
    if (c.j === 0 && !walls.has(wallKey(c.i, -1, 0, 1))) {
      out.push(`<line x1="${r2(c.x - half)}" y1="${r2(c.y - half)}" x2="${r2(c.x + half)}" y2="${r2(c.y - half)}" stroke-width="${r2(sw)}"/>`);
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
