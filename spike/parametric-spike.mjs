/**
 * Parametric Engine — 可行性 spike
 * 目标：用同一套 (Lattice × Modulator × Primitive × Topology) 抽象，还原 14 张参考图。
 * 纯函数，无依赖，输出 SVG 字符串。可直接在 node 跑。
 *
 * 运行: node spike/parametric-spike.mjs
 */

/* ────────────────────────── 基础数学 ────────────────────────── */

const TAU = Math.PI * 2;

/** 确定性哈希 → [0,1)。必须用 Math.imul 做 32 位整数运算，
 *  否则大整数乘法会丢精度、>>> 位移退化为常量，噪声会整片失效。 */
function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 平滑值噪声 (value noise, 双线性 + smoothstep) */
function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** 分形噪声 (fBm) */
function fbm(x, y, seed = 0, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 97);
    norm += amp;
    amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const r2 = (n) => Math.round(n * 100) / 100;

/* ────────────────────────── Lattice 底场 ────────────────────────── */
/**
 * 每个底场产出一组 cell：
 * { x, y, u, v, r, theta, i, j, n, cx, cy }  —— x,y 为像素坐标；u,v ∈[0,1] 归一化；
 * r ∈[0,1] 归一化半径；theta 极角；i,j 为索引；n 为序号；cx,cy 为归一化中心
 */
const Lattice = {
  /** 正方网格 */
  grid({ w, h, cols = 12, rows = 20, margin = 0 }) {
    const cells = [];
    const dx = (w + margin) / (cols + 1), dy = (h + margin) / (rows + 1);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = dx * (i + 1), y = dy * (j + 1);
        cells.push(mk(x, y, i, j, i + j * cols, w, h, cols, rows));
      }
    return { cells, cols, rows, w, h };
  },

  /** 六角 / 蜂窝网格（轴向坐标） */
  hex({ w, h, cols = 10, rows = 16, margin = 0 }) {
    const cells = [];
    const dx = (w + margin) / (cols + 1);
    const dy = dx * Math.sqrt(3) / 2;
    const usedRows = Math.min(rows, Math.floor(h / dy));
    for (let j = 0; j < usedRows; j++)
      for (let i = 0; i < cols; i++) {
        const x = dx * (i + 0.5 + (j % 2 ? 0.5 : 0)) + dx * 0.25;
        const y = dy * (j + 0.5) + 1;
        if (y > h) continue;
        cells.push(mk(x, y, i, j, i + j * cols, w, h, cols, usedRows));
      }
    return { cells, cols, rows: usedRows, w, h, dx, dy };
  },

  /** 等轴测（60°/120° 三角网格） */
  iso({ w, h, cols = 10, rows = 16 }) {
    const cells = [];
    const dx = w / (cols + 1);
    const dy = dx * 0.866;
    const usedRows = Math.min(rows, Math.floor(h / dy));
    for (let j = 0; j < usedRows; j++)
      for (let i = 0; i < cols; i++) {
        const x = dx * (i + 0.5 + (j % 2 ? 0.5 : 0));
        const y = dy * (j + 0.5);
        if (y > h || x > w) continue;
        cells.push(mk(x, y, i, j, i + j * cols, w, h, cols, usedRows));
      }
    return { cells, cols, rows: usedRows, w, h, dx, dy };
  },

  /** 斜交网格（对角编织） */
  oblique({ w, h, cols = 14, rows = 14, skew = Math.PI / 4 }) {
    const cells = [];
    const d = (w + h) / (cols + rows);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = i * d + j * d * Math.cos(skew);
        const y = j * d * Math.sin(skew);
        if (x > w + d || y > h + d) continue;
        cells.push(mk(x, y, i, j, i + j * cols, w, h, cols, rows));
      }
    return { cells, cols, rows, w, h, d };
  },

  /** 极坐标（同心环） */
  ring({ w, h, count = 22, perRing = 30 }) {
    const cells = [];
    const cx = w / 2, cy = h / 2;
    const rmax = Math.min(w, h) / 2;
    let n = 0;
    for (let ring = 1; ring <= count; ring++) {
      const t = ring / count;
      const r = rmax * t;
      const k = Math.max(4, Math.round(perRing * t));
      for (let i = 0; i < k; i++) {
        const th = (i / k) * TAU;
        const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
        cells.push(mkFull(x, y, i, ring, n++, cx, cy, rmax, (th + TAU) % TAU, t));
      }
    }
    return { cells, w, h };
  },

  /** Vogel 叶序螺旋 */
  phyllotaxis({ w, h, count = 900, angle = 137.507764, spacing = 1, r0 = 0.18 }) {
    const cells = [];
    const cx = w / 2, cy = h / 2;
    const rmax = Math.min(w, h) / 2;
    const nMax = rmax / Math.sqrt(count) / spacing;
    for (let n = 0; n < count; n++) {
      const r = nMax * Math.sqrt(n);
      const th = (n * angle * Math.PI) / 180;
      const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      const rr = r / rmax;
      cells.push(mkFull(x, y, n, 0, n, cx, cy, rmax, (th + TAU) % TAU, clamp((rr - r0) / (1 - r0))));
    }
    return { cells, w, h, cx, cy, rmax };
  },

  /** 阿基米德 / 对数螺旋 */
  spiral({ w, h, count = 420, turns = 5, kind = 'archimedean', k = 1 }) {
    const cells = [];
    const cx = w / 2, cy = h / 2;
    const rmax = Math.min(w, h) / 2;
    let n = 0;
    const tmax = turns * TAU;
    for (let s = 0; s < count; s++) {
      const t = (s / count) * tmax;
      const tn = t / tmax;
      let rr;
      if (kind === 'log') rr = (Math.exp(k * t) - 1) / (Math.exp(k * tmax) - 1);
      else rr = tn;
      const r = rr * rmax;
      const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
      cells.push(mkFull(x, y, s, 0, n++, cx, cy, rmax, t % TAU, rr));
    }
    return { cells, w, h, cx, cy, rmax };
  },

  /** 二级嵌套：簇内六角点阵 + 簇间六角平铺（六角点阵簇） */
  hexCluster({ w, h, cols = 5, rows = 8, perCluster = 4, dotGap = 1.0, clusterGap = 2.4 }) {
    const cells = [];
    const R = Math.min(w / (cols + 1), h / (rows * 0.9)) * 0.5; // 簇半径
    const clusterStepX = R * clusterGap;
    const clusterStepY = R * clusterGap * 0.866;
    const dotStep = R / perCluster * dotGap;       // 簇内点间距（六角）
    let n = 0;
    for (let cj = 0; cj < rows; cj++)
      for (let ci = 0; ci < cols; ci++) {
        const ccx = clusterStepX * (ci + 0.5 + (cj % 2 ? 0.5 : 0)) + clusterStepX * 0.3;
        const ccy = clusterStepY * (cj + 0.5) + clusterStepY * 0.3;
        if (ccy > h || ccx > w) continue;
        // 簇内六角点阵（轴向坐标 → 笛卡尔）
        const lim = Math.ceil(perCluster / dotGap) + 1;
        for (let q = -lim; q <= lim; q++)
          for (let p = -lim; p <= lim; p++) {
            const px = ccx + dotStep * (p + q * 0.5);
            const py = ccy + dotStep * q * 0.866;
            const dxh = px - ccx, dyh = py - ccy;
            // 六角距离：裁剪出六边形簇
            const dHex = Math.max(Math.abs(dyh), Math.abs(dyh * 0.5 + dxh * 0.866), Math.abs(dyh * 0.5 - dxh * 0.866));
            if (dHex > R) continue;
            if (px < 0 || px > w || py < 0 || py > h) continue;
            cells.push({
              x: px, y: py, i: p, j: q, n: n++,
              u: px / w, v: py / h, r: clamp(dHex / R),
              theta: Math.atan2(dyh, dxh), clusterI: ci, clusterJ: cj,
            });
          }
      }
    return { cells, w, h };
  },
};

