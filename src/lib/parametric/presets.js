/**
 * 预设库 —— 每个预设还原一张桌面参考图。
 * 参考图目录：~/Desktop/参数化几何图形参考图/
 * 识别与分类见：docs/parametric-engine/01-reference-analysis.md
 *
 * 尺寸一律用像素（见 preset() 里钉死的 shape.scaleToUnit = false）。
 *
 * 数值标定方法（重要）：不靠主观视觉评审 —— 模型对缩略图的判断不可靠。
 * 改用客观比对：spike/ref-density.py 量出每张参考图的"前景像素占比"，
 * 再与引擎产出的覆盖率对齐（spike/parametric-audit.mjs 导出 coverage.json）。
 * 覆盖率 ∝ 尺寸² 的图形按 sqrt(目标/当前) 换算，∝ 线宽的按线性换算。
 */

import { defaults } from './schema.js';

const INK = '#101216';
const PAPER = '#f2eee6';
const ORANGE = '#FFA500';

/**
 * 预设构造器。
 *  1. 强制 shape.scaleToUnit = false —— 本文件里所有预设的尺寸都按像素书写，
 *     而 DEFAULTS 可能变化，因此在这里显式钉死，避免预设被默认值悄悄改语义。
 *     （这正是 p-polar-spiral 曾经渲染成空白的原因：半径被缩成 0.03px）
 *  2. 把 bg 同步成 palette[0] —— 项目的 stageFromBg(params.bg || PAPER) 与
 *     frameBg 都靠这个字段判定 paper/ink 主题。若不同步，深色预设（如黑底
 *     白圆的圆脉）会被当成浅色主题，缩略图与舞台底色全错。
 */
const preset = (over) => {
  const p = { ...defaults(), 'shape.scaleToUnit': false, ...over };
  if (Array.isArray(p.palette) && p.palette[0]) p.bg = p.palette[0];
  return p;
};

