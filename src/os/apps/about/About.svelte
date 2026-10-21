<script lang="ts">
  import { PERSONA } from '../../../content/persona';
  import { appLinkTarget } from '../../../lib/cv';
  import { UI_SVG } from '../../icons';
  import type { AboutData } from '../../items';
  import { dispatch } from '../../stores/os-actions';

  let { about }: { about: AboutData } = $props();

  // Los enlaces `#abrir-…` del texto abren una app del escritorio; el resto son enlaces normales.
  function onclick(e: MouseEvent) {
    const link = (e.target as Element).closest('a');
    const app = appLinkTarget(link?.getAttribute('href'));
    if (!app) return;
    e.preventDefault();
    dispatch({ type: 'open', target: { app } });
  }
</script>

<div class="about" data-testid="about">
  <div class="bar">
    <span class="file">Mi CV.pdf</span>
    {#if about.pdf}
      <a class="download" href={about.pdf} download={PERSONA.cvFileName} data-testid="about-download">
        <span aria-hidden="true">{@html UI_SVG.download}</span> Descargar PDF
      </a>
    {/if}
  </div>

  <div class="desk">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="sheet" {onclick}>
      <header>
        <img
          class="photo"
          src={about.photo.src}
          width={about.photo.width}
          height={about.photo.height}
          alt={PERSONA.name}
          data-testid="about-photo"
        />
        <div>
          <h1 data-testid="about-title">Hola, soy {PERSONA.firstName}</h1>
          <p class="tagline" data-testid="about-tagline">{about.tagline}</p>
        </div>
      </header>
      <p class="hook">{about.hook}</p>
      <div class="prose" data-testid="about-body">
        <!-- El texto sale de src/content/sobre-mi.md, del propio repositorio: nunca de un visitante. -->
        {@html about.html}
      </div>
    </article>
  </div>
</div>

<style>
  .about {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--paper-desk);
  }
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--line);
    background: var(--chrome);
    color: var(--fg);
  }
  .file {
    font-weight: 600;
  }
  .download {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 12px;
    border-radius: var(--r-control);
    font-weight: 600;
    text-decoration: none;
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .download:hover {
    filter: brightness(1.08);
  }
  .download :global(svg) {
    width: 14px;
    height: 14px;
  }
  .desk {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 16px 32px;
  }
  /* La hoja es blanca en los dos temas, como un documento de verdad. */
  .sheet {
    max-width: 660px;
    margin: 0 auto;
    padding: 44px 52px 48px;
    border-radius: 4px;
    background: var(--paper-bg);
    color: var(--paper-fg);
    box-shadow:
      0 0 0 0.5px rgba(0, 0, 0, 0.2),
      0 10px 30px -12px rgba(0, 0, 0, 0.4);
    line-height: 1.55;
  }
  header {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .photo {
    flex: none;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    object-fit: cover;
  }
  h1 {
    margin: 0;
    font-size: calc(26px * var(--text-scale));
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .tagline {
    margin: 4px 0 0;
    font-weight: 600;
  }
  .hook {
    margin: 18px 0 4px;
    color: var(--paper-muted);
    font-style: italic;
  }
  .prose :global(h2) {
    margin: 26px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--paper-line);
    font-size: calc(16px * var(--text-scale));
  }
  .prose :global(p) {
    margin: 0 0 10px;
  }
  .prose :global(ul) {
    margin: 0 0 10px;
    padding-left: 20px;
  }
  .prose :global(li) {
    margin: 0 0 6px;
  }
  .prose :global(a) {
    color: var(--paper-link);
  }
  .prose :global(a:focus-visible) {
    outline-offset: 2px;
  }
  @media (max-width: 520px) {
    .sheet {
      padding: 28px 22px 32px;
    }
    header {
      gap: 14px;
    }
    .photo {
      width: 64px;
      height: 64px;
    }
  }
</style>