function mk(x, y, i, j, n, w, h, cols, rows) {
  const u = x / w, v = y / h;
  const cu = u - 0.5, cv = v - 0.5;
  return { x, y, i, j, n, u, v, cu, cv, r: Math.hypot(cu, cv) / 0.7071, theta: (Math.atan2(cv, cu) + TAU) % TAU };
}
function mkFull(x, y, i, j, n, cx, cy, rmax, theta, r) {
  return { x, y, i, j, n, u: x / 1, v: y / 1, cu: (x - cx) / rmax, cv: (y - cy) / rmax, r, theta };
}

/* ────────────────────────── Modulator 调制场 ────────────────────────── */
/** 返回归一化调制值 m ∈ [0,1]（0→小/疏，1→大/密） */
function modulate(cell, p) {
  const { type = 'none', axis = 'y', freq = 1, amp = 1, phase = 0, bias = 0.5, seed = 0, invert = false } = p;
  // 取作用轴上的归一化坐标
  let t;
  switch (axis) {
    case 'x': t = cell.u; break;
    case 'y': t = cell.v; break;
    case 'radius': t = cell.r; break;
    case 'angle': t = cell.theta / TAU; break;
    case 'both': t = (cell.u + cell.v) / 2; break;
    case 'diag': t = (cell.u - cell.v) / 2 + 0.5; break;
    default: t = cell.v;
  }
  let m;
  switch (type) {
    case 'none': m = bias; break;
    case 'linear': m = bias + amp * (t - 0.5) * 2; break;
    case 'radial': m = bias + amp * (1 - cell.r * 2); break;
    case 'sine': m = bias + amp * 0.5 * Math.sin(t * TAU * freq + phase * TAU); break;
    case 'noise': m = bias + amp * (fbm(cell.u * freq * 4, cell.v * freq * 4, seed, 4) - 0.5) * 2; break;
    case 'golden': m = bias; break;
    default: m = bias;
  }
  m = clamp(m);
  return invert ? 1 - m : m;
}

