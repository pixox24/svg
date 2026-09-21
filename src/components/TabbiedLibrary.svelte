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
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  h2 {
    margin: 4px 0 0;
    font-size: 1.05rem;
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
    background: var(--bg-elev);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    outline: none;
  }

  .search input::placeholder {
    color: var(--text-faint);
  }

  .search input:focus {
    border-color: var(--accent);
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pills button {
    margin: 0;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
    letter-spacing: 0.02em;
    padding: 4px 8px;
    border-radius: 999px;
    cursor: pointer;
    text-transform: capitalize;
  }

  .pills button.on {
    color: var(--bg);
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
    scrollbar-color: #fff2 transparent;
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
    border-radius: 3px;
    overflow: hidden;
    background: var(--paper);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.28),
      0 10px 22px -14px rgba(0, 0, 0, 0.55);
  }

  .tile.on .print {
    box-shadow:
      0 0 0 1.5px var(--accent),
      0 10px 22px -14px rgba(0, 0, 0, 0.55);
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
