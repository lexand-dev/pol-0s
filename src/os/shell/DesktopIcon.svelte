<script lang="ts">
  import type { Item } from '../items';
  import AppIcon from './AppIcon.svelte';

  interface Props {
    item: Item;
    selected: boolean;
    onselect: () => void;
    onopen: () => void;
  }

  let { item, selected, onselect, onopen }: Props = $props();

  // Como en macOS: un clic selecciona y doble clic abre. Con teclado (detail 0) Enter abre.
  // En los enlaces, el segundo clic deja actuar al navegador, que abre la pestaña nueva.
  function onclick(e: MouseEvent) {
    onselect();
    if (e.detail === 1) {
      e.preventDefault();
      return;
    }
    if (!item.href) onopen();
  }
</script>

{#if item.href}
  <a
    class="icon"
    class:selected
    href={item.href}
    target="_blank"
    rel="noopener noreferrer"
    data-testid={`desktop-icon-${item.id}`}
    {onclick}
  >
    <span class="art shortcut"><AppIcon icon={item.icon} /></span>
    <span class="label">{item.label}</span>
  </a>
{:else}
  <button class="icon" class:selected data-testid={`desktop-icon-${item.id}`} aria-pressed={selected} {onclick}>
    <span class="art"><AppIcon icon={item.icon} /></span>
    <span class="label">{item.label}</span>
  </button>
{/if}

<style>
  .icon {
    direction: ltr;
    width: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 6px 2px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--on-wall);
  }
  .art {
    position: relative;
    width: 56px;
    height: 56px;
    padding: 3px;
    border-radius: 12px;
  }
  .label {
    max-width: 100%;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: calc(13px * var(--text-scale));
    font-weight: 500;
    line-height: 1.25;
    text-align: center;
    overflow-wrap: anywhere;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
  }
  .selected .art {
    background: rgba(0, 0, 0, 0.22);
  }
  .selected .label {
    background: var(--accent-solid);
    color: #ffffff;
    text-shadow: none;
  }
  /* Flecha de alias de macOS: el enlace sale de Pol OS. */
  .shortcut::after {
    content: '';
    position: absolute;
    left: 2px;
    bottom: 2px;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: #ffffff
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 11L11 5M6 5h5v5'/%3E%3C/svg%3E")
      center / 11px no-repeat;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }
</style>
