/**
 * Compose：把 SVG 片段合成为完整文档字符串。
 * 只做字符串拼接 —— 必须能在 Node 下无 DOM 运行。
 *
 * 配色遵循项目约定：params.palette = [bg, fg, accent?]，
 * 这样 stageFromBg(params.palette[0]) 能正确判定 paper / ink 主题。
 */

import { clampNum } from './lattice.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** 画布比例预设 → [width, height] */
export const ASPECTS = {
  square: [1000, 1000],
  portrait: [1000, 1400],
  photo: [1000, 1250],
  tall: [900, 1600],
  banner: [500, 1000],
  landscape: [1400, 1000],
  wide: [1600, 900],
};

export function canvasSize(p) {
  const a = ASPECTS[p['canvas.aspect']] || ASPECTS.square;
  return { width: a[0], height: a[1] };
}

function colors(p) {
  const palette = Array.isArray(p.palette) ? p.palette : [];
  const bg = p.bg || palette[0] || '#f2eee6';
  const fg = palette[1] || '#101216';
  const accent = palette[2] || '';
  const invert = !!p.invert;
  return {
    bg: invert ? fg : bg,
    fg: invert ? bg : fg,
    accent,
  };
}

/**
 * @param {string[]} fragments SVG 片段
 * @param {object} p 参数
 * @returns {string} 完整 SVG 文档
 */
export function compose(fragments, p) {
  const { width: w, height: h } = canvasSize(p);
  const c = colors(p);
  const strokeMode = !!p['shape.stroke'];
  const topo = p['topology.mode'];
  const painting = strokeMode || topo === 'truchet' || topo === 'maze' || topo === 'lattice';

  const groupAttrs = painting
    ? `fill="none" stroke="${esc(c.accent || c.fg)}" stroke-linecap="${topo === 'maze' ? 'square' : 'butt'}"`
    : `fill="${esc(c.accent || c.fg)}" stroke="none"`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${esc(c.bg)}"/>`,
    `<g ${groupAttrs}>`,
    fragments.join(''),
    '</g>',
    '</svg>',
  ].join('');
}

/** 空文档（无片段时，保证预览不会得到空字符串） */
export function emptyDoc(p) {
  const { width: w, height: h } = canvasSize(p);
  const c = colors(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" fill="${esc(c.bg)}"/></svg>`;
}

export { clampNum };
