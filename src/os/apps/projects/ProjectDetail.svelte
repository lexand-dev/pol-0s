<script lang="ts">
  import { tick } from 'svelte';
  import { UI_SVG } from '../../icons';
  import { projectIcon, type ProjectData } from '../../items';
  import AppIcon from '../../shell/AppIcon.svelte';
  import { dispatch } from '../../stores/os-actions';
  import { detailSections, languageShares, primaryAction, repoButton } from './projects-view';

  interface Props {
    project: ProjectData;
    onback: () => void;
    onbrowser: () => void;
  }

  let { project, onback, onbrowser }: Props = $props();

  const action = $derived(primaryAction(project));
  const repo = $derived(repoButton(project));
  const shares = $derived(languageShares(project.github?.languages ?? []));
  const topics = $derived(project.github?.topics ?? []);
  const license = $derived(project.github?.license ?? null);
  const show = $derived(detailSections(project));

  // Captura ampliada: índice dentro de project.screenshots, o null si no hay ninguna.
  let zoom = $state<number | null>(null);
  let closeButton: HTMLButtonElement | undefined = $state();
  let opener: HTMLElement | null = null;

  async function open(i: number, e: MouseEvent) {
    opener = e.currentTarget as HTMLElement;
    zoom = i;
    await tick();
    closeButton?.focus();
  }

  function close() {
    zoom = null;
    opener?.focus();
  }

  function step(delta: number) {
    if (zoom === null) return;
    const n = project.screenshots.length;
    zoom = (zoom + delta + n) % n;
  }

  // Dentro de la ampliación: Escape la cierra a ella y no a la ventana; las flechas pasan de una captura a otra.
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Tab') {
      // Trampa de foco sencilla: solo hay tres controles dentro.
      const controls = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const shot = $derived(zoom === null ? null : project.screenshots[zoom]);
</script>

