<div class="library">
  <header class="bar">
    <div class="identity">
      <p class="family-label">Tabbied</p>
      <h2>{visible.length === TABBIED_COUNT ? `${TABBIED_COUNT} patterns` : `${visible.length} of ${TABBIED_COUNT}`}</h2>
    </div>
    <button type="button" class="close" on:click={() => dispatch('close')}>Close</button>
  </header>

  <div class="filters">
    <label class="search">
      <span class="sr">Search patterns</span>
      <input type="search" placeholder="Search patterns" bind:value={query} />
    </label>
    <div class="pills" role="group" aria-label="Density">
      <button type="button" class:on={density === ''} on:click={() => density = ''}>All</button>
      {#each TABBIED_DENSITIES as item}
        <button type="button" class:on={density === item} on:click={() => density = item}>{item}</button>
      {/each}
    </div>
    <div class="pills" role="group" aria-label="Mood">
      <button type="button" class:on={mood === ''} on:click={() => mood = ''}>Any mood</button>
      {#each TABBIED_MOODS as item}
        <button type="button" class:on={mood === item} on:click={() => mood = item}>{item}</button>
      {/each}
    </div>
  </div>

  <div class="mosaic">
    {#each visible as design (design.slug)}
      <button
        type="button"
        class="tile"
        class:on={selectedSlug === design.slug}
        title={design.name}
        on:click={() => dispatch('select', design.slug)}
      >
        <span class="print">
          <img src={previewUrl(design.slug)} alt="" loading="lazy" />
        </span>
        <span class="name">{design.name}</span>
      </button>
    {/each}
    {#if !visible.length}
      <p class="empty">No patterns match.</p>
    {/if}
  </div>
</div>

<script>
  import { createEventDispatcher } from 'svelte';
  import {
    TABBIED_CATALOG,
    TABBIED_COUNT,
    TABBIED_MOODS,
    TABBIED_DENSITIES,
    previewUrl
  } from '../tabbiedCatalog.js';

  export let selectedSlug = '';
  export let initialQuery = '';

  const dispatch = createEventDispatcher();

  let query = initialQuery || '';
  let density = '';
  let mood = '';

  $: needle = query.trim().toLowerCase();
  $: visible = TABBIED_CATALOG.filter((design) => {
    if (density && design.density !== density) return false;
    if (mood && !(design.mood || []).includes(mood)) return false;
    if (!needle) return true;
    const blob = [
      design.name,
      design.slug,
      design.description,
      ...(design.tags || []),
      ...(design.mood || []),
      ...(design.goodFor || [])
    ].join(' ').toLowerCase();
    return blob.includes(needle);
  });
</script>

<style>
  .library {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    min-height: 0;
    padding: 22px 24px 20px;
  }

  .bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }

  .identity {
    min-width: 0;
  }

  .family-label {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }

  h2 {
    margin: 4px 0 0;
    font-size: 1.35rem;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  .close {
    margin: 0;
    border: 0;
    padding: 0 0 3px;
    background: transparent;
    color: var(--text-faint);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .close:hover {
    color: var(--text);
  }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 18px 0 16px;
    flex-shrink: 0;
  }

  .search input {
    width: 100%;
    max-width: 360px;
    height: 38px;
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    border-radius: 9px;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;
  }

  .search input::placeholder {
    color: var(--text-muted);
  }

  .search input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pills button {
    margin: 0;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
    font-size: 11px;
    letter-spacing: 0.02em;
    padding: 5px 10px;
    min-height: 28px;
    border-radius: 999px;
    cursor: pointer;
    text-transform: capitalize;
  }

  .pills button:hover:not(.on) {
    background: var(--bg-hover);
  }

  .pills button.on {
    color: var(--text-inverse);
    background: var(--accent);
    border-color: var(--accent);
  }

  .mosaic {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 14px 12px;
    align-content: start;
    padding-bottom: 12px;
  }

  .tile {
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-dim);
    text-align: left;
    cursor: pointer;
  }

  .print {
    display: block;
    aspect-ratio: 2 / 3;
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-active);
    box-shadow: 0 0 0 1px var(--border-subtle);
  }

  .tile.on .print {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .print img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .name {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tile.on .name {
    color: var(--text);
  }

  .empty {
    grid-column: 1 / -1;
    color: var(--text-dim);
    font-size: 13px;
    margin: 24px 0;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  @media screen and (max-width: 51.25em) {
    .library {
      padding: 14px 14px 12px;
    }
    .mosaic {
      grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
      gap: 10px 8px;
    }
  }
</style>
