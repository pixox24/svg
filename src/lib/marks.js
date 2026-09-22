import { lucideDynamicIconImports, lucideIconNames } from '@lucide/icons/dynamic';
import { FILLED_INDEX, FILLED_SHELF } from './tablerFilled.js';
import Star from '@lucide/icons/icons/star';
import Heart from '@lucide/icons/icons/heart';
import Hexagon from '@lucide/icons/icons/hexagon';
import Triangle from '@lucide/icons/icons/triangle';
import Circle from '@lucide/icons/icons/circle';
import Plus from '@lucide/icons/icons/plus';
import X from '@lucide/icons/icons/x';
import Sparkle from '@lucide/icons/icons/sparkle';
import Flower2 from '@lucide/icons/icons/flower-2';
import ArrowUp from '@lucide/icons/icons/arrow-up';
import Diamond from '@lucide/icons/icons/diamond';
import Moon from '@lucide/icons/icons/moon';
import Sun from '@lucide/icons/icons/sun';
import Zap from '@lucide/icons/icons/zap';
import Leaf from '@lucide/icons/icons/leaf';
import Hash from '@lucide/icons/icons/hash';
import Asterisk from '@lucide/icons/icons/asterisk';
import Bookmark from '@lucide/icons/icons/bookmark';
import Pentagon from '@lucide/icons/icons/pentagon';
import Snowflake from '@lucide/icons/icons/snowflake';

function unwrap(mod) {
  if (mod && Array.isArray(mod.node)) return mod;
  if (mod && mod.default && Array.isArray(mod.default.node)) return mod.default;
  return mod;
}

function entry(data, tags) {
  const icon = unwrap(data);
  const id = icon.name || 'star';
  return {
    id,
    name: label(id),
    tags: tags || [],
    paint: 'stroke',
    source: 'lucide',
    data: icon
  };
}

function label(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const MARKS = [
  entry(Star, ['star', 'shape']),
  entry(Heart, ['heart', 'love']),
  entry(Hexagon, ['hexagon', 'shape']),
  entry(Triangle, ['triangle', 'shape']),
  entry(Circle, ['circle', 'shape']),
  entry(Plus, ['plus', 'add']),
  entry(X, ['x', 'close']),
  entry(Sparkle, ['sparkle', 'star']),
  entry(Flower2, ['flower', 'organic']),
  entry(ArrowUp, ['arrow', 'direction']),
  entry(Diamond, ['diamond', 'shape']),
  entry(Moon, ['moon', 'night']),
  entry(Sun, ['sun', 'day']),
  entry(Zap, ['zap', 'bolt']),
  entry(Leaf, ['leaf', 'organic']),
  entry(Hash, ['hash', 'grid']),
  entry(Asterisk, ['asterisk', 'star']),
  entry(Bookmark, ['bookmark', 'mark']),
  entry(Pentagon, ['pentagon', 'shape']),
  entry(Snowflake, ['snowflake', 'winter'])
];

function filledMark(name, node, tags) {
  return {
    id: `filled:${name}`,
    name: label(name),
    tags: tags || [],
    paint: 'fill',
    source: 'tabler',
    data: { name, node }
  };
}

export const FILLED_MARKS = FILLED_SHELF.map((item) => filledMark(item.name, item.node, item.tags));

const byId = Object.fromEntries(MARKS.map((item) => [item.id, item]));
for (let i = 0; i < FILLED_MARKS.length; i++) byId[FILLED_MARKS[i].id] = FILLED_MARKS[i];

const filledNames = new Set(FILLED_INDEX.map((item) => item[0]));
const pending = new Map();
let filledNodesPromise;

export function adoptCustom(record) {
  const mark = {
    id: record.id,
    name: record.name || 'Stamp',
    tags: [],
    paint: record.paint === 'fill' ? 'fill' : 'stroke',
    source: 'custom',
    data: { name: record.name || 'Stamp', node: record.node }
  };
  byId[mark.id] = mark;
  return mark;
}

export function forgetCustom(id) {
  const mark = byId[id];
  if (mark && mark.source === 'custom') delete byId[id];
}

export function markPaint(id) {
  const mark = byId[id];
  if (mark && mark.paint) return mark.paint;
  return String(id || '').startsWith('filled:') ? 'fill' : 'stroke';
}

export function getMark(id) {
  return byId[id] || byId.star;
}

function scoreName(id, words, needle) {
  if (id === needle || words === needle) return 0;
  if (id.startsWith(needle) || words.startsWith(needle)) return 1;
  if (id.includes(needle) || words.includes(needle)) return 2;
  return -1;
}

function takeMixed(scored) {
  const bands = new Map();
  for (let i = 0; i < scored.length; i++) {
    const item = scored[i];
    let band = bands.get(item.score);
    if (!band) {
      band = [];
      bands.set(item.score, band);
    }
    band.push(item);
  }
  const scores = [...bands.keys()].sort((a, b) => a - b);
  const seen = new Set();
  const out = [];
  const push = (item) => {
    if (!item || seen.has(item.id) || out.length >= 48) return;
    seen.add(item.id);
    out.push(item.id);
  };
  for (let s = 0; s < scores.length; s++) {
    const band = bands.get(scores[s]);
    const primary = [];
    const secondary = [];
    for (let i = 0; i < band.length; i++) {
      if (band[i].bias === 0) primary.push(band[i]);
      else secondary.push(band[i]);
    }
    const n = Math.max(primary.length, secondary.length);
    for (let i = 0; i < n; i++) {
      push(primary[i]);
      push(secondary[i]);
      if (out.length >= 48) return out;
    }
  }
  return out;
}

export function searchIconNames(query, prefer = 'line') {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) {
    const shelf = prefer === 'solid' ? FILLED_MARKS : MARKS;
    return shelf.map((item) => item.id);
  }
  const lineBias = prefer === 'solid' ? 1 : 0;
  const fillBias = prefer === 'solid' ? 0 : 1;
  const scored = [];
  for (let i = 0; i < lucideIconNames.length; i++) {
    const id = lucideIconNames[i];
    const words = id.replace(/-/g, ' ');
    const score = scoreName(id, words, needle);
    if (score >= 0) scored.push({ score, bias: lineBias, id });
  }
  for (let i = 0; i < FILLED_INDEX.length; i++) {
    const name = FILLED_INDEX[i][0];
    const tags = FILLED_INDEX[i][1] || '';
    const words = name.replace(/-/g, ' ');
    let score = scoreName(name, words, needle);
    if (score < 0 && needle.length >= 2) {
      const parts = tags.split(' ');
      for (let t = 0; t < parts.length; t++) {
        if (parts[t] === needle) {
          score = 1;
          break;
        }
        if (score < 0 && parts[t].startsWith(needle)) score = 2;
      }
    }
    if (score >= 0) scored.push({ score, bias: fillBias, id: `filled:${name}` });
  }
  scored.sort((a, b) => a.score - b.score || a.bias - b.bias || (a.id < b.id ? -1 : 1));
  return takeMixed(scored);
}

