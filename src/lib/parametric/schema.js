/**
 * 参数 Schema —— 单一真相源。
 *
 * 字段类型必须与项目既有的 LookPanel 渲染链保持一致：
 *   range | select | color | palette | toggle | seed | icon
 * 条件显示用 showIf(p)，而不是 when。
 */

import { LATTICES } from './lattice.js';
import { MODULATORS, AXES } from './modulator.js';
import { SHAPES, ROT_MODES } from './primitive.js';
import { TOPOLOGIES } from './topology.js';
import { ASPECTS } from './compose.js';

const INK = '#101216';
const PAPER = '#f2eee6';

const opts = (values, labels) =>
  values.map((value) => ({ value, label: labels?.[value] || value }));

const LATTICE_LABELS = {
  grid: '网格', hex: '六角', iso: '等轴测', oblique: '斜交',
  ring: '同心环', phyllotaxis: '叶序', spiral: '螺旋', cluster: '点阵簇',
};
const MOD_LABELS = {
  none: '无', linear: '线性', radial: '径向', sine: '正弦',
  noise: '噪声', golden: '黄金角', ripple: '波纹',
};
const AXIS_LABELS = { x: 'X 轴', y: 'Y 轴', both: '对角', diag: '反向对角', radius: '径向', angle: '角度' };
const SHAPE_LABELS = {
  dot: '圆点', ellipse: '椭圆', bar: '线段', capsule: '胶囊',
  polygon: '多边形', curvePoly: '曲边多边形', arc: '弧', ring: '圆环',
};
const ROT_LABELS = { none: '固定', grid: '跟随底场', alternate: '交替', tangent: '切线', radial: '径向', noise: '扰动' };
const TOPO_LABELS = { isolated: '独立', truchet: '特鲁谢连通', maze: '迷宫', lattice: '织网', halftone: '半调' };
const ASPECT_LABELS = { square: '正方', portrait: '竖版', photo: '4:5', tall: '长条', banner: '海报条', landscape: '横版', wide: '宽幅' };

const isOneOf = (key, list) => (p) => list.includes(p[key]);
// 墙类拓扑：图形即墙，基元选择/描边开关/旋转对墙无意义，交给 showIf 藏掉。
const isWall = (p) => ['truchet', 'maze', 'lattice'].includes(p['topology.mode']);

