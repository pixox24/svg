import {
  radius,
  blossom,
  bauhaus,
  windowpane,
  mixtape,
  odessa,
  veil,
  disque,
  cascade,
  annulus,
  battlement,
  bokeh
} from 'tabbied/patterns';
import {
  buildDoodleSource,
  expandPalette,
  randomSeed,
  supportsSvgExport
} from 'tabbied';
import { stageFromBg } from './lib/rng.js';

const PRESETS = [
  radius,
  blossom,
  bauhaus,
  windowpane,
  mixtape,
  odessa,
  veil,
  disque,
  cascade,
  annulus,
  battlement,
  bokeh
];

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

function tagsFor(definition) {
  const tags = ['pattern'];
  const organic = ['petals', 'leaves', 'scallops', 'waves', 'organic'];
  if ((definition.tags || []).some((tag) => organic.includes(tag)) || (definition.mood || []).includes('organic')) {
    tags.push('organic');
  }
  if (definition.slug === 'bauhaus') tags.push('mark');
  return tags;
}

function wrap(definition) {
  const params = defaultParams(definition);
  const schema = [
    { key: 'palette', type: 'palette', label: 'Palette' },
    ...definition.options.map(optionField)
  ];
  const family = {
    kind: 'tabbied',
    id: `tabbied-${definition.slug}`,
    label: definition.name,
    blurb: (definition.description && definition.description.length > 40
      ? definition.description
      : ((definition.tags || []).slice(0, 3).join(' · '))) || 'A Tabbied cell pattern.',
    tags: tagsFor(definition),
    definition,
    schema,
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
        id: `tabbied-${definition.slug}`,
        name: definition.name,
        params,
        stage: stageFromBg(params.palette[0]),
        preview: `/thumbs/tabbied-${definition.slug}.webp`
      }
    ]
  };
  family.variants[0].code = family.compile(params);
  family.variants[0].stage = stageFromBg(params.palette[0]);
  return family;
}

export const tabbiedFamilies = PRESETS.map(wrap);