export function searchMarks(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return MARKS;
  return MARKS.filter((item) => {
    const blob = [item.id, item.name, ...(item.tags || [])].join(' ').toLowerCase();
    return blob.includes(needle);
  });
}

function loadFilledNodes() {
  if (!filledNodesPromise) {
    filledNodesPromise = import('./tablerFilledNodes.json').then((mod) => mod.default || mod);
  }
  return filledNodesPromise;
}

export function ensureMark(id) {
  const hit = byId[id];
  if (hit) return Promise.resolve(hit);
  if (String(id).startsWith('filled:')) return ensureFilled(id);
  const loader = lucideDynamicIconImports[id];
  if (!loader) return Promise.resolve(byId.star);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const task = loader().then((mod) => {
    const mark = entry(unwrap(mod), []);
    byId[mark.id] = mark;
    if (id !== mark.id) byId[id] = mark;
    pending.delete(id);
    return mark;
  }).catch(() => {
    pending.delete(id);
    return byId.star;
  });
  pending.set(id, task);
  return task;
}

function ensureFilled(id) {
  const name = String(id).slice(7);
  if (!filledNames.has(name)) return Promise.resolve(null);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const task = loadFilledNodes().then((nodes) => {
    const node = nodes[name];
    pending.delete(id);
    if (!node) return null;
    const mark = filledMark(name, node, []);
    byId[mark.id] = mark;
    return mark;
  }).catch(() => {
    pending.delete(id);
    return null;
  });
  pending.set(id, task);
  return task;
}

function nodesToDoodle(nodes) {
  return (nodes || []).map((node) => {
    const [tag, attrs = {}, children] = node;
    const props = Object.entries(attrs)
      .filter(([key]) => key !== 'key')
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    const inner = children && children.length ? ` ${nodesToDoodle(children)}` : '';
    return `${tag} { ${props}${props ? ';' : ''}${inner} }`;
  }).join(' ');
}

export function markDoodle(id) {
  return nodesToDoodle(getMark(id).data.node);
}

function nodesToSvg(nodes) {
  return (nodes || []).map((node) => {
    const [tag, attrs = {}, children] = node;
    const props = Object.entries(attrs)
      .filter(([key]) => key !== 'key')
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    if (children && children.length) {
      return `<${tag} ${props}>${nodesToSvg(children)}</${tag}>`;
    }
    return `<${tag}${props ? ' ' + props : ''}/>`;
  }).join('');
}

export function markPreview(id, color = 'currentColor') {
  const mark = getMark(id);
  const inner = nodesToSvg(mark.data.node);
  if (mark.paint === 'fill') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">${inner}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