export const SCHEMA = [
  { key: 'canvas.aspect', type: 'select', label: '画幅', options: opts(Object.keys(ASPECTS), ASPECT_LABELS) },

  { key: 'palette', type: 'palette', label: '配色（背景 / 图形 / 强调）' },
  { key: 'invert', type: 'toggle', label: '图底反转' },

  { key: 'lattice.type', type: 'select', label: '底场', options: opts(Object.keys(LATTICES), LATTICE_LABELS) },
  { key: 'lattice.cols', type: 'range', label: '列数', min: 1, max: 40, step: 1,
    showIf: isOneOf('lattice.type', ['grid', 'hex', 'iso', 'oblique', 'cluster']) },
  { key: 'lattice.rows', type: 'range', label: '行数 / 环数', min: 1, max: 40, step: 1,
    showIf: isOneOf('lattice.type', ['grid', 'hex', 'iso', 'oblique', 'cluster', 'ring']) },
  { key: 'lattice.gap', type: 'range', label: '单元间隙', min: -0.9, max: 0.9, step: 0.01,
    showIf: isOneOf('lattice.type', ['grid', 'hex', 'iso', 'oblique']) },
  { key: 'lattice.angle', type: 'range', label: '底场旋转', min: 0, max: 360, step: 1,
    showIf: isOneOf('lattice.type', ['grid']) },
  { key: 'lattice.skew', type: 'range', label: '斜切', min: -60, max: 60, step: 1,
    showIf: isOneOf('lattice.type', ['oblique']) },
  { key: 'lattice.count', type: 'range', label: '点数', min: 20, max: 4000, step: 10,
    showIf: isOneOf('lattice.type', ['phyllotaxis', 'spiral', 'ring']) },
  { key: 'lattice.turns', type: 'range', label: '圈数', min: 0.5, max: 20, step: 0.1,
    showIf: isOneOf('lattice.type', ['spiral']) },
  { key: 'lattice.spiralKind', type: 'select', label: '螺线类型',
    options: opts(['archimedean', 'logarithmic'], { archimedean: '阿基米德', logarithmic: '对数' }),
    showIf: isOneOf('lattice.type', ['spiral']) },
  { key: 'lattice.divergence', type: 'range', label: '发散角', min: 90, max: 180, step: 0.1,
    showIf: isOneOf('lattice.type', ['phyllotaxis']) },
  { key: 'lattice.clusterSize', type: 'range', label: '簇内点数', min: 1, max: 12, step: 0.1,
    showIf: isOneOf('lattice.type', ['cluster']) },
  { key: 'lattice.clusterSpread', type: 'range', label: '簇间距', min: 1.2, max: 6, step: 0.05,
    showIf: isOneOf('lattice.type', ['cluster']) },

  { key: 'modulator.type', type: 'select', label: '调制', options: opts(MODULATORS, MOD_LABELS) },
  { key: 'modulator.axis', type: 'select', label: '作用轴', options: opts(AXES, AXIS_LABELS),
    showIf: (p) => p['modulator.type'] !== 'none' && p['modulator.type'] !== 'noise' && p['modulator.type'] !== 'ripple' },
  { key: 'modulator.freq', type: 'range', label: '频率', min: 0.1, max: 8, step: 0.05,
    showIf: (p) => p['modulator.type'] !== 'none' },
  { key: 'modulator.amp', type: 'range', label: '强度', min: 0, max: 2, step: 0.01,
    showIf: (p) => p['modulator.type'] !== 'none' },
  { key: 'modulator.phase', type: 'range', label: '相位', min: 0, max: 1, step: 0.01,
    showIf: (p) => ['sine', 'ripple', 'golden'].includes(p['modulator.type']) },
  { key: 'modulator.bias', type: 'range', label: '基准值', min: 0, max: 1, step: 0.01 },
  { key: 'modulator.invert', type: 'toggle', label: '调制反转',
    showIf: (p) => p['modulator.type'] !== 'none' },

  { key: 'shape.type', type: 'select', label: '基元', options: opts(SHAPES, SHAPE_LABELS),
    showIf: (p) => !isWall(p) },
  { key: 'shape.scaleToUnit', type: 'toggle', label: '尺寸随单元缩放' },
  { key: 'shape.sizeMin', type: 'range', label: '最小尺寸', min: 0, max: 200, step: 0.5 },
  { key: 'shape.sizeMax', type: 'range', label: '最大尺寸', min: 0, max: 200, step: 0.5 },
  { key: 'shape.aspect', type: 'range', label: '长宽比', min: 0.1, max: 6, step: 0.02,
    showIf: isOneOf('shape.type', ['ellipse', 'capsule']) },
  { key: 'shape.aspectMode', type: 'select', label: '长宽比随调制',
    options: opts(['fixed', 'modulated'], { fixed: '固定', modulated: '随调制渐变' }),
    showIf: isOneOf('shape.type', ['ellipse', 'capsule']) },
  { key: 'shape.corner', type: 'range', label: '圆角', min: 0, max: 1, step: 0.01,
    showIf: isOneOf('shape.type', ['capsule', 'polygon']) },
  { key: 'shape.sides', type: 'range', label: '边数', min: 3, max: 12, step: 1,
    showIf: isOneOf('shape.type', ['polygon', 'curvePoly']) },
  { key: 'shape.curvature', type: 'range', label: '边曲率', min: -0.9, max: 0.9, step: 0.01,
    showIf: isOneOf('shape.type', ['curvePoly']) },
  { key: 'shape.sweep', type: 'range', label: '弧度', min: 0.05, max: 0.99, step: 0.01,
    showIf: (p) => p['topology.mode'] === 'truchet' || isOneOf('shape.type', ['arc'])(p) },
  { key: 'shape.inner', type: 'range', label: '内径', min: 0.05, max: 0.95, step: 0.01,
    showIf: isOneOf('shape.type', ['ring']) },
  { key: 'shape.rotation', type: 'range', label: '旋转', min: 0, max: 360, step: 1,
    showIf: (p) => !['maze', 'lattice'].includes(p['topology.mode']) },
  { key: 'shape.rotMode', type: 'select', label: '旋转模式', options: opts(ROT_MODES, ROT_LABELS),
    showIf: (p) => !['maze', 'lattice'].includes(p['topology.mode']) },
  { key: 'shape.stroke', type: 'toggle', label: '描边模式',
    showIf: (p) => !isWall(p) },
  { key: 'shape.strokeWidth', type: 'range', label: '线宽', min: 0.1, max: 60, step: 0.1,
    // 墙类（maze/lattice）的粗细走「尺寸」，线宽只在描边基元与 truchet 弧上有意义。
    showIf: (p) => p['topology.mode'] === 'truchet' || (!isWall(p) && !!p['shape.stroke']) },

  { key: 'topology.mode', type: 'select', label: '拓扑', options: opts(TOPOLOGIES, TOPO_LABELS) },
  { key: 'topology.jitter', type: 'range', label: '抖动', min: 0, max: 1, step: 0.01 },
  { key: 'topology.warp', type: 'range', label: '形变', min: 0, max: 1, step: 0.01 },
  { key: 'topology.warpFreq', type: 'range', label: '形变频率', min: 0.1, max: 8, step: 0.05,
    showIf: (p) => Number(p['topology.warp']) > 0 },
  { key: 'topology.density', type: 'range', label: '连通密度', min: 0, max: 1, step: 0.01,
    showIf: isOneOf('topology.mode', ['truchet', 'maze', 'lattice']) },
  { key: 'topology.halftoneLevels', type: 'range', label: '半调级数', min: 0, max: 1, step: 0.01,
    showIf: isOneOf('topology.mode', ['halftone']) },

  { key: 'modulator.seed', type: 'seed', label: '种子' },
];