/* ────────────────────────── Primitive 基元 ────────────────────────── */
/** 基元 → SVG path/shape 字符串。size 为像素尺寸，由 m 映射而来。 */
const Primitive = {
  dot(c, { size }) {
    return `<circle cx="${r2(c.x)}" cy="${r2(c.y)}" r="${r2(size / 2)}"/>`;
  },
  ellipse(c, { size, aspect = 1, rotation = 0, rot = 'none' }) {
    const rx = size / 2 * aspect, ry = size / 2 / Math.max(aspect, 0.001);
    const ang = resolveRotation(c, rot, rotation);
    return `<ellipse cx="${r2(c.x)}" cy="${r2(c.y)}" rx="${r2(rx)}" ry="${r2(ry)}" transform="rotate(${r2(ang)} ${r2(c.x)} ${r2(c.y)})"/>`;
  },
  bar(c, { size, stroke = 6, rotation = 0, rot = 'none' }) {
    const ang = resolveRotation(c, rot, rotation);
    const hx = Math.cos(ang) * size / 2, hy = Math.sin(ang) * size / 2;
    return `<line x1="${r2(c.x - hx)}" y1="${r2(c.y - hy)}" x2="${r2(c.x + hx)}" y2="${r2(c.y + hy)}" stroke-width="${r2(stroke)}"/>`;
  },
  capsule(c, { size, aspect = 1, corner = 0.5, rotation = 0, rot = 'none' }) {
    const wdt = size * aspect, hgt = size / Math.max(aspect, 0.001);
    const rr = Math.min(wdt, hgt) * corner;
    const ang = resolveRotation(c, rot, rotation);
    return `<rect x="${r2(c.x - wdt / 2)}" y="${r2(c.y - hgt / 2)}" width="${r2(wdt)}" height="${r2(hgt)}" rx="${r2(rr)}" ry="${r2(rr)}" transform="rotate(${r2(ang)} ${r2(c.x)} ${r2(c.y)})"/>`;
  },
  polygon(c, { size, sides = 3, corner = 0.25, rotation = 0, rot = 'none' }) {
    const ang0 = resolveRotation(c, rot, rotation) - Math.PI / 2;
    const rr = size / 2;
    const cr = rr * corner;
    const pts = [];
    for (let i = 0; i < sides; i++) pts.push([c.x + Math.cos(ang0 + i * TAU / sides) * rr, c.y + Math.sin(ang0 + i * TAU / sides) * rr]);
    // 圆角多边形：顶点向两侧缩进 cr，二次贝塞尔连接
    let d = '';
    for (let i = 0; i < sides; i++) {
      const p0 = pts[(i - 1 + sides) % sides], p1 = pts[i], p2 = pts[(i + 1) % sides];
      const v1 = norm(sub(p0, p1)), v2 = norm(sub(p2, p1));
      const a = add(p1, mul(v1, cr)), b = add(p1, mul(v2, cr));
      if (i === 0) d += `M ${r2(a[0])} ${r2(a[1])} `;
      else d += `L ${r2(a[0])} ${r2(a[1])} `;
      d += `Q ${r2(p1[0])} ${r2(p1[1])} ${r2(b[0])} ${r2(b[1])} `;
    }
    d += 'Z';
    return `<path d="${d}"/>`;
  },
  curveHex(c, { size, curvature = 0.35, rotation = 0, rot = 'none' }) {
    // 六边形，每边向内凹陷的二次曲线
    const rr = size / 2;
    const ang0 = resolveRotation(c, rot, rotation);
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push([c.x + Math.cos(ang0 + i * TAU / 6) * rr, c.y + Math.sin(ang0 + i * TAU / 6) * rr]);
    const mid = [];
    for (let i = 0; i < 6; i++) mid.push(mid3(pts[i], pts[(i + 1) % 6]));
    const inn = mid.map((mm, i) => lerpPt(mm, [c.x, c.y], curvature));
    let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])} `;
    for (let i = 0; i < 6; i++) d += `Q ${r2(inn[i][0])} ${r2(inn[i][1])} ${r2(pts[(i + 1) % 6][0])} ${r2(pts[(i + 1) % 6][1])} `;
    d += 'Z';
    return `<path d="${d}"/>`;
  },
  arc(c, { size, sweep = 0.8, rotation = 0, rot = 'none', stroke = 6 }) {
    const rr = size / 2;
    const a0 = resolveRotation(c, rot, rotation);
    const a1 = a0 + Math.PI * sweep;
    const x0 = c.x + Math.cos(a0) * rr, y0 = c.y + Math.sin(a0) * rr;
    const x1 = c.x + Math.cos(a1) * rr, y1 = c.y + Math.sin(a1) * rr;
    return `<path d="M ${r2(x0)} ${r2(y0)} A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(x1)} ${r2(y1)}" fill="none" stroke-width="${r2(stroke)}"/>`;
  },
};

function resolveRotation(c, rot, fixed = 0) {
  switch (rot) {
    case 'tangent': return (c.theta ?? 0) + Math.PI / 2 + fixed;
    case 'radial': return (c.theta ?? 0) + fixed;
    case 'grid': return fixed;
    case 'alternate': return (c.i + c.j) % 2 ? fixed + Math.PI : fixed;
    default: return fixed;
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const norm = (a) => { const L = Math.hypot(a[0], a[1]) || 1; return [a[0] / L, a[1] / L]; };
const mid3 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/* ────────────────────────── 组装：管线 ────────────────────────── */
function render(params) {
  const {
    w = 500, h = 1000,
    lattice, modulator = {}, primitive = {}, palette = {}, stroke = 0,
  } = params;
  const { fg = '#000000', bg = '#ffffff', accent = null, invert = false } = palette;
  const F = invert ? bg : fg, B = invert ? fg : bg;

  const field = Lattice[lattice.type]({ w, h, ...lattice });
  const { size = 10, sizeMin = 0, sizeMax = null, aspect = 1, corner = 0.5, curvature = 0.35, sides = 3, sweep = 0.8, rot = 'none', rotation = 0, strokeWidth = 6, fill = true, colorMode = 'fg' } = primitive;

  const body = [];
  const useStroke = ['bar', 'arc'].includes(primitive.shape) || !fill;
  for (const cell of field.cells) {
    const m = modulate(cell, modulator);
    const s = lerp(sizeMin, sizeMax == null ? size : sizeMax, m); // m 映射尺寸
    const cm = { ...cell };
    const style = colorMode === 'accent' && accent ? `fill="${accent}"` : '';
    const body_ = Primitive[primitive.shape](cm, {
      size: s, aspect: aspectAt(m, aspect), corner, curvature, sides, sweep, rot, rotation, stroke: strokeWidth,
    });
    body.push(body_.replace('<circle', `<circle ${style}`).replace('<ellipse', `<ellipse ${style}`).replace('<rect', `<rect ${style}`).replace('<path', `<path ${style}`));
  }
  const groupFill = useStroke ? `fill="none" stroke="${F}"` : `fill="${F}" stroke="none"`;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="${B}"/>
<g ${groupFill} stroke-linecap="round">${body.join('')}</g>
</svg>`,
    count: field.cells.length,
  };
}
function aspectAt(m, aspect) {
  // aspect 可为数字（固定）或 {from, to}（随 m 渐变）
  if (typeof aspect === 'number') return aspect;
  return lerp(aspect.from, aspect.to, m);
}

