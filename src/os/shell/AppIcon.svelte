<script lang="ts">
  import { ART_SVG, glyphSvg, TILE_SVG, type IconSpec } from '../icons';
  import AppIcon from './AppIcon.svelte';

  let { icon }: { icon: IconSpec } = $props();
</script>

{#if icon.kind === 'art'}
  <span class="icon art">{@html ART_SVG[icon.art]}</span>
{:else if icon.kind === 'image'}
  <!-- Decorativo: el nombre del proyecto aparece siempre junto al icono. -->
  <span class="icon image"><img src={icon.src} alt="" width="180" height="180" decoding="async" /></span>
{:else if icon.kind === 'folder'}
  <span class="icon folder">
    {#each icon.children as child, i (i)}
      <span class="mini"><AppIcon icon={child} /></span>
    {/each}
  </span>
{:else if icon.kind === 'tile'}
  <span class="icon tile full" style:--from={icon.from} style:--to={icon.to}>{@html TILE_SVG[icon.art]}</span>
{:else if icon.kind === 'monogram'}
  <span class="icon tile" style:--from={icon.from} style:--to={icon.to}>
    <span class="letter">{icon.letter}</span>
  </span>
{:else}
  <span class="icon tile" style:--from={icon.from} style:--to={icon.to} style:--icon-fg={icon.fg ?? '#ffffff'}>
    {@html glyphSvg(icon.glyph)}
  </span>
{/if}

<style>
  .icon {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    container-type: inline-size;
  }
  .tile {
    border-radius: 23%;
    color: var(--icon-fg, #ffffff);
    background: linear-gradient(180deg, var(--from), var(--to));
    box-shadow:
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.3),
      0 4px 10px -3px rgba(0, 0, 0, 0.35);
  }
  .tile :global(svg) {
    width: 56%;
    height: 56%;
  }
  /* Los dibujos de casilla ocupan toda la casilla y se recortan con su silueta. */
  .tile.full {
    overflow: hidden;
  }
  .tile.full :global(svg) {
    width: 100%;
    height: 100%;
  }
  .image {
    border-radius: 23%;
    overflow: hidden;
    box-shadow:
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.3),
      0 4px 10px -3px rgba(0, 0, 0, 0.35);
  }
  .image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .letter {
    font-weight: 700;
    font-size: 46cqi;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  /* El dibujo se encaja en la caja cuadrada aunque su proporción no lo sea (el PDF es vertical). */
  .art {
    position: relative;
  }
  .art :global(svg) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.28));
  }
  .folder {
    grid-template-columns: 1fr 1fr;
    gap: 9%;
    padding: 16%;
    border-radius: 23%;
    background: rgba(255, 255, 255, 0.28);
    border: 0.5px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .mini {
    width: 100%;
    height: 100%;
  }
  .mini :global(.tile) {
    box-shadow: none;
  }
</style>
