import { lucideDynamicIconImports, lucideIconNames } from '@lucide/icons/dynamic';
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

const byId = Object.fromEntries(MARKS.map((item) => [item.id, item]));
const pending = new Map();

export function getMark(id) {
  return byId[id] || byId.star;
}

export function searchIconNames(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return MARKS.map((item) => item.id);
  const scored = [];
  for (let i = 0; i < lucideIconNames.length; i++) {
    const id = lucideIconNames[i];
    const words = id.replace(/-/g, ' ');
    if (id === needle || words === needle) scored.push([0, id]);
    else if (id.startsWith(needle) || words.startsWith(needle)) scored.push([1, id]);
    else if (id.includes(needle) || words.includes(needle)) scored.push([2, id]);
  }
  scored.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
  const seen = new Set();
  const out = [];
  for (let i = 0; i < scored.length; i++) {
    const id = scored[i][1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 48) break;
  }
  return out;
}

export function searchMarks(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return MARKS;
  return MARKS.filter((item) => {
    const blob = [item.id, item.name, ...(item.tags || [])].join(' ').toLowerCase();
    return blob.includes(needle);
  });
}

export function ensureMark(id) {
  const hit = byId[id];
  if (hit) return Promise.resolve(hit);
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
