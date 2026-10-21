/**
 * Carga y uso del widget de Turnstile en el navegador. El script se pide al abrir Correo, no al
 * entrar en la home, y con renderizado explícito. El token solo vale para un envío: tras cada
 * intento hay que pedir uno nuevo con `reset`.
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Clave de prueba que publica Cloudflare: siempre pasa. Solo se usa en desarrollo. */
export const DEV_TEST_SITE_KEY = '1x00000000000000000000AA';

export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      'timeout-callback'?: () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * En desarrollo se usa siempre la clave de prueba: la real solo acepta el dominio publicado y
 * en localhost da el error 110200. En producción se lee al compilar; sin ella el formulario no
 * puede enviar.
 */
export function siteKey(): string | null {
  if (import.meta.env.DEV) return DEV_TEST_SITE_KEY;
  return (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) || null;
}

let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no disponible')));
    script.onerror = () => {
      script.remove();
      loading = null; // permite reintentar al volver a abrir Correo
      reject(new Error('No se pudo cargar Turnstile'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
