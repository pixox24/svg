/**
 * Lattice 底场：把画布解析为一组单元（cell）。
 *
 * cell 形状（所有底场统一）：
 *   x, y     像素坐标
 *   u, v     归一化坐标 [0,1]
 *   cu, cv   中心化归一化坐标 [-1,1]
 *   r        归一化半径 [0,1]（0 = 画布中心）
 *   theta    极角 [0, 2π)
 *   i, j     索引
 *   n        序号
 *   unit     单元尺寸（像素，供基元按单元比例缩放）
 */

import { hash2 } from './hash.js';

const TAU = Math.PI * 2;

function base(x, y, i, j, n, w, h) {
  const u = x / w;
  const v = y / h;
  const cu = u * 2 - 1;
  const cv = v * 2 - 1;
  const r = Math.min(1, Math.hypot(cu, cv) / Math.SQRT2);
  return { x, y, u, v, cu, cv, r, theta: (Math.atan2(cv, cu) + TAU) % TAU, i, j, n, unit: 1 };
}

/** 正方网格 */
export function grid(p) {
  const { w, h, cols, rows, gap, angle } = p;
  const cells = [];
  const dx = w / cols;
  const dy = h / rows;
  const unit = Math.max(1, Math.min(dx, dy) * (1 - gap));
  const cx = w / 2;
  const cy = h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let n = 0;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      let x = dx * (i + 0.5) - cx;
      let y = dy * (j + 0.5) - cy;
      if (angle) {
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }
      const c = base(x + cx, y + cy, i, j, n, w, h);
      c.unit = unit;
      cells.push(c);
      n += 1;
    }
  }
  return cells;
}

/** 六角 / 蜂窝网格（轴向坐标） */
export function hex(p) {
  const { w, h, cols, rows, gap } = p;
  const cells = [];
  const dx = w / cols;
  const dy = dx * Math.sqrt(3) / 2;
  const available = Math.max(1, Math.floor(h / dy));
  const usedRows = Math.min(rows, available);
  const unit = Math.max(1, dx * (1 - gap));
  const offsetY = (h - usedRows * dy) / 2;
  let n = 0;
  for (let j = 0; j < usedRows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = dx * (i + 0.5 + (j % 2 ? 0.5 : 0));
      const y = offsetY + dy * (j + 0.5);
      if (x > w) continue;
      const c = base(x, y, i, j, n, w, h);
      c.unit = unit;
      cells.push(c);
      n += 1;
    }
  }
  return cells;
}

/** 等轴测（60°/120° 三角网格） */
export function iso(p) {
  const { w, h, cols, rows, gap } = p;
  const cells = [];
  const dx = w / cols;
  const dy = dx * 0.866;
  const available = Math.max(1, Math.floor(h / dy));
  const usedRows = Math.min(rows, available);
  const unit = Math.max(1, dx * (1 - gap));
  const offsetY = (h - usedRows * dy) / 2;
  let n = 0;
  for (let j = 0; j < usedRows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = dx * (i + 0.5 + (j % 2 ? 0.5 : 0));
      const y = offsetY + dy * (j + 0.5);
      if (x > w) continue;
      const c = base(x, y, i, j, n, w, h);
      c.unit = unit;
      cells.push(c);
      n += 1;
    }
  }
  return cells;
}

/** 斜交网格（用于对角编织） */
export function oblique(p) {
  const { w, h, cols, rows, gap, skew } = p;
  const cells = [];
  const d = Math.min(w / cols, h / (rows * Math.max(0.2, Math.cos(skew))));
  const step = Math.max(4, d);
  const unit = Math.max(1, step * (1 - gap));
  const cos = Math.cos(skew);
  const sin = Math.sin(skew);
  let n = 0;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = i * step * cos + j * step * 0.866;
      const y = i * step * sin - j * step * 0.5 + h * 0.66;
      if (x < -step || x > w + step || y < -step || y > h + step) continue;
      const c = base(x, y, i, j, n, w, h);
      c.unit = unit;
      cells.push(c);
      n += 1;
    }
  }
  return cells;
}

/** 极坐标同心环 */
export function ring(p) {
  const { w, h, rows: rings, count } = p;
  const cells = [];
  const cx = w / 2;
  const cy = h / 2;
  const rmax = Math.min(w, h) / 2;
  const ringCount = Math.max(1, rings);
  // 注意：不要用 `base` 当变量名 —— 会遮蔽本模块的 base() 辅助函数
  const perRing = Math.max(4, Math.round(count / ringCount));
  let n = 0;
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const t = ring / ringCount;
    const r = rmax * 0.96 * t;
    const k = Math.max(3, Math.round(perRing * t));
    const unit = Math.max(2, (TAU * r) / k);
    for (let i = 0; i < k; i += 1) {
      const th = (i / k) * TAU;
      const x = cx + Math.cos(th) * r;
      const y = cy + Math.sin(th) * r;
      const c = base(x, y, i, ring, n, w, h);
      c.r = t;
      c.unit = unit;
      cells.push(c);
      n += 1;
    }
  }
  return cells;
}

