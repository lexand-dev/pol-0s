<script lang="ts">
  import { formatNoteDate } from '../../../lib/notes';
  import type { NoteData } from '../../items';
  import AppIcon from '../../shell/AppIcon.svelte';
  import { dispatch } from '../../stores/os-actions';

  // Las notas ya llegan ordenadas, de la más reciente a la más antigua.
  let { notes }: { notes: NoteData[] } = $props();

  let selected = $state<string | null>(null);

  const open = (id: string) => dispatch({ type: 'open', target: { app: 'note', arg: id } });

  // Como en Finder: un clic selecciona y doble clic abre; con el teclado (detail 0), Enter abre.
  function onclick(e: MouseEvent, id: string) {
    selected = id;
    if (e.detail === 0 || e.detail >= 2) open(id);
  }
</script>

<div class="folder" data-testid="notes-folder">
  {#if notes.length === 0}
    <p class="empty" data-testid="notes-empty">Todavía no hay notas.</p>
  {:else}
    <ul class="grid" aria-label="Notas">
      {#each notes as note (note.id)}
        <li>
          <button
            class="note"
            class:selected={selected === note.id}
            data-testid={`notes-item-${note.id}`}
            aria-pressed={selected === note.id}
            title={note.description}
            onclick={(e) => onclick(e, note.id)}
          >
            <span class="icon" aria-hidden="true"><AppIcon icon={{ kind: 'art', art: 'notefile' }} /></span>
            <span class="title">{note.title}</span>
            <span class="date">{formatNoteDate(note.date)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .folder {
    height: 100%;
    overflow-y: auto;
    padding: 18px 16px 24px;
    background: var(--win-bg);
    color: var(--fg);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 10px 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .note {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 8px 6px 6px;
    border-radius: 8px;
    text-align: center;
  }
  .note:hover {
    background: var(--hover);
  }
  .note.selected {
    background: var(--accent-soft);
  }
  .icon {
    width: 52px;
    height: 52px;
    flex: none;
  }
  .title {
    font-size: calc(13px * var(--text-scale));
    line-height: 1.25;
    font-weight: 500;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .date {
    font-size: calc(12px * var(--text-scale));
    color: var(--muted);
  }
  /* Sobre el fondo de selección, el gris de la fecha no llega al contraste mínimo en modo oscuro. */
  .note.selected .date {
    color: var(--fg);
  }
  .empty {
    margin: 40px 0;
    text-align: center;
    color: var(--muted);
  }
</style>
