import { systems } from './systems.js';
import { stageFromBg } from './lib/rng.js';
import {
  TABBIED_CATALOG,
  TABBIED_COUNT,
  catalogEntry,
  getTabbiedFamily,
  slugFromId,
  tabbiedId,
  previewUrl
} from './tabbiedCatalog.js';

export {
  TABBIED_CATALOG,
  TABBIED_COUNT,
  catalogEntry,
  getTabbiedFamily,
  slugFromId,
  tabbiedId,
  previewUrl
};

function read(input) {
  let temp = input.replace(/^\n+/g, '');
  let len = temp.length - temp.replace(/^\s+/g, '').length;
  return input.split('\n').map((n) => (
    n.replace(new RegExp(`^\\s{${len}}`, 'g'), '')
  )).join('\n').trim();
}

const INK = '#101216';
const PAPER = '#f2eee6';

export const TAGS = [
  { id: 'all', label: 'All' },
  { id: 'motion', label: 'Motion' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'organic', label: 'Organic' },
  { id: 'mark', label: 'Mark' },
  { id: 'code', label: 'Code' }
];

export const families = [
  {
    id: 'lattice',
    label: 'Lattice',
    blurb: 'A field of cells — pulsing, strict, or overgrown.',
    tags: ['motion', 'pattern'],
    ...systems.lattice,
    variants: [
      {
        id: 'lattice-pulse',
        name: 'Pulse',
        params: {
          colors: ['#e2b44c', '#c43c6e', '#5346b8'],
          bg: PAPER,
          grid: 10,
          rMin: 0.08,
          rMax: 0.44,
          strokeWidth: 0.03,
          opacity: 1,
          motion: true,
          speed: 2.2,
          seed: 48291
        }
      },
      {
        id: 'lattice-monolith',
        name: 'Monolith',
        params: {
          colors: ['#161412'],
          bg: '#f4f0e8',
          grid: 8,
          rMin: 0.32,
          rMax: 0.32,
          strokeWidth: 0,
          opacity: 1,
          motion: false,
          speed: 2,
          seed: 1
        }
      },
      {
        id: 'lattice-noir',
        name: 'Noir',
        params: {
          colors: ['#e2b87a', '#e2b87a', '#e2b87a', '#6b542e'],
          bg: INK,
          grid: 12,
          rMin: 0.04,
          rMax: 0.32,
          strokeWidth: 0,
          opacity: 1,
          motion: false,
          speed: 2,
          seed: 90011
        }
      },
      {
        id: 'lattice-bloom',
        name: 'Bloom',
        params: {
          colors: ['#ead3cf', '#d3c2e6', '#c5ddd6', '#f0d7a4'],
          bg: '#f6f1ea',
          grid: 6,
          rMin: 0.42,
          rMax: 0.95,
          strokeWidth: 0,
          opacity: 0.72,
          motion: false,
          speed: 2,
          seed: 77102
        }
      }
    ]
  },
  {
    id: 'marks',
    label: 'Marks',
    blurb: 'One Lucide icon, tiled into a field — turned, recolored, reseeded.',
    tags: ['mark', 'pattern'],
    ...systems.marks,
    variants: [
      {
        id: 'marks-star',
        name: 'Star',
        params: {
          icon: 'star',
          colors: ['#c9a46c', '#8a5a2b', '#161412'],
          bg: PAPER,
          grid: 6,
          frequency: 1,
          size: 0.58,
          strokeWidth: 1.8,
          turn: true,
          seed: 48291
        }
      },
      {
        id: 'marks-heart',
        name: 'Heart',
        params: {
          icon: 'heart',
          colors: ['#c43c6e', '#e08a3c', '#ead3cf'],
          bg: '#f6f1ea',
          grid: 5,
          frequency: 1,
          size: 0.62,
          strokeWidth: 1.7,
          turn: false,
          seed: 22018
        }
      },
      {
        id: 'marks-hex',
        name: 'Hex',
        params: {
          icon: 'hexagon',
          colors: ['#e2b87a', '#7dd3c0'],
          bg: INK,
          grid: 7,
          frequency: 1,
          size: 0.52,
          strokeWidth: 1.6,
          turn: true,
          seed: 90011
        }
      },
      {
        id: 'marks-sparkle',
        name: 'Sparkle',
        params: {
          icon: 'sparkle',
          colors: ['#f2c14e', '#5eead4', '#c4b5fd'],
          bg: INK,
          grid: 6,
          frequency: 0.6,
          size: 0.48,
          strokeWidth: 1.9,
          turn: true,
          seed: 77102
        }
      }
    ]
  },
  {
    id: 'crystal',
    label: 'Crystal',
    blurb: 'Radial ice — six arms, or something colder.',
    tags: ['organic', 'mark'],
    ...systems.crystal,
    variants: [
      {
        id: 'crystal-ice',
        name: 'Ice',
        params: { color: '#161412', dot: '#161412', bg: PAPER, arms: 6, strokeWidth: 1.15, armLen: 44, dotR: 0 }
      },
      {
        id: 'crystal-ember',
        name: 'Ember',
        params: { color: '#e08a3c', dot: '#f2c14e', bg: INK, arms: 6, strokeWidth: 1.35, armLen: 42, dotR: 3.2 }
      },
      {
        id: 'crystal-ink',
        name: 'Ink',
        params: { color: '#111111', dot: '#111111', bg: PAPER, arms: 5, strokeWidth: 2.4, armLen: 40, dotR: 0 }
      },
      {
        id: 'crystal-neon',
        name: 'Neon',
        params: { color: '#5eead4', dot: '#5eead4', bg: INK, arms: 12, strokeWidth: 0.55, armLen: 42, dotR: 0 }
      }
    ]
  },
  {
    id: 'textile',
    label: 'Textile',
    blurb: 'A woven tile, rotated 45°, drawn as it appears.',
    tags: ['pattern', 'motion'],
    ...systems.textile,
    variants: [
      { id: 'textile-karesansui', name: 'Karesansui', params: { bg: '#f3efe6', stroke: '#1b2d37', tile: 12, rotate: 45, strokeWidth: 1, draw: 3 } },
      { id: 'textile-noir', name: 'Noir', params: { bg: INK, stroke: '#e8e0d4', tile: 12, rotate: 45, strokeWidth: 1, draw: 3 } },
      { id: 'textile-gilt', name: 'Gilt', params: { bg: '#10211a', stroke: '#e2b87a', tile: 12, rotate: 45, strokeWidth: 1, draw: 3 } },
      { id: 'textile-circuit', name: 'Circuit', params: { bg: '#071018', stroke: '#7dd3c0', tile: 12, rotate: 45, strokeWidth: 1, draw: 3 } }
    ]
  },
  {
    id: 'pebble',
    label: 'Pebble',
    blurb: 'Stripes and stones, locked on a diagonal.',
    tags: ['pattern'],
    ...systems.pebble,
    variants: [
      { id: 'pebble-candy', name: 'Candy', params: { stripeA: '#f5f0e1', stripeB: '#ff6e40', stoneA: '#1e3d59', stoneB: '#ffc13b', stoneC: '#ffcce7', tile: 25, rotate: -45 } },
      { id: 'pebble-ink', name: 'Sumi', params: { stripeA: '#efeae1', stripeB: '#2b3038', stoneA: '#1a1d22', stoneB: '#8a8680', stoneC: '#d9d3c7', tile: 25, rotate: -45 } },
      { id: 'pebble-coral', name: 'Coral', params: { stripeA: '#f6ead9', stripeB: '#e07a5f', stoneA: '#3d405b', stoneB: '#f2cc8f', stoneC: '#f4acb7', tile: 25, rotate: -45 } },
      { id: 'pebble-midnight', name: 'Midnight', params: { stripeA: '#121826', stripeB: '#c9a46c', stoneA: '#0b1020', stoneB: '#7c9cff', stoneC: '#e8d5a3', tile: 25, rotate: -45 } }
    ]
  },
  {
    id: 'spiral',
    label: 'Spiral',
    blurb: 'Three hundred seeds on a golden-angle wind.',
    tags: ['organic'],
    ...systems.spiral,
    variants: [
      { id: 'spiral-garden', name: 'Garden', params: { hue: 120, spread: 90, sat: 80, light: 50, count: 300, bg: PAPER } },
      { id: 'spiral-cosmos', name: 'Cosmos', params: { hue: 255, spread: 50, sat: 72, light: 52, count: 320, bg: INK } },
      { id: 'spiral-ember', name: 'Ember', params: { hue: 18, spread: 28, sat: 88, light: 54, count: 280, bg: INK } },
      { id: 'spiral-mono', name: 'Mono', params: { hue: 32, spread: 0, sat: 10, light: 40, count: 260, bg: PAPER } }
    ]
  },
  {
    id: 'orb',
    label: 'Orb',
    blurb: 'A masked world with a noisy terminator.',
    tags: ['organic', 'mark'],
    ...systems.orb,
    variants: [
      { id: 'orb-rose', name: 'Rose', params: { colorA: '#ffc0cb', colorB: '#322EA2', bg: PAPER } },
      { id: 'orb-earth', name: 'Earth', params: { colorA: '#8ec5d4', colorB: '#1c4a3a', bg: INK } },
      { id: 'orb-eclipse', name: 'Eclipse', params: { colorA: '#1a1612', colorB: '#e2b87a', bg: INK } },
      { id: 'orb-jupiter', name: 'Jupiter', params: { colorA: '#f0d5a0', colorB: '#b85c38', bg: INK } }
    ]
  },
  {
    id: 'halo',
    label: 'Halo',
    blurb: 'Rotated ellipses, each a slice of a gradient.',
    tags: ['organic', 'motion'],
    ...systems.halo,
    variants: [
      { id: 'halo-dusk', name: 'Dusk', params: { c1: '#ffffff', c2: '#f9a828', c3: '#07617d', c4: '#2e383f', count: 100, turn: 240, bg: PAPER } },
      { id: 'halo-aurora', name: 'Aurora', params: { c1: '#04160f', c2: '#34d399', c3: '#60a5fa', c4: '#c4b5fd', count: 90, turn: 220, bg: INK } },
      { id: 'halo-brass', name: 'Brass', params: { c1: '#2a2118', c2: '#e2b87a', c3: '#8a5a2b', c4: '#f3efe6', count: 48, turn: 200, bg: INK } },
      { id: 'halo-ghost', name: 'Ghost', params: { c1: '#ffffff', c2: '#d9d3c7', c3: '#8a8680', c4: '#3a3835', count: 70, turn: 260, bg: PAPER } }
    ]
  },
  {
    id: 'tide',
    label: 'Tide',
    blurb: 'A closed curve sampled seven hundred times.',
    tags: ['organic', 'pattern'],
    ...systems.tide,
    variants: [
      { id: 'tide-foam', name: 'Foam', params: { stroke: '#1B2D37', fill: '#d7e7ee', bg: PAPER, samples: 720, strokeWidth: 0.15, amp: 10, f1: 4, f2: 12 } },
      { id: 'tide-abyss', name: 'Abyss', params: { stroke: '#7dd3c0', fill: '#0b1c28', bg: INK, samples: 720, strokeWidth: 0.12, amp: 9, f1: 5, f2: 14 } },
      { id: 'tide-radar', name: 'Radar', params: { stroke: '#4ade80', fill: 'none', bg: INK, samples: 240, strokeWidth: 0.2, amp: 3.2, f1: 3, f2: 9 } },
      { id: 'tide-silk', name: 'Silk', params: { stroke: '#b76e79', fill: '#f6eae4', bg: PAPER, samples: 400, strokeWidth: 0.08, amp: 7, f1: 6, f2: 18 } }
    ]
  }
];

