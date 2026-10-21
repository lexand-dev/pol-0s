<script lang="ts">
  import { appLinkTarget } from '../../../lib/cv';
  import { HOWTO_DATA_PATH, type HowToData } from '../../../lib/howto';
  import { dispatch } from '../../stores/os-actions';
  import TechGrid from './TechGrid.svelte';

  let data = $state<HowToData | null>(null);
  let failed = $state(false);
  let desk: HTMLDivElement | undefined = $state();

  // El texto se pide al abrir la app (un archivo estático del propio sitio): la home no lo lleva.
  $effect(() => {
    let cancelled = false;
    fetch(HOWTO_DATA_PATH)
      .then((res) => (res.ok ? (res.json() as Promise<HowToData>) : Promise.reject(new Error(String(res.status)))))
      .then((d) => {
        if (!cancelled) data = d;
      })
      .catch(() => {
        if (!cancelled) failed = true;
      });
    return () => {
      cancelled = true;
    };
  });

  /** Va a una sección del propio documento, sin tocar la dirección de la página. */
  function goTo(id: string) {
    const target = desk?.querySelector<HTMLElement>(`[id="${id}"]`);
    if (!target) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  // Los enlaces `#abrir-…` del texto abren una app del escritorio; el resto son enlaces normales.
  function onclick(e: MouseEvent) {
    const link = (e.target as Element).closest('a');
    const app = appLinkTarget(link?.getAttribute('href'));
    if (!app) return;
    e.preventDefault();
    dispatch({ type: 'open', target: { app } });
  }
</script>

<div class="howto" data-testid="howto">
  <div class="bar"><span class="file">Cómo está hecho.md</span></div>

  <div class="desk" bind:this={desk}>
    {#if data}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <article class="sheet" {onclick}>
        <header>
          <h1 data-testid="howto-title">{data.title}</h1>
          <p class="lead">{data.description}</p>
        </header>

        <nav class="toc" aria-label="Índice" data-testid="howto-toc">
          <p class="toc-title">En este documento</p>
          <ol>
            {#each data.toc as entry (entry.id)}
              <li><button type="button" data-testid={`howto-toc-${entry.id}`} onclick={() => goTo(entry.id)}>{entry.title}</button></li>
            {/each}
          </ol>
        </nav>

        <!-- El texto sale de src/content/como-esta-hecho.md, del propio repositorio: nunca de un visitante. -->
        <div class="prose" data-testid="howto-body">
          {@html data.before}
          <TechGrid />
          {@html data.after}
        </div>
      </article>
    {:else if failed}
      <p class="status" role="alert" data-testid="howto-error">No se ha podido cargar el documento. Revisa tu conexión y vuelve a abrirlo.</p>
    {:else}
      <p class="status" role="status" data-testid="howto-loading">Cargando el documento…</p>
    {/if}
  </div>
</div>

<style>
  .howto {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--paper-desk);
  }
  .bar {
    flex: none;
    padding: 6px 14px;
    border-bottom: 1px solid var(--line);
    background: var(--chrome);
    color: var(--fg);
  }
  .file {
    font-weight: 600;
  }
  .desk {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 16px 32px;
  }
  .status {
    margin: 40px 0;
    text-align: center;
    color: var(--muted);
  }
  /* La hoja es blanca en los dos temas, como un documento de verdad. */
  .sheet {
    max-width: 700px;
    margin: 0 auto;
    padding: 44px 52px 52px;
    border-radius: 4px;
    background: var(--paper-bg);
    color: var(--paper-fg);
    box-shadow:
      0 0 0 0.5px rgba(0, 0, 0, 0.2),
      0 10px 30px -12px rgba(0, 0, 0, 0.4);
    line-height: 1.6;
  }
  h1 {
    margin: 0;
    font-size: calc(28px * var(--text-scale));
    line-height: 1.2;
    letter-spacing: -0.015em;
  }
  .lead {
    margin: 10px 0 0;
    font-size: calc(16px * var(--text-scale));
    color: var(--paper-muted);
  }
  .toc {
    margin: 22px 0 6px;
    padding: 14px 18px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.045);
  }
  .toc-title {
    margin: 0 0 6px;
    font-size: calc(12px * var(--text-scale));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--paper-muted);
  }
  .toc ol {
    margin: 0;
    padding-left: 20px;
  }
  .toc li {
    margin: 2px 0;
  }
  .toc button {
    padding: 2px 0;
    text-align: left;
    color: var(--paper-link);
    cursor: pointer;
    font: inherit;
  }
  .toc button:hover {
    text-decoration: underline;
  }
  .toc button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .prose :global(h2) {
    margin: 32px 0 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--paper-line);
    font-size: calc(19px * var(--text-scale));
  }
  .prose :global(h2:focus) {
    outline: none;
  }
  .prose :global(p) {
    margin: 0 0 12px;
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
  .prose :global(code) {
    padding: 1px 4px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.06);
    font-family: var(--mono);
    font-size: 0.9em;
  }
  @media (max-width: 520px) {
    .sheet {
      padding: 26px 20px 32px;
    }
  }
</style>
