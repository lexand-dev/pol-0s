/**
 * El reproductor oficial de YouTube (S-03), cargado solo cuando el visitante pulsa play: hasta entonces no se pide nada a YouTube. Usa la API
 * oficial (`iframe_api`) y el dominio sin cookies (`youtube-nocookie.com`). El vídeo siempre se ve: las condiciones de YouTube no permiten
 * ocultarlo, reproducir en segundo plano ni separar el audio. No toca nada de Node: solo se importa desde el navegador.
 */

export const YOUTUBE_API_SRC = 'https://www.youtube.com/iframe_api';
export const YOUTUBE_EMBED_HOST = 'https://www.youtube-nocookie.com';

/** Los estados de `onStateChange` que usamos. */
export const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

export interface YTPlayer {
  loadVideoById(video: string): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

export interface YTPlayerOptions {
  width: string;
  height: string;
  videoId: string;
  host: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

/** Carga la API una sola vez. Si falla (sin conexión, bloqueada), se puede volver a intentar al pulsar otra vez. */
export function loadYouTubeApi(timeoutMs = 10_000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = (reason: string) => {
      script.remove();
      loading = null;
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail('YouTube tardó demasiado en cargar'), timeoutMs);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else fail('YouTube no ofrece el reproductor');
    };
    script.src = YOUTUBE_API_SRC;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      fail('No se pudo cargar YouTube');
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Los parámetros con los que se crea el reproductor: empieza solo al pulsar (el visitante ya lo ha pedido) y sin vídeos sugeridos de otros canales. */
export const PLAYER_VARS = { autoplay: 1, playsinline: 1, rel: 0 } as const;