<div class="root" data-testid="project-detail" data-project={project.id}>
  <div class="scroll">
    <button class="back" data-testid="projects-back" onclick={onback}>
      <span aria-hidden="true">{@html UI_SVG.back}</span> Proyectos
    </button>

    <header class="head">
      <span class="icon" aria-hidden="true"><AppIcon icon={projectIcon(project)} /></span>
      <div class="title">
        <h2 data-testid="project-name">{project.name}</h2>
        <p class="domain">{project.domain}</p>
      </div>
    </header>

    <div class="actions">
      {#if action.kind === 'browser'}
        <button class="button primary" data-testid="project-open-browser" onclick={onbrowser}>{action.label}</button>
      {:else}
        <a class="button primary" data-testid="project-visit" href={action.href} target="_blank" rel="noopener noreferrer">
          {action.label} <span aria-hidden="true">{@html UI_SVG.external}</span>
        </a>
      {/if}
      {#if project.howto}
        <button class="button" data-testid="project-howto" onclick={() => dispatch({ type: 'open', target: { app: 'howto' } })}>Cómo está hecho</button>
      {/if}
      {#if repo}
        <a class="button" data-testid="project-repo" href={repo.href} target="_blank" rel="noopener noreferrer">
          {repo.label} <span aria-hidden="true">{@html UI_SVG.external}</span>
        </a>
      {/if}
    </div>

    {#if show.what}
      <section aria-labelledby="pd-what">
        <h3 id="pd-what">Qué es</h3>
        {#each project.details as paragraph, i (i)}
          <p class="para">{paragraph}</p>
        {/each}
      </section>
    {/if}

    {#if show.madeWith}
      <section aria-labelledby="pd-made" data-testid="project-made-with">
        <h3 id="pd-made">Hecho con</h3>
        {#if project.stack.length > 0}
          <ul class="chips" aria-label="Tecnologías">
            {#each project.stack as tech (tech)}<li class="chip">{tech}</li>{/each}
          </ul>
        {/if}
        {#if show.languages}
          <div class="langs" data-testid="project-languages">
            <div class="bar" role="img" aria-label={`Lenguajes del repositorio: ${shares.map((s) => `${s.name} ${s.share} %`).join(', ')}`}>
              {#each shares as s, i (s.name)}
                <span class="seg" style:flex={s.share} style:background={`var(--lang-${i + 1}, var(--muted))`}></span>
              {/each}
            </div>
            <ul class="legend">
              {#each shares as s, i (s.name)}
                <li><i style:background={`var(--lang-${i + 1}, var(--muted))`}></i>{s.name} <span class="pct">{s.share} %</span></li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if show.topics}
          <ul class="chips topics" aria-label="Etiquetas del repositorio" data-testid="project-topics">
            {#each topics as topic (topic)}<li class="chip">{topic}</li>{/each}
          </ul>
        {/if}
        {#if show.license}<p class="license" data-testid="project-license">Licencia: {license}</p>{/if}
      </section>
    {/if}

    {#if show.screenshots}
      <section aria-labelledby="pd-shots" data-testid="project-screenshots">
        <h3 id="pd-shots">Capturas</h3>
        <ul class="shots">
          {#each project.screenshots as s, i (s.src)}
            <li>
              <button class="shot" data-testid={`project-shot-${i}`} aria-label={`Ampliar: ${s.alt}`} onclick={(e) => open(i, e)}>
                {#if s.still}
                  <!-- Con movimiento reducido, el GIF se sustituye por su imagen fija. -->
                  <picture>
                    <source media="(prefers-reduced-motion: reduce)" srcset={s.still} />
                    <img src={s.src} alt="" loading="lazy" decoding="async" />
                  </picture>
                {:else}
                  <img src={s.src} alt="" loading="lazy" decoding="async" />
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>

  {#if shot}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="Captura ampliada" data-testid="project-lightbox" tabindex="-1" {onkeydown}>
      <div class="stage">
        {#if shot.still}
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcset={shot.still} />
            <img src={shot.src} alt={shot.alt} data-testid="project-lightbox-image" />
          </picture>
        {:else}
          <img src={shot.src} alt={shot.alt} data-testid="project-lightbox-image" />
        {/if}
      </div>
      <p class="caption">{shot.alt}</p>
      <div class="bar-controls">
        {#if project.screenshots.length > 1}
          <button class="ctl" aria-label="Captura anterior" data-testid="project-lightbox-prev" onclick={() => step(-1)}>
            <span aria-hidden="true">{@html UI_SVG.back}</span>
          </button>
        {/if}
        <button class="ctl" bind:this={closeButton} aria-label="Cerrar la captura" data-testid="project-lightbox-close" onclick={close}>
          <span aria-hidden="true">{@html UI_SVG.close}</span>
        </button>
        {#if project.screenshots.length > 1}
          <button class="ctl" aria-label="Captura siguiente" data-testid="project-lightbox-next" onclick={() => step(1)}>
            <span aria-hidden="true">{@html UI_SVG.forward}</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .root {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: var(--win-bg);
    color: var(--fg);
  }
  .scroll {
    height: 100%;
    overflow-y: auto;
    padding: 14px 24px 32px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 10px -6px;
    padding: 4px 8px 4px 4px;
    border-radius: 7px;
    font-size: calc(14px * var(--text-scale));
    color: var(--accent-text);
    cursor: pointer;
  }
  .back:hover {
    background: var(--hover);
  }
  .back :global(svg) {
    width: 16px;
    height: 16px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .icon {
    flex: none;
    width: 76px;
    height: 76px;
  }
  .title {
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: calc(24px * var(--text-scale));
    letter-spacing: -0.01em;
  }
  .domain {
    margin: 2px 0 0;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 18px 0 6px;
  }
  .button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-control);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    color: var(--fg);
    background: var(--hover);
  }
  .button:hover {
    filter: brightness(0.96);
  }
  .button.primary {
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .button.primary:hover {
    filter: brightness(1.08);
  }
  .button :global(svg) {
    width: 14px;
    height: 14px;
  }
  section {
    margin-top: 24px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: calc(14px * var(--text-scale));
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .para {
    margin: 0 0 10px;
    line-height: 1.55;
    max-width: 62ch;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
  .chip {
    padding: 2px 10px;
    border-radius: 99px;
    font-size: calc(13px * var(--text-scale));
    background: var(--accent-soft);
  }
  .topics .chip {
    background: var(--hover);
  }
  .langs {
    margin: 0 0 12px;
    max-width: 520px;
  }
  .bar {
    display: flex;
    height: 8px;
    gap: 2px;
    overflow: hidden;
    border-radius: 99px;
  }
  .seg {
    min-width: 4px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    font-size: calc(13px * var(--text-scale));
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .pct {
    color: var(--muted);
  }
  .license {
    margin: 0;
    color: var(--muted);
  }
  .shots {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .shot {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--line);
    background: var(--hover);
    cursor: zoom-in;
  }
  .shot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
  }
  .lightbox {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 16px 12px;
    background: rgba(0, 0, 0, 0.82);
    color: #ffffff;
    animation: fade 0.15s ease-out both;
  }
  /* La imagen rellena la caja y se ajusta con object-fit: con max-height en porcentaje, dentro de una caja de alto
     automático, se salía y tapaba el pie de foto y los controles. */
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
  }
  .stage img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .caption {
    margin: 0;
    max-width: 70ch;
    text-align: center;
    font-size: calc(13px * var(--text-scale));
    line-height: 1.4;
  }
  .bar-controls {
    display: flex;
    gap: 8px;
  }
  .ctl {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.18);
    cursor: pointer;
  }
  .ctl:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  .ctl:focus-visible {
    outline-color: #ffffff;
  }
  .ctl :global(svg) {
    width: 18px;
    height: 18px;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lightbox {
      animation: none;
    }
  }
</style>
