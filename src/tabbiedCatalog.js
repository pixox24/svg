import catalogJson from 'tabbied/catalog.json';
import {
  buildDoodleSource,
  expandPalette,
  randomSeed,
  supportsSvgExport
} from 'tabbied';
import { stageFromBg } from './lib/rng.js';

const catalog = catalogJson.default || catalogJson;
export const TABBIED_CATALOG = catalog.designs;
export const TABBIED_COUNT = catalog.count || catalog.designs.length;
export const TABBIED_MOODS = ['bold', 'playful', 'retro', 'calm', 'festive', 'technical', 'elegant', 'organic'];
export const TABBIED_DENSITIES = ['sparse', 'medium', 'dense'];

const cache = new Map();
let patternsModule;

export function tabbiedId(slug) {
  return `tabbied-${slug}`;
}

export function slugFromId(id) {
  return id && id.startsWith('tabbied-') ? id.slice('tabbied-'.length) : null;
}

export function previewUrl(slug) {
  return `https://tabbied.com/previews/${slug}.webp`;
}

export function catalogEntry(slug) {
  return TABBIED_CATALOG.find((item) => item.slug === slug) || null;
}

export function getTabbiedFamily(slug) {
  return cache.get(slug) || null;
}

export function warmupPatterns() {
  if (patternsModule) return Promise.resolve(patternsModule);
  return import('tabbied/patterns').then((mod) => {
    patternsModule = mod;
    return mod;
  });
}

export async function loadTabbiedFamily(slug) {
  const hit = cache.get(slug);
  if (hit) return hit;
  if (!patternsModule) {
    patternsModule = await warmupPatterns();
  }
  const definition = patternsModule.patterns?.[slug] || patternsModule[slug];
  if (!definition) {
    throw new Error(`Unknown Tabbied pattern: ${slug}`);
  }
  const family = wrap(definition);
  cache.set(slug, family);
  return family;
}

function optionField(option) {
  if (option.type === 'Slider') {
    return {
      key: option.id,
      type: 'range',
      label: option.displayName,
      min: option.min,
      max: option.max,
      step: option.step
    };
  }
  if (option.type === 'ToggleSwitch') {
    return {
      key: option.id,
      type: 'toggle',
      label: option.displayName
    };
  }
  return {
    key: option.id,
    type: 'select',
    label: option.displayName,
    options: option.options || []
  };
}

function defaultParams(definition) {
  const count = definition.colors?.default ?? definition.palette.length;
  const params = {
    palette: definition.palette.slice(0, count),
    seed: 'Play'
  };
  for (const option of definition.options) {
    params[option.id] = option.default;
  }
  return params;
}

function wrap(definition) {
  const params = defaultParams(definition);
  const family = {
    kind: 'tabbied',
    id: tabbiedId(definition.slug),
    label: definition.name,
    blurb: definition.description || ((definition.tags || []).slice(0, 3).join(' · ')) || 'A Tabbied cell pattern.',
    tags: ['pattern'],
    definition,
    schema: [
      { key: 'palette', type: 'palette', label: 'Palette' },
      ...definition.options.map(optionField)
    ],
    svgExport: supportsSvgExport(definition),
    svgExportNote: definition.svgExportNote || '',
    compile(current) {
      const total = definition.colors?.max ?? current.palette.length;
      const { styleCode, doodleCode } = buildDoodleSource({
        code: definition.code,
        options: definition.options,
        palette: expandPalette(current.palette, total),
        optionValues: definition.options.map((option) => current[option.id] ?? option.default),
        width: 800,
        height: 800
      });
      return `${styleCode.trim()}\n\n${doodleCode.trim()}`;
    },
    shuffle(current) {
      return { ...current, seed: randomSeed() };
    },
    variants: [
      {
        id: tabbiedId(definition.slug),
        name: definition.name,
        params,
        stage: stageFromBg(params.palette[0]),
        preview: previewUrl(definition.slug)
      }
    ]
  };
  family.variants[0].code = family.compile(params);
  return family;
}