/** Vogel 叶序螺旋 */
export function phyllotaxis(p) {
  const { w, h, count, divergence } = p;
  const cells = [];
  const cx = w / 2;
  const cy = h / 2;
  const rmax = Math.min(w, h) / 2 * 0.96;
  const N = Math.max(1, count);
  const c0 = rmax / Math.sqrt(N);
  const ang = (divergence * Math.PI) / 180;
  for (let n = 0; n < N; n += 1) {
    const r = c0 * Math.sqrt(n);
    const th = n * ang;
    const x = cx + r * Math.cos(th);
    const y = cy + r * Math.sin(th);
    const cell = base(x, y, n, 0, n, w, h);
    cell.theta = ((th % TAU) + TAU) % TAU;
    cell.r = Math.min(1, r / rmax);
    cell.unit = c0;
    cells.push(cell);
  }
  return cells;
}

/** 螺旋（阿基米德 / 对数） */
export function spiral(p) {
  const { w, h, count, turns, spiralKind } = p;
  const cells = [];
  const cx = w / 2;
  const cy = h / 2;
  const rmax = Math.min(w, h) / 2 * 0.96;
  const N = Math.max(2, count);
  const tmax = Math.max(0.5, turns) * TAU;
  const k = 0.24;
  const denom = spiralKind === 'logarithmic' ? Math.exp(k * tmax) - 1 : 1;
  for (let s = 0; s < N; s += 1) {
    const t = (s / N) * tmax;
    const tn = t / tmax;
    const rr = spiralKind === 'logarithmic' ? (Math.exp(k * t) - 1) / denom : tn;
    const r = rr * rmax;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    const cell = base(x, y, s, 0, s, w, h);
    cell.theta = t % TAU;
    cell.r = rr;
    cell.unit = Math.max(2, rmax / N * 4);
    cells.push(cell);
  }
  return cells;
}

/** 元素总预算：唯一放大器是 cluster（点数 ∝ clusterSize²），按预算反解间距。 */
export const CELL_BUDGET = 30000;

/** 二级嵌套：簇内六角点阵 + 簇间六角平铺 */
export function cluster(p) {
  const { w, h, cols, rows, clusterSize, clusterSpread } = p;
  const cells = [];
  const R = Math.min(w / (cols + 1), h / (rows * 0.9)) * 0.5;
  const stepX = R * Math.max(1.2, clusterSpread);
  const stepY = stepX * 0.866;
  // 簇内点数 ≈ 3.63·(R/s)²。不设上限时 40×40 + 簇内 12 = 72 万元素 / 26MB SVG，浏览器卡死。
  // ponytail: 用预算反解间距（保几何、不裁画布）；要更密就分批渲染，别放宽 CELL_BUDGET。
  const perCluster = Math.max(4, Math.floor(CELL_BUDGET / Math.max(1, cols * rows)));
  const dotStep = Math.max(R / Math.max(1, clusterSize), R * Math.sqrt(3.63 / perCluster));
  const lim = Math.ceil(R / dotStep) + 1;
  let n = 0;
  for (let cj = 0; cj < rows; cj += 1) {
    for (let ci = 0; ci < cols; ci += 1) {
      const ccx = stepX * (ci + 0.5 + (cj % 2 ? 0.5 : 0)) + stepX * 0.25;
      const ccy = stepY * (cj + 0.5) + stepY * 0.25;
      if (ccy > h + stepY || ccx > w + stepX) continue;
      for (let q = -lim; q <= lim; q += 1) {
        for (let pp = -lim; pp <= lim; pp += 1) {
          const px = ccx + dotStep * (pp + q * 0.5);
          const py = ccy + dotStep * q * 0.866;
          const dxh = px - ccx;
          const dyh = py - ccy;
          const dHex = Math.max(
            Math.abs(dyh),
            Math.abs(dyh * 0.5 + dxh * 0.866),
            Math.abs(dyh * 0.5 - dxh * 0.866),
          );
          if (dHex > R) continue;
          if (px < 0 || px > w || py < 0 || py > h) continue;
          const cell = base(px, py, pp, q, n, w, h);
          cell.r = Math.min(1, dHex / R);
          cell.unit = dotStep;
          cell.clusterI = ci;
          cell.clusterJ = cj;
          cells.push(cell);
          n += 1;
        }
      }
    }
  }
  return cells;
}

/** 网格拓扑用的二维索引（供 truchet / maze） */
export function gridIndex(cells, cols) {
  const map = new Map();
  for (const c of cells) map.set(`${c.i},${c.j}`, c);
  void cols;
  return map;
}

export const LATTICES = { grid, hex, iso, oblique, ring, phyllotaxis, spiral, cluster };

/** 入口：按参数解析底场 */
export function resolve(params, w, h) {
  const type = params['lattice.type'];
  const fn = LATTICES[type] || grid;
  const p = {
    w,
    h,
    cols: clampInt(params['lattice.cols'], 1, 80),
    rows: clampInt(params['lattice.rows'], 1, 80),
    gap: clampNum(params['lattice.gap'], -0.9, 1.5),
    angle: (clampNum(params['lattice.angle'], 0, 360) * Math.PI) / 180,
    skew: (clampNum(params['lattice.skew'], -60, 60) * Math.PI) / 180,
    count: clampInt(params['lattice.count'], 1, 20000),
    turns: clampNum(params['lattice.turns'], 0.5, 30),
    spiralKind: params['lattice.spiralKind'],
    divergence: clampNum(params['lattice.divergence'], 90, 180),
    clusterSize: clampNum(params['lattice.clusterSize'], 1, 12),
    clusterSpread: clampNum(params['lattice.clusterSpread'], 1.2, 6),
  };
  void hash2;
  return fn(p);
}

export function clampNum(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function clampInt(v, lo, hi) {
  return Math.round(clampNum(v, lo, hi));
}

export { TAU };
