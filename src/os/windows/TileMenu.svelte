<script lang="ts">
  import { UI_SVG } from '../icons';
  import type { TileSide } from './window-manager';

  interface Props {
    tile?: TileSide;
    maximized: boolean;
    onchoose: (choice: TileSide | 'toggle') => void;
    onclose: () => void;
  }

  let { tile, maximized, onchoose, onclose }: Props = $props();

  let menu: HTMLDivElement | undefined = $state();

  const items = () => [...(menu?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])];

  /** Flechas, Inicio y Fin recorren las opciones; Escape cierra solo el cuadro, no la ventana. */
  function onkeydown(e: KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(i + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  }

  /** Para que la ventana pueda llevar el foco a la primera opción al pulsar la flecha abajo. */
  export function focusFirst() {
    items()[0]?.focus();
  }

  const restores = $derived(maximized || !!tile);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={menu}
  class="tile-menu"
  role="menu"
  aria-label="Organizar ventana"
  tabindex="-1"
  data-testid="tile-menu"
  {onkeydown}
  onpointerdown={(e) => e.stopPropagation()}
  ondblclick={(e) => e.stopPropagation()}
>
  <button class="opt" role="menuitemradio" aria-checked={tile === 'left'} data-testid="tile-left" onclick={() => onchoose('left')}>
    <span class="ico">{@html UI_SVG.tileLeft}</span>
    <span>Mitad izquierda</span>
  </button>
  <button class="opt" role="menuitemradio" aria-checked={tile === 'right'} data-testid="tile-right" onclick={() => onchoose('right')}>
    <span class="ico">{@html UI_SVG.tileRight}</span>
    <span>Mitad derecha</span>
  </button>
  <button class="opt" role="menuitem" data-testid="tile-toggle" onclick={() => onchoose('toggle')}>
    <span class="ico">{@html restores ? UI_SVG.restore : UI_SVG.fill}</span>
    <span>{restores ? 'Restaurar' : 'Ampliar'}</span>
  </button>
</div>

<style>
  .tile-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: -6px;
    z-index: 30;
    display: grid;
    gap: 2px;
    min-width: 190px;
    padding: 5px;
    border-radius: var(--r-menu);
    background: var(--glass-strong);
    border: 0.5px solid var(--glass-border);
    backdrop-filter: var(--blur-glass);
    -webkit-backdrop-filter: var(--blur-glass);
    box-shadow: var(--shadow-win);
    color: var(--fg);
    font-weight: 400;
    text-align: left;
    animation: tile-in 0.12s ease-out both;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 5px 9px;
    border-radius: 6px;
    font-size: calc(14px * var(--text-scale));
    color: inherit;
    text-align: left;
    cursor: default;
  }
  .opt:hover,
  .opt:focus-visible {
    background: var(--accent-solid);
    color: var(--accent-fg);
    outline: none;
  }
  .opt[aria-checked='true'] .ico {
    color: var(--accent-text);
  }
  .opt:hover .ico,
  .opt:focus-visible .ico {
    color: inherit;
  }
  .ico {
    flex: none;
    display: grid;
    width: 20px;
    height: 20px;
  }
  .ico :global(svg) {
    width: 100%;
    height: 100%;
  }
  @keyframes tile-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tile-menu {
      animation: none;
    }
  }
</style>
