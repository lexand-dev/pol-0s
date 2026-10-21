<script lang="ts">
  import { onDestroy } from 'svelte';
  import { PLAYER_VARS, PlayerState, YOUTUBE_EMBED_HOST, loadYouTubeApi, type YTPlayer } from '../../lib/youtube-player';
  import { UI_SVG } from '../icons';
  import { previousTrack, trackPosition } from '../../lib/player-queue';
  import { PLAYER_SVG } from './player-icons';
  import { player } from '../stores/player.svelte';

  /** `z`: su sitio entre las ventanas (escritorio); sin él, por encima de todo (móvil). `onraise`: al tocarlo, pasa delante. */
  let { z, onraise }: { z?: number; onraise?: () => void } = $props();

  // El mini reproductor (S-03). Se monta solo mientras hay algo que reproducir y es el único sitio que habla con YouTube. El vídeo siempre
  // está a la vista: las condiciones de YouTube no permiten ocultarlo ni reproducir en segundo plano.
  let box: HTMLDivElement | undefined = $state();
  let yt: YTPlayer | null = null;
  let loadedVideo: string | null = null;
  let failed = $state(false);
  let loading = $state(true);
  // Si suena o no, tal como lo cuenta YouTube (también cuando el visitante pausa con los controles del vídeo), no lo último que se pulsó aquí.
  let playing = $state(false);

  /** Crea el reproductor la primera vez y, después, solo cambia de vídeo. */
  async function show(video: string) {
    if (!box) return;
    failed = false;
    if (yt) {
      loadedVideo = video;
      yt.loadVideoById(video);
      return;
    }
    loading = true;
    try {
      const YT = await loadYouTubeApi();
      if (!box || player.current === null) return;
      const host = document.createElement('div');
      box.replaceChildren(host);
      loadedVideo = video;
      yt = new YT.Player(host, {
        width: '100%',
        height: '100%',
        videoId: video,
        host: YOUTUBE_EMBED_HOST,
        playerVars: { ...PLAYER_VARS },
        events: {
          onReady: (e) => {
            loading = false;
            e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === PlayerState.PLAYING) playing = true;
            else if (e.data === PlayerState.PAUSED) playing = false;
            else if (e.data === PlayerState.ENDED) {
              // Al acabar una canción pasa a la siguiente de la lista; con la última (o un tráiler) se queda parado.
              playing = false;
              player.next();
            }
          },
          onError: () => {
            failed = true;
            playing = false;
          },
        },
      });
    } catch {
      failed = true;
      loading = false;
    }
  }

  // Anterior, siguiente y posición se calculan aquí, con lo que ya sabe la tienda: una lista de varias canciones tiene los tres; un tráiler suelto, ninguno.
  const isList = $derived(player.queue.length > 1);
  const before = $derived(player.current ? previousTrack(player.queue, player.current.id) : null);
  const position = $derived(player.current ? trackPosition(player.queue, player.current.id) : null);

  function previous() {
    if (before) player.play(before, player.queue);
  }

  function toggle() {
    if (!yt) return;
    if (playing) yt.pauseVideo();
    else yt.playVideo();
  }

  // Cada vez que cambia lo que suena, se lleva al reproductor.
  $effect(() => {
    const video = player.current?.video;
    if (video && box && video !== loadedVideo) void show(video);
  });

  onDestroy(() => {
    try {
      yt?.destroy();
    } catch {
      /* sin efecto: el reproductor ya no existe */
    }
    yt = null;
  });
</script>

