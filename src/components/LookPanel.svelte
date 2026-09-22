<div class="look" class:paused={ejected}>
  {#if ejected}
    <div class="banner">
      <p>Sliders paused — source was edited.</p>
      <button type="button" on:click={() => dispatch('reset')}>Reset to Look</button>
    </div>
  {/if}

  <div class="toolbar">
    <button type="button" class="shuffle" disabled={ejected} on:click={() => dispatch('shuffle')}>
      Shuffle
    </button>
    {#if dirty}
      <span class="hint">Custom look</span>
    {/if}
  </div>

  <div class="fields">
    {#each visibleFields as field}
      <div class="field">
        <div class="label-row">
          <span>{field.label}</span>
          {#if field.type === 'range'}
            <span class="value">{format(params[field.key], field)}</span>
          {:else if field.type === 'seed'}
            <span class="value">{params[field.key]}</span>
          {:else if field.type === 'icon'}
            <span class="value">{iconName(params[field.key])}</span>
          {/if}
        </div>

        {#if field.type === 'palette'}
          <div class="swatches">
            {#each params[field.key] as color, index}
              <label class="swatch" title={color} style="background: {toHex(color)}">
                <input
                  type="color"
                  value={toHex(color)}
                  on:input={(e) => setColor(field.key, index, e.target.value)}
                />
              </label>
            {/each}
          </div>
        {:else if field.type === 'color'}
          <div class="color-row">
            {#if params[field.key] === 'none'}
              <button type="button" class="none-on" on:click={() => set(field.key, '#d7e7ee')}>None</button>
            {:else}
              <label class="swatch" style="background: {toHex(params[field.key])}">
                <input
                  type="color"
                  value={toHex(params[field.key])}
                  on:input={(e) => set(field.key, e.target.value)}
                />
              </label>
              {#if field.key === 'fill'}
                <button type="button" class="none" on:click={() => set(field.key, 'none')}>None</button>
              {/if}
            {/if}
          </div>
        {:else if field.type === 'select'}
          <div class="pills">
            {#each field.options as option}
              <button
                type="button"
                class="pill"
                class:on={params[field.key] === option}
                on:click={() => set(field.key, option)}
              >{option}</button>
            {/each}
          </div>
        {:else if field.type === 'range'}
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={params[field.key]}
            style="--pct: {rangePct(params[field.key], field)}"
            on:input={(e) => set(field.key, Number(e.target.value))}
          />
        {:else if field.type === 'toggle'}
          <button
            type="button"
            class="toggle"
            class:on={params[field.key]}
            on:click={() => set(field.key, !params[field.key])}
          >
            {params[field.key] ? 'On' : 'Off'}
          </button>
        {:else if field.type === 'icon'}
          <div class="icon-picker">
            <div class="icon-sets" role="group" aria-label="Icon style">
              <button
                type="button"
                class="pill"
                class:on={iconSet === 'line'}
                aria-pressed={iconSet === 'line'}
                on:click={() => pickSet('line')}
              >Line</button>
              <button
                type="button"
                class="pill"
                class:on={iconSet === 'solid'}
                aria-pressed={iconSet === 'solid'}
                on:click={() => pickSet('solid')}
              >Solid</button>
              <button
                type="button"
                class="pill"
                class:on={iconSet === 'mine'}
                aria-pressed={iconSet === 'mine'}
                on:click={() => pickSet('mine')}
              >Mine</button>
            </div>
            {#if iconSet === 'mine'}
              <label class="upload">
                Upload SVG
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  on:change={(e) => onFile(field.key, e)}
                />
              </label>
            {:else}
              <input
                type="search"
                placeholder="Search icons"
                bind:value={iconQuery}
              />
            {/if}
            <div
              class="icon-grid"
              on:dragover|preventDefault
              on:drop|preventDefault={(e) => onDrop(field.key, e)}
            >
              {#each iconHits as icon (icon.id)}
                <div class="mark-cell">
                  <button
                    type="button"
                    class="mark-btn"
                    class:on={params[field.key] === icon.id}
                    title={icon.paint === 'fill' ? `${icon.name} · solid` : icon.name}
                    on:click={() => pickIcon(field.key, icon.id)}
                  >
                    {@html markPreview(icon.id)}
                  </button>
                  {#if icon.source === 'custom'}
                    <button
                      type="button"
                      class="mark-x"
                      title="Remove"
                      on:click={() => removeIcon(field.key, icon.id)}
                    >×</button>
                  {/if}
                </div>
              {/each}
            </div>
            {#if iconSearching}
              <p class="icon-empty">Searching…</p>
            {:else if iconError}
              <p class="icon-empty">{iconError}</p>
            {:else if iconSet === 'mine' && !iconHits.length}
              <p class="icon-empty">Drop an SVG here. It becomes a one-color stamp.</p>
            {:else if !iconHits.length}
              <p class="icon-empty">No icons match.</p>
            {/if}
            <p class="icon-credit">{iconSet === 'mine' ? 'Custom stamps stay in this browser.' : 'Lucide · ISC · Tabler filled · MIT'}</p>
          </div>
        {:else if field.type === 'seed'}
          <div class="seed-row">
            <code>{params[field.key]}</code>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<script>
  import { createEventDispatcher } from 'svelte';
  import { MARKS, FILLED_MARKS, searchIconNames, ensureMark, markPreview, getMark } from '../lib/marks.js';
  import { restoreCustomMarks, saveCustomSvg, removeCustomMark } from '../lib/customMarks.js';

  export let schema = [];
  export let params = {};
  export let ejected = false;
  export let dirty = false;

  const dispatch = createEventDispatcher();
  let iconQuery = '';
  let iconSet = shelfFor(params.icon);
  let seenShelf = iconSet;
  let customList = restoreCustomMarks();
  let iconHits = shelfMarks(iconSet);
  let iconSearching = false;
  let iconError = '';
  let searchGen = 0;

  function shelfFor(id) {
    const key = String(id || '');
    if (key.startsWith('filled:')) return 'solid';
    if (key.startsWith('custom:')) return 'mine';
    return 'line';
  }

  function shelfMarks(set) {
    if (set === 'solid') return FILLED_MARKS;
    if (set === 'mine') return customList;
    return MARKS;
  }

  $: {
    const shelf = shelfFor(params.icon);
    if (shelf !== seenShelf) {
      seenShelf = shelf;
      iconSet = shelf;
    }
  }

  $: runIconSearch(iconQuery, iconSet);

  function pickSet(set) {
    iconError = '';
    if (set === 'mine') iconQuery = '';
    iconSet = set;
  }

  function iconName(id) {
    const mark = getMark(id);
    const known = mark.id === id;
    const name = known
      ? mark.name
      : String(id || 'star').replace(/^(filled|custom):/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const solid = String(id || '').startsWith('filled:') || (known && mark.paint === 'fill' && mark.source === 'custom');
    return solid ? `${name} · solid` : name;
  }

  async function ingest(key, file) {
    iconError = '';
    if (!file) return;
    const namedSvg = /\.svg$/i.test(file.name);
    const typedSvg = /svg/i.test(file.type || '');
    const typedBitmap = /^image\/(?!svg)/i.test(file.type || '');
    if (typedBitmap || (!namedSvg && !typedSvg)) {
      iconError = 'SVG files only.';
      return;
    }
    if (file.size > 100 * 1024) {
      iconError = 'This SVG is too large.';
      return;
    }
    try {
      const mark = saveCustomSvg(await file.text(), file.name);
      customList = restoreCustomMarks();
      iconSet = 'mine';
      iconQuery = '';
      iconHits = customList;
      await pickIcon(key, mark.id);
    } catch (error) {
      iconError = error.message || 'Could not read that SVG.';
    }
  }

  function onFile(key, event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    ingest(key, file);
  }

  function onDrop(key, event) {
    if (iconSet !== 'mine') return;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    ingest(key, file);
  }

  function removeIcon(key, id) {
    customList = removeCustomMark(id);
    iconHits = iconQuery ? customList.filter((item) => item.name.toLowerCase().includes(iconQuery.toLowerCase())) : customList;
    if (params[key] === id) set(key, 'star');
  }

  async function runIconSearch(query, set) {
    const needle = String(query || '').trim();
    const gen = ++searchGen;
    if (!needle || set === 'mine') {
      const shelf = shelfMarks(set);
      iconHits = !needle
        ? shelf
        : shelf.filter((item) => item.name.toLowerCase().includes(needle.toLowerCase()));
      iconSearching = false;
      return;
    }
    iconSearching = true;
    const ids = searchIconNames(needle, set);
    const loaded = await Promise.all(ids.map((id) => ensureMark(id)));
    if (gen !== searchGen) return;
    iconHits = loaded.filter((item, index, list) => item && list.findIndex((other) => other.id === item.id) === index);
    iconSearching = false;
  }

  async function pickIcon(key, id) {
    await ensureMark(id);
    set(key, id);
  }

  $: visibleFields = schema.filter((field) => !field.showIf || field.showIf(params));

  function set(key, value) {
    dispatch('change', { ...params, [key]: value });
  }

  function setColor(key, index, value) {
    const next = params[key].slice();
    next[index] = value;
    set(key, next);
  }

  function toHex(color) {
    if (!color || color === 'none') return '#000000';
    if (color[0] === '#') {
      if (color.length === 4) {
        return '#' + color.slice(1).split('').map((c) => c + c).join('');
      }
      return color.slice(0, 7);
    }
    const map = { pink: '#ffc0cb', white: '#ffffff', black: '#000000' };
    return map[color] || '#888888';
  }

  function format(value, field) {
    if (typeof value !== 'number') return value;
    const step = field.step || 1;
    if (step >= 1) return String(Math.round(value));
    if (step >= 0.1) return value.toFixed(1);
    if (step >= 0.01) return value.toFixed(2);
    return String(value);
  }

  function rangePct(value, field) {
    const span = Number(field.max) - Number(field.min);
    if (!span) return '0%';
    const t = (Number(value) - Number(field.min)) / span;
    return `${Math.min(100, Math.max(0, t * 100))}%`;
  }
</script>

<style>
  .look {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 18px 20px;
    min-height: 0;
  }

  .paused .fields {
    opacity: 0.38;
    pointer-events: none;
  }

  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    background: var(--accent-muted);
    border: 1px solid var(--accent-border);
    border-radius: 10px;
  }

  .banner p {
    margin: 0;
    font-size: 12px;
    color: var(--text);
  }

  .banner button,
  .shuffle,
  .none,
  .none-on,
  .toggle {
    margin: 0;
    border: 1px solid var(--border-default);
    background: var(--bg-elevated);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }

  .shuffle {
    background: transparent;
    color: var(--text-primary);
    border: 2px solid var(--accent);
    border-radius: 10px;
    min-height: 36px;
    padding: 8px 14px;
    letter-spacing: 0.02em;
  }

  .shuffle:hover:not(:disabled) {
    background: var(--accent-muted);
  }

  .shuffle:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .hint {
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .value {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 2px 7px;
    font-size: 12px;
    line-height: 1.4;
  }

  .swatches,
  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid var(--border-default);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    cursor: pointer;
    display: block;
  }

  .swatch:focus-within {
    box-shadow: 0 0 0 2px var(--bg-panel), 0 0 0 4px var(--accent);
  }

  .swatch input {
    opacity: 0;
    width: 24px;
    height: 24px;
    cursor: pointer;
    transform: scale(1.4);
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 14px;
    margin: 2px 0 0;
    background: transparent;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent) var(--pct, 0%), var(--border-default) var(--pct, 0%));
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border: 0;
    border-radius: 999px;
    background: var(--accent);
  }

  input[type='range']::-moz-range-track {
    height: 4px;
    border: 0;
    border-radius: 999px;
    background: var(--border-default);
  }

  input[type='range']::-moz-range-progress {
    height: 4px;
    border-radius: 999px;
    background: var(--accent);
  }

  input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 0;
    border-radius: 999px;
    background: var(--accent);
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    margin: 0;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
    border-radius: 999px;
    padding: 5px 10px;
    min-height: 28px;
    font-size: 11px;
    cursor: pointer;
  }

  .pill:hover:not(.on) {
    background: var(--bg-hover);
  }

  .pill.on {
    background: var(--accent-muted);
    color: var(--accent);
    border-color: var(--accent);
  }

  .toggle {
    min-width: 52px;
    background: var(--bg-active);
    color: var(--text-secondary);
  }

  .toggle.on {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .seed-row code {
    font-size: 12px;
    color: var(--text-dim);
  }

  .none-on {
    color: var(--accent);
  }

  .icon-sets {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .upload {
    display: block;
    margin-bottom: 8px;
    border: 1px dashed var(--line-strong);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    cursor: pointer;
  }

  .upload input {
    display: none;
  }

  .icon-picker input[type='search'] {
    width: 100%;
    height: 36px;
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    outline: none;
    margin-bottom: 8px;
  }

  .icon-picker input[type='search']:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .mark-cell {
    position: relative;
  }

  .mark-x {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-dim);
    font-size: 12px;
    line-height: 14px;
    cursor: pointer;
  }

  .mark-btn {
    margin: 0;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    padding: 6px;
    border: 1.5px solid var(--border-subtle);
    background: var(--bg-elevated);
    color: var(--text-muted);
    border-radius: 10px;
    cursor: pointer;
  }

  .mark-btn :global(svg) {
    width: 16px;
    height: 16px;
    display: block;
  }

  .mark-btn.on {
    color: var(--accent);
    background: var(--accent-muted);
    border-color: var(--accent);
  }

  .icon-empty,
  .icon-credit {
    margin: 8px 0 0;
    font-size: 10px;
    color: var(--text-faint);
  }

  .icon-credit {
    letter-spacing: 0.04em;
  }
</style>
