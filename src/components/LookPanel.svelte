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

  export let schema = [];
  export let params = {};
  export let ejected = false;
  export let dirty = false;

  const dispatch = createEventDispatcher();

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
    return String(value);
  }
</script>

<style>
  .look {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 16px 18px;
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
    background: var(--accent-dim);
    border-radius: 8px;
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
    border: 1px solid var(--line-strong);
    background: var(--bg-elev-2);
    color: var(--text);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .shuffle {
    background: var(--accent-dim);
    color: var(--accent);
    border-color: transparent;
    letter-spacing: 0.02em;
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
    gap: 14px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 6px;
  }

  .value {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .swatches,
  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    cursor: pointer;
    display: block;
  }

  .swatch input {
    opacity: 0;
    width: 28px;
    height: 28px;
    cursor: pointer;
    transform: scale(1.4);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    margin: 0;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text-dim);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .pill.on,
  .toggle.on {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .seed-row code {
    font-size: 12px;
    color: var(--text-dim);
  }

  .none-on {
    color: var(--accent);
  }
</style>
