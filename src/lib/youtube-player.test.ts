import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// La carga de la API de YouTube (S-03), con un `window` y un `document` mínimos: no se pide nada a YouTube.
interface FakeScript {
  src: string;
  async: boolean;
  onerror: (() => void) | null;
  remove: () => void;
  removed: boolean;
}

let scripts: FakeScript[];
let fakeWindow: { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void };

beforeEach(() => {
  scripts = [];
  fakeWindow = {};
  vi.useFakeTimers();
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('document', {
    createElement: (): FakeScript => {
      const script: FakeScript = { src: '', async: false, onerror: null, removed: false, remove: () => void (script.removed = true) };
      return script;
    },
    head: { appendChild: (s: FakeScript) => void scripts.push(s) },
  });
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const load = async () => (await import('./youtube-player')).loadYouTubeApi;

describe('loadYouTubeApi', () => {
  test('no pide nada hasta que se la llama, y entonces pide solo el script oficial de la API', async () => {
    const loadYouTubeApi = await load();
    expect(scripts).toHaveLength(0);
    void loadYouTubeApi().catch(() => undefined);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://www.youtube.com/iframe_api');
    expect(scripts[0].async).toBe(true);
  });

  test('se resuelve cuando YouTube avisa de que está lista, y se carga una sola vez aunque se llame varias', async () => {
    const loadYouTubeApi = await load();
    const a = loadYouTubeApi();
    const b = loadYouTubeApi();
    expect(scripts).toHaveLength(1);
    fakeWindow.YT = { Player: class {} };
    fakeWindow.onYouTubeIframeAPIReady?.();
    expect(await a).toBe(fakeWindow.YT);
    expect(await b).toBe(fakeWindow.YT);
  });

  test('si la API ya está en la página, no se vuelve a pedir', async () => {
    fakeWindow.YT = { Player: class {} };
    const loadYouTubeApi = await load();
    expect(await loadYouTubeApi()).toBe(fakeWindow.YT);
    expect(scripts).toHaveLength(0);
  });

  test('si el script no carga, falla, retira el script y se puede volver a intentar', async () => {
    const loadYouTubeApi = await load();
    const first = loadYouTubeApi();
    const caught = first.catch((e: Error) => e.message);
    scripts[0].onerror?.();
    expect(await caught).toMatch(/No se pudo cargar/);
    expect(scripts[0].removed).toBe(true);

    const second = loadYouTubeApi();
    expect(scripts).toHaveLength(2);
    fakeWindow.YT = { Player: class {} };
    fakeWindow.onYouTubeIframeAPIReady?.();
    expect(await second).toBeDefined();
  });

  test('si tarda demasiado, falla y se puede volver a intentar', async () => {
    const loadYouTubeApi = await load();
    const result = loadYouTubeApi(5000).catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await result).toMatch(/tardó demasiado/);
    void loadYouTubeApi(5000).catch(() => undefined);
    expect(scripts).toHaveLength(2);
  });

  test('si avisa de que está lista pero no hay reproductor, falla en lugar de quedarse colgada', async () => {
    const loadYouTubeApi = await load();
    const result = loadYouTubeApi().catch((e: Error) => e.message);
    fakeWindow.onYouTubeIframeAPIReady?.();
    expect(await result).toMatch(/no ofrece el reproductor/);
  });
});

describe('constantes', () => {
  test('el vídeo se incrusta desde el dominio sin cookies y empieza al pulsar, sin sugerencias de otros canales', async () => {
    const { YOUTUBE_EMBED_HOST, PLAYER_VARS } = await import('./youtube-player');
    expect(YOUTUBE_EMBED_HOST).toBe('https://www.youtube-nocookie.com');
    expect(PLAYER_VARS).toMatchObject({ autoplay: 1, playsinline: 1, rel: 0 });
  });
});
