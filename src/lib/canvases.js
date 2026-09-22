const MM_PER_IN = 25.4;
const RATIO_BASE = 1024;

export const FIT_MODES = [
  { id: 'cover', label: '填充' },
  { id: 'contain', label: '适应' },
  { id: 'none', label: '拉伸' }
];

export const CATEGORIES = [
  { id: 'ratio', label: '比例' },
  { id: 'device', label: '设备' },
  { id: 'social', label: '社媒' },
  { id: 'print', label: '印刷' },
  { id: 'custom', label: '自定义' }
];

export const DEFAULT_FIT = 'cover';
export const DEFAULT_DPI = 300;
export const DPI_STEPS = [150, 300, 600];

export const PRESETS = [
  { id: 'sq', cat: 'ratio', label: '方形', w: 1, h: 1, unit: 'ratio' },
  { id: 'r45', cat: 'ratio', label: '4:5', w: 4, h: 5, unit: 'ratio' },
  { id: 'r34', cat: 'ratio', label: '3:4', w: 3, h: 4, unit: 'ratio' },
  { id: 'r23', cat: 'ratio', label: '2:3', w: 2, h: 3, unit: 'ratio' },
  { id: 'riso', cat: 'ratio', label: 'ISO √2', w: 1, h: 1.41421356237, unit: 'ratio' },
  { id: 'r169', cat: 'ratio', label: '16:9', w: 16, h: 9, unit: 'ratio' },
  { id: 'r219', cat: 'ratio', label: '21:9', w: 21, h: 9, unit: 'ratio' },

  { id: 'iphone', cat: 'device', label: 'iPhone 15', w: 393, h: 852, unit: 'px' },
  { id: 'android', cat: 'device', label: '安卓手机', w: 360, h: 800, unit: 'px' },
  { id: 'ipad', cat: 'device', label: 'iPad Air', w: 820, h: 1180, unit: 'px' },
  { id: 'mbp14', cat: 'device', label: 'MacBook 14"', w: 1512, h: 982, unit: 'px' },
  { id: 'fhd', cat: 'device', label: '桌面 FHD', w: 1920, h: 1080, unit: 'px' },
  { id: 'qhd', cat: 'device', label: '桌面 2K', w: 2560, h: 1440, unit: 'px' },
  { id: 'uhd', cat: 'device', label: '桌面 4K', w: 3840, h: 2160, unit: 'px' },
  { id: 'watch', cat: 'device', label: 'Apple Watch', w: 410, h: 502, unit: 'px' },

  { id: 'xhs', cat: 'social', label: '小红书 3:4', w: 1242, h: 1656, unit: 'px' },
  { id: 'ig11', cat: 'social', label: 'IG 方图', w: 1080, h: 1080, unit: 'px' },
  { id: 'story', cat: 'social', label: 'Story/朋友圈', w: 1080, h: 1920, unit: 'px' },
  { id: 'xpost', cat: 'social', label: 'X 横图', w: 1600, h: 900, unit: 'px' },
  { id: 'wechat', cat: 'social', label: '公众号封面', w: 900, h: 383, unit: 'px' },
  { id: 'yt', cat: 'social', label: 'B站/YouTube', w: 1280, h: 720, unit: 'px' },

  { id: 'a5', cat: 'print', label: 'A5', w: 148, h: 210, unit: 'mm' },
  { id: 'a4', cat: 'print', label: 'A4', w: 210, h: 297, unit: 'mm' },
  { id: 'a3', cat: 'print', label: 'A3', w: 297, h: 420, unit: 'mm' },
  { id: 'a2', cat: 'print', label: 'A2', w: 420, h: 594, unit: 'mm' },
  { id: 'a1', cat: 'print', label: 'A1', w: 594, h: 841, unit: 'mm' },
  { id: 'card', cat: 'print', label: '名片', w: 90, h: 54, unit: 'mm' },
  { id: 'photo6', cat: 'print', label: '照片 6寸', w: 102, h: 152, unit: 'mm' },
  { id: 'poster', cat: 'print', label: '海报 50×70', w: 500, h: 700, unit: 'mm' }
];

export const DEFAULT_CANVAS = PRESETS[0];

export function oriented(c, flipped) {
  return flipped ? { w: c.h, h: c.w } : { w: c.w, h: c.h };
}

function trimNum(v) {
  return String(Math.round(v * 100) / 100);
}

export function describe(c, flipped = false) {
  const { w, h } = oriented(c, flipped);
  if (c.unit === 'ratio') return `${trimNum(w)}:${trimNum(h)}`;
  const unit = c.unit === 'mm' ? 'mm' : c.unit === 'in' ? 'in' : '';
  return `${trimNum(w)}×${trimNum(h)}${unit}`;
}

export function pillLabel(c, flipped = false) {
  if (!c) return '';
  if (c.unit === 'ratio') return describe(c, flipped);
  return `${c.label} · ${describe(c, flipped)}`;
}

export function toPixels(c, flipped, opts = {}) {
  const scale = opts.scale || 1;
  const dpi = opts.dpi || DEFAULT_DPI;
  const { w, h } = oriented(c, flipped);
  let pw;
  let ph;
  if (c.unit === 'mm') {
    pw = (w / MM_PER_IN) * dpi;
    ph = (h / MM_PER_IN) * dpi;
  } else if (c.unit === 'in') {
    pw = w * dpi;
    ph = h * dpi;
  } else if (c.unit === 'px') {
    pw = w;
    ph = h;
  } else {
    if (w >= h) {
      pw = RATIO_BASE;
      ph = (RATIO_BASE * h) / w;
    } else {
      ph = RATIO_BASE;
      pw = (RATIO_BASE * w) / h;
    }
  }
  return {
    width: Math.max(1, Math.round(pw * scale)),
    height: Math.max(1, Math.round(ph * scale))
  };
}

export function exportScale(c) {
  return c.unit === 'mm' || c.unit === 'in' ? 1 : 2;
}

export function encodeCanvas(c) {
  if (!c) return DEFAULT_CANVAS.id;
  if (c.id === 'custom') return `c-${c.w}x${c.h}-${c.unit}`;
  return c.id;
}

export function parseCanvasParam(str) {
  if (!str) return null;
  const m = str.match(/^c-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-(px|mm|in)$/);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (!(w > 0) || !(h > 0)) return null;
    return { id: 'custom', cat: 'custom', label: '自定义', w, h, unit: m[3] };
  }
  return PRESETS.find((p) => p.id === str) || null;
}
