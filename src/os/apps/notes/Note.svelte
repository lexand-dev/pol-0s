<script lang="ts">
  import { PERSONA } from '../../../content/persona';
  import { formatNoteDate, noteDataHref, noteHref } from '../../../lib/notes';
  import { UI_SVG } from '../../icons';

  interface NoteBody {
    id: string;
    title: string;
    description: string;
    date: string;
    tags: string[];
    html: string;
  }

  let { id }: { id: string } = $props();

  let note = $state<NoteBody | null>(null);
  let failed = $state(false);

  // El texto de la nota se pide al abrirla (un archivo estático del propio sitio): la home no carga el de todas.
  $effect(() => {
    const wanted = id;
    note = null;
    failed = false;
    let cancelled = false;
    fetch(noteDataHref(wanted))
      .then((res) => (res.ok ? (res.json() as Promise<NoteBody>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!cancelled) note = data;
      })
      .catch(() => {
        if (!cancelled) failed = true;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="note" data-testid="note" data-note={id}>
  {#if note}
    <article class="sheet">
      <header>
        <h1 data-testid="note-title">{note.title}</h1>
        <p class="subtitle" data-testid="note-subtitle">{note.description}</p>
        <p class="meta">
          <time datetime={note.date.slice(0, 10)} data-testid="note-date">{formatNoteDate(note.date)}</time>
          {#if note.tags.length > 0}
            <span aria-hidden="true"> · </span>
            <span class="tags" data-testid="note-tags">{#each note.tags as tag (tag)}<span class="tag">{tag}</span>{/each}</span>
          {/if}
        </p>
      </header>

      <!-- El texto sale de un archivo del propio repositorio, nunca de un visitante. -->
      <div class="prose" data-testid="note-body">{@html note.html}</div>

      {#if PERSONA.newsletter}
        <aside class="cta" data-testid="note-subscribe">
          <p>Si te ha servido, suscríbete a <strong>{PERSONA.newsletter.name}</strong>: {PERSONA.newsletter.pitch}.</p>
          <a class="button" href={PERSONA.newsletter.url} target="_blank" rel="noopener noreferrer">
            Suscribirme a {PERSONA.newsletter.name} <span aria-hidden="true">{@html UI_SVG.external}</span>
          </a>
        </aside>
      {/if}

      <p class="permalink"><a href={noteHref(note.id)} target="_blank" rel="noopener noreferrer" data-testid="note-permalink">Abrir esta nota en su página</a></p>
    </article>
  {:else if failed}
    <p class="status" role="alert" data-testid="note-error">No se ha podido cargar la nota. Revisa tu conexión y vuelve a abrirla.</p>
  {:else}
    <p class="status" role="status" data-testid="note-loading">Cargando la nota…</p>
  {/if}
</div>

<style>
  .note {
    height: 100%;
    overflow-y: auto;
    padding: 20px 16px 32px;
    background: var(--paper-desk);
  }
  .sheet {
    max-width: 640px;
    margin: 0 auto;
    padding: 36px 44px 40px;
    border-radius: 4px;
    background: var(--paper-bg);
    color: var(--paper-fg);
    box-shadow:
      0 0 0 0.5px rgba(0, 0, 0, 0.2),
      0 10px 30px -12px rgba(0, 0, 0, 0.4);
    line-height: 1.6;
    font-size: calc(15px * var(--text-scale));
  }
  h1 {
    margin: 0;
    font-size: calc(24px * var(--text-scale));
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
  .subtitle {
    margin: 8px 0 0;
    font-size: calc(15px * var(--text-scale));
    line-height: 1.45;
    color: var(--paper-muted);
  }
  .meta {
    margin: 12px 0 22px;
    font-size: calc(13px * var(--text-scale));
    color: var(--paper-muted);
  }
  .tag {
    display: inline-block;
    margin: 0 4px 3px 0;
    padding: 1px 8px;
    border-radius: 99px;
    background: rgba(0, 0, 0, 0.06);
  }
  .prose :global(p) {
    margin: 0 0 12px;
  }
  .prose :global(h2) {
    margin: 24px 0 8px;
    font-size: calc(17px * var(--text-scale));
  }
  .prose :global(h3) {
    margin: 20px 0 6px;
    font-size: calc(15px * var(--text-scale));
  }
  .prose :global(ul),
  .prose :global(ol) {
    margin: 0 0 12px;
    padding-left: 22px;
  }
  .prose :global(li) {
    margin: 0 0 6px;
  }
  .prose :global(a) {
    color: var(--paper-link);
  }
  .prose :global(blockquote) {
    margin: 0 0 12px;
    padding: 2px 0 2px 14px;
    border-left: 3px solid var(--paper-line);
    color: var(--paper-muted);
  }
  .prose :global(code) {
    padding: 1px 4px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.06);
    font-family: var(--mono);
    font-size: 0.9em;
  }
  .prose :global(pre) {
    margin: 0 0 12px;
    padding: 12px 14px;
    overflow-x: auto;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.06);
    line-height: 1.5;
  }
  .prose :global(pre code) {
    padding: 0;
    background: none;
  }
  .prose :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }
  .cta {
    margin-top: 30px;
    padding: 16px 18px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.045);
  }
  .cta p {
    margin: 0 0 10px;
  }
  .button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--r-control);
    font-weight: 600;
    text-decoration: none;
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .button :global(svg) {
    width: 14px;
    height: 14px;
  }
  .permalink {
    margin: 20px 0 0;
    font-size: calc(13px * var(--text-scale));
  }
  .permalink a {
    color: var(--paper-link);
  }
  .status {
    margin: 60px 0;
    text-align: center;
    color: var(--muted);
  }
  @media (max-width: 520px) {
    .sheet {
      padding: 24px 20px 28px;
    }
  }
</style>
