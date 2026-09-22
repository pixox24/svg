import { randomSeed, stageFromBg, evenCells, mulberry32 } from './lib/rng.js';
import { markDoodle, markPaint } from './lib/marks.js';

function read(input) {
  let temp = input.replace(/^\n+/g, '');
  let len = temp.length - temp.replace(/^\s+/g, '').length;
  return input.split('\n').map((n) => (
    n.replace(new RegExp(`^\\s{${len}}`, 'g'), '')
  )).join('\n').trim();
}

const INK = '#101216';
const PAPER = '#f2eee6';
const MARK_STROKE_REF = 0.55;

export const marks = {
  schema: [
    { key: 'icon', type: 'icon', label: 'Icon' },
    { key: 'colors', type: 'palette', label: 'Palette', max: 4 },
    { key: 'bg', type: 'color', label: 'Ground' },
    { key: 'grid', type: 'range', label: 'Density', min: 3, max: 16, step: 1 },
    { key: 'frequency', type: 'range', label: 'Frequency', min: 0.05, max: 1, step: 0.05 },
    { key: 'sizeMin', type: 'range', label: 'Min scale', min: 0.18, max: 1.2, step: 0.01 },
    { key: 'sizeMax', type: 'range', label: 'Max scale', min: 0.18, max: 1.2, step: 0.01 },
    { key: 'opacity', type: 'range', label: 'Opacity', min: 0.35, max: 1, step: 0.01 },
    { key: 'strokeWidth', type: 'range', label: 'Stroke', min: 0.6, max: 4, step: 0.1, showIf: (p) => markPaint(p.icon) !== 'fill' },
    { key: 'fill', type: 'toggle', label: 'Fill', showIf: (p) => markPaint(p.icon) !== 'fill' },
    { key: 'turn', type: 'toggle', label: 'Turn' },
    { key: 'motion', type: 'toggle', label: 'Motion' },
    { key: 'speed', type: 'range', label: 'Speed', min: 0.8, max: 4, step: 0.1, showIf: (p) => p.motion }
  ],
  compile(p) {
    const n = p.grid;
    const sizeMin = p.sizeMin ?? 0.55;
    const sizeMax = p.sizeMax ?? 0.55;
    const lo = Math.min(sizeMin, sizeMax);
    const hi = Math.max(sizeMin, sizeMax);
    const pad = Math.max(0.72, hi * 0.72);
    const min = 1 - pad;
    const span = (n - 1) + pad * 2;
    const freq = p.frequency ?? 1;
    const opacity = p.opacity ?? 1;
    const icon = markDoodle(p.icon);
    const filled = markPaint(p.icon) === 'fill';
    const colors = p.colors && p.colors.length ? p.colors : [INK];
    const cells = evenCells(n, freq, p.seed);
    const seed = Number(p.seed) || 1;
    const anim = p.motion ? `style animation: mark-fade ${p.speed ?? 2}s reverse;` : '';
    const uses = cells.map(([x, y]) => {
      const jitter = 0.5 + 0.5 * Math.sin(x * 1.31 + y * 2.63 + seed * 0.00037);
      const size = lo + (hi - lo) * jitter;
      const scale = +(size / 24).toFixed(5);
      const rand = mulberry32((seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b)) >>> 0);
      const color = colors[Math.floor(rand() * colors.length)] || colors[0];
      const turn = p.turn
        ? ` rotate(${90 * Math.floor(4 * (0.5 + 0.5 * Math.sin(x * 2.11 + y * 1.73 + seed * 0.00021)))})`
        : '';
      const paint = filled
        ? `fill: ${color}; stroke: none;`
        : `stroke: ${color}; stroke-width: ${+(p.strokeWidth * MARK_STROKE_REF / size).toFixed(3)};${p.fill ? ` fill: ${color};` : ''}`;
      return `use {
          href: #mark;
          transform: translate(${x}, ${y})${turn} scale(${scale}) translate(-12, -12);
          opacity: ${opacity};
          ${paint}
          ${anim}
        }`;
    }).join('\n        ');
    const keyframes = p.motion ? `style { @keyframes mark-fade { to { opacity: 0 } } }` : '';
    return read(`
      svg {
        viewBox: ${min} ${min} ${span} ${span};
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        rect {
          x: ${min}; y: ${min};
          width: ${span}; height: ${span};
          fill: ${p.bg};
        }
        defs {
          g { id: mark; ${icon} }
        }
        ${uses}
        ${keyframes}
      }
    `);
  },
  shuffle(p) {
    return { ...p, seed: randomSeed() };
  }
};

