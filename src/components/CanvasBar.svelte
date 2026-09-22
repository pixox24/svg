<div class="wrap">
  <div class="bar">
    <button type="button" class="pill" class:on={open} on:click={() => (open = !open)}>
      <span class="pill-text">{pillLabel(canvas, flipped)}</span>
      <svg class="chev" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M3 6l5 5 5-5"/></svg>
    </button>
    <button
      type="button"
      class="orient"
      class:on={flipped}
      title="切换横向 / 纵向"
      on:click={() => (flipped = !flipped)}
    >{flipped ? '横' : '竖'}</button>
    <div class="fit">
      {#each FIT_MODES as mode}
        <button
          type="button"
          class="fit-btn"
          class:on={fit === mode.id}
          title={fitTitle(mode.id)}
          on:click={() => (fit = mode.id)}
        >{mode.label}</button>
      {/each}
    </div>
  </div>

  {#if open}
    <button type="button" class="backdrop" aria-label="关闭" on:click={() => (open = false)}></button>
    <div class="panel">
      <div class="cats">
        {#each CATEGORIES as cat}
          <button
            type="button"
            class="cat"
            class:on={tab === cat.id}
            on:click={() => (tab = cat.id)}
          >{cat.label}</button>
        {/each}
      </div>

      {#if tab === 'custom'}
        <div class="custom">
          <label>
            <span>宽</span>
            <input type="number" min="1" step="1" bind:value={cw} on:input={applyCustom} />
          </label>
          <label>
            <span>高</span>
            <input type="number" min="1" step="1" bind:value={ch} on:input={applyCustom} />
          </label>
          <label class="unit">
            <span>单位</span>
            <select bind:value={cunit} on:change={applyCustom}>
              <option value="px">px</option>
              <option value="mm">mm</option>
              <option value="in">in</option>
            </select>
          </label>
        </div>
      {:else}
        <div class="list">
          {#each PRESETS.filter((p) => p.cat === tab) as preset (preset.id)}
            <button
              type="button"
              class="row"
              class:on={canvas.id === preset.id}
              on:click={() => pick(preset)}
            >
              <span class="name">{preset.label}</span>
              <span class="dims">{describe(preset)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if showDpi}
        <div class="dpi">
          <span class="dpi-label">DPI</span>
          {#each DPI_STEPS as d}
            <button type="button" class="dpi-btn" class:on={dpi === d} on:click={() => (dpi = d)}>{d}</button>
          {/each}
          <span class="dpi-hint">PNG ≈ {exportHint}</span>
        </div>
      {/if}

      <p class="tip">方向按钮可横竖切换；填充会裁切，适应会留白。</p>
    </div>
  {/if}
</div>

<script>
  import {
    CATEGORIES,
    DEFAULT_DPI,
    DPI_STEPS,
    FIT_MODES,
    PRESETS,
    describe,
    pillLabel,
    toPixels
  } from '../lib/canvases.js';

  export let canvas = PRESETS[0];
  export let flipped = false;
  export let fit = 'cover';
  export let dpi = DEFAULT_DPI;

  let open = false;
  let tab = 'ratio';
  let cw = 800;
  let ch = 600;
  let cunit = 'px';

  $: showDpi = tab === 'print' || (tab === 'custom' && cunit !== 'px');
  $: exportHint = (() => {
    const target = tab === 'custom'
      ? { w: Number(cw) || 1, h: Number(ch) || 1, unit: cunit }
      : canvas;
    const { width, height } = toPixels(target, flipped, { scale: 1, dpi });
    return `${width}×${height}px`;
  })();

  function fitTitle(id) {
    return id === 'cover' ? '铺满并裁切' : id === 'contain' ? '完整显示并留白' : '拉伸填满';
  }

  function pick(preset) {
    canvas = preset;
    flipped = false;
    open = false;
  }

  function applyCustom() {
    const w = Number(cw);
    const h = Number(ch);
    if (!(w > 0) || !(h > 0)) return;
    canvas = { id: 'custom', cat: 'custom', label: '自定义', w, h, unit: cunit };
  }

  function seedCustom() {
    if (canvas && canvas.id === 'custom') {
      cw = canvas.w;
      ch = canvas.h;
      cunit = canvas.unit;
    }
  }

  $: if (open && tab === 'custom') seedCustom();

  function onKey(e) {
    if (e.key === 'Escape' && open) open = false;
  }
</script>

<svelte:window on:keydown={onKey} />

<style>
  .wrap {
    position: relative;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    min-width: 0;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
    margin: 0;
    border: 1px solid var(--line-strong);
    background: var(--bg-elev-2);
    color: var(--text);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .pill.on {
    border-color: var(--accent);
  }

  .pill-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chev {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .orient {
    margin: 0;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border: 1px solid var(--line-strong);
    background: var(--bg-elev-2);
    color: var(--text-dim);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  .orient.on {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .fit {
    display: flex;
    flex-shrink: 0;
  }

  .fit-btn {
    margin: 0;
    border: 1px solid var(--line-strong);
    background: var(--bg-elev-2);
    color: var(--text-dim);
    padding: 6px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .fit-btn:first-child {
    border-radius: 6px 0 0 6px;
  }

  .fit-btn:last-child {
    border-radius: 0 6px 6px 0;
  }

  .fit-btn + .fit-btn {
    border-left: 0;
  }

  .fit-btn.on {
    background: var(--accent-dim);
    color: var(--accent);
    border-color: var(--accent);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: default;
  }

  .panel {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 41;
    width: min(380px, 92vw);
    background: var(--bg-elev-2);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
    padding: 10px;
  }

  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
  }

  .cat {
    margin: 0;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text-dim);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
  }

  .cat.on {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 44vh;
    overflow: auto;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    border-radius: 6px;
    padding: 7px 8px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .row:hover {
    background: var(--bg-elev);
  }

  .row.on {
    background: var(--accent-dim);
    color: var(--accent);
  }

  .dims {
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .row.on .dims {
    color: var(--accent);
  }

  .custom {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .custom label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--text-dim);
  }

  .custom input,
  .custom select {
    width: 84px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    outline: none;
  }

  .custom .unit input,
  .custom .unit select {
    width: 64px;
  }

  .dpi {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--text-dim);
  }

  .dpi-label {
    letter-spacing: 0.06em;
  }

  .dpi-btn {
    margin: 0;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--text-dim);
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .dpi-btn.on {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .dpi-hint {
    margin-left: auto;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .tip {
    margin: 10px 0 0;
    font-size: 10px;
    color: var(--text-faint);
    letter-spacing: 0.02em;
  }
</style>
