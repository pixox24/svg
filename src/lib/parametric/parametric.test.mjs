/**
 * Parametric engine unit tests. Node built-ins only:
 *   node --test src/lib/parametric/parametric.test.mjs
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { hash2, noise2, fbm, mulberry32 } from './hash.js';
import { resolve, LATTICES } from './lattice.js';
import { evaluate, MODULATORS, AXES } from './modulator.js';
import { build, sizeAt, SHAPES } from './primitive.js';
import { apply, TOPOLOGIES } from './topology.js';
import { compose, canvasSize, ASPECTS } from './compose.js';
import {
  generate,
  selfCheck,
  normalize,
  defaults,
  randomize,
  encodeParams,
  decodeParams,
  PRESETS,
  DEFAULTS,
} from './index.js';

const CELL_KEYS = ['x', 'y', 'u', 'v', 'r', 'theta', 'i', 'j', 'n', 'unit'];

function cell(over = {}) {
  return {
    x: 120,
    y: 240,
    u: 0.25,
    v: 0.62,
    cu: -0.5,
    cv: 0.24,
    r: 0.42,
    theta: 1.15,
    i: 2,
    j: 4,
    n: 18,
    unit: 40,
    ...over,
  };
}

function gridParams(over = {}) {
  return {
    ...defaults(),
    'lattice.type': 'grid',
    'lattice.cols': 8,
    'lattice.rows': 8,
    'lattice.gap': 0.2,
    'modulator.type': 'none',
    'modulator.bias': 0.6,
    'modulator.invert': false,
    'shape.type': 'dot',
    'shape.sizeMin': 12,
    'shape.sizeMax': 28,
    'shape.scaleToUnit': false,
    'shape.stroke': false,
    'shape.strokeWidth': 4,
    'topology.mode': 'isolated',
    'topology.jitter': 0,
    'topology.warp': 0,
    'topology.density': 0.6,
    'modulator.seed': 11,
    ...over,
  };
}

describe('hash', () => {
  test('hash2 is deterministic', () => {
    const samples = [
      [0, 0, 0],
      [1, 2, 3],
      [99, 17, 4821],
      [-4, 8, 12],
      [1000, -20, 99999],
    ];
    for (const [x, y, seed] of samples) {
      const a = hash2(x, y, seed);
      assert.equal(a, hash2(x, y, seed));
      assert.ok(a >= 0 && a < 1, `range ${a}`);
    }
    assert.notEqual(hash2(1, 2, 3), hash2(2, 1, 3));
    assert.notEqual(hash2(1, 2, 3), hash2(1, 2, 4));
  });

  test('hash2 decile buckets stay between 5% and 15% over 10k samples', () => {
    const buckets = new Array(10).fill(0);
    const n = 10000;
    for (let i = 0; i < n; i += 1) {
      const h = hash2(i % 100, Math.floor(i / 100), 1);
      assert.ok(h >= 0 && h < 1);
      buckets[Math.min(9, Math.floor(h * 10))] += 1;
    }
    for (let b = 0; b < buckets.length; b += 1) {
      const share = buckets[b] / n;
      assert.ok(share >= 0.05 && share <= 0.15, `bucket ${b} share ${share}`);
    }
  });

  test('hash2 spreads across a 100x100 grid (imul regression)', () => {
    const uniq = new Set();
    for (let y = 0; y < 100; y += 1) {
      for (let x = 0; x < 100; x += 1) uniq.add(hash2(x, y, 0));
    }
    assert.ok(uniq.size > 900, `unique ${uniq.size}`);
  });

  test('noise2 stays inside [0,1]', () => {
    for (let i = 0; i < 2000; i += 1) {
      const x = (i % 50) * 0.37 - 8;
      const y = Math.floor(i / 50) * 0.41 - 3;
      const n = noise2(x, y, i % 13);
      assert.ok(n >= 0 && n <= 1, `noise2(${x}, ${y}) = ${n}`);
    }
  });

  test('fbm stays inside [0,1]', () => {
    for (const octaves of [1, 4, 8]) {
      for (let i = 0; i < 400; i += 1) {
        const x = (i % 20) * 0.55 - 2;
        const y = Math.floor(i / 20) * 0.47 - 1;
        const v = fbm(x, y, i % 9, octaves);
        assert.ok(v >= 0 && v <= 1, `fbm octaves ${octaves} = ${v}`);
      }
    }
  });

  test('mulberry32 repeats the same sequence for the same seed', () => {
    const take = (seed, n) => {
      const next = mulberry32(seed);
      const out = [];
      for (let i = 0; i < n; i += 1) out.push(next());
      return out;
    };
    const a = take(42, 24);
    const b = take(42, 24);
    assert.deepEqual(a, b);
    for (const v of a) assert.ok(v >= 0 && v < 1);
    assert.notDeepEqual(a, take(43, 24));
  });
});

describe('lattice', () => {
  for (const type of Object.keys(LATTICES)) {
    test(`${type} resolve() returns cells with a positive unit`, () => {
      const p = defaults();
      p['lattice.type'] = type;
      if (type === 'phyllotaxis' || type === 'spiral') p['lattice.count'] = 80;
      if (type === 'ring') {
        p['lattice.rows'] = 4;
        p['lattice.count'] = 80;
      }
      const { width, height } = canvasSize(p);
      const cells = resolve(p, width, height);
      assert.ok(Array.isArray(cells));
      assert.ok(cells.length > 0, `${type} empty`);
      for (const c of cells) {
        for (const key of CELL_KEYS) {
          assert.equal(typeof c[key], 'number', `${type}.${key}`);
          assert.ok(Number.isFinite(c[key]), `${type}.${key}=${c[key]}`);
        }
        assert.ok(c.unit > 0, `${type} unit ${c.unit}`);
      }
    });
  }

  test('lattice.gap at its maximum still keeps unit > 0', () => {
    // Schema max is 0.9. resolve() also accepts up to 1.5, where (1 - gap) is negative.
    for (const type of ['grid', 'hex', 'iso', 'oblique']) {
      for (const gap of [0.9, 1.5]) {
        const p = defaults();
        p['lattice.type'] = type;
        p['lattice.cols'] = 8;
        p['lattice.rows'] = 8;
        p['lattice.gap'] = gap;
        p['lattice.skew'] = 20;
        const cells = resolve(p, 1000, 1000);
        assert.ok(cells.length > 0, `${type} gap ${gap} produced no cells`);
        for (const c of cells) {
          assert.ok(c.unit > 0, `${type} gap ${gap} unit ${c.unit}`);
        }
      }
    }
  });

  test('phyllotaxis divergence 137.5 emits exactly count points', () => {
    const p = defaults();
    p['lattice.type'] = 'phyllotaxis';
    p['lattice.count'] = 320;
    p['lattice.divergence'] = 137.5;
    const cells = resolve(p, 1000, 1000);
    assert.equal(cells.length, 320);
  });
});

describe('modulator', () => {
  for (const type of MODULATORS) {
    test(`${type} stays inside [0,1]`, () => {
      assert.equal(MODULATORS.length, 7);
      const p = defaults();
      p['modulator.type'] = type;
      p['modulator.freq'] = 3.2;
      p['modulator.amp'] = 1.7;
      p['modulator.phase'] = 0.35;
      p['modulator.bias'] = 0.15;
      p['modulator.invert'] = false;
      p['modulator.seed'] = 19;
      for (const axis of AXES) {
        p['modulator.axis'] = axis;
        for (let i = 0; i < 12; i += 1) {
          const c = cell({
            u: i / 11,
            v: ((i * 5) % 11) / 11,
            r: (i % 10) / 9,
            theta: i * 0.7,
            n: i * 13,
            i,
            j: (i * 3) % 7,
          });
          const m = evaluate(c, p);
          assert.ok(m >= 0 && m <= 1, `${type}/${axis} m=${m}`);
        }
      }
    });
  }

  test('invert is the complement of the uninverted value', () => {
    const c = cell();
    for (const type of MODULATORS) {
      for (const axis of AXES) {
        const p = defaults();
        p['modulator.type'] = type;
        p['modulator.axis'] = axis;
        p['modulator.freq'] = 2.4;
        p['modulator.amp'] = 1.3;
        p['modulator.phase'] = 0.2;
        p['modulator.bias'] = 0.4;
        p['modulator.seed'] = 8;
        p['modulator.invert'] = false;
        const plain = evaluate(c, p);
        const flipped = evaluate(c, { ...p, 'modulator.invert': true });
        assert.equal(flipped, 1 - plain, `${type}/${axis}`);
      }
    }
  });

  test('the same cell and params evaluate twice to the same value', () => {
    const c = cell({ u: 0.37, v: 0.81, r: 0.55, theta: 2.2, n: 40 });
    for (const type of MODULATORS) {
      const p = defaults();
      p['modulator.type'] = type;
      p['modulator.axis'] = 'diag';
      p['modulator.freq'] = 1.8;
      p['modulator.amp'] = 0.9;
      p['modulator.bias'] = 0.33;
      p['modulator.seed'] = 1234;
      assert.equal(evaluate(c, p), evaluate(c, p), type);
    }
  });

  test('noise seeds above 9999 do not collapse to one value', () => {
    const c = cell();
    const p = defaults();
    p['modulator.type'] = 'noise';
    p['modulator.freq'] = 2;
    p['modulator.amp'] = 1;
    p['modulator.bias'] = 0.5;
    const a = evaluate(c, { ...p, 'modulator.seed': 12000 });
    const b = evaluate(c, { ...p, 'modulator.seed': 48000 });
    const again = evaluate(c, { ...p, 'modulator.seed': 12000 });
    assert.equal(a, again);
    assert.notEqual(a, b);
  });
});

describe('primitive', () => {
  for (const shape of SHAPES) {
    test(`${shape} emits a non-empty SVG fragment`, () => {
      assert.equal(SHAPES.length, 8);
      const p = defaults();
      p['shape.type'] = shape;
      p['shape.sizeMin'] = 18;
      p['shape.sizeMax'] = 36;
      p['shape.scaleToUnit'] = false;
      p['shape.aspect'] = 1.6;
      p['shape.aspectMode'] = 'fixed';
      p['shape.corner'] = 0.4;
      p['shape.sides'] = 5;
      p['shape.curvature'] = 0.3;
      p['shape.sweep'] = 0.7;
      p['shape.rotation'] = 20;
      p['shape.rotMode'] = 'none';
      p['shape.strokeWidth'] = 3;
      const frag = build(cell(), 0.7, p, 1);
      assert.equal(typeof frag, 'string');
      assert.ok(frag.length > 0, shape);
      assert.ok(frag.startsWith('<'), frag);
    });
  }

  test('size 0 returns an empty string for every shape', () => {
    const p = defaults();
    p['shape.sizeMin'] = 0;
    p['shape.sizeMax'] = 0;
    p['shape.strokeWidth'] = 4;
    for (const shape of SHAPES) {
      p['shape.type'] = shape;
      assert.equal(build(cell(), 1, p, 1), '', shape);
    }
  });

  test('sizeAt is pixels unless scaleToUnit, where 100 is one cell', () => {
    const c = cell({ unit: 40 });
    const pixels = defaults();
    pixels['shape.sizeMin'] = 10;
    pixels['shape.sizeMax'] = 30;
    pixels['shape.scaleToUnit'] = false;
    assert.equal(sizeAt(0, pixels, c), 10);
    assert.equal(sizeAt(1, pixels, c), 30);
    assert.equal(sizeAt(0.5, pixels, c), 20);

    const scaled = defaults();
    scaled['shape.sizeMin'] = 100;
    scaled['shape.sizeMax'] = 100;
    scaled['shape.scaleToUnit'] = true;
    assert.equal(sizeAt(0, scaled, c), 40);
    assert.equal(sizeAt(1, scaled, c), 40);

    scaled['shape.sizeMin'] = 0;
    scaled['shape.sizeMax'] = 100;
    assert.equal(sizeAt(0.5, scaled, c), 20);
  });
});

describe('topology', () => {
  const params = gridParams();
  const cells = resolve(params, 1000, 1000);

  for (const mode of TOPOLOGIES) {
    test(`${mode} returns an array`, () => {
      assert.equal(TOPOLOGIES.length, 5);
      const out = apply(cells, { ...params, 'topology.mode': mode, 'topology.density': 0.75 }, {});
      assert.ok(Array.isArray(out), mode);
    });
  }

  test('isolated element count equals the number of valid cells', () => {
    const p = gridParams({ 'topology.mode': 'isolated' });
    const work = resolve(p, 1000, 1000);
    const out = apply(work, p, {});
    const valid = work.filter((c) => {
      const m = evaluate(c, p);
      return sizeAt(m, p, c) > 0.05;
    });
    assert.ok(valid.length > 0);
    assert.equal(valid.length, work.length);
    assert.equal(out.length, valid.length);
  });

  for (const mode of ['truchet', 'maze']) {
    test(`${mode} does not lose elements as density rises`, () => {
      let prev = -1;
      for (const density of [0, 0.25, 0.5, 0.75, 1]) {
        const p = gridParams({
          'topology.mode': mode,
          'topology.density': density,
          'shape.sizeMin': 30,
          'shape.sizeMax': 30,
          'shape.strokeWidth': 6,
          'modulator.seed': 7,
        });
        const n = apply(cells, p, {}).length;
        assert.ok(n >= prev, `${mode} density ${density}: ${n} < ${prev}`);
        prev = n;
      }
    });
  }

  test('maze follows the seed, including seeds above 9999', () => {
    const svg = (seed) => apply(cells, gridParams({
      'topology.mode': 'maze',
      'topology.density': 0.8,
      'modulator.seed': seed,
      'shape.strokeWidth': 5,
    }), {}).join('\n');
    assert.equal(svg(11), svg(11));
    assert.notEqual(svg(11), svg(29));
    assert.notEqual(svg(12000), svg(48000));
  });

  test('halftone levels follow topology.halftoneLevels', () => {
    const p = gridParams({
      'lattice.cols': 6,
      'lattice.rows': 4,
      'modulator.type': 'linear',
      'modulator.axis': 'x',
      'modulator.amp': 1,
      'modulator.bias': 0.5,
      'shape.type': 'dot',
      'shape.sizeMin': 2,
      'shape.sizeMax': 40,
      'topology.mode': 'halftone',
    });
    const work = resolve(p, 1000, 1000);
    const low = apply(work, { ...p, 'topology.halftoneLevels': 0 }, {}).join('');
    const high = apply(work, { ...p, 'topology.halftoneLevels': 1 }, {}).join('');
    assert.notEqual(low, high);
    assert.ok(low.length > 0 && high.length > 0);
  });
});

describe('compose', () => {
  test('document has an svg root, xmlns, and viewBox', () => {
    const p = defaults();
    p['canvas.aspect'] = 'portrait';
    const [w, h] = ASPECTS.portrait;
    const svg = compose(['<circle cx="10" cy="10" r="4"/>'], p);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes(`viewBox="0 0 ${w} ${h}"`));
  });

  test('invert swaps background and foreground', () => {
    const p = defaults();
    p.palette = ['#112233', '#abcdef', ''];
    p.bg = '#112233';
    p.invert = false;
    p['shape.stroke'] = false;
    p['topology.mode'] = 'isolated';
    const plain = compose(['<circle cx="10" cy="10" r="4"/>'], p);
    const flipped = compose(['<circle cx="10" cy="10" r="4"/>'], { ...p, invert: true });
    const bgOf = (svg) => svg.match(/<rect[^>]*fill="([^"]+)"/)[1];
    const inkOf = (svg) => svg.match(/<g [^>]*fill="([^"]+)"/)[1];
    assert.equal(bgOf(plain), '#112233');
    assert.equal(inkOf(plain), '#abcdef');
    assert.equal(bgOf(flipped), '#abcdef');
    assert.equal(inkOf(flipped), '#112233');
  });
});

describe('index', () => {
  test('selfCheck passes', () => {
    const check = selfCheck();
    assert.equal(check.ok, true, JSON.stringify(check.failures));
    assert.ok(Array.isArray(check.failures));
    assert.equal(check.failures.length, 0);
  });

  test('there are 14 presets', () => {
    assert.equal(PRESETS.length, 14);
  });

  for (const preset of PRESETS) {
    test(`preset ${preset.id} renders with no warnings`, () => {
      const r = generate(preset.params);
      assert.ok(r.svg.startsWith('<svg'));
      assert.ok(r.stats.elements > 8, `${preset.id} elements ${r.stats.elements}`);
      assert.equal(r.warnings.length, 0, `${preset.id}: ${r.warnings.join('; ')}`);
    });
  }

  test('normalize repairs out-of-range numbers, unknown enums, and missing fields', () => {
    const p = normalize({
      'lattice.cols': 1000,
      'lattice.rows': -20,
      'lattice.gap': 5,
      'lattice.type': 'triangular',
      'modulator.type': 'wave',
      'modulator.amp': -4,
      'modulator.freq': 99,
      'modulator.seed': 'nope',
      'shape.type': 'star',
      'shape.sizeMax': -10,
      'topology.mode': 'weave',
      'topology.density': 3,
      'canvas.aspect': 'ultrawide',
    });
    assert.equal(p['lattice.cols'], 40);
    assert.equal(p['lattice.rows'], 1);
    assert.equal(p['lattice.gap'], 0.9);
    assert.equal(p['lattice.type'], DEFAULTS['lattice.type']);
    assert.equal(p['modulator.type'], DEFAULTS['modulator.type']);
    assert.equal(p['modulator.amp'], 0);
    assert.equal(p['modulator.freq'], 8);
    assert.equal(p['modulator.seed'], DEFAULTS['modulator.seed']);
    assert.equal(p['shape.type'], DEFAULTS['shape.type']);
    assert.equal(p['shape.sizeMax'], 0);
    assert.equal(p['topology.mode'], DEFAULTS['topology.mode']);
    assert.equal(p['topology.density'], 1);
    assert.equal(p['canvas.aspect'], DEFAULTS['canvas.aspect']);
    // Fields the caller omitted are filled from the defaults.
    assert.equal(p['shape.sizeMin'], DEFAULTS['shape.sizeMin']);
    assert.equal(p['lattice.count'], DEFAULTS['lattice.count']);
    assert.equal(p['modulator.bias'], DEFAULTS['modulator.bias']);

    const themed = normalize({ palette: ['#010203', '#abcdef', ''] });
    assert.equal(themed.bg, '#010203');
    assert.equal(themed.palette[0], themed.bg);

    const blankBg = normalize({ palette: ['', '#abcdef', ''], bg: '' });
    assert.equal(typeof blankBg.bg, 'string');
    assert.ok(blankBg.bg.length > 0);
    assert.equal(blankBg.bg, blankBg.palette[0]);

    const empty = normalize(undefined);
    assert.equal(empty['lattice.type'], DEFAULTS['lattice.type']);
    assert.equal(empty.bg, empty.palette[0]);
  });

  test('randomize stays non-blank across 200 seeds', { timeout: 120000 }, () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const params = randomize(defaults(), seed);
      const r = generate(params);
      assert.ok(
        r.stats.elements >= 8,
        `seed ${seed} elements ${r.stats.elements} ${r.warnings.join('; ')}`,
      );
    }
  });

  test('encodeParams / decodeParams round-trips 20 random params', () => {
    for (let i = 0; i < 20; i += 1) {
      const params = randomize(defaults(), i * 17 + 3);
      const back = decodeParams(encodeParams(params));
      assert.equal(JSON.stringify(back), JSON.stringify(params), `seed ${i * 17 + 3}`);
    }
  });
});

describe('performance', () => {
  test('about 20000 elements generate in under 2000ms', () => {
    const p = defaults();
    p['lattice.type'] = 'cluster';
    p['lattice.cols'] = 16;
    p['lattice.rows'] = 14;
    p['lattice.clusterSize'] = 5;
    p['lattice.clusterSpread'] = 1.2;
    p['modulator.type'] = 'none';
    p['shape.type'] = 'dot';
    p['shape.sizeMin'] = 4;
    p['shape.sizeMax'] = 4;
    p['shape.scaleToUnit'] = false;
    p['topology.mode'] = 'isolated';
    p['topology.warp'] = 0;
    p['topology.jitter'] = 0;
    const t0 = performance.now();
    const r = generate(p);
    const ms = performance.now() - t0;
    assert.ok(r.stats.elements >= 20000, `elements ${r.stats.elements}`);
    assert.ok(ms < 2000, `ms ${ms}`);
  });
});
