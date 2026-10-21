<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { UI_SVG } from '../icons';
  import TileMenu from './TileMenu.svelte';
  import type { TileSide, WindowState } from './window-manager';

  interface Props {
    win: WindowState;
    active: boolean;
    onfocus: () => void;
    onclose: () => void;
    onminimize: () => void;
    onmaximize: () => void;
    ontile: (side: TileSide) => void;
    onmove: (x: number, y: number) => void;
    onresize: (w: number, h: number) => void;
    children: Snippet;
  }

  let { win, active, onfocus, onclose, onminimize, onmaximize, ontile, onmove, onresize, children }: Props = $props();

  // Cuadro de mitades del botón verde (S-07): se abre al dejar el ratón medio segundo o al dar el foco con el teclado.
  const OPEN_DELAY = 400;
  const CLOSE_DELAY = 180;
  let tileOpen = $state(false);
  let snapping = $state(false);
  let wrap: HTMLSpanElement | undefined = $state();
  let tileMenu: ReturnType<typeof TileMenu> | undefined = $state();
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  // Al devolver el foco al botón verde (tras elegir o con Escape) el cuadro no debe volver a abrirse.
  let refocusing = false;

  const clearTimers = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  };
  const closeTile = () => {
    clearTimers();
    tileOpen = false;
  };
  onDestroy(() => {
    clearTimers();
    clearTimeout(snapTimer);
  });

  // Una ventana minimizada no tiene botón visible: el cuadro no se queda abierto.
  $effect(() => {
    if (win.minimized) closeTile();
  });

  function hoverIn(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    clearTimers();
    if (!tileOpen) openTimer = setTimeout(() => (tileOpen = true), OPEN_DELAY);
  }

  function hoverOut() {
    clearTimeout(openTimer);
    closeTimer = setTimeout(() => {
      // Con el foco dentro del cuadro (teclado), no se cierra aunque el puntero se vaya.
      if (!wrap?.contains(document.activeElement)) tileOpen = false;
    }, CLOSE_DELAY);
  }

  function focusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;
    if (!refocusing && target.classList.contains('zoom') && target.matches(':focus-visible')) {
      clearTimers();
      tileOpen = true;
    }
  }

  function focusOut(e: FocusEvent) {
    if (!wrap?.contains(e.relatedTarget as Node | null)) closeTile();
  }

  function focusZoom() {
    refocusing = true;
    wrap?.querySelector<HTMLButtonElement>('.zoom')?.focus({ preventScroll: true });
    refocusing = false;
  }

  function wrapKeydown(e: KeyboardEvent) {
    if (!tileOpen) return;
    if (e.key === 'Escape') {
      // Escape cierra el cuadro y no la ventana.
      e.preventDefault();
      e.stopPropagation();
      closeTile();
      focusZoom();
    } else if (e.key === 'ArrowDown' && (e.target as HTMLElement).classList.contains('zoom')) {
      e.preventDefault();
      tileMenu?.focusFirst();
    }
  }

  /** Colocar y restaurar desde el cuadro se animan; el clic directo en el botón no (ver .snap en el estilo). */
  function choose(choice: TileSide | 'toggle') {
    closeTile();
    snapping = true;
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => (snapping = false), 300);
    if (choice === 'toggle') onmaximize();
    else ontile(choice);
    focusZoom();
  }

  function clickZoom() {
    closeTile();
    onmaximize();
  }

  /** Sigue el puntero desde que se pulsa hasta que se suelta, aunque salga del elemento. */
  function track(e: PointerEvent, onDelta: (dx: number, dy: number) => void) {
    const el = e.currentTarget as HTMLElement;
    const sx = e.clientX;
    const sy = e.clientY;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onDelta(ev.clientX - sx, ev.clientY - sy);
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function startDrag(e: PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    e.preventDefault();
    closeTile();
    // Si se arrastra justo después de colocar la ventana, la transición de colocar no debe frenar el arrastre.
    clearTimeout(snapTimer);
    snapping = false;
    let { x, y } = win.rect;
    // Una ventana ampliada o colocada se suelta al arrastrarla y recupera su tamaño; el puntero se queda
    // en la misma proporción de la barra, como en macOS.
    if ((win.maximized || win.tile) && win.restore) {
      x = e.clientX - ((e.clientX - win.rect.x) / win.rect.w) * win.restore.w;
    }
    track(e, (dx, dy) => onmove(x + dx, y + dy));
  }

  function startResize(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const { w, h } = win.rect;
    track(e, (dx, dy) => onresize(w + dx, h + dy));
  }

  function ondblclick(e: MouseEvent) {
    if (!(e.target as Element).closest('button')) onmaximize();
  }
</script>

<div
  class="win"
  class:active
  class:max={win.maximized}
  class:tiled={!!win.tile}
  class:snap={snapping}
  role="dialog"
  aria-label={win.title}
  data-testid={`window-${win.key}`}
  data-active={active}
  hidden={win.minimized}
  style:left={`${win.rect.x}px`}
  style:top={`${win.rect.y}px`}
  style:width={`${win.rect.w}px`}
  style:height={`${win.rect.h}px`}
  style:z-index={win.z}
  onpointerdowncapture={onfocus}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="titlebar" data-testid="window-titlebar" onpointerdown={startDrag} {ondblclick}>
    <div class="lights">
      <button class="light close" data-testid="window-close" aria-label="Cerrar" onclick={onclose}>{@html UI_SVG.close}</button>
      <button class="light min" data-testid="window-minimize" aria-label="Minimizar" onclick={onminimize}>{@html UI_SVG.minimize}</button>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="zoom-wrap"
        bind:this={wrap}
        onpointerenter={hoverIn}
        onpointerleave={hoverOut}
        onfocusin={focusIn}
        onfocusout={focusOut}
        onkeydown={wrapKeydown}
      >
        <button class="light zoom" data-testid="window-maximize" aria-label="Ampliar" aria-haspopup="menu" aria-expanded={tileOpen} onclick={clickZoom}>
          {@html UI_SVG.maximize}
        </button>
        {#if tileOpen}
          <TileMenu bind:this={tileMenu} tile={win.tile} maximized={win.maximized} onchoose={choose} onclose={() => { closeTile(); focusZoom(); }} />
        {/if}
      </span>
    </div>
    <div class="title">{win.title}</div>
  </div>
  <div class="body" data-window-body>
    {@render children()}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="resize" data-testid="window-resize" aria-hidden="true" onpointerdown={startResize}></div>
</div>

<style>
  .win {
    position: absolute;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    border-radius: var(--r-win);
    background: var(--win-bg);
    color: var(--fg);
    box-shadow: var(--shadow-idle);
    overflow: hidden;
    animation: win-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
  }
  .win[hidden] {
    display: none;
  }
  /* Colocar desde el cuadro anima el cambio de sitio y de tamaño; arrastrar y ampliar con el clic no. */
  .win.snap {
    transition:
      left 0.24s ease,
      top 0.24s ease,
      width 0.24s ease,
      height 0.24s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .win.snap {
      transition: none;
    }
  }
  .win.active {
    box-shadow: var(--shadow-win);
  }
  .win.max {
    border-radius: 0;
  }
  @keyframes win-in {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
  }
  .titlebar {
    position: relative;
    flex: none;
    height: 38px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: var(--chrome);
    border-bottom: 1px solid var(--line);
    user-select: none;
    touch-action: none;
  }
  .lights {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 8px;
  }
  .light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: rgba(0, 0, 0, 0.55);
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.2);
  }
  .light :global(svg) {
    width: 8px;
    height: 8px;
    opacity: 0;
  }
  .lights:hover .light :global(svg),
  .light:focus-visible :global(svg) {
    opacity: 1;
  }
  .close {
    background: #ff5f57;
  }
  .min {
    background: #febc2e;
  }
  .zoom {
    background: #28c840;
  }
  .win:not(.active) .lights:not(:hover) .light {
    background: var(--line-strong);
  }
  .title {
    position: absolute;
    left: 80px;
    right: 80px;
    text-align: center;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .win:not(.active) .title {
    color: var(--muted);
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .resize {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    touch-action: none;
  }
  .zoom-wrap {
    position: relative;
    display: inline-flex;
  }
  .max .resize,
  .tiled .resize {
    display: none;
  }
</style>
