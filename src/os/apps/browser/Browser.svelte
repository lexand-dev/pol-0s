<script lang="ts">
  import { PERSONA } from '../../../content/persona';
  import { untrack } from 'svelte';
  import { UI_SVG } from '../../icons';
  import { projectIcon, type ProjectData } from '../../items';
  import AppIcon from '../../shell/AppIcon.svelte';
  import { browserView } from '../../stores/browser.svelte';
  import * as H from './history';

  interface Props {
    projects: ProjectData[];
    /** Proyecto con el que se abre la ventana; null es la página de Favoritos. */
    initial?: string | null;
    /** Cambia cada vez que se pide abrir el Navegador: si trae proyecto, se navega a él. */
    nav?: number;
  }

  let { projects, initial = null, nav = 0 }: Props = $props();

  const known = $derived(new Set(projects.map((p) => p.id)));
  const byId = (id: H.Entry) => (id === null ? null : (projects.find((p) => p.id === id) ?? null));

  let history = $state.raw(untrack(() => H.visit(H.createHistory(), initial, known)));
  let reloadKey = $state(0);
  let loading = $state(untrack(() => byId(H.current(history))?.embeddable ?? false));
  let lastNav = untrack(() => nav);

  const project = $derived(byId(H.current(history)));
  const secure = $derived(project?.url.startsWith('https://') ?? false);

  // Una web de otro dominio necesita su propio origen para funcionar (cookies, almacenamiento).
  // Una página local no: sin allow-same-origin no puede salir del sandbox ni tocar Pol OS.
  const SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';
  const sandbox = $derived(project?.url.startsWith('/') ? SANDBOX : `${SANDBOX} allow-same-origin`);

  // Los menús de la barra (Archivo → "Abrir en pestaña nueva") necesitan saber qué proyecto se ve.
  $effect(() => {
    browserView.projectId = project?.id ?? null;
    return () => (browserView.projectId = null);
  });

  // Doble clic en el icono de un proyecto con el Navegador ya abierto: la ventana navega a él.
  $effect(() => {
    const n = nav;
    const target = initial;
    if (n === lastNav) return;
    lastNav = n;
    if (target) untrack(() => go(target));
  });

  function show(next: H.BrowserHistory) {
    if (next === history) return;
    history = next;
    loading = byId(H.current(next))?.embeddable ?? false;
  }

  const go = (entry: H.Entry) => show(H.visit(history, entry, known));

  function reload() {
    if (!project?.embeddable) return;
    reloadKey += 1;
    loading = true;
  }
</script>

