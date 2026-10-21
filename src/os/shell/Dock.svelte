<script lang="ts" module>
  /** Una ventana minimizada: vive en el dock, a la derecha, hasta que se recupera. */
  export interface MinimizedWindow {
    key: string;
    title: string;
    icon: IconSpec;
  }
</script>

<script lang="ts">
  import type { AppId } from '../apps/registry';
  import type { IconSpec } from '../icons';
  import type { DockItem } from '../items';
  import AppIcon from './AppIcon.svelte';

  interface Props {
    items: DockItem[];
    running: Set<AppId>;
    minimized?: MinimizedWindow[];
    onopen: (app: AppId) => void;
    onrestore?: (key: string) => void;
  }

  let { items, running, minimized = [], onopen, onrestore }: Props = $props();
</script>

<nav class="dock" data-testid="dock" aria-label="Dock">
  {#each items as item, i (item.app)}
    {#if i === items.length - 1}<span class="separator" aria-hidden="true"></span>{/if}
    <button
      class="item"
      class:running={running.has(item.app)}
      data-testid={`dock-item-${item.app}`}
      aria-label={item.label}
      onclick={() => onopen(item.app)}
    >
      <AppIcon icon={item.icon} />
      <span class="tip" aria-hidden="true">{item.label}</span>
    </button>
  {/each}
  {#if minimized.length > 0}
    <span class="separator" aria-hidden="true"></span>
    {#each minimized as win (win.key)}
      <button
        class="item minimized"
        data-testid={`dock-minimized-${win.key}`}
        aria-label={`Recuperar ${win.title}`}
        onclick={() => onrestore?.(win.key)}
      >
        <AppIcon icon={win.icon} />
        <span class="tip" aria-hidden="true">{win.title}</span>
      </button>
    {/each}
  {/if}
</nav>

<style>
  .dock {
    position: absolute;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
    z-index: 8000;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 22px;
    background: var(--glass);
    border: 0.5px solid var(--glass-border);
    backdrop-filter: var(--blur-glass);
    -webkit-backdrop-filter: var(--blur-glass);
    box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.35);
  }
  .separator {
    width: 1px;
    align-self: stretch;
    margin: 4px 4px;
    background: var(--line-strong);
  }
  .item {
    position: relative;
    width: 52px;
    height: 52px;
    transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }
  .item:hover,
  .item:focus-visible {
    transform: translateY(-8px) scale(1.14);
  }
  .tip {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    padding: 3px 9px;
    border-radius: 6px;
    white-space: nowrap;
    font-size: calc(13px * var(--text-scale));
    color: var(--fg);
    background: var(--glass-strong);
    border: 0.5px solid var(--glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .item:hover .tip,
  .item:focus-visible .tip {
    opacity: 1;
  }
  .minimized {
    animation: dock-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
  }
  @keyframes dock-in {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
  }
  .running::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -5px;
    width: 4px;
    height: 4px;
    margin-left: -2px;
    border-radius: 50%;
    background: var(--fg);
    opacity: 0.7;
  }
  @media (prefers-reduced-motion: reduce) {
    .minimized {
      animation: none;
    }
    .item:hover,
    .item:focus-visible {
      transform: none;
    }
  }
</style>
