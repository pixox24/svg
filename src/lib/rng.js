export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 0x7fffffff) | 0;
}

export function shuffleInPlace(list, rand) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Pick ~freq of an n×n grid so chosen cells stay spread out (blue-noise-ish).
export function evenCells(n, freq, seed) {
  const cells = [];
  for (let y = 1; y <= n; y++) {
    for (let x = 1; x <= n; x++) cells.push([x, y]);
  }
  const total = cells.length;
  const keep = freq >= 0.999
    ? total
    : Math.max(freq > 0 ? 1 : 0, Math.round(freq * total));
  if (keep >= total) return cells;
  if (keep <= 0) return [];

  const rand = mulberry32((Number(seed) || 1) >>> 0);
  const order = shuffleInPlace(cells, rand);
  const minDist = 0.82 * (n / Math.sqrt(keep));
  const minSq = minDist * minDist;
  const chosen = [];
  const used = new Set();
  const id = (x, y) => `${x},${y}`;

  function farEnough(x, y) {
    for (let i = 0; i < chosen.length; i++) {
      const dx = chosen[i][0] - x;
      const dy = chosen[i][1] - y;
      if (dx * dx + dy * dy < minSq) return false;
    }
    return true;
  }

  for (let i = 0; i < order.length; i++) {
    if (chosen.length >= keep) break;
    const x = order[i][0];
    const y = order[i][1];
    if (!farEnough(x, y)) continue;
    chosen.push([x, y]);
    used.add(id(x, y));
  }

  while (chosen.length < keep) {
    let best = null;
    let bestD = -1;
    for (let i = 0; i < order.length; i++) {
      const x = order[i][0];
      const y = order[i][1];
      if (used.has(id(x, y))) continue;
      let nearest = Infinity;
      for (let j = 0; j < chosen.length; j++) {
        const dx = chosen[j][0] - x;
        const dy = chosen[j][1] - y;
        const d = dx * dx + dy * dy;
        if (d < nearest) nearest = d;
      }
      if (nearest > bestD) {
        bestD = nearest;
        best = [x, y];
      }
    }
    if (!best) break;
    chosen.push(best);
    used.add(id(best[0], best[1]));
  }

  return chosen;
}

export function luminance(hex) {
  const n = String(hex).replace('#', '');
  const v = n.length === 3
    ? n.split('').map((c) => c + c).join('')
    : n;
  if (v.length < 6) return 1;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function stageFromBg(bg) {
  return luminance(bg) < 0.28 ? 'ink' : 'paper';
}
