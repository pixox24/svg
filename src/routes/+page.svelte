<main class:collapsed={inspectorCollapsed}>
  <Sidebar {base} {selectedId} {activeLookId} on:select={handleSelectSketch} />

  <section class="stage" class:ink={stage === 'ink'} class:full>
    <header class="stage-bar">
      <div class="identity">
        {#if isCustom}
          <p class="family-label">Custom</p>
          <h2>From URL</h2>
        {:else}
          <p class="family-label">{current?.familyLabel || ''}</p>
          <h2>{lookName}</h2>
        {/if}
      </div>
      <div class="tabs">
        <button type="button" class:on={tab === 'graph'} on:click={() => setPreviewTab('graph')}>Preview</button>
        <button type="button" class:on={tab === 'svg'} on:click={() => setPreviewTab('svg')}>SVG</button>
      </div>
    </header>

    <div
      class="canvas"
      class:svg={tab === 'svg' && !isTabbied}
      class:doodle={isTabbied}
    >
      {#if isTabbied}
        <div class="doodle-layer" class:hidden={tab === 'svg'}>
          {#key selectedId}
            <TabbiedStage bind:this={tabbiedStage} definition={family.definition} {params} />
          {/key}
        </div>
        {#if tab === 'svg'}
          <pre class="svg-overlay">{tabbiedSvg}</pre>
        {/if}
      {:else if tab === 'graph'}
        {@html svgCode}
      {:else}
        <pre>{svgCode}</pre>
      {/if}
    </div>
  </section>

  <aside class="inspector">
    {#if inspectorCollapsed}
      <button type="button" class="rail-toggle" on:click={toggleInspector} title="Open panel">
        Panel
      </button>
    {:else}
      <header class="inspector-bar">
        <div class="mode">
          {#if family}
            <div class="tabs mode-tabs">
              <button type="button" class:on={inspectorTab === 'look'} on:click={() => inspectorTab = 'look'}>Look</button>
              <button type="button" class:on={inspectorTab === 'source'} on:click={() => inspectorTab = 'source'}>Source</button>
            </div>
          {:else}
            <p class="kicker">Source</p>
          {/if}
        </div>
        <div class="inspector-actions">
          <select on:change={handleSelect} value={selectedId}>
            {#if isCustom}
              <option value="other">Custom</option>
            {/if}
            {#each allSketches() as sketch}
              <option value={sketch.id}>{sketch.kind === 'gallery' ? `${sketch.familyLabel} / ${sketch.name}` : sketch.name}</option>
            {/each}
          </select>
          <button type="button" class="icon-btn" on:click={toggleInspector} title="Collapse">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6 3 11 8 6 13"/></svg>
          </button>
          <a class="icon-btn" href="https://github.com/css-doodle/svg" target="_blank" rel="noreferrer" title="GitHub">
            <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path></svg>
          </a>
        </div>
      </header>
      {#if family && inspectorTab === 'look'}
        <div class="look-body">
          <LookPanel
            schema={family.schema}
            {params}
            {ejected}
            {dirty}
            on:change={handleParams}
            on:shuffle={handleShuffle}
            on:reset={handleReset}
          />
        </div>
      {:else}
        <div class="editor-body">
          <Editor {code} bind:this={editor} on:change={handleChange} />
        </div>
      {/if}
      <footer class="inspector-foot">
        <div class="export">
          <button type="button" on:click={copySvg}>Copy SVG</button>
          <button type="button" on:click={() => downloadPng(2)}>PNG</button>
          <button type="button" on:click={downloadSvg}>SVG</button>
          {#if isNull(codeFromQuery) && mounted}
            <button type="button" on:click={saveToURL}>Save URL</button>
          {/if}
        </div>
        {#if exportNote}
          <p>{exportNote}</p>
        {:else if current?.blurb}
          <p>{current.blurb}</p>
        {/if}
      </footer>
    {/if}
  </aside>
</main>

<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { svg } from 'css-doodle/generator';
  import { base } from '$app/paths';
  import Editor from '../components/editor/index.svelte';
  import Sidebar from '../components/Sidebar.svelte';
  import LookPanel from '../components/LookPanel.svelte';
  import TabbiedStage from '../components/TabbiedStage.svelte';
  import { supportsSvgExport } from 'tabbied';
  import {
    allSketches,
    getSketch,
    familyForSketch,
    matchingPreset,
    DEFAULT_ID
  } from '../catalog.js';
  import { stageFromBg } from '../lib/rng.js';
  import { copyText, downloadFile, svgBlob, svgToPngBlob } from '../lib/export.js';

  let selectedId = DEFAULT_ID;
  let family = familyForSketch(DEFAULT_ID);
  let params = clone(getSketch(DEFAULT_ID).params);
  let code = family.compile(params);
  let codeFromQuery = undefined;
  let editor;
  let tab = 'graph';
  let inspectorTab = 'look';
  let ejected = false;
  let mounted = false;
  let inspectorCollapsed = false;
  let exportNote = '';
  let noteTimer;
  let tabbiedStage;
  let tabbiedSvg = '';

  $: current = getSketch(selectedId);
  $: isTabbied = family?.kind === 'tabbied';
  $: isCustom = !isNull(codeFromQuery) || selectedId === 'other';
  $: rendered = isTabbied ? '' : svg(code);
  $: svgCode = tab === 'svg' ? prettySVG(rendered) : rendered;
  $: full = /preserveAspectRatio/i.test(code);
  $: preset = family ? matchingPreset(family, params) : null;
  $: dirty = Boolean(family) && !preset && !ejected;
  $: lookName = isCustom ? 'From URL' : ejected ? `${current?.name || 'Look'} · edited` : (preset?.name || (dirty ? 'Custom' : current?.name || ''));
  $: activeLookId = ejected || isCustom ? '' : (preset?.id || selectedId);
  $: stage = family
    ? stageFromBg(params.bg || params.palette?.[0] || '#f2eee6')
    : (current?.stage || 'paper');

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function handleChange(e) {
    const next = e.detail;
    code = next;
    if (family && !ejected && next.trim() !== family.compile(params).trim()) {
      ejected = true;
    }
    if (!isNull(codeFromQuery)) {
      saveToURL();
    }
  }

  function handleParams(e) {
    if (ejected || !family) return;
    params = e.detail;
    code = family.compile(params);
  }

  function handleShuffle() {
    if (ejected || !family) return;
    params = family.shuffle(params);
    code = family.compile(params);
  }

  function handleReset() {
    const sketch = getSketch(selectedId);
    if (!family || !sketch?.params) return;
    ejected = false;
    params = clone(sketch.params);
    code = family.compile(params);
    inspectorTab = 'look';
  }

  function prettySVG(input) {
    try {
      let xmlDoc = new DOMParser().parseFromString(input, 'application/xml');
      let xsltDoc = new DOMParser().parseFromString(`
<xsl:stylesheet version="1.0"
 xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
 <xsl:output omit-xml-declaration="yes" indent="yes"/>
    <xsl:template match="node()|@*">
      <xsl:copy>
        <xsl:apply-templates select="node()|@*"/>
      </xsl:copy>
    </xsl:template>
</xsl:stylesheet>
      `, 'application/xml');
      let xsltProcessor = new XSLTProcessor();
      xsltProcessor.importStylesheet(xsltDoc);
      let resultDoc = xsltProcessor.transformToDocument(xmlDoc);
      return new XMLSerializer().serializeToString(resultDoc);
    } catch (e) {
      return input;
    }
  }

  function isNull(value) {
    return value === null || value === undefined;
  }

  function handleSelectSketch(e) {
    loadSketch(e.detail);
  }

  function handleSelect(e) {
    loadSketch(e.target.value);
  }

  function loadSketch(id) {
    const sketch = getSketch(id) || getSketch(DEFAULT_ID);
    selectedId = sketch.id;
    family = familyForSketch(sketch.id);
    ejected = false;
    codeFromQuery = undefined;
    if (family && sketch.params) {
      params = clone(sketch.params);
      code = family.compile(params);
      inspectorTab = 'look';
    } else {
      params = {};
      code = sketch.code;
      inspectorTab = 'source';
    }
    if (editor) editor.updateCode(code);
    updateUrl(sketch.id);
  }

  function fileBase() {
    return (lookName || 'look').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'look';
  }

  function note(text) {
    exportNote = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { exportNote = ''; }, 1600);
  }

  function setPreviewTab(next) {
    tab = next;
    if (next === 'svg' && isTabbied) loadTabbiedSvg();
  }

  async function tabbiedExportSvg() {
    const controller = tabbiedStage && tabbiedStage.getController && tabbiedStage.getController();
    if (!controller) throw new Error('Pattern is still mounting');
    if (!supportsSvgExport(family.definition)) {
      throw new Error(family.svgExportNote || 'This design does not export as SVG');
    }
    return controller.exportSvg();
  }

  async function loadTabbiedSvg() {
    tabbiedSvg = 'Rendering SVG…';
    try {
      const result = await tabbiedExportSvg();
      tabbiedSvg = result.svg;
      if (result.warnings && result.warnings.length) note(result.warnings[0]);
    } catch (error) {
      tabbiedSvg = error.message || String(error);
    }
  }

  async function copySvg() {
    try {
      if (isTabbied) {
        const result = await tabbiedExportSvg();
        await copyText(result.svg);
      } else {
        await copyText(svgCode);
      }
      note('SVG copied');
    } catch (e) {
      note(e.message || 'Copy failed');
    }
  }

  async function downloadSvg() {
    try {
      const markup = isTabbied ? (await tabbiedExportSvg()).svg : svgCode;
      downloadFile(`${fileBase()}.svg`, svgBlob(markup));
      note('SVG downloaded');
    } catch (e) {
      note(e.message || 'SVG failed');
    }
  }

  async function downloadPng(scale) {
    try {
      if (isTabbied) {
        const result = await tabbiedExportSvg();
        const blob = await svgToPngBlob(result.svg, scale);
        downloadFile(`${fileBase()}.png`, blob);
      } else {
        const blob = await svgToPngBlob(svgCode, scale);
        downloadFile(`${fileBase()}.png`, blob);
      }
      note('PNG downloaded');
    } catch (e) {
      note(e.message || 'PNG failed');
    }
  }

  function updateUrl(id) {
    let query = new URLSearchParams(location.search);
    query.set('id', id);
    query.delete('code');
    query.delete('name');
    goto(location.pathname + '?' + query.toString(), { replaceState: true });
  }

  function saveToURL() {
    let query = new URLSearchParams(location.search);
    query.set('code', code);
    query.delete('id');
    query.delete('name');
    codeFromQuery = code;
    selectedId = 'other';
    history.replaceState('', '', location.pathname + '?' + query.toString());
  }

  function canCollapse() {
    return typeof window !== 'undefined' && window.innerWidth > 1080;
  }

  function toggleInspector() {
    if (!canCollapse() && !inspectorCollapsed) return;
    inspectorCollapsed = !inspectorCollapsed;
    try {
      localStorage.setItem('svg-inspector-collapsed', inspectorCollapsed ? '1' : '0');
    } catch (e) {}
  }

  function stepVariant(dir) {
    const family = familyForSketch(selectedId);
    if (!family) return;
    const index = family.variants.findIndex((item) => item.id === selectedId);
    const next = family.variants[(index + dir + family.variants.length) % family.variants.length];
    loadSketch(next.id);
  }

  function onKey(e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') stepVariant(-1);
    if (e.key === 'ArrowRight') stepVariant(1);
    if (e.key === '\\') toggleInspector();
  }

  function init() {
    let query = new URLSearchParams(location.search);
    codeFromQuery = query.get('code');
    const id = query.get('id') || query.get('name');
    if (codeFromQuery) {
      code = codeFromQuery;
      selectedId = 'other';
      family = null;
      ejected = true;
      inspectorTab = 'source';
      if (editor) editor.updateCode(code);
    } else {
      loadSketch(id || DEFAULT_ID);
    }
  }

  onMount(() => {
    try {
      inspectorCollapsed = canCollapse() && localStorage.getItem('svg-inspector-collapsed') === '1';
    } catch (e) {}
    const onResize = () => {
      if (!canCollapse()) inspectorCollapsed = false;
    };
    init();
    window.addEventListener('popstate', init);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    mounted = true;
    return () => {
      window.removeEventListener('popstate', init);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<style>
  main {
    display: grid;
    height: 100%;
    min-height: 0;
    grid-template-columns: var(--sidebar) minmax(0, 1fr) var(--inspector);
    grid-template-areas: "sidebar stage inspector";
    background: var(--bg);
  }

  main.collapsed {
    grid-template-columns: var(--sidebar) minmax(0, 1fr) 48px;
  }

  :global(.sidebar) {
    grid-area: sidebar;
  }

  .stage {
    grid-area: stage;
    position: relative;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--paper);
    color: #1c1916;
  }

  .stage.ink {
    background: var(--ink);
    color: var(--text);
  }

  .stage-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 22px 0;
    pointer-events: none;
  }

  .stage-bar > * {
    pointer-events: auto;
  }

  .family-label {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .stage.ink .family-label {
    color: var(--text-dim);
  }

  .identity h2 {
    margin: 4px 0 0;
    font-size: 1.35rem;
    font-weight: 560;
    letter-spacing: -0.03em;
  }

  .tabs {
    display: flex;
    padding: 2px;
    background: rgba(12, 13, 16, 0.06);
    border-radius: 999px;
  }

  .stage.ink .tabs {
    background: rgba(255, 255, 255, 0.06);
  }

  .tabs button {
    margin: 0;
    border: 0;
    background: transparent;
    color: inherit;
    opacity: 0.55;
    min-width: 4.6em;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
  }

  .tabs button.on {
    opacity: 1;
    background: #fff;
    color: #1c1916;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .stage.ink .tabs button.on {
    background: var(--bg-elev-2);
    color: var(--text);
  }

  .canvas {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 4vmax 5vmax 5vmax;
    overflow: auto;
  }

  .stage.full .canvas {
    padding: 0;
  }

  .canvas.doodle {
    padding: 0;
    display: block;
    position: relative;
    overflow: hidden;
  }

  .doodle-layer {
    position: absolute;
    inset: 0;
  }

  .doodle-layer.hidden {
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
  }

  .canvas pre.svg-overlay {
    position: relative;
    z-index: 1;
    height: 100%;
    overflow: auto;
    margin: 0;
    padding: 28px 24px;
    background: var(--paper);
    color: #1c1916;
    opacity: 1;
  }

  .canvas :global(svg) {
    max-width: 100%;
    max-height: 100%;
  }

  .stage.full .canvas :global(svg) {
    width: 100%;
    height: 100%;
  }

  .canvas.svg {
    display: block;
    place-items: normal;
    padding: 28px 24px 32px;
  }

  .canvas pre {
    margin: 0;
    white-space: pre-wrap;
    user-select: all;
    font-size: 12.5px;
    line-height: 1.5;
    opacity: 0.86;
  }

  .inspector {
    grid-area: inspector;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border-left: 1px solid var(--line);
    color: var(--text);
  }

  .inspector-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 12px 10px 16px;
    border-bottom: 1px solid var(--line);
    min-height: 56px;
  }

  .kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .syntax {
    color: var(--accent);
    text-decoration: none;
    font-size: 12px;
  }

  .syntax:hover {
    text-decoration: underline;
  }

  .inspector-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  select {
    display: none;
    background: transparent;
    color: var(--text);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 12px;
    max-width: 160px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
    margin: 0;
    padding: 0;
  }

  .icon-btn:hover {
    color: var(--text);
    background: var(--bg-elev-2);
  }

  .editor-body,
  .look-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .mode-tabs {
    background: rgba(255, 255, 255, 0.06);
  }

  .mode-tabs button.on {
    background: var(--bg-elev-2);
    color: var(--text);
    box-shadow: none;
    opacity: 1;
  }

  .inspector-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-dim);
  }

  .export {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .inspector-foot p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inspector-foot button {
    margin: 0;
    background: var(--accent-dim);
    color: var(--accent);
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  .rail-toggle {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    height: 100%;
    width: 100%;
    margin: 0;
    border: 0;
    background: transparent;
    color: var(--text-dim);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-size: 11px;
    cursor: pointer;
  }

  .rail-toggle:hover {
    color: var(--text);
    background: var(--bg-elev-2);
  }

  @media screen and (max-width: 67.5em) {
    main,
    main.collapsed {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 38%);
      grid-template-areas: "stage inspector";
    }
    select {
      display: block;
    }
  }

  @media screen and (max-width: 51.25em) {
    main,
    main.collapsed {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
      grid-template-areas:
        "stage"
        "inspector";
    }
    .stage-bar {
      padding: 12px 14px 0;
    }
    .canvas.svg {
      padding: 16px;
    }
  }
</style>