/* ────────────────────────── 14 张参考图的配方 ────────────────────────── */

export const RECIPES = {
  '01-iso-maze': {
    label: '等轴测网格迷宫',
    w: 500, h: 1000,
    lattice: { type: 'iso', cols: 9, rows: 24 },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'bar', size: 999, strokeWidth: 26, rotation: 0, rot: 'grid' },
    // 用长线段 + 交替角度模拟等轴测三向骨架
    custom: 'isoMaze',
  },
  '02-circle-pulse': {
    label: '变半径重叠圆网格',
    w: 500, h: 1000,
    lattice: { type: 'grid', cols: 7, rows: 15 },
    modulator: { type: 'sine', axis: 'y', freq: 1.35, amp: 1.0, bias: 0.5 },
    primitive: { shape: 'dot', sizeMin: 12, sizeMax: 96 },
    palette: { fg: '#ffffff', bg: '#000000' },
    custom: 'circlePulse',
  },
  '03-capsule-noise': {
    label: '胶囊/圆角矩形噪声场',
    w: 736, h: 736,
    lattice: { type: 'grid', cols: 8, rows: 8 },
    modulator: { type: 'noise', axis: 'both', freq: 1.6, amp: 0.62, bias: 0.5, seed: 7 },
    primitive: { shape: 'capsule', sizeMin: 34, sizeMax: 108, aspect: { from: 0.45, to: 1.9 }, corner: 0.5, rot: 'grid' },
    palette: { fg: '#ffffff', bg: '#000000' },
  },
  '04-curved-hex': {
    label: '曲边六边形密铺',
    w: 736, h: 736,
    lattice: { type: 'hex', cols: 9, rows: 11 },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'curveHex', size: 100, curvature: 0.42, rot: 'grid' },
    palette: { fg: '#ffffff', bg: '#000000' },
  },
  '05-phyllotaxis': {
    label: '叶序螺旋',
    w: 626, h: 626,
    lattice: { type: 'phyllotaxis', count: 1100, angle: 137.507764 },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'dot', sizeMin: 0, sizeMax: 1, },
    custom: 'phyllo',
  },
  '06-diagonal-weave': {
    label: '对角平行线编织',
    w: 450, h: 900,
    lattice: { type: 'grid', cols: 6, rows: 18 },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'bar', size: 70, strokeWidth: 14, rot: 'alternate', rotation: Math.PI / 4 },
    custom: 'diagWeave',
  },
  '07-sine-warp': {
    label: '正弦扭曲点阵',
    w: 736, h: 981,
    lattice: { type: 'grid', cols: 13, rows: 17 },
    modulator: { type: 'sine', axis: 'y', freq: 3, amp: 1, bias: 0.5 },
    primitive: { shape: 'dot', sizeMin: 20, sizeMax: 42 },
    custom: 'sineWarp',
    palette: { fg: '#ffffff', bg: '#000000' },
  },
  '08-polar-spiral-accent': {
    label: '极坐标螺旋点阵（橙）',
    w: 735, h: 862,
    lattice: { type: 'spiral', count: 520, turns: 7, kind: 'archimedean' },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'dot', sizeMin: 1, sizeMax: 16 },
    custom: 'spiralDots',
    palette: { fg: '#FFA500', bg: '#000000' },
  },
  '09-sine-weave': {
    label: '正弦波点阵编织',
    w: 626, h: 626,
    lattice: { type: 'grid', cols: 11, rows: 22 },
    modulator: { type: 'sine', axis: 'x', freq: 2, amp: 1, bias: 0.5 },
    primitive: { shape: 'dot', sizeMin: 6, sizeMax: 20, colorMode: 'fg' },
    custom: 'sineWeave',
    palette: { fg: '#ffffff', bg: '#000000' },
  },
  '10-decay-grid': {
    label: '纵向渐变消散的扭曲网格',
    w: 640, h: 1242,
    lattice: { type: 'grid', cols: 9, rows: 26 },
    modulator: { type: 'linear', axis: 'y', amp: 1, bias: 0, freq: 1 },
    primitive: { shape: 'polygon', size: 40, sides: 3, corner: 0.3, rot: 'grid' },
    custom: 'decay',
    palette: { fg: '#000000', bg: '#ffffff' },
  },
  '11-hex-clusters': {
    label: '六边形点阵簇',
    w: 626, h: 626,
    lattice: { type: 'hexCluster', cols: 5, rows: 9, perCluster: 4, dotGap: 1.0, clusterGap: 2.35 },
    modulator: { type: 'none', bias: 0.75 },
    primitive: { shape: 'dot', size: 24 },
  },
  '12-hex-triangles': {
    label: '六角三角阵列',
    w: 736, h: 1041,
    lattice: { type: 'hex', cols: 9, rows: 13 },
    modulator: { type: 'linear', axis: 'y', amp: 1, bias: 0.06, freq: 1 },
    primitive: { shape: 'polygon', size: 96, sides: 3, corner: 0.34, rot: 'radial' },
    custom: 'hexTri',
  },
  '13-spiral-gallery': {
    label: '螺旋/放射点阵合集',
    w: 1042, h: 1052,
    lattice: { type: 'phyllotaxis', count: 700, angle: 137.3 },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'ellipse', sizeMin: 2, sizeMax: 26, aspect: { from: 0.25, to: 0.8 }, rot: 'tangent' },
    custom: 'spiralGallery',
  },
  '14-hex-meander': {
    label: '六边形回纹迷宫',
    w: 736, h: 1041,
    lattice: { type: 'hex', cols: 7, rows: 12 },
    modulator: { type: 'none', bias: 1 },
    primitive: { shape: 'arc', size: 78, sweep: 0.72, strokeWidth: 22, rot: 'grid' },
    custom: 'hexMeander',
    palette: { fg: '#000000', bg: '#ffffff' },
  },
};

