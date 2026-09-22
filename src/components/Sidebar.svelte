<aside class="sidebar">
  <header class="brand">
    <p class="eyebrow">SVG</p>
    <h1>Playground</h1>
    <label class="search">
      <span class="sr">Search</span>
      <input
        type="search"
        placeholder="Search families"
        bind:value={query}
      />
    </label>
    <div class="tags" role="tablist" aria-label="Filter">
      {#each TAGS as tag}
        <button
          type="button"
          role="tab"
          aria-selected={tagFilter === tag.id}
          class:on={tagFilter === tag.id}
          on:click={() => tagFilter = tag.id}
        >{tag.label}</button>
      {/each}
    </div>
  </header>

  <div class="scroller">
    {#if visibleFamilies.length}
      <h2>Gallery</h2>
      {#each visibleFamilies as family}
        <article class="family" class:active={selectedFamilyId === family.id}>
          <button
            type="button"
            class="family-hit"
            on:click={() => selectFamily(family)}
          >
            <span class="cover">
              <img src="{base}/thumbs/{coverId(family)}.svg" alt="" />
            </span>
            <span class="meta">
              <span class="name">{family.label}</span>
              <span class="sub">{family.variants.length} looks</span>
            </span>
          </button>

          {#if selectedFamilyId === family.id && family.variants.length > 1}
            <div class="rail" role="list">
              {#each family.variants as variant}
                <button
                  type="button"
                  role="listitem"
                  class="look"
                  class:on={activeLookId === variant.id}
                  title={variant.name}
                  on:click={() => dispatch('select', variant.id)}
                >
                  <span class="look-thumb">
                    <img src="{base}/thumbs/{variant.id}.svg" alt="" />
                  </span>
                  <span class="look-name">{variant.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    {/if}

    {#if showTabbied}
      <h2>Tabbied</h2>
      <article class="family" class:active={tabbiedActive || libraryOpen}>
        <button type="button" class="family-hit" on:click={() => dispatch('library')}>
          <span class="cover">
            <img src={previewUrl('radius')} alt="" />
          </span>
          <span class="meta">
            <span class="name">Tabbied</span>
            <span class="sub">{tabbiedName || `${TABBIED_COUNT} cell patterns`}</span>
          </span>
        </button>
      </article>
      <p class="credit">Cell patterns from Tabbied · MIT</p>
    {/if}

    {#if visibleClassics.length}
      <h2>Classics</h2>
      <div class="classics">
        {#each visibleClassics as item}
          <button
            type="button"
            class="classic"
            class:on={selectedId === item.id}
            on:click={() => dispatch('select', item.id)}
          >
            <span class="classic-thumb">
              <img src="{base}/thumbs/{item.id}.svg" alt="" />
            </span>
            <span class="classic-name">{item.name}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if !visibleFamilies.length && !showTabbied && !visibleClassics.length}
      <p class="empty">No matches.</p>
    {/if}
  </div>
</aside>

<script>
  import { createEventDispatcher } from 'svelte';
  import { TAGS, families, classics, familyForSketch, TABBIED_COUNT, previewUrl } from '../catalog.js';

  export let selectedId = '';
  export let activeLookId = '';
  export let base = '';
  export let libraryOpen = false;
  export let tabbiedActive = false;
  export let tabbiedName = '';

  const dispatch = createEventDispatcher();

  let query = '';
  let tagFilter = 'all';

  $: selectedFamilyId = familyForSketch(selectedId)?.id || null;

  $: needle = query.trim().toLowerCase();

  $: visibleFamilies = families.filter((family) => {
    if (tagFilter !== 'all' && !family.tags.includes(tagFilter)) return false;
    if (!needle) return true;
    const blob = [
      family.label,
      family.blurb,
      ...family.variants.map((item) => item.name)
    ].join(' ').toLowerCase();
    return blob.includes(needle);
  });

  $: showTabbied = (tagFilter === 'all' || tagFilter === 'pattern' || tagFilter === 'organic')
    && (!needle || 'tabbied pattern cell'.includes(needle) || (tabbiedName && tabbiedName.toLowerCase().includes(needle)));

  $: visibleClassics = classics.filter((item) => {
    if (tagFilter !== 'all' && !item.tags.includes(tagFilter)) return false;
    if (!needle) return true;
    return item.name.toLowerCase().includes(needle);
  });

  function coverId(family) {
    if (selectedFamilyId === family.id) return selectedId;
    return family.variants[0].id;
  }

  function selectFamily(family) {
    if (selectedFamilyId === family.id && !libraryOpen) return;
    dispatch('select', family.variants[0].id);
  }
</script>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border-subtle);
    color: var(--text-primary);
  }

  .brand {
    padding: 18px 16px 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .eyebrow {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 500;
  }

  h1 {
    margin: 4px 0 14px;
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    font-size: 1.7rem;
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .search input {
    width: 100%;
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

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }

  .tags button {
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
  }

  .tags button:hover:not(.on) {
    background: var(--bg-hover);
  }

  .tags button.on {
    color: var(--text-inverse);
    background: var(--accent);
    border-color: var(--accent);
  }

  .tags button.on:hover {
    background: var(--accent-hover);
  }

  .scroller {
    flex: 1;
    overflow: auto;
    padding: 8px 10px 24px;
  }

  h2 {
    margin: 18px 6px 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .family {
    border-radius: var(--radius);
    margin-bottom: 6px;
  }

  .family.active {
    background: var(--accent-muted);
    box-shadow: inset 0 0 0 1px var(--accent-border);
  }

  .family-hit {
    width: 100%;
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 10px;
    align-items: center;
    margin: 0;
    padding: 8px;
    background: transparent;
    border: 0;
    color: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius);
  }

  .family-hit:hover {
    background: var(--bg-hover);
  }

  .family.active .family-hit:hover {
    background: var(--accent-muted-strong);
  }

  .cover,
  .look-thumb,
  .classic-thumb {
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--bg-active);
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--border-subtle);
  }

  .cover {
    width: 44px;
    height: 44px;
  }

  .cover img,
  .look-thumb img,
  .classic-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name {
    font-size: 13.5px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  .sub {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 0 8px 10px;
  }

  .look {
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    text-align: center;
  }

  .look-thumb {
    aspect-ratio: 1;
    border-radius: 10px;
  }

  .look.on .look-thumb {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .look-name {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .look.on .look-name {
    color: var(--text);
  }

  .classics {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .classic {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 10px;
    align-items: center;
    margin: 0;
    padding: 6px 8px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: var(--text-dim);
    cursor: pointer;
    text-align: left;
  }

  .classic:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .classic.on {
    background: var(--accent-muted);
    color: var(--text-primary);
  }

  .classic-thumb {
    width: 40px;
    height: 40px;
  }

  .classic.on .classic-thumb {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .classic-name {
    font-size: 13px;
  }

  .credit {
    margin: 4px 8px 0;
    font-size: 10px;
    color: var(--text-faint);
  }

  .empty {
    color: var(--text-dim);
    font-size: 13px;
    padding: 24px 8px;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  @media screen and (max-width: 67.5em) {
    .sidebar {
      display: none;
    }
  }
</style>