{#if player.current}
  <section class="mini" data-testid="miniplayer" aria-label="Reproductor" data-video={player.current.video} style:z-index={z} onpointerdown={onraise}>
    <header>
      <div class="meta">
        <strong data-testid="miniplayer-title">{player.current.title}</strong>
        <span data-testid="miniplayer-subtitle">{player.current.subtitle}{position ? ` · ${position}` : ''}</span>
      </div>
      <button class="ctl close" data-testid="miniplayer-close" aria-label="Cerrar el reproductor" onclick={() => player.close()}>
        <span aria-hidden="true">{@html UI_SVG.close}</span>
      </button>
    </header>
    <div class="video" data-testid="miniplayer-video" bind:this={box}>
      {#if loading && !failed}<p class="state" role="status">Cargando…</p>{/if}
    </div>
    {#if failed}
      <p class="error" role="alert" data-testid="miniplayer-error">
        No se ha podido cargar el vídeo.
        <a href={player.current.url} target="_blank" rel="noopener noreferrer" data-testid="miniplayer-fallback">Abrir en YouTube</a>
      </p>
    {:else}
      <div class="controls" role="group" aria-label="Controles del reproductor">
        {#if isList}
          <!-- aria-disabled y no disabled: así el botón sigue enfocable y el teclado no pierde el sitio al llegar al final de la lista. -->
          <button
            class="btn"
            data-testid="miniplayer-prev"
            aria-label="Canción anterior"
            aria-disabled={!before}
            onclick={previous}
          >
            <span aria-hidden="true">{@html PLAYER_SVG.prev}</span>
          </button>
        {/if}
        <button class="btn main" data-testid="miniplayer-toggle" aria-label={playing ? 'Pausar' : 'Reproducir'} data-playing={playing} onclick={toggle}>
          <span aria-hidden="true">{@html playing ? PLAYER_SVG.pause : UI_SVG.play}</span>
        </button>
        {#if isList}
          <button class="btn" data-testid="miniplayer-next" aria-label="Canción siguiente" aria-disabled={!player.hasNext} onclick={() => player.next()}>
            <span aria-hidden="true">{@html UI_SVG.next}</span>
          </button>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .mini {
    position: fixed;
    right: 16px;
    bottom: 100px;
    z-index: 7900;
    /* En escritorio va dentro de la capa de ventanas, que no recibe clics: él sí. */
    pointer-events: auto;
    /* Con 356 × 200 el vídeo cumple el mínimo de YouTube (200 × 200) con la proporción de siempre. */
    width: 356px;
    max-width: calc(100vw - 24px);
    border-radius: 12px;
    overflow: hidden;
    color: var(--fg);
    background: var(--win-bg);
    box-shadow: var(--shadow-win);
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 6px 12px;
    background: var(--chrome);
    border-bottom: 1px solid var(--line);
  }
  .meta {
    flex: 1;
    min-width: 0;
    display: grid;
    line-height: 1.25;
  }
  .meta strong,
  .meta span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta span {
    font-size: calc(13px * var(--text-scale));
    color: var(--muted);
  }
  .ctl {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    cursor: pointer;
  }
  .ctl:hover {
    background: var(--hover);
  }
  .ctl :global(svg) {
    width: 15px;
    height: 15px;
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px;
    background: var(--chrome);
    border-top: 1px solid var(--line);
  }
  .btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    cursor: pointer;
  }
  .btn:hover {
    background: var(--hover);
  }
  .btn.main {
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .btn.main:hover {
    filter: brightness(1.08);
  }
  .btn[aria-disabled='true'] {
    opacity: 0.35;
    cursor: default;
  }
  .btn[aria-disabled='true']:hover {
    background: none;
  }
  .btn :global(svg) {
    width: 16px;
    height: 16px;
  }
  .ctl:focus-visible,
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .video {
    position: relative;
    aspect-ratio: 16 / 9;
    min-height: 200px;
    background: #000;
  }
  .video :global(iframe) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .state {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
  }
  .error {
    margin: 0;
    padding: 10px 12px;
    font-size: calc(13px * var(--text-scale));
    color: var(--danger);
  }
  .error a {
    color: var(--accent-text);
  }
  /* En el móvil (y con cualquier pantalla táctil) los botones son grandes: el pulgar no apunta con precisión. */
  @media (max-width: 767px), (pointer: coarse) {
    .ctl {
      width: 44px;
      height: 44px;
    }
    .ctl :global(svg) {
      width: 18px;
      height: 18px;
    }
    .controls {
      gap: 24px;
      padding: 10px;
    }
    .btn {
      width: 48px;
      height: 48px;
    }
    .btn :global(svg) {
      width: 20px;
      height: 20px;
    }
  }
  @media (max-width: 767px) {
    .mini {
      right: 12px;
      left: 12px;
      width: auto;
      bottom: 92px;
    }
  }
</style>