export const crystal = {
  schema: [
    { key: 'color', type: 'color', label: 'Line' },
    { key: 'dot', type: 'color', label: 'Core' },
    { key: 'bg', type: 'color', label: 'Ground' },
    { key: 'arms', type: 'range', label: 'Arms', min: 4, max: 16, step: 1 },
    { key: 'strokeWidth', type: 'range', label: 'Weight', min: 0.4, max: 3, step: 0.05 },
    { key: 'armLen', type: 'range', label: 'Reach', min: 28, max: 48, step: 1 },
    { key: 'dotR', type: 'range', label: 'Core size', min: 0, max: 6, step: 0.1 }
  ],
  compile(p) {
    const step = 360 / p.arms;
    const ink = stageFromBg(p.bg) === 'ink';
    const ground = ink
      ? `rect { x, y: -58; width, height: 116; fill: ${p.bg}; }`
      : '';
    const core = p.dotR > 0
      ? `circle { r: ${p.dotR}; fill: ${p.dot}; }`
      : '';
    return read(`
      svg {
        viewBox: -58 -58 116 116;
        ${ground}
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke: ${p.color};
        stroke-width: ${p.strokeWidth};
        path*${p.arms} {
          transform: rotate(@n(*${step}));
          d: M 0 0 0 ${p.armLen}
             @M2x3(M 0 @ny(* -9)
                   L @pn(±8) $(-10*@ny - 5.8));
        }
        ${core}
      }
    `);
  },
  shuffle(p) {
    const palettes = [
      { color: '#161412', dot: '#161412', bg: PAPER },
      { color: '#e08a3c', dot: '#f2c14e', bg: INK },
      { color: '#111111', dot: '#111111', bg: PAPER },
      { color: '#5eead4', dot: '#5eead4', bg: INK },
      { color: '#c9a46c', dot: '#e8d5a3', bg: INK },
      { color: '#c43c6e', dot: '#e2b44c', bg: PAPER }
    ];
    const pick = palettes[Math.floor(Math.random() * palettes.length)];
    return {
      ...p,
      ...pick,
      arms: 4 + Math.floor(Math.random() * 13),
      strokeWidth: +(0.5 + Math.random() * 2).toFixed(2)
    };
  }
};

export const textile = {
  schema: [
    { key: 'bg', type: 'color', label: 'Ground' },
    { key: 'stroke', type: 'color', label: 'Thread' },
    { key: 'tile', type: 'range', label: 'Scale', min: 6, max: 22, step: 1 },
    { key: 'rotate', type: 'range', label: 'Rotate', min: 0, max: 90, step: 1 },
    { key: 'strokeWidth', type: 'range', label: 'Weight', min: 0.4, max: 2.2, step: 0.1 },
    { key: 'draw', type: 'range', label: 'Draw', min: 0, max: 6, step: 0.2 }
  ],
  compile(p) {
    const draw = p.draw > 0 ? `draw: ${p.draw}s;` : '';
    return read(`
      svg {
        viewBox: 0 0 1 1;
        preserveAspectRatio: xMidYMid slice;
        rect {
          width, height: 100%;
          fill: ${p.bg};
        }
        rect {
          width, height: 100%;
          fill: defs pattern {
            viewBox: 0 0 14 14;
            patternTransform: rotate(${p.rotate});
            width, height: ${p.tile}%;
            path {
              fill: none;
              stroke-linecap: square;
              stroke: ${p.stroke};
              stroke-width: ${p.strokeWidth};
              ${draw}
              d: M 4 5
                 @p(@p(h -1 v -2 h 3 v 4 h -5 v -6 h 6)
                    @flipv.reverse.p)
                 M 4 9 @flipv.p
            }
          }
        }
      }
    `);
  },
  shuffle(p) {
    const pairs = [
      { bg: '#f3efe6', stroke: '#1b2d37' },
      { bg: INK, stroke: '#e8e0d4' },
      { bg: '#10211a', stroke: '#e2b87a' },
      { bg: '#071018', stroke: '#7dd3c0' },
      { bg: '#1a1612', stroke: '#c9a46c' },
      { bg: '#f6ead9', stroke: '#e07a5f' }
    ];
    const pick = pairs[Math.floor(Math.random() * pairs.length)];
    return {
      ...p,
      ...pick,
      tile: 8 + Math.floor(Math.random() * 12),
      rotate: [0, 15, 30, 45, 60][Math.floor(Math.random() * 5)]
    };
  }
};