/* ────────────────────────── 定制渲染（还原用） ────────────────────────── */
const CUSTOM = {
  /** 等轴测三向骨架：在等腰三角网格上画三方向粗线 */
  isoMaze(p) {
    const { w, h } = p;
    const dx = w / 9, dy = dx * 0.866;
    const t = 17;                 // 线宽
    const seg = Math.round(dx / Math.sqrt(3)); // 边长
    const lines = [];
    const rows = Math.floor(h / dy) + 2;
    for (let j = -1; j < rows; j++)
      for (let i = -1; i < 10; i++) {
        const x = dx * (i + 0.5 + (j % 2 ? 0.5 : 0));
        const y = dy * (j + 0.5);
        if (((i + j) % 2 + 2) % 2 === 0) {
          lines.push(`<line x1="${x}" y1="${y - seg * 0.58}" x2="${x}" y2="${y + seg * 0.58}"/>`);
          lines.push(`<line x1="${x}" y1="${y}" x2="${x - seg}" y2="${y + seg * 0.58}"/>`);
          lines.push(`<line x1="${x}" y1="${y}" x2="${x + seg}" y2="${y + seg * 0.58}"/>`);
        } else {
          lines.push(`<line x1="${x}" y1="${y - seg * 1.16}" x2="${x}" y2="${y + seg * 1.16}"/>`);
        }
      }
    return `<g fill="none" stroke="#000" stroke-width="${t}" stroke-linecap="square">${lines.join('')}</g>`;
  },
  circlePulse(p) {
    const { w, h } = p;
    const cols = 7, rows = 15;
    const dx = w / cols, dy = h / rows;
    const out = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = dx * (i + 0.5), y = dy * (j + 0.5);
        const v = j / (rows - 1);
        // 半径沿 Y：两端极大（几乎全白只剩小星），中部最小（负空间成大四角星）
        // 注意：中部半径必须 < 网格半间距，否则圆全部重叠 → 整片白
        const t = Math.abs(v - 0.5) * 2;              // 0 在中部, 1 在两端
        const r = dx * (0.30 + 0.88 * Math.pow(t, 0.85));
        out.push(`<circle cx="${x}" cy="${y}" r="${r}"/>`);
      }
    return `<g fill="#fff">${out.join('')}</g>`;
  },
  phyllo(p) {
    const { w, h } = p;
    const cx = w / 2, cy = h / 2, rmax = Math.min(w, h) / 2;
    const N = 1100, gap = 137.507764;
    const c = rmax / Math.sqrt(N) * 1.02;
    const out = [];
    for (let n = 0; n < N; n++) {
      const r = c * Math.sqrt(n);
      const a = n * gap * Math.PI / 180;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      const rr = r / rmax;
      if (rr < 0.01) continue;
      const rad = c * 0.44 * (0.35 + 1.15 * rr);
      out.push(`<circle cx="${x}" cy="${y}" r="${rad}"/>`);
    }
    return `<g fill="#000">${out.join('')}</g>`;
  },
  diagWeave(p) {
    const { w, h } = p;
    const cols = 7, rows = 22, d = Math.min(w / cols, h / rows);
    const out = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i <= cols; i++) {
        const x = i * d, y = j * d * 0.92;
        const flip = (i + j) % 2 === 0;
        const a = flip ? Math.PI / 4 : -Math.PI / 4;
        const L = d * 1.05;
        out.push(`<line x1="${x - Math.cos(a) * L / 2}" y1="${y - Math.sin(a) * L / 2}" x2="${x + Math.cos(a) * L / 2}" y2="${y + Math.sin(a) * L / 2}"/>`);
      }
    return `<g stroke="#000" stroke-width="${d * 0.2}" stroke-linecap="square" fill="none">${out.join('')}</g>`;
  },
  sineWarp(p) {
    const { w, h } = p;
    const cols = 13, rows = 17;
    const dx = w / cols, dy = h / rows;
    const out = [];
    const A = dx * 0.62, k = 2.4;
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const bx = i * dx, by = j * dy;
        const x = bx + A * Math.sin((by / h) * Math.PI * 2 * k);
        const y = by + A * Math.sin((bx / w) * Math.PI * 2 * k) * 0.35;
        const rr = dx * 0.40;
        out.push(`<circle cx="${x}" cy="${y}" r="${rr}"/>`);
      }
    return `<g fill="#fff">${out.join('')}</g>`;
  },
  spiralDots(p) {
    const { w, h } = p;
    const cx = w / 2, cy = h / 2, rmax = Math.min(w, h) / 2 * 0.92;
    const N = 620, turns = 7.5, arms = 5;
    const out = [];
    for (let arm = 0; arm < arms; arm++) {
      for (let s = 0; s < N / arms; s++) {
        const t = s / (N / arms);
        const a = t * turns * Math.PI * 2 + arm * (Math.PI * 2 / arms);
        const r = t * rmax;
        if (r < rmax * 0.07) continue;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        const rad = 0.6 + 9.5 * Math.pow(t, 1.5);
        out.push(`<circle cx="${x}" cy="${y}" r="${rad}"/>`);
      }
    }
    return `<g fill="#FFA500">${out.join('')}</g>`;
  },
  sineWeave(p) {
    const { w, h } = p;
    const cols = 12, rows = 30;
    const dx = w / cols, dy = h / rows;
    const out = [];
    for (let j = 0; j <= rows; j++) {
      const base = j * dy;
      const phase = (j % 2) * Math.PI;
      for (let i = 0; i <= cols; i++) {
        const x = i * dx;
        const sn = Math.sin((i / cols) * Math.PI * 2 * 1.5 + phase);
        const y = base + sn * dy * 0.42;
        const rr = dx * (0.20 + 0.24 * Math.abs(sn));
        out.push(`<circle cx="${x}" cy="${y}" r="${rr}"/>`);
      }
    }
    return `<g fill="#fff">${out.join('')}</g>`;
  },
  decay(p) {
    const { w, h } = p;
    const cols = 9, rows = 30;
    const dx = w / cols, dy = h / rows;
    const out = [];
    for (let j = 0; j < rows; j++) {
      const v = j / (rows - 1);
      const scale = 0.28 + 0.72 * Math.pow(1 - v, 1.15);   // 上大下小但不留空
      for (let i = 0; i < cols; i++) {
        const jitter = (fbm(i * 0.9, j * 0.35, 3, 3) - 0.5) * dx * 0.45 * scale;
        const x = dx * (i + 0.5) + jitter;
        const y = dy * (j + 0.5) + (fbm(i * 0.6, j * 0.5, 9, 3) - 0.5) * dy * 0.22;
        const s = Math.max(2.4, dx * 0.80 * scale);
        // 三角/多边形碎片感
        const ang = fbm(i * 1.3, j * 0.8, 21, 2) * Math.PI;
        const hh = s / 2;
        const pts = [];
        for (let k = 0; k < 3; k++) pts.push([x + Math.cos(ang + k * TAU / 3) * hh, y + Math.sin(ang + k * TAU / 3) * hh]);
        out.push(`<path d="M ${r2(pts[0][0])} ${r2(pts[0][1])} L ${r2(pts[1][0])} ${r2(pts[1][1])} L ${r2(pts[2][0])} ${r2(pts[2][1])} Z"/>`);
      }
    }
    return `<g fill="#000">${out.join('')}</g>`;
  },
  hexTri(p) {
    const { w, h } = p;
    const cols = 9, rows = 14, dx = w / (cols + 1), dy = dx * 0.866;
    const out = [];
    for (let j = 0; j < rows; j++) {
      const v = j / (rows - 1);
      const scale = 0.30 + 0.70 * Math.pow(v, 1.35);   // 上小下大，顶部不全空
      for (let i = 0; i < cols; i++) {
        const x = dx * (i + 0.5 + (j % 2 ? 0.5 : 0));
        const y = dy * (j + 0.6);
        if (y > h) continue;
        const cx = w / 2, cy = h / 2;
        const ang = Math.atan2(y - cy, x - cx) + Math.PI / 2;
        const s = dx * 1.02 * scale;
        if (s < 1.2) continue;
        const pts = [];
        for (let k = 0; k < 3; k++) pts.push([x + Math.cos(ang + k * TAU / 3) * s / 2, y + Math.sin(ang + k * TAU / 3) * s / 2]);
        const cr = s * 0.17;
        let d = '';
        for (let k = 0; k < 3; k++) {
          const p0 = pts[(k + 2) % 3], p1 = pts[k], p2 = pts[(k + 1) % 3];
          const v1 = norm(sub(p0, p1)), v2 = norm(sub(p2, p1));
          const a = add(p1, mul(v1, Math.min(cr, s * 0.32))), b = add(p1, mul(v2, Math.min(cr, s * 0.32)));
          d += (k === 0 ? `M ${r2(a[0])} ${r2(a[1])} ` : `L ${r2(a[0])} ${r2(a[1])} `) + `Q ${r2(p1[0])} ${r2(p1[1])} ${r2(b[0])} ${r2(b[1])} `;
        }
        out.push(`<path d="${d}Z"/>`);
      }
    }
    return `<g fill="#000">${out.join('')}</g>`;
  },
  spiralGallery(p) {
    // 3×3 九宫格，每格一个螺旋变体
    const { w, h } = p;
    const cw = w / 3, ch = h / 3;
    const out = [];
    const variants = [
      { kind: 'phyllo', gap: 137.2, size: 1.0, elong: 1 },
      { kind: 'phyllo', gap: 137.6, size: 1.0, elong: 2.6, align: true },
      { kind: 'ring', arms: 1, size: 1.0, elong: 1.7, align: true },
      { kind: 'ring', arms: 1, size: 1.0, elong: 2.2, align: true, dense: true },
      { kind: 'phyllo', gap: 137.4, size: 1.0, rays: true },
      { kind: 'phyllo', gap: 137.9, size: 1.0, elong: 2.4, align: true },
      { kind: 'arms', arms: 3, size: 1.0, elong: 1.8, align: true },
      { kind: 'flow', size: 1.0, elong: 2.8, align: true },
      { kind: 'ring', arms: 1, size: 1.0, elong: 2.0, radial: true },
    ];
    for (let vi = 0; vi < 9; vi++) {
      const ox = (vi % 3) * cw, oy = Math.floor(vi / 3) * ch;
      const cx = ox + cw / 2, cy = oy + ch / 2;
      const R = Math.min(cw, ch) / 2 * 0.92;
      const v = variants[vi];
      const N = v.dense ? 900 : 460;
      const g = [];
      if (v.kind === 'phyllo') {
        const c = R / Math.sqrt(N) * 1.05;
        for (let n = 0; n < N; n++) {
          const r = c * Math.sqrt(n), a = n * v.gap * Math.PI / 180;
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          const t = r / R;
          if (v.rays) { if (t > 0.94 || t < 0.06 || (t > 0.3 && t < 0.34)) continue; }
          const s = c * 0.42 * (0.4 + 1.2 * t) * v.size;
          if (s < 0.4) continue;
          if (v.elong > 1) {
            const ang = v.align ? a + Math.PI / 2 : 0;
            g.push(`<ellipse cx="${x}" cy="${y}" rx="${s * v.elong}" ry="${s}" transform="rotate(${ang * 180 / Math.PI} ${x} ${y})"/>`);
          } else g.push(`<circle cx="${x}" cy="${y}" r="${s}"/>`);
        }
      } else if (v.kind === 'ring') {
        const rings = 14;
        for (let rI = 1; rI <= rings; rI++) {
          const t = rI / rings, r = t * R;
          const k = Math.max(6, Math.round(28 * t));
          for (let i = 0; i < k; i++) {
            const a = (i / k) * Math.PI * 2;
            const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
            const s = cw * 0.012 * (0.5 + 2.2 * t);
            const ang = v.radial ? a : a + Math.PI / 2;
            g.push(`<ellipse cx="${x}" cy="${y}" rx="${s * (v.elong || 1)}" ry="${s}" transform="rotate(${ang * 180 / Math.PI} ${x} ${y})"/>`);
          }
        }
      } else if (v.kind === 'arms') {
        const arms = v.arms || 3;
        for (let arm = 0; arm < arms; arm++)
          for (let s = 0; s < 120; s++) {
            const t = s / 120, a = t * 3.4 * Math.PI * 2 + arm * (Math.PI * 2 / arms) + 0.3;
            const r = t * R;
            const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
            const sz = cw * 0.014 * (0.4 + 2.0 * t);
            g.push(`<ellipse cx="${x}" cy="${y}" rx="${sz * v.elong}" ry="${sz}" transform="rotate(${(a + Math.PI / 2) * 180 / Math.PI} ${x} ${y})"/>`);
          }
      } else if (v.kind === 'flow') {
        const rows = 26;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < rows; i++) {
            const x = ox + cw * (i + 0.5) / rows, y = oy + ch * (j + 0.5) / rows;
            const a = fbm(x * 0.03, y * 0.03, 11, 3) * Math.PI * 2;
            const s = cw * 0.006;
            g.push(`<ellipse cx="${x}" cy="${y}" rx="${s * v.elong}" ry="${s}" transform="rotate(${a * 180 / Math.PI} ${x} ${y})"/>`);
          }
        }
      }
      out.push(`<g fill="#000">${g.join('')}</g>`);
    }
    return out.join('');
  },
  hexMeander(p) {
    const { w, h } = p;
    const cols = 7, rows = 13, d = w / (cols + 1), dy = d * 0.866;
    const out = [];
    for (let j = 0; j < rows + 1; j++)
      for (let i = 0; i < cols; i++) {
        const x = d * (i + 0.5 + (j % 2 ? 0.5 : 0));
        const y = dy * (j + 0.5);
        if (y > h) continue;
        const R = d * 0.52;
        const seed = hash2(i, j, 5);
        // C / U 形粗弧
        const a0 = (seed > 0.5 ? 0 : Math.PI * 0.5) + Math.PI * 0.15;
        const sweep = 0.78;
        const fl = seed > 0.5 ? 1 : -1;
        const x0 = x + Math.cos(a0) * R, y0 = y + Math.sin(a0) * R;
        const a1 = a0 + fl * Math.PI * sweep;
        const x1 = x + Math.cos(a1) * R, y1 = y + Math.sin(a1) * R;
        out.push(`<path d="M ${r2(x0)} ${r2(y0)} A ${r2(R)} ${r2(R)} 0 0 ${fl > 0 ? 1 : 0} ${r2(x1)} ${r2(y1)}"/>`);
        // 小开口段
        const a2 = a1 + fl * Math.PI * 0.35, a3 = a2 + fl * Math.PI * 0.30;
        const x2 = x + Math.cos(a2) * R, y2 = y + Math.sin(a2) * R;
        const x3 = x + Math.cos(a3) * R, y3 = y + Math.sin(a3) * R;
        out.push(`<path d="M ${r2(x2)} ${r2(y2)} A ${r2(R)} ${r2(R)} 0 0 ${fl > 0 ? 1 : 0} ${r2(x3)} ${r2(y3)}"/>`);
      }
    return `<g fill="none" stroke="#000" stroke-width="${d * 0.30}" stroke-linecap="butt">${out.join('')}</g>`;
  },
};

