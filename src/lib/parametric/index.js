/**
 * 参数化图形引擎 —— 公共 API（唯一对外的门面）。
 *
 * 设计约束：
 *   - 纯函数，无 DOM、无副作用、无全局态
 *   - 零 npm 依赖（只用标准 JS）
 *   - 可被 Node 直接 import（服务端渲染 / 单元测试）
 *
 * 与项目的集成契约：
 *   compile(params) 直接返回完整 SVG 字符串。
 *   +page.svelte 里对 kind === 'parametric' 的 family 跳过 css-doodle 的 svg() 包装，
 *   其余（参数面板 / 预览 / 三种导出 / ?id 分享 / 缩略图）全部自动继承。
 */

import { DEFAULTS, SCHEMA, GROUPS, defaults, normalize } from './schema.js';
import { resolve } from './lattice.js';
import { apply } from './topology.js';
import { compose, emptyDoc, canvasSize, ASPECTS } from './compose.js';
import { mulberry32 } from './hash.js';
import { PRESETS, PRESET_BY_ID } from './presets.js';

export { SCHEMA, GROUPS, DEFAULTS, defaults, normalize, PRESETS, PRESET_BY_ID, ASPECTS, canvasSize };

/**
 * 主入口：参数 → SVG。
 * @returns {{ svg: string, stats: { cells: number, elements: number, ms: number }, warnings: string[] }}
 */
export function generate(input) {
  const start = Date.now();
  const p = normalize(input);
  const warnings = [];
  let cells = [];
  let fragments = [];

  try {
    const { width, height } = canvasSize(p);
    cells = resolve(p, width, height);
    fragments = apply(cells, p, { seed: p['modulator.seed'] });
  } catch (err) {
    warnings.push(`render failed: ${err && err.message ? err.message : err}`);
  }

  const svg = fragments.length ? compose(fragments, p) : emptyDoc(p);
  if (!fragments.length) warnings.push('no elements produced — try a larger size or different topology');

  return {
    svg,
    stats: { cells: cells.length, elements: fragments.length, ms: Date.now() - start },
    warnings,
  };
}

/** 只取 SVG 字符串的便捷入口（集成用） */
export function toSvg(input) {
  return generate(input).svg;
}

/**
 * 确定性随机：种子相同 → 结果相同。
 * lockedKeys 里的参数保持不动（对应 UI 的「锁」）。
 *
 * 关键要求：随机结果必须「有内容」—— 约束住尺寸下限、连通密度、
 * 以及拓扑与底场的相容性，否则会随机出一片空白（压测抓出来的问题）。
 */