<div class="browser" data-testid="browser">
  <div class="toolbar">
    <button class="tool" data-testid="browser-back" aria-label="Atrás" disabled={!H.canGoBack(history)} onclick={() => show(H.back(history))}>
      {@html UI_SVG.backSmall}
    </button>
    <button
      class="tool"
      data-testid="browser-forward"
      aria-label="Adelante"
      disabled={!H.canGoForward(history)}
      onclick={() => show(H.forward(history))}
    >
      {@html UI_SVG.forward}
    </button>
    <button class="tool" data-testid="browser-reload" aria-label="Recargar" disabled={!project?.embeddable} onclick={reload}>
      {@html UI_SVG.reload}
    </button>

    <div class="address" data-testid="browser-address">
      {#if project}
        {#if secure}<span class="address-icon" role="img" aria-label="Conexión segura">{@html UI_SVG.lock}</span>{/if}
        <span class="address-text">{project.domain}</span>
      {:else}
        <span class="address-icon" aria-hidden="true">{@html UI_SVG.star}</span>
        <span class="address-text">Favoritos</span>
      {/if}
    </div>

    <button class="tool" data-testid="browser-home" aria-label="Favoritos" onclick={() => go(null)}>
      {@html UI_SVG.star}
    </button>
    {#if project}
      <a
        class="tool"
        data-testid="browser-open-external"
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir en pestaña nueva"
        title="Abrir en pestaña nueva"
      >
        {@html UI_SVG.external}
      </a>
    {:else}
      <button class="tool" aria-label="Abrir en pestaña nueva" disabled>{@html UI_SVG.external}</button>
    {/if}
  </div>

  <div class="favorites" role="toolbar" aria-label="Barra de favoritos">
    {#each projects as p (p.id)}
      <button class="fav" data-testid={`browser-fav-${p.id}`} aria-pressed={project?.id === p.id} onclick={() => go(p.id)}>
        <span class="fav-icon" aria-hidden="true">
          <AppIcon icon={projectIcon(p)} />
        </span>
        {p.name}
      </button>
    {/each}
  </div>

  <div class="page">
    {#if !project}
      <div class="start" data-testid="browser-start">
        <h2>Favoritos</h2>
        <div class="tiles">
          {#each projects as p (p.id)}
            <button class="tile" data-testid={`browser-tile-${p.id}`} onclick={() => go(p.id)}>
              <span class="tile-icon" aria-hidden="true">
                <AppIcon icon={projectIcon(p)} />
              </span>
              <span class="tile-name">{p.name}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else if project.embeddable}
      {#key `${project.id}-${reloadKey}`}
        <iframe
          data-testid="browser-frame"
          src={project.url}
          title={project.name}
          {sandbox}
          referrerpolicy="strict-origin-when-cross-origin"
          onload={() => (loading = false)}
        ></iframe>
      {/key}
      {#if loading}
        <div class="loading" data-testid="browser-loading" role="status">Cargando {project.domain}…</div>
      {/if}
    {:else}
      <div class="blocked" data-testid="browser-blocked">
        <span class="blocked-icon" aria-hidden="true">{@html UI_SVG.shield}</span>
        <h2>{project.name} no se puede abrir dentro de {PERSONA.osName}</h2>
        <p>Este sitio no permite que otra web lo muestre dentro de una ventana. Puedes verlo en una pestaña nueva.</p>
        <a class="button" data-testid="browser-blocked-open" href={project.url} target="_blank" rel="noopener noreferrer">
          {@html UI_SVG.external}Abrir en pestaña nueva
        </a>
      </div>
    {/if}
  </div>
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px;
    background: var(--chrome);
    border-bottom: 1px solid var(--line);
  }
  .tool {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    color: var(--muted);
    cursor: pointer;
  }
  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--fg);
  }
  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tool :global(svg) {
    width: 16px;
    height: 16px;
  }
  .address {
    flex: 1;
    min-width: 0;
    height: 28px;
    margin: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 10px;
    border-radius: var(--r-control);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .address-icon {
    flex: none;
    color: var(--muted);
  }
  .address-icon :global(svg) {
    width: 12px;
    height: 12px;
  }
  .address-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .favorites {
    flex: none;
    display: flex;
    gap: 4px;
    padding: 5px 10px;
    overflow-x: auto;
    background: var(--win-bg);
    border-bottom: 1px solid var(--line);
  }
  .fav {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px 3px 4px;
    border-radius: 6px;
    white-space: nowrap;
    cursor: pointer;
  }
  .fav:hover {
    background: var(--hover);
  }
  .fav[aria-pressed='true'] {
    background: var(--accent-soft);
  }
  .fav-icon {
    width: 18px;
    height: 18px;
  }
  .page {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--surface);
  }
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: #ffffff;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--muted);
    background: var(--surface);
  }
  .start {
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 24px 36px;
  }
  .start h2 {
    margin: 0 0 16px;
    font-size: calc(20px * var(--text-scale));
  }
  /* Como los Favoritos de Safari: solo el icono y el nombre. El detalle de cada proyecto vive en su propia página. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 16px 6px;
    justify-items: center;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    width: 92px;
    padding: 6px 4px 4px;
    border-radius: 12px;
    cursor: pointer;
  }
  .tile:hover {
    background: var(--hover);
  }
  .tile-icon {
    flex: none;
    width: 64px;
    height: 64px;
  }
  .tile-name {
    max-width: 100%;
    font-size: calc(13px * var(--text-scale));
    line-height: 1.25;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .blocked {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 24px;
    text-align: center;
  }
  .blocked-icon {
    color: var(--muted);
  }
  .blocked-icon :global(svg) {
    width: 44px;
    height: 44px;
  }
  .blocked h2 {
    margin: 0;
    max-width: 30ch;
    font-size: calc(17px * var(--text-scale));
    text-wrap: balance;
  }
  .blocked p {
    margin: 0;
    max-width: 40ch;
    color: var(--muted);
    line-height: 1.5;
  }
  .button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 14px;
    border-radius: var(--r-control);
    font-weight: 600;
    text-decoration: none;
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .button :global(svg) {
    width: 15px;
    height: 15px;
  }
</style>