export const pebble = {
  schema: [
    { key: 'stripeA', type: 'color', label: 'Stripe A' },
    { key: 'stripeB', type: 'color', label: 'Stripe B' },
    { key: 'stoneA', type: 'color', label: 'Stone A' },
    { key: 'stoneB', type: 'color', label: 'Stone B' },
    { key: 'stoneC', type: 'color', label: 'Stone C' },
    { key: 'tile', type: 'range', label: 'Scale', min: 14, max: 40, step: 1 },
    { key: 'rotate', type: 'range', label: 'Rotate', min: -90, max: 90, step: 1 }
  ],
  compile(p) {
    return read(`
      svg {
        --color: ${p.stripeA}, ${p.stripeB};
        --color2: ${p.stoneA}, ${p.stoneB}, ${p.stoneC};
        viewBox: 0 0 1 1;
        preserveAspectRatio: xMidYMid slice;
        rect {
          width, height: 100%;
          fill: defs pattern {
            viewBox: 0 0 8 8;
            patternTransform: rotate(${p.rotate});
            width, height: ${p.tile}%;
            rect*4 {
              fill: @pn(--color);
              x, y: 0 @pn(0, 2, 6, 4);
              width, height: 8 2;
            }
            circle*4 {
              r: 1.25;
              cx, cy: @pn(2 2, 6 2, 6 6, 2 6);
              fill: @pnr(--color);
              stroke-width: 1.5;
              stroke: defs @radialGradient(
                @pnr(--color2) .99,
                @pn(--color) 0
              );
            }
          }
        }
      }
    `);
  },
  shuffle(p) {
    const sets = [
      { stripeA: '#f5f0e1', stripeB: '#ff6e40', stoneA: '#1e3d59', stoneB: '#ffc13b', stoneC: '#ffcce7' },
      { stripeA: '#efeae1', stripeB: '#2b3038', stoneA: '#1a1d22', stoneB: '#8a8680', stoneC: '#d9d3c7' },
      { stripeA: '#f6ead9', stripeB: '#e07a5f', stoneA: '#3d405b', stoneB: '#f2cc8f', stoneC: '#f4acb7' },
      { stripeA: '#121826', stripeB: '#c9a46c', stoneA: '#0b1020', stoneB: '#7c9cff', stoneC: '#e8d5a3' },
      { stripeA: '#10211a', stripeB: '#e2b87a', stoneA: '#071018', stoneB: '#7dd3c0', stoneC: '#f3efe6' }
    ];
    return { ...p, ...sets[Math.floor(Math.random() * sets.length)] };
  }
};