export const PRESETS = [
  {
    id: 'p-iso-maze',
    name: 'Iso Maze',
    nameZh: '等轴测迷宫',
    family: 'grid',
    ref: 'ref-01',
    // 参考前景 48.5%。密度保持，但刻意把纹样放大（cols 12→7, 线宽 17→33）：
    // 覆盖率在数学上对尺度近似不变，而特征尺寸翻倍后，侧栏缩略图尺寸下才分辨得出结构
    // —— cols 12 + 19px 线宽在缩略图里会糊成一块深色，等于用户看不见这个预设。
    // 参考图本身也是 48.5% 墨量，在同样的缩小尺寸下同样是密实纹理，所以这不是保真度问题，
    // 是"能不能用"的问题：优先保证可辨识。
    params: preset({
      'canvas.aspect': 'banner',
      palette: [PAPER, INK, ''],
      'lattice.type': 'iso',
      'lattice.cols': 7,
      'lattice.rows': 16,
      'lattice.gap': 0.08,
      'shape.stroke': true,
      'shape.strokeWidth': 25,
      'topology.mode': 'maze',
      'modulator.seed': 7123,
    }),
  },
  {
    id: 'p-circle-pulse',
    name: 'Circle Pulse',
    nameZh: '圆脉',
    family: 'grid',
    ref: 'ref-02',
    // 参考前景 84.3% / 引擎 82.7% → 已对齐
    params: preset({
      'canvas.aspect': 'banner',
      palette: [INK, '#ffffff', ''],
      'lattice.type': 'grid',
      'lattice.cols': 8,
      'lattice.rows': 16,
      'lattice.gap': 0,
      'modulator.type': 'sine',
      'modulator.axis': 'y',
      'modulator.freq': 1,
      'modulator.phase': 0.25,
      'modulator.amp': 1,
      'modulator.bias': 0.5,
      'shape.type': 'dot',
      'shape.sizeMin': 46,
      'shape.sizeMax': 80,
    }),
  },
  {
    id: 'p-capsule-noise',
    name: 'Capsule Field',
    nameZh: '胶囊噪声场',
    family: 'grid',
    ref: 'ref-03',
    // 参考前景 84.1% / 引擎 51.0% → 尺寸 ×1.28
    params: preset({
      palette: [INK, '#ffffff', ''],
      'lattice.type': 'grid',
      'lattice.cols': 8,
      'lattice.rows': 8,
      'modulator.type': 'noise',
      'modulator.axis': 'both',
      'modulator.freq': 1.6,
      'modulator.amp': 0.62,
      'modulator.bias': 0.5,
      'modulator.seed': 7,
      'shape.type': 'capsule',
      'shape.sizeMin': 96,
      'shape.sizeMax': 150,
      'shape.aspect': 1.9,
      'shape.aspectMode': 'modulated',
      'shape.corner': 1,
      'shape.rotMode': 'grid',
    }),
  },
  {
    id: 'p-curved-hex',
    name: 'Curved Hex',
    nameZh: '曲边六角',
    family: 'hex',
    ref: 'ref-04',
    // 参考前景 75.5% / 引擎 55.5% → 尺寸 ×1.17（曲边内凹会削掉约 20% 面积）
    params: preset({
      palette: [INK, '#ffffff', ''],
      'lattice.type': 'hex',
      'lattice.cols': 9,
      'lattice.rows': 11,
      'shape.type': 'curvePoly',
      'shape.sides': 6,
      'shape.curvature': 0.42,
      'shape.sizeMin': 148,
      'shape.sizeMax': 148,
    }),
  },
  {
    id: 'p-phyllotaxis',
    name: 'Phyllotaxis',
    nameZh: '叶序螺旋',
    family: 'spiral',
    ref: 'ref-05',
    // 参考前景 21.2% / 引擎 13.2% → 尺寸 ×1.27
    params: preset({
      palette: [PAPER, INK, ''],
      'lattice.type': 'phyllotaxis',
      'lattice.count': 1100,
      'lattice.divergence': 137.5,
      'modulator.type': 'linear',
      'modulator.axis': 'radius',
      'modulator.amp': 0.5,
      'modulator.bias': 0.5,
      'shape.type': 'dot',
      'shape.sizeMin': 2,
      'shape.sizeMax': 21,
    }),
  },
  {
    id: 'p-diagonal-weave',
    name: 'Diagonal Weave',
    nameZh: '对角编织',
    family: 'grid',
    ref: 'ref-06',
    // 参考前景 54.5% / 引擎 34.4% → 线宽线性上调 12→19
    params: preset({
      'canvas.aspect': 'banner',
      palette: [PAPER, INK, ''],
      'lattice.type': 'grid',
      'lattice.cols': 12,
      'lattice.rows': 26,
      'lattice.gap': 0.12,
      'shape.type': 'bar',
      'shape.sizeMin': 46,
      'shape.sizeMax': 46,
      'shape.rotation': 45,
      'shape.rotMode': 'alternate',
      'shape.stroke': true,
      'shape.strokeWidth': 19,
    }),
  },
  {
    id: 'p-sine-warp',
    name: 'Sine Warp',
    nameZh: '正弦扭曲',
    family: 'grid',
    ref: 'ref-07',
    // 参考前景 10.9% / 引擎 13.3% → 尺寸 ×0.82
    params: preset({
      'canvas.aspect': 'photo',
      palette: [INK, '#ffffff', ''],
      'lattice.type': 'grid',
      'lattice.cols': 13,
      'lattice.rows': 17,
      'topology.warp': 0.55,
      'topology.warpFreq': 2.4,
      'shape.type': 'dot',
      'shape.sizeMin': 16,
      'shape.sizeMax': 34,
    }),
  },
  {
    id: 'p-polar-spiral',
    name: 'Polar Spiral',
    nameZh: '极坐标螺旋',
    family: 'spiral',
    ref: 'ref-08',
    // 参考前景 6.2% / 引擎 10.7% → 尺寸 ×0.76
    params: preset({
      'canvas.aspect': 'portrait',
      palette: [INK, ORANGE, ''],
      'lattice.type': 'spiral',
      'lattice.count': 520,
      'lattice.turns': 7.5,
      'lattice.spiralKind': 'archimedean',
      'modulator.type': 'linear',
      'modulator.axis': 'radius',
      'modulator.amp': 0.5,
      'modulator.bias': 0.45,
      'shape.type': 'dot',
      'shape.sizeMin': 2,
      'shape.sizeMax': 26,
    }),
  },
  {
    id: 'p-sine-weave',
    name: 'Sine Weave',
    nameZh: '正弦编织',
    family: 'grid',
    ref: 'ref-09',
    // 参考前景 25.9% / 引擎 7.8% → 尺寸 ×1.82
    params: preset({
      'canvas.aspect': 'photo',
      palette: [INK, '#ffffff', ''],
      'lattice.type': 'grid',
      'lattice.cols': 11,
      'lattice.rows': 26,
      'modulator.type': 'sine',
      'modulator.axis': 'x',
      'modulator.freq': 1.5,
      'modulator.amp': 1,
      'modulator.bias': 0.5,
      'shape.type': 'dot',
      'shape.sizeMin': 16,
      'shape.sizeMax': 48,
    }),
  },
  {
    id: 'p-decay-grid',
    name: 'Decay Grid',
    nameZh: '消散网格',
    family: 'grid',
    ref: 'ref-10',
    // 参考前景 31.4% / 引擎 37.2% → 尺寸 ×0.84
    params: preset({
      'canvas.aspect': 'tall',
      palette: [PAPER, INK, ''],
      'lattice.type': 'grid',
      'lattice.cols': 11,
      'lattice.rows': 34,
      'modulator.type': 'linear',
      'modulator.axis': 'y',
      'modulator.amp': -0.5,
      'modulator.bias': 0.9,
      'shape.type': 'polygon',
      'shape.sides': 3,
      'shape.corner': 0.3,
      'shape.sizeMin': 14,
      'shape.sizeMax': 62,
      'topology.jitter': 0.15,
      'topology.warp': 0.22,
      'topology.warpFreq': 1.2,
      'modulator.seed': 3,
    }),
  },
  {
    id: 'p-hex-clusters',
    name: 'Hex Clusters',
    nameZh: '六角点阵簇',
    family: 'hex',
    ref: 'ref-11',
    // 参考前景 29.5% / 引擎 89.3% → 尺寸 ×0.58（此前密到几乎糊成一片）
    params: preset({
      palette: [PAPER, INK, ''],
      'lattice.type': 'cluster',
      'lattice.cols': 5,
      'lattice.rows': 9,
      'lattice.clusterSize': 4,
      'lattice.clusterSpread': 2.35,
      'shape.type': 'dot',
      'shape.sizeMin': 12.5,
      'shape.sizeMax': 12.5,
    }),
  },
  {
    id: 'p-hex-triangles',
    name: 'Hex Triangles',
    nameZh: '六角三角阵列',
    family: 'hex',
    ref: 'ref-12',
    // 参考前景 24.2% / 引擎 15.9% → 尺寸 ×1.23
    params: preset({
      'canvas.aspect': 'portrait',
      palette: [PAPER, INK, ''],
      'lattice.type': 'hex',
      'lattice.cols': 8,
      'lattice.rows': 13,
      'modulator.type': 'linear',
      'modulator.axis': 'y',
      'modulator.amp': 0.38,
      'modulator.bias': 0.62,
      'shape.type': 'polygon',
      'shape.sides': 3,
      'shape.corner': 0.34,
      'shape.rotMode': 'radial',
      'shape.sizeMin': 26,
      'shape.sizeMax': 142,
    }),
  },
  {
    id: 'p-spiral-gallery',
    name: 'Spiral Gallery',
    nameZh: '螺旋陈列',
    family: 'spiral',
    ref: 'ref-13',
    // 参考前景 19.4% / 引擎 10.8% → 尺寸 ×1.34
    params: preset({
      palette: [PAPER, INK, ''],
      'lattice.type': 'phyllotaxis',
      'lattice.count': 700,
      'lattice.divergence': 137.3,
      'shape.type': 'ellipse',
      'shape.aspect': 2.6,
      'shape.rotMode': 'tangent',
      'shape.sizeMin': 2.7,
      'shape.sizeMax': 34,
    }),
  },
  {
    id: 'p-hex-meander',
    name: 'Hex Meander',
    nameZh: '六角回纹',
    family: 'hex',
    ref: 'ref-14',
    // 参考前景 35.2% / 引擎 18.4% → 线宽 ×1.57 + 尺寸 ×1.07
    params: preset({
      'canvas.aspect': 'portrait',
      palette: [PAPER, INK, ''],
      'lattice.type': 'hex',
      'lattice.cols': 8,
      'lattice.rows': 14,
      'shape.type': 'arc',
      'shape.sweep': 0.72,
      'shape.sizeMin': 130,
      'shape.sizeMax': 130,
      'shape.stroke': true,
      'shape.strokeWidth': 44,
      'topology.mode': 'truchet',
      'topology.density': 0.95,
      'modulator.seed': 11,
    }),
  },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((x) => [x.id, x]));
