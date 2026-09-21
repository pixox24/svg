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

export async function svgToPngBlob(svgText, scale = 2) {
  const markup = normalizeSvg(svgText);
  const { width, height } = viewBoxSize(markup);
  const long = Math.max(width, height, 1);
  const target = 1024 * scale;
  const w = Math.max(1, Math.round((width / long) * target));
  const h = Math.max(1, Math.round((height / long) * target));
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

export async function copyPng(svgText, scale = 2) {
  const blob = await svgToPngBlob(svgText, scale);
  if (navigator.clipboard && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return;
  }
  downloadFile('look.png', blob);
}