export const GROUPS = [
  { id: 'canvas', label: '画幅' },
  { id: 'palette', label: '配色' },
  { id: 'lattice', label: '底场' },
  { id: 'modulator', label: '调制' },
  { id: 'shape', label: '基元' },
  { id: 'topology', label: '拓扑' },
];

/** DEFAULTS：合法且能渲染出像样图形的默认参数 */
export const DEFAULTS = {
  'canvas.aspect': 'square',
  palette: [PAPER, INK, ''],
  bg: PAPER,
  invert: false,

  'lattice.type': 'grid',
  'lattice.cols': 12,
  'lattice.rows': 12,
  'lattice.gap': 0.35,
  'lattice.angle': 0,
  'lattice.skew': 0,
  'lattice.count': 900,
  'lattice.turns': 5,
  'lattice.spiralKind': 'archimedean',
  'lattice.divergence': 137.5,
  'lattice.clusterSize': 4,
  'lattice.clusterSpread': 2.4,

  'modulator.type': 'none',
  'modulator.axis': 'y',
  'modulator.freq': 1,
  'modulator.amp': 1,
  'modulator.phase': 0,
  'modulator.bias': 0.5,
  'modulator.invert': false,
  'modulator.seed': 4821,

  'shape.type': 'dot',
  'shape.sizeMin': 4,
  'shape.sizeMax': 24,
  // 尺寸默认按像素解释（设计师直觉：40 就是 40px）。
  // 需要随底场密度自动缩放时，再打开 scaleToUnit（此时数值按单元百分比解释，100 = 一个单元）。
  'shape.scaleToUnit': false,
  'shape.aspect': 1,
  'shape.aspectMode': 'fixed',
  'shape.corner': 0.5,
  'shape.sides': 6,
  'shape.curvature': 0.35,
  'shape.sweep': 0.8,
  'shape.inner': 0.55,
  'shape.rotation': 0,
  'shape.rotMode': 'none',
  'shape.stroke': false,
  'shape.strokeWidth': 8,

  'topology.mode': 'isolated',
  'topology.jitter': 0,
  'topology.warp': 0,
  'topology.warpFreq': 1.5,
  'topology.density': 0.6,
  'topology.halftoneLevels': 0.5,
};

export function defaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

/** 按 schema 校正参数：未知值回落默认，数字夹到区间，select 校验取值 */
export function normalize(input) {
  const p = { ...defaults(), ...(input || {}) };
  for (const f of SCHEMA) {
    const v = p[f.key];
    if (f.type === 'range') {
      const n = Number(v);
      p[f.key] = Number.isFinite(n) ? Math.min(f.max, Math.max(f.min, n)) : DEFAULTS[f.key];
    } else if (f.type === 'select') {
      const valid = f.options.some((o) => o.value === v);
      if (!valid) p[f.key] = DEFAULTS[f.key];
    } else if (f.type === 'toggle') {
      p[f.key] = !!v;
    } else if (f.type === 'seed') {
      const n = Math.round(Number(v));
      p[f.key] = Number.isFinite(n) ? ((n % 100000) + 100000) % 100000 : DEFAULTS[f.key];
    } else if (f.type === 'palette') {
      if (!Array.isArray(v) || v.length < 2) p[f.key] = [...DEFAULTS.palette];
    }
  }
  // palette[0] 必须与 bg 保持一致：stageFromBg() 与 frameBg 都依赖它
  // An empty palette[0] used to reset bg to paper while leaving the swatch blank.
  if (Array.isArray(p.palette)) {
    if (typeof p.palette[0] !== 'string' || !p.palette[0]) {
      const accent = p.palette.length > 2 ? p.palette[2] : '';
      p.palette = [PAPER, p.palette[1] || INK, accent];
    }
    p.bg = p.palette[0];
  }
  if (typeof p.bg !== 'string' || !p.bg) p.bg = PAPER;
  return p;
}