/* ────────────────────────── 主程序 ────────────────────────── */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const results = [];
for (const [key, recipe] of Object.entries(RECIPES)) {
  const { w, h, label, palette = {}, custom } = recipe;
  const bg = palette.invert ? (palette.fg || '#000') : (palette.bg || '#fff');
  let inner, count = 0;
  if (custom && CUSTOM[custom]) {
    inner = CUSTOM[custom](recipe);
    count = -1;
  } else {
    const r = render(recipe);
    // 保留 <g> 属性（fill/stroke 都在标签上），只替换外层容器
    const m = r.svg.match(/<g([^>]*)>([\s\S]*)<\/g>/);
    inner = `<g${m[1]}>${m[2]}</g>`;
    count = r.count;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${inner}<g></g></svg>`;
  writeFileSync(join(OUT, `${key}.svg`), svg);
  results.push({ key, label, w, h, count, svg });
  console.log(`✓ ${key.padEnd(24)} ${String(w).padStart(4)}×${String(h).padStart(4)}  ${label}  (${count === -1 ? 'custom' : count + ' 元素'})`);
}

// 生成对照页
const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>参数化引擎 Spike — 14 张参考图还原</title>
<style>
  body{margin:0;background:#111;color:#eee;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;padding:24px}
  h1{font-size:18px;font-weight:600;margin:0 0 4px}
  p.sub{color:#888;margin:0 0 24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}
  figure{margin:0;background:#1b1b1b;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden}
  .frame{background:#000;display:flex;align-items:center;justify-content:center;height:300px;padding:8px}
  .frame svg{max-height:284px;max-width:100%;height:auto;width:auto;display:block}
  figcaption{padding:8px 10px;font-size:12px;color:#bbb;display:flex;justify-content:space-between;gap:8px}
  code{color:#7dd3fc;font-size:11px}
</style></head><body>
<h1>参数化引擎 Spike · 14 张参考图还原</h1>
<p class="sub">同一套 Lattice × Modulator × Primitive × Topology 抽象 · 全部由 <code>spike/parametric-spike.mjs</code> 生成</p>
<div class="grid">
${results.map((r) => `<figure><div class="frame">${r.svg}</div><figcaption><span>${r.label}</span><code>${r.w}×${r.h}</code></figcaption></figure>`).join('\n')}
</div></body></html>`;
writeFileSync(join(OUT, 'index.html'), html);
console.log(`\n→ ${join(OUT, 'index.html')}`);
