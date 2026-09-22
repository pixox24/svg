import { adoptCustom, forgetCustom } from './marks.js';

const KEY = 'svg-marks-custom';
const MAX_MARKS = 24;
const MAX_SHAPES = 48;
const MAX_FILE = 100 * 1024;

const SKIP = new Set(['title', 'desc', 'metadata', 'defs']);
const BANNED = new Set([
  'script', 'foreignobject', 'image', 'text', 'tspan', 'textpath', 'use',
  'style', 'animate', 'animatetransform', 'animatemotion', 'set', 'filter',
  'iframe', 'video', 'canvas', 'svg'
]);
const SHAPES = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline']);
const GEOM = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polygon: ['points'],
  polyline: ['points']
};

function fail(message) {
  const error = new Error(message);
  error.stamp = true;
  throw error;
}

function assertValue(value) {
  const text = String(value || '');
  if (/url\s*\(/i.test(text)) fail('This SVG uses a paint server or an outside link.');
  if (/[;{}]/.test(text)) fail('This SVG uses syntax the stamp field cannot keep.');
  if (/^https?:/i.test(text) || text.trim().startsWith('//')) fail('This SVG links outside the file.');
}

function isPaint(value) {
  const text = String(value || '').trim().toLowerCase();
  return Boolean(text) && text !== 'none' && text !== 'transparent';
}

function fmt(n) {
  return String(+n.toFixed(4));
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function stampName(filename) {
  const base = String(filename || '')
    .replace(/\.svg$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
  if (!base) return 'Stamp';
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function viewBoxOf(svg) {
  const raw = svg.getAttribute('viewBox');
  if (raw) {
    const parts = raw.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0 && parts.every(Number.isFinite)) {
      return parts;
    }
  }
  const w = parseFloat(svg.getAttribute('width'));
  const h = parseFloat(svg.getAttribute('height'));
  if (w > 0 && h > 0) return [0, 0, w, h];
  fail('This SVG needs a viewBox.');
}

function readNode(el, inherited, tally) {
  const tag = (el.localName || '').toLowerCase();
  if (!tag) return null;
  if ([...el.attributes].some((attr) => attr.name.toLowerCase().startsWith('on'))) {
    fail('This SVG contains a script.');
  }
  const paint = {
    fill: el.hasAttribute('fill') ? el.getAttribute('fill') : inherited.fill,
    stroke: el.hasAttribute('stroke') ? el.getAttribute('stroke') : inherited.stroke
  };
  assertValue(paint.fill);
  assertValue(paint.stroke);
  if (el.hasAttribute('clip-path')) assertValue(el.getAttribute('clip-path'));
  if (el.hasAttribute('mask')) assertValue(el.getAttribute('mask'));

  if (tag === 'g') {
    const kids = readChildren(el, paint, tally);
    if (!kids.length) return null;
    const attrs = {};
    if (el.hasAttribute('transform')) {
      const transform = el.getAttribute('transform').trim();
      assertValue(transform);
      attrs.transform = transform;
    }
    return ['g', attrs, kids];
  }
  if (SKIP.has(tag)) return null;
  if (BANNED.has(tag)) fail(`<${tag}> cannot be used as a stamp.`);
  if (!SHAPES.has(tag)) fail(`<${tag}> cannot be used as a stamp.`);

  tally.count += 1;
  if (tally.count > MAX_SHAPES) fail('This SVG has too many separate shapes for a repeated stamp.');
  const attrs = {};
  const keys = GEOM[tag];
  for (let i = 0; i < keys.length; i++) {
    if (!el.hasAttribute(keys[i])) continue;
    const value = el.getAttribute(keys[i]).trim();
    assertValue(value);
    attrs[keys[i]] = value;
  }
  if (tag === 'path' && !attrs.d) return null;
  if (el.hasAttribute('transform')) {
    const transform = el.getAttribute('transform').trim();
    assertValue(transform);
    attrs.transform = transform;
  }
  if (isPaint(paint.fill) && !isPaint(paint.stroke)) tally.filled += 1;
  else tally.stroked += 1;
  return [tag, attrs];
}

function readChildren(el, inherited, tally) {
  const nodes = [];
  for (const child of el.children) {
    const node = readNode(child, inherited, tally);
    if (node) nodes.push(node);
  }
  return nodes;
}

export function parseCustomSvg(text, filename) {
  if (typeof DOMParser === 'undefined') fail('SVG upload needs a browser.');
  const source = String(text || '');
  if (source.length > MAX_FILE) fail('This SVG is too large.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror')) fail('This file is not valid SVG.');
  const svg = doc.querySelector('svg');
  if (!svg) fail('This file is not an SVG.');
  const [vx, vy, vw, vh] = viewBoxOf(svg);
  const tally = { count: 0, filled: 0, stroked: 0 };
  const inherited = {
    fill: svg.getAttribute('fill') || '#000000',
    stroke: svg.getAttribute('stroke') || 'none'
  };
  assertValue(inherited.fill);
  assertValue(inherited.stroke);
  const children = readChildren(svg, inherited, tally);
  if (!children.length) fail('This SVG has no drawable shapes.');
  const scale = 24 / Math.max(vw, vh);
  const tx = (24 - vw * scale) / 2 - vx * scale;
  const ty = (24 - vh * scale) / 2 - vy * scale;
  const node = [[
    'g',
    { transform: `translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})` },
    children
  ]];
  const paint = tally.filled > tally.stroked ? 'fill' : 'stroke';
  const id = `custom:${hash(JSON.stringify([paint, node]))}`;
  return {
    id,
    name: stampName(filename),
    paint,
    node
  };
}

function readStore() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeStore(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function restoreCustomMarks() {
  const marks = [];
  const list = readStore();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || !String(item.id || '').startsWith('custom:') || !item.node) continue;
    marks.push(adoptCustom(item));
  }
  return marks;
}

export function saveCustomSvg(text, filename) {
  const record = parseCustomSvg(text, filename);
  const list = readStore().filter((item) => item && item.id !== record.id);
  list.unshift(record);
  const dropped = list.splice(MAX_MARKS);
  for (let i = 0; i < dropped.length; i++) forgetCustom(dropped[i].id);
  writeStore(list);
  return adoptCustom(record);
}

export function removeCustomMark(id) {
  const list = readStore().filter((item) => item && item.id !== id);
  writeStore(list);
  forgetCustom(id);
  return list.map((item) => adoptCustom(item));
}
