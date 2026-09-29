/**
 * Primitive 基元：把一个单元 + 调制值渲染成 SVG 片段（纯字符串）。
 *
 * 所有基元都在「局部尺度」下绘制：尺寸由 m 在 sizeMin..sizeMax 之间插值，
 * 再乘以 cell.unit（当 shape.scaleToUnit 为真时），这样换底场密度时图形自动适配。
 */

import { clampNum, TAU } from './lattice.js';

const r2 = (n) => Math.round(n * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;

/** 依据调制值求基元尺寸。
 *  scaleToUnit 语义：尺寸按「单元尺寸的百分比」解释，100 = 一个完整单元。
 *  这样同一组 sizeMin/sizeMax 在两种模式下都有意义，滑杆不会被浪费。 */
export function sizeAt(m, p, cell) {
  const min = clampNum(p['shape.sizeMin'], 0, 4000);
  const max = clampNum(p['shape.sizeMax'], 0, 4000);
  let s = lerp(min, max, m);
  if (p['shape.scaleToUnit']) s = (s / 100) * cell.unit;
  return s;
}

/** 依据 rotMode 解析实际旋转角（弧度） */
export function rotationAt(cell, p, seed) {
  const fixed = (clampNum(p['shape.rotation'], 0, 360) * Math.PI) / 180;
  switch (p['shape.rotMode']) {
    case 'grid': return fixed;
    case 'alternate': return (cell.i + cell.j) % 2 ? fixed + Math.PI : fixed;
    case 'tangent': return cell.theta + Math.PI / 2 + fixed;
    case 'radial': return cell.theta + fixed;
    case 'noise': return cell.theta * 0.35 + fixed + (cell.n % 7) * 0.11;
    case 'none':
    default: return fixed;
  }
}

/** 多边形的顶点（带圆角），返回 path d */
function roundedPolygon(cx, cy, radius, sides, corner, angle) {
  const pts = [];
  for (let k = 0; k < sides; k += 1) {
    const a = angle - Math.PI / 2 + (k * TAU) / sides;
    pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  const cr = Math.min(radius, radius * corner);
  let d = '';
  for (let k = 0; k < sides; k += 1) {
    const p0 = pts[(k + sides - 1) % sides];
    const p1 = pts[k];
    const p2 = pts[(k + 1) % sides];
    const v1 = norm(p0[0] - p1[0], p0[1] - p1[1]);
    const v2 = norm(p2[0] - p1[0], p2[1] - p1[1]);
    const ax = p1[0] + v1[0] * cr;
    const ay = p1[1] + v1[1] * cr;
    const bx = p1[0] + v2[0] * cr;
    const by = p1[1] + v2[1] * cr;
    d += k === 0 ? `M ${r2(ax)} ${r2(ay)} ` : `L ${r2(ax)} ${r2(ay)} `;
    d += `Q ${r2(p1[0])} ${r2(p1[1])} ${r2(bx)} ${r2(by)} `;
  }
  return `${d}Z`;
}

function norm(x, y) {
  const L = Math.hypot(x, y) || 1;
  return [x / L, y / L];
}

/** 曲边多边形（每边向内/外弯） */
function curvedPolygon(cx, cy, radius, sides, curvature, angle) {
  const pts = [];
  for (let k = 0; k < sides; k += 1) {
    const a = angle + (k * TAU) / sides;
    pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  const ctrl = [];
  for (let k = 0; k < sides; k += 1) {
    const p0 = pts[k];
    const p1 = pts[(k + 1) % sides];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    ctrl.push([lerp(mx, cx, curvature), lerp(my, cy, curvature)]);
  }
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])} `;
  for (let k = 0; k < sides; k += 1) {
    const p = pts[(k + 1) % sides];
    const c = ctrl[k];
    d += `Q ${r2(c[0])} ${r2(c[1])} ${r2(p[0])} ${r2(p[1])} `;
  }
  return `${d}Z`;
}

/** 基元构建：→ SVG 片段字符串 */
export function build(cell, m, p, seed) {
  const type = p['shape.type'];
  const size = sizeAt(m, p, cell);
  if (!(size > 0.05)) return '';
  const aspect = clampNum(p['shape.aspect'], 0.1, 8);
  const a = p['shape.aspectMode'] === 'modulated' ? lerp(1 / aspect, aspect, m) : aspect;
  const ang = rotationAt(cell, p, seed);
  const angDeg = (ang * 180) / Math.PI;
  const corner = clampNum(p['shape.corner'], 0, 1);
  const sides = Math.round(clampNum(p['shape.sides'], 3, 16));
  const curvature = clampNum(p['shape.curvature'], -0.9, 0.9);
  const sw = clampNum(p['shape.strokeWidth'], 0.1, 200);
  const X = r2(cell.x);
  const Y = r2(cell.y);

  switch (type) {
    case 'ellipse': {
      const rx = (size / 2) * a;
      const ry = size / 2 / Math.max(a, 0.001);
      if (ang) return `<ellipse cx="${X}" cy="${Y}" rx="${r2(rx)}" ry="${r2(ry)}" transform="rotate(${r2(angDeg)} ${X} ${Y})"/>`;
      return `<ellipse cx="${X}" cy="${Y}" rx="${r2(rx)}" ry="${r2(ry)}"/>`;
    }
    case 'bar': {
      const hx = (Math.cos(ang) * size) / 2;
      const hy = (Math.sin(ang) * size) / 2;
      return `<line x1="${r2(cell.x - hx)}" y1="${r2(cell.y - hy)}" x2="${r2(cell.x + hx)}" y2="${r2(cell.y + hy)}" stroke-width="${r2(sw)}"/>`;
    }
    case 'capsule': {
      const wdt = size * a;
      const hgt = size / Math.max(a, 0.001);
      const rr = Math.min(wdt, hgt) * corner * 0.5;
      const base = `<rect x="${r2(cell.x - wdt / 2)}" y="${r2(cell.y - hgt / 2)}" width="${r2(wdt)}" height="${r2(hgt)}" rx="${r2(rr)}" ry="${r2(rr)}"`;
      return ang ? `${base} transform="rotate(${r2(angDeg)} ${X} ${Y})"/>` : `${base}/>`;
    }
    case 'polygon':
      return `<path d="${roundedPolygon(cell.x, cell.y, size / 2, sides, corner, ang)}"/>`;
    case 'curvePoly':
      return `<path d="${curvedPolygon(cell.x, cell.y, size / 2, sides, curvature, ang)}"/>`;
    case 'arc': {
      const rr = size / 2;
      const sweep = clampNum(p['shape.sweep'] ?? 0.8, 0.05, 0.99);
      const a0 = ang;
      const a1 = a0 + Math.PI * sweep;
      const x0 = cell.x + Math.cos(a0) * rr;
      const y0 = cell.y + Math.sin(a0) * rr;
      const x1 = cell.x + Math.cos(a1) * rr;
      const y1 = cell.y + Math.sin(a1) * rr;
      return `<path d="M ${r2(x0)} ${r2(y0)} A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(x1)} ${r2(y1)}" fill="none" stroke-width="${r2(sw)}"/>`;
    }
    case 'ring': {
      const rr = size / 2;
      const inner = rr * clampNum(p['shape.inner'] ?? 0.55, 0.05, 0.95);
      return `<path d="M ${r2(cell.x - rr)} ${Y} a ${r2(rr)} ${r2(rr)} 0 1 0 ${r2(rr * 2)} 0 a ${r2(rr)} ${r2(rr)} 0 1 0 ${r2(-rr * 2)} 0 Z M ${r2(cell.x - inner)} ${Y} a ${r2(inner)} ${r2(inner)} 0 1 1 ${r2(inner * 2)} 0 a ${r2(inner)} ${r2(inner)} 0 1 1 ${r2(-inner * 2)} 0 Z" fill-rule="evenodd"/>`;
    }
    case 'dot':
    default:
      return `<circle cx="${X}" cy="${Y}" r="${r2(size / 2)}"/>`;
  }
}

export const SHAPES = ['dot', 'ellipse', 'bar', 'capsule', 'polygon', 'curvePoly', 'arc', 'ring'];
export const ROT_MODES = ['none', 'grid', 'alternate', 'tangent', 'radial', 'noise'];
