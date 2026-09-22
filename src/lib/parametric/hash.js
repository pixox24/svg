/**
 * 确定性随机与噪声。
 *
 * ⚠️ 关键陷阱：所有 32 位整数运算必须走 Math.imul。
 * 直接用 `a * b` 处理大整数会丢精度，`>>>` 位移会退化成常量，
 * 结果整片噪声场恒为同一个值（表现为所有图形尺寸归零）。
 */

/** 确定性哈希 → [0,1) */
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 一维哈希 → [0,1) */
export function hash1(x, seed = 0) {
  return hash2(x | 0, 0x9e3779b9, seed);
}

const smooth = (t) => t * t * (3 - 2 * t);

/** 平滑值噪声，双线性插值 + smoothstep */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** 分形布朗运动（多八度叠加） */
export function fbm(x, y, seed = 0, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** 可播种的伪随机数发生器，用于 randomize() */
export function mulberry32(seed) {
  let a = (seed | 0) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
