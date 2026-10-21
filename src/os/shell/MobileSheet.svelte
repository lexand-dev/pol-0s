<script lang="ts">
  import type { Snippet } from 'svelte';
  import { UI_SVG } from '../icons';

  let { title, onback, children }: { title: string; onback: () => void; children: Snippet } = $props();
</script>

<div class="sheet" role="dialog" aria-label={title} data-testid="mobile-sheet">
  <header class="bar">
    <button class="back" data-testid="mobile-back" onclick={onback}>{@html UI_SVG.back}Inicio</button>
    <h2 class="title">{title}</h2>
    <span></span>
  </header>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .sheet {
    position: absolute;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    color: var(--fg);
    background: var(--win-bg);
    animation: sheet-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  @keyframes sheet-in {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
  }
  .bar {
    flex: none;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px;
    background: var(--chrome);
    border-bottom: 1px solid var(--line);
  }
  .back {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    color: var(--accent-text);
    font-size: calc(16px * var(--text-scale));
  }
  .back :global(svg) {
    width: 20px;
    height: 20px;
  }
  .title {
    margin: 0;
    max-width: 60vw;
    overflow: hidden;
    font-size: calc(16px * var(--text-scale));
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