families.forEach((family) => {
  family.variants.forEach((variant) => {
    variant.code = family.compile(variant.params);
    variant.stage = variant.params.stage || stageFromBg(variant.params.bg || PAPER);
  });
});

export const classics = [
  {
    id: 'basic',
    name: 'Basic',
    tags: ['code'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: 0 0 10 10;
        stroke: #000;
        stroke-width: .1;
        circle {
          fill: deepskyblue;
          cx: 4;
          cy: 4;
          r: 3
        }
        rect {
          width: 1;
          height: 1;
          fill: yellow;
          transform: translate(8.5 7.8) rotate(45);
        }
        rect {
          width: 10;
          height: 10;
          fill: none;
        }
      }
    `)
  },
  {
    id: 'star',
    name: 'Star',
    tags: ['mark'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: -50 -50 100 100;
        polygon {
          stroke: #000;
          points: @m10.@Plot(
            r: seq(20, 40);
            rotate: 18;
          );
          fill: @linearGradient(30, deeppink 50%, yellow 100%);
        }
      }
    `)
  },
  {
    id: 'flower',
    name: 'Flower',
    tags: ['motion', 'organic'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: 0 0 10 10.1;
        stroke: #000;
        stroke-width: .1;
        stroke-dasharray: 100;
        stroke-linecap: round;
        path*3 {
          style animation: move @r(2s, 4s) reverse;
          fill: none;
          d: @pn(M 5 10 Q 5 5 8 1,
                 M 5 10 Q 4 5 2 4,
                 M 5 10 Q 6 6 8 4);
        }
        circle*3 {
          style animation: scale @r(1s, 2s) reverse;
          fill: @pn(yellow, blueviolet, deeppink);
          cx, cy: @pn(8 1, 2 4, 8 4);
          r: @r(.2, .5);
        }
        style {
          @keyframes move { to { stroke-dashoffset: 100 } }
          @keyframes scale { to { r: 0 } }
        }
      }
    `)
  },
  {
    id: '10-print',
    name: '10 PRINT',
    tags: ['code', 'pattern', 'motion'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: 0 0 16 16 padding .2;
        stroke: #1B2D37;
        stroke-width: .4;
        stroke-linecap: round;
        line*16x16 {
          draw: @r(1s);
          x1, y1, x2, y2: @p(
            @nx(-1) @ny(-1) @nx @ny,
            @nx @ny(-1) @nx(-1) @ny,
            @nx @ny(-1) @nx @ny
          );
        }
      }
    `)
  },
  {
    id: '99-bottles-of-beer',
    name: '99 bottles',
    tags: ['code'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: 0 0 16 $(99*5);
        overflow: visible;
        style max-height: inherit;
        foreignObject {
          width, height: 100%;
          font-size: 1;
          style line-height: 1;
          p*99-1 {
            content: \`
              @n bottles of beer on the wall, <br />
              @n bottles of beer. <br />
              Take one down and pass it around, <br />
              @n(-1) bottles of beer on the wall.
            \`;
          }
        }
      }
    `)
  },
  {
    id: 'css-logo',
    name: 'CSS logo',
    tags: ['mark', 'code'],
    stage: 'paper',
    code: read(`
      svg {
        viewbox: 0 0 10 10;
        title { content: "CSS LOGO" }
        path {
          fill: rebeccapurple;
          d: M 0 0 8.4 0 Q 10 0 10 1.6
             L 10 8.4 Q 10 10 8.4 10
             L 1.6 10 Q 0 10 0 8.4
        }
        g {
          stroke: #fff;
          stroke-width: .75;
          fill: none;
          path {
            d: M 4.25 6.5
               c 0 -1 -1.25 -1 -1.25 0
               l 0 1.5
               c 0 1 1.25 1 1.25 0
          }
          path*2 {
            d: M @pn(8.75, 6.5) 6.5
               c 0 -1 -1.25 -1 -1.25 0
               s 1.25 .5 1.25 1.5
               c 0 1 -1.25 1 -1.25 0
          }
        }
      }
    `)
  },
  {
    id: 'icons',
    name: 'Icons',
    tags: ['mark', 'code'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: 0 0 120 20 p 1;
        stroke: #000;
        stroke-width: .5;
        fill: none;
        g rect*5 {
          width, height: 20;
          x, y: @n(*25, -25) 0;
          stroke-dasharray: .5;
          stroke-width: .2;
        }
        g {
          path {
            d: M 12 20 A 6 6 0 1 1 12 0 z
               M 18 16 A 6 6 0 0 1 18 4 z;
          }
        }
        g {
          transform: translate(25, 0);
          circle*2x2 {
            r, cx, cy: 5 @nx(*10, -5) @ny(*10, -5);
          }
        }
        g {
          transform: translate(50, 0);
          stroke-miterlimit: 1;
          path {
             d: M 0 0 0 10 0 20 10 20
                  0 10 0 0 20 20 10 20;
          }
        }
        g {
          transform: translate(75, 0);
          line { x1, y1, x2, y2: 10 0 10 20 }
          circle*2 { r, cx, cy: @n(*5) 10 10 }
        }
        g {
          transform: translate(100, 0);
          path {
            d: M 0 20 A 20 20 0 0 1 20 0 L 20 20 z
               M 8.5 20 A 11.5 11.5 0 0 1 20 8.5;
          }
        }
      }
    `)
  },
  {
    id: 'hyperbolic-circles',
    name: 'Hyperbolic',
    tags: ['pattern', 'code'],
    stage: 'paper',
    code: read(`
      svg {
        viewBox: -5 -5 10 10;
        g {
          stroke: #1B2D37;
          stroke-width: .04;
          circle { r: 5; fill: #f9f8eb }
          circle*4 {
            r: 5;
            cx, cy: @Plot(r: 7.07; rotate: 45);
            fill: #76b39d;
          }
          circle*8 {
            cx, cy: @Plot(r: 5.5; rotate: $(45/2));
            r: $(5/2.39);
            fill: #05004e;
          }
          circle*16 {
            r: 1.01;
            cx, cy: @Plot(r: 5.2; rotate: $(45/4));
            fill: #fd5f00;
          }
          circle*32 {
            r: $(5/9.6);
            cx, cy: @Plot(r: 5.2; rotate: $(45/8));
            fill: #f9f8eb;
          }
          circle*64 {
            r: $(5/21);
            cx, cy: @Plot(r: 5.08; rotate: $(45/16));
            fill: #76b39d;
          }
          mask: defs mask { circle { r: 5; fill: #fff }}
          circle { r: 4.98; fill: none }
        }
      }
    `)
  }
];

export function compileVariant(family, params) {
  return family.compile(params);
}

export function paramsEqual(a, b, keys) {
  return keys.every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}

export function matchingPreset(family, params) {
  if (!family) return null;
  const keys = family.schema.map((item) => item.key).filter((key) => key !== 'seed');
  return family.variants.find((variant) => paramsEqual(variant.params, params, keys)) || null;
}

function sketchFromFamily(family, kind) {
  return family.variants.map((variant) => ({
    ...variant,
    code: variant.code || family.compile(variant.params),
    stage: variant.stage || stageFromBg(variant.params.bg || variant.params.palette?.[0] || PAPER),
    familyId: family.id,
    familyLabel: kind === 'tabbied' ? 'Tabbied' : family.label,
    blurb: family.blurb,
    tags: family.tags,
    kind,
    svgExport: family.svgExport,
    svgExportNote: family.svgExportNote
  }));
}

function stubTabbied(entry) {
  return {
    id: tabbiedId(entry.slug),
    name: entry.name,
    familyId: tabbiedId(entry.slug),
    familyLabel: 'Tabbied',
    blurb: entry.description || '',
    tags: ['pattern'],
    kind: 'tabbied',
    preview: previewUrl(entry.slug),
    svgExport: entry.svgExport?.supported !== false
  };
}

export function allSketches() {
  const gallery = families.flatMap((family) => sketchFromFamily(family, 'gallery'));
  const tabbied = TABBIED_CATALOG.map((entry) => {
    const loaded = getTabbiedFamily(entry.slug);
    return loaded ? sketchFromFamily(loaded, 'tabbied')[0] : stubTabbied(entry);
  });
  const classicItems = classics.map((item) => ({
    ...item,
    familyId: null,
    familyLabel: 'Classics',
    blurb: '',
    kind: 'classic'
  }));
  return [...gallery, ...tabbied, ...classicItems];
}

export function getSketch(id) {
  for (const family of families) {
    if (family.variants.some((item) => item.id === id)) {
      return sketchFromFamily(family, 'gallery').find((item) => item.id === id);
    }
  }
  const classic = classics.find((item) => item.id === id);
  if (classic) {
    return {
      ...classic,
      familyId: null,
      familyLabel: 'Classics',
      blurb: '',
      kind: 'classic'
    };
  }
  const slug = slugFromId(id);
  if (slug) {
    const loaded = getTabbiedFamily(slug);
    if (loaded) return sketchFromFamily(loaded, 'tabbied')[0];
    const entry = catalogEntry(slug);
    if (entry) return stubTabbied(entry);
  }
  return null;
}

export function getFamily(id) {
  return families.find((item) => item.id === id)
    || getTabbiedFamily(slugFromId(id) || '')
    || null;
}

export function familyForSketch(id) {
  const gallery = families.find((family) => family.variants.some((item) => item.id === id));
  if (gallery) return gallery;
  const slug = slugFromId(id);
  return slug ? getTabbiedFamily(slug) : null;
}

export const DEFAULT_ID = families[0].variants[0].id;