export const spiral = {
  schema: [
    { key: 'hue', type: 'range', label: 'Hue', min: 0, max: 360, step: 1 },
    { key: 'spread', type: 'range', label: 'Spread', min: 0, max: 120, step: 1 },
    { key: 'sat', type: 'range', label: 'Saturation', min: 0, max: 100, step: 1 },
    { key: 'light', type: 'range', label: 'Light', min: 20, max: 70, step: 1 },
    { key: 'count', type: 'range', label: 'Seeds', min: 120, max: 420, step: 10 },
    { key: 'bg', type: 'color', label: 'Ground' }
  ],
  compile(p) {
    const ink = stageFromBg(p.bg) === 'ink';
    const ground = ink
      ? `rect { x, y: -50; width, height: 100; fill: ${p.bg}; }`
      : '';
    return read(`
      svg {
        viewBox: -50 -50 100 100;
        ${ground}
        circle*${p.count} {
          fill: hsl($(${p.hue}+${p.spread}*@sin.n), ${p.sat}%, ${p.light}%);
          r: @sqrt(@n/60);
          cx: $(@n*.618^4 * cos(2π*@n*.618));
          cy: $(@n*.618^4 * sin(2π*@n*.618));
        }
      }
    `);
  },
  shuffle(p) {
    return {
      ...p,
      hue: Math.floor(Math.random() * 360),
      spread: 20 + Math.floor(Math.random() * 90),
      sat: 40 + Math.floor(Math.random() * 50),
      count: 180 + Math.floor(Math.random() * 20) * 10
    };
  }
};

export const orb = {
  schema: [
    { key: 'colorA', type: 'color', label: 'Light' },
    { key: 'colorB', type: 'color', label: 'Shadow' },
    { key: 'bg', type: 'color', label: 'Ground' }
  ],
  compile(p) {
    const ink = stageFromBg(p.bg) === 'ink';
    const ground = ink
      ? `rect { x, y: -5; width, height: 10; fill: ${p.bg}; }`
      : '';
    return read(`
      svg {
        --color-a: ${p.colorA};
        --color-b: ${p.colorB};
        viewBox: -5 -5 10 10;
        ${ground}
        g {
          mask: defs mask {
            circle { r: 3; fill: #fff }
          }
          circle {
            r: 3;
            fill: @p(--color-a);
          }
          g {
            filter: defs filter {
              feTurbulence {
                type: fractalNoise;
                baseFrequency: 100;
              }
              feDisplacementMap {
                in: SourceGraphic;
                scale: 3;
              }
            }
            circle {
              cx, cy: 4;
              r: 6;
              fill: @p(--color-b);
              filter: defs filter {
                feGaussianBlur { stdDeviation: .7 }
              }
            }
          }
        }
        g {
          transform: rotate(-20);
          circle*50 {
            r: @r(.1);
            fill: @p(--color-a, --color-b);
            cx, cy: @Plot(
              turn: .774;
              scale: 3 1.3;
              rotate: 227;
              move: 0 .6;
              r: 1.5;
            )
          }
        }
        g {
          mask: defs mask {
            circle {
              r: .85;
              cx, cy: 2;
              fill: #fff;
            }
          }
          circle {
            r: 8;
            fill: @p(--color-b);
          }
          g {
            filter: defs filter {
              feTurbulence {
                type: fractalNoise;
                baseFrequency: 100;
              }
              feDisplacementMap {
                in: SourceGraphic;
                scale: 1;
              }
            }
            circle {
              cx, cy: 1;
              r: 1.5;
              fill: @p(--color-a);
              filter: defs filter {
                feGaussianBlur { stdDeviation: .2 }
              }
            }
          }
        }
      }
    `);
  },
  shuffle(p) {
    const pairs = [
      { colorA: '#ffc0cb', colorB: '#322EA2', bg: PAPER },
      { colorA: '#8ec5d4', colorB: '#1c4a3a', bg: INK },
      { colorA: '#1a1612', colorB: '#e2b87a', bg: INK },
      { colorA: '#f0d5a0', colorB: '#b85c38', bg: INK },
      { colorA: '#ead3cf', colorB: '#5346b8', bg: PAPER },
      { colorA: '#5eead4', colorB: '#071018', bg: INK }
    ];
    return { ...p, ...pairs[Math.floor(Math.random() * pairs.length)] };
  }
};

