/**
 * Modulator 调制场：把每个单元映射到一个归一化值 m ∈ [0,1]。
 *
 * m 的含义由消费方决定（通常 0 → shape.sizeMin，1 → shape.sizeMax）。
 * 这是"参数化"的核心：同一个底场换不同调制函数，得到完全不同的图形。
 */

import { fbm, hash2, noise2 } from './hash.js';
import { clampNum, TAU } from './lattice.js';

/** 取调制的作用轴上的归一化坐标 t ∈ [0,1] */
function axisValue(cell, axis) {
  switch (axis) {
    case 'x': return cell.u;
    case 'y': return cell.v;
    case 'both': return (cell.u + cell.v) / 2;
    case 'diag': return clampNum((cell.u - cell.v) / 2 + 0.5, 0, 1);
    case 'radius': return cell.r;
    case 'angle': return cell.theta / TAU;
    default: return cell.v;
  }
}

/** 求值：→ m ∈ [0,1] */
export function evaluate(cell, p) {
  const type = p['modulator.type'];
  const axis = p['modulator.axis'];
  const freq = clampNum(p['modulator.freq'], 0.1, 8);
  const amp = clampNum(p['modulator.amp'], 0, 2);
  const phase = clampNum(p['modulator.phase'], 0, 1);
  const bias = clampNum(p['modulator.bias'], 0, 1);
  // Schema seeds span 0..99999; a 9999 cap aliased every larger seed together.
  const seed = Math.round(clampNum(p['modulator.seed'], 0, 99999));

  const t = axisValue(cell, axis);
  let m;

  switch (type) {
    case 'linear':
      m = bias + amp * (t - 0.5) * 2;
      break;
    case 'radial':
      m = bias + amp * (1 - cell.r * 2);
      break;
    case 'sine':
      m = bias + amp * 0.5 * Math.sin(t * TAU * freq + phase * TAU);
      break;
    case 'noise':
      m = bias + amp * (fbm(cell.u * freq * 4, cell.v * freq * 4, seed, 4) - 0.5) * 2;
      break;
    case 'golden': {
      // 叶序式：以序号 × 黄金角 + 径向，产生无理数错位
      const g = (cell.n * 0.6180339887 + cell.r * freq + phase) % 1;
      m = bias + amp * (g - 0.5) * 2;
      break;
    }
    case 'ripple': {
      // 同心波纹：sin(r × freq) 与 sin(θ × freq) 相乘
      const a = Math.sin(cell.r * TAU * freq + phase * TAU);
      const b = Math.sin(cell.theta * freq + phase * TAU);
      m = bias + amp * 0.5 * (a * 0.6 + b * 0.4);
      break;
    }
    case 'none':
    default:
      m = bias;
      break;
  }

  m = Math.min(1, Math.max(0, m));
  return p['modulator.invert'] ? 1 - m : m;
}

/** 拓扑用的稳定单元随机值（与调制无关，只依赖索引 + 种子） */
export function cellRandom(cell, seed) {
  return hash2(cell.i, cell.j, seed);
}

/** 平滑场（供流场类用法） */
export function fieldValue(u, v, freq, seed) {
  return fbm(u * freq * 4, v * freq * 4, seed, 4);
}

export { noise2 } from './hash.js';

export const MODULATORS = ['none', 'linear', 'radial', 'sine', 'noise', 'golden', 'ripple'];
export const AXES = ['x', 'y', 'both', 'diag', 'radius', 'angle'];