export function randomize(input, seed, lockedKeys = []) {
  const p = normalize(input);
  const base = Math.round(Number(seed));
  const s = Number.isFinite(base) ? ((base % 100000) + 100000) % 100000 : Math.floor(Math.random() * 100000);
  const rand = mulberry32(s);
  const locked = new Set(lockedKeys);
  const out = { ...p };
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const field = (key) => SCHEMA.find((f) => f.key === key);

  for (const f of SCHEMA) {
    if (locked.has(f.key) || f.type === 'seed') continue;
    if (f.showIf && !f.showIf(out)) continue;
    if (f.type === 'select') {
      out[f.key] = pick(f.options.map((o) => o.value));
    } else if (f.type === 'range') {
      const step = f.step || 1;
      const raw = between(f.min, f.max);
      out[f.key] = Math.round(raw / step) * step;
    } else if (f.type === 'toggle') {
      out[f.key] = rand() > 0.72;
    } else if (f.type === 'palette') {
      out[f.key] = pick([
        ['#f2eee6', '#101216', ''],
        ['#101216', '#f2eee6', ''],
        ['#101216', '#FFA500', ''],
        ['#f2eee6', '#1d4ed8', ''],
        ['#e8e2d6', '#101216', '#c2410c'],
        ['#0b1c28', '#7dd3c0', ''],
      ]);
    }
  }

  // —— 可用性约束：避免随机出空白画面 ——
  // 1) 迷宫需要 i,j 网格型底场，否则画不出墙
  if (out['topology.mode'] === 'maze' && !['grid', 'hex', 'iso'].includes(out['lattice.type'])) {
    out['lattice.type'] = pick(['grid', 'hex']);
  }
  // 2) 连通密度不能太低，否则只剩零星元素
  if (['truchet', 'maze'].includes(out['topology.mode'])) {
    out['topology.density'] = Math.max(0.3, out['topology.density']);
  }
  // 3) 尺寸下限：随机可能抽到 0.x，视觉上等于空白。
  //    scaleToUnit 时尺寸按单元百分比解释（100 = 一个单元），两种模式分别给合理区间。
  const scaleUnit = !!out['shape.scaleToUnit'];
  if (scaleUnit) {
    const hi = between(22, 110);
    out['shape.sizeMax'] = hi;
    out['shape.sizeMin'] = Math.max(0, hi - between(6, Math.max(8, hi * 0.7)));
  } else {
    const hi = between(8, 76);
    out['shape.sizeMax'] = hi;
    out['shape.sizeMin'] = Math.max(0, hi - between(6, Math.max(10, hi * 0.8)));
  }
  // 4) 线宽下限
  if (out['shape.stroke'] && (out['shape.strokeWidth'] || 0) < 1) {
    out['shape.strokeWidth'] = between(2, 26);
  }
  // 5) 单元预算：点/格太少的组合会产出"只有几个元素"的空画面。
  //    阈值定得比"不空白"更严一些 —— 随机的下限应该是"一眼能看出是图案"。
  const lt = out['lattice.type'];
  if (['grid', 'hex', 'iso', 'oblique'].includes(lt)) {
    out['lattice.cols'] = Math.max(5, out['lattice.cols']);
    out['lattice.rows'] = Math.max(5, out['lattice.rows']);
    if (out['lattice.cols'] * out['lattice.rows'] < 80) out['lattice.rows'] = Math.ceil(80 / out['lattice.cols']);
  } else if (lt === 'ring') {
    out['lattice.rows'] = Math.max(6, out['lattice.rows']);
    out['lattice.count'] = Math.max(240, out['lattice.count']);
  } else if (lt === 'cluster') {
    out['lattice.cols'] = Math.max(4, out['lattice.cols']);
    out['lattice.rows'] = Math.max(5, out['lattice.rows']);
  } else if (lt === 'phyllotaxis' || lt === 'spiral') {
    out['lattice.count'] = Math.max(260, out['lattice.count']);
  }
  out['modulator.seed'] = Math.floor(rand() * 99999);
  return normalize(out);
}

/** 生成一个随机种子 */
export function randomSeed() {
  return Math.floor(Math.random() * 99999) + 1;
}

/** 参数 → URL-safe 字符串（只存与默认值不同的项，尽量短） */
export function encodeParams(input) {
  const p = normalize(input);
  const diff = {};
  for (const [k, v] of Object.entries(p)) {
    const d = DEFAULTS[k];
    if (JSON.stringify(v) !== JSON.stringify(d)) diff[k] = v;
  }
  return encodeURIComponent(JSON.stringify(diff));
}

/** URL-safe 字符串 → 参数 */
export function decodeParams(str) {
  if (!str) return defaults();
  try {
    return normalize(JSON.parse(decodeURIComponent(str)));
  } catch {
    return defaults();
  }
}

/** 引擎自检：返回 { ok, failures[] }。集成方与 CI 都可用。 */
export function selfCheck() {
  const failures = [];
  for (const preset of PRESETS) {
    const r = generate(preset.params);
    if (!r.svg || !r.svg.startsWith('<svg')) failures.push(`${preset.id}: no svg`);
    if (r.stats.elements < 8) failures.push(`${preset.id}: only ${r.stats.elements} elements`);
    if (r.warnings.length) failures.push(`${preset.id}: ${r.warnings.join('; ')}`);
  }
  // 同参数两次生成必须逐字节一致
  const a = generate(PRESETS[0].params).svg;
  const b = generate(PRESETS[0].params).svg;
  if (a !== b) failures.push('determinism: two runs differ');
  return { ok: failures.length === 0, failures };
}

export const VERSION = '1.0.0';