export const halo = {
  schema: [
    { key: 'c1', type: 'color', label: 'Stop 1' },
    { key: 'c2', type: 'color', label: 'Stop 2' },
    { key: 'c3', type: 'color', label: 'Stop 3' },
    { key: 'c4', type: 'color', label: 'Stop 4' },
    { key: 'count', type: 'range', label: 'Rings', min: 36, max: 120, step: 2 },
    { key: 'turn', type: 'range', label: 'Twist', min: 120, max: 280, step: 2 },
    { key: 'bg', type: 'color', label: 'Ground' }
  ],
  compile(p) {
    const ink = stageFromBg(p.bg) === 'ink';
    const ground = ink
      ? `rect { x, y: -5; width, height: 10; fill: ${p.bg}; }`
      : '';
    return read(`
      svg {
        viewBox: -5 -5 10 10;
        ${ground}
        ellipse*${p.count} {
          fill: none;
          rx, ry: 4 @nN(ease-out, *4);
          transform: rotate(-@nN(ease-out, *${p.turn}));
          stroke: @linearGradient(
            ${p.c1}, ${p.c2}, ${p.c3}, ${p.c4}
          );
        }
      }
    `);
  },
  shuffle(p) {
    const sets = [
      { c1: '#fff', c2: '#f9a828', c3: '#07617d', c4: '#2e383f', bg: PAPER },
      { c1: '#04160f', c2: '#34d399', c3: '#60a5fa', c4: '#c4b5fd', bg: INK },
      { c1: '#2a2118', c2: '#e2b87a', c3: '#8a5a2b', c4: '#f3efe6', bg: INK },
      { c1: '#ffffff', c2: '#d9d3c7', c3: '#8a8680', c4: '#3a3835', bg: PAPER },
      { c1: '#140e0c', c2: '#e08a3c', c3: '#c43c6e', c4: '#f2c14e', bg: INK }
    ];
    return {
      ...p,
      ...sets[Math.floor(Math.random() * sets.length)],
      count: 40 + Math.floor(Math.random() * 40) * 2,
      turn: 160 + Math.floor(Math.random() * 50) * 2
    };
  }
};

export const tide = {
  schema: [
    { key: 'stroke', type: 'color', label: 'Line' },
    { key: 'fill', type: 'color', label: 'Fill' },
    { key: 'bg', type: 'color', label: 'Ground' },
    { key: 'samples', type: 'range', label: 'Samples', min: 120, max: 800, step: 20 },
    { key: 'strokeWidth', type: 'range', label: 'Weight', min: 0.04, max: 0.3, step: 0.01 },
    { key: 'amp', type: 'range', label: 'Amplitude', min: 2, max: 12, step: 0.2 },
    { key: 'f1', type: 'range', label: 'Wave A', min: 2, max: 10, step: 1 },
    { key: 'f2', type: 'range', label: 'Wave B', min: 6, max: 20, step: 1 }
  ],
  compile(p) {
    const ink = stageFromBg(p.bg) === 'ink';
    const ground = ink
      ? `rect { x, y: -58; width, height: 114; fill: ${p.bg}; }`
      : '';
    const fill = p.fill === 'none' ? 'none' : p.fill;
    return read(`
      svg {
        viewBox: -58 -57 114 114;
        ${ground}
        stroke-width: ${p.strokeWidth};
        stroke: ${p.stroke};
        fill: ${fill};
        circle*${p.samples} {
          r: $(sin(π/@N*@n)*${p.amp});
          cx, cy: @Plot(
            r: 38+sin(${p.f1}t)*6+sin(${p.f2}t)*4
          );
        }
      }
    `);
  },
  shuffle(p) {
    const sets = [
      { stroke: '#1B2D37', fill: '#d7e7ee', bg: PAPER },
      { stroke: '#7dd3c0', fill: '#0b1c28', bg: INK },
      { stroke: '#4ade80', fill: 'none', bg: INK },
      { stroke: '#b76e79', fill: '#f6eae4', bg: PAPER },
      { stroke: '#e2b87a', fill: 'none', bg: INK }
    ];
    return {
      ...p,
      ...sets[Math.floor(Math.random() * sets.length)],
      samples: 200 + Math.floor(Math.random() * 25) * 20,
      f1: 2 + Math.floor(Math.random() * 8),
      f2: 8 + Math.floor(Math.random() * 12)
    };
  }
};

export const systems = {
  marks,
  crystal,
  textile,
  pebble,
  spiral,
  orb,
  halo,
  tide
};
