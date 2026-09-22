function viewBoxSize(svgText) {
  const match = String(svgText).match(/viewBox="([^"]+)"/i);
  if (!match) return { width: 1024, height: 1024 };
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  const width = Math.abs(parts[2]) || 1024;
  const height = Math.abs(parts[3]) || 1024;
  return { width, height };
}

function normalizeSvg(svgText) {
  let markup = String(svgText)
    .replace(/\sviewbox=/gi, ' viewBox=')
    .replace(/\spreserveaspectratio=/gi, ' preserveAspectRatio=');
  if (!markup.includes('xmlns=')) {
    markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return markup;
}

function round4(v) {
  return Math.round(v * 1e4) / 1e4;
}

export function frameSvg(svgText, { width, height, fit = 'cover', bg } = {}) {
  const markup = normalizeSvg(svgText);
  if (!markup) return markup;
  const open = markup.match(/<svg\b[^>]*>/i);
  if (!open || !(width > 0) || !(height > 0)) return markup;

  const viewBoxMatch = markup.match(/viewBox="([^"]+)"/i);
  const nums = viewBoxMatch
    ? viewBoxMatch[1].trim().split(/[\s,]+/).map(Number)
    : [0, 0, width, height];
  const vx = Number.isFinite(nums[0]) ? nums[0] : 0;
  const vy = Number.isFinite(nums[1]) ? nums[1] : 0;
  const vw = nums[2] > 0 ? nums[2] : width;
  const vh = nums[3] > 0 ? nums[3] : height;

  let sx;
  let sy;
  if (fit === 'none') {
    sx = width / vw;
    sy = height / vh;
  } else {
    sx = fit === 'contain'
      ? Math.min(width / vw, height / vh)
      : Math.max(width / vw, height / vh);
    sy = sx;
  }
  const tx = width / 2 - (vx + vw / 2) * sx;
  const ty = height / 2 - (vy + vh / 2) * sy;
  const transform = sx === sy
    ? `translate(${round4(tx)} ${round4(ty)}) scale(${round4(sx)})`
    : `translate(${round4(tx)} ${round4(ty)}) scale(${round4(sx)} ${round4(sy)})`;

  const openTag = open[0]
    .replace(/\sviewBox="[^"]*"/i, '')
    .replace(/\spreserveAspectRatio="[^"]*"/i, '')
    .replace(/\swidth="[^"]*"/i, '')
    .replace(/\sheight="[^"]*"/i, '')
    .replace(/\s*\/?>$/, '')
    + ` width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  const inner = markup
    .slice(open.index + open[0].length)
    .replace(/<\/svg\s*>\s*$/i, '');

  const fill = bg
    ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>`
    : '';

  return `${openTag}${fill}<g transform="${transform}">${inner}</g></svg>`;
}

export function downloadFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export function svgBlob(svgText) {
  return new Blob([normalizeSvg(svgText)], { type: 'image/svg+xml' });
}

export async function svgToPngBlob(svgText, width = 0, height = 0) {
  const markup = normalizeSvg(svgText);
  let w = Math.round(width);
  let h = Math.round(height);
  if (!(w > 0) || !(h > 0)) {
    const size = viewBoxSize(markup);
    const long = Math.max(size.width, size.height, 1) || 1024;
    w = Math.max(1, Math.round((size.width / long) * 2048));
    h = Math.max(1, Math.round((size.height / long) * 2048));
  }
  const url = URL.createObjectURL(svgBlob(markup));
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not rasterize SVG'));
    });
    image.src = url;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyPng(svgText) {
  const blob = await svgToPngBlob(svgText);
  if (navigator.clipboard && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return;
  }
  downloadFile('look.png', blob);
}
