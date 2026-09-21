<div class="host" bind:this={host}></div>

<script>
  import { onMount } from 'svelte';
  import { createPattern } from 'tabbied';

  export let definition;
  export let params;

  let host;
  let controller;

  function optionMap(next = params) {
    const options = {};
    for (const option of definition.options) {
      options[option.id] = next[option.id] ?? option.default;
    }
    return options;
  }

  function snapshot(next = params) {
    return {
      pattern: definition,
      seed: String(next.seed || 'Play'),
      palette: next.palette,
      options: optionMap(next),
      fit: 'grid'
    };
  }

  function apply() {
    if (!controller || controller.destroyed) return;
    controller.update(snapshot());
  }

  onMount(() => {
    controller = createPattern(host, snapshot());
    return () => {
      controller.destroy();
      controller = null;
    };
  });

  $: definition, params, apply();

  export function getController() {
    return controller;
  }
</script>

<style>
  .host {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
