import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Carga la home y espera a que la isla esté hidratada (el botón de entrar recibe el foco). */
export async function gotoLock(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('lock-enter')).toBeFocused();
}

/** Entra al sistema como lo haría un visitante: clic en el campo de contraseña. */
export async function enter(page: Page) {
  await gotoLock(page);
  await page.getByTestId('lock-enter').click();
  await expect(page.getByTestId('lock-screen')).toHaveCount(0);
}

/** Lo que aparece tras entrar depende del ancho: escritorio o pantalla de inicio. */
export const homeTestId = (projectName: string) => (projectName.endsWith('movil') ? 'mobile-home' : 'desktop');

export interface ProjectFile {
  id: string;
  name: string;
  description: string;
  summary: string;
  details: string[];
  stack: string[];
  screenshots: { src: string; alt: string; still?: string }[];
  repo?: string;
  github?: { languages: { name: string; bytes: number }[]; topics: string[]; license: string | null };
  icon?: string;
  placement: 'folder' | 'desktop';
  domain: string;
  url: string;
  embeddable: boolean;
  order: number;
}

/** Los proyectos tal como están en la colección, en el orden en que se muestran. */
export function loadProjects(): ProjectFile[] {
  const dir = join(process.cwd(), 'src/content/projects');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    // Los valores por defecto del esquema (`default([])`) no existen al leer el JSON en crudo.
    .map((f) => ({ id: f.replace(/\.json$/, ''), details: [], screenshots: [], placement: 'folder', ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
    .sort((a, b) => a.order - b.order);
}

/** Los proyectos que viven dentro de la carpeta Proyectos y los que tienen su propio icono en el escritorio. */
export const inFolder = (list: readonly ProjectFile[]) => list.filter((p) => p.placement === 'folder');
export const onDesktop = (list: readonly ProjectFile[]) => list.filter((p) => p.placement === 'desktop');

/**
 * Abre el detalle de un proyecto como lo haría un visitante. Los de la carpeta: doble clic en Proyectos y su tarjeta (en móvil, la
 * carpeta y un toque). Los que tienen icono propio: doble clic en su icono (en móvil, un toque en la pantalla de inicio).
 */
export async function openProjectDetail(page: Page, projectName: string, project: ProjectFile) {
  const own = project.placement === 'desktop';
  if (projectName.endsWith('movil')) {
    if (!own) await page.getByTestId('mobile-icon-folder-projects').tap();
    await page.getByTestId(`mobile-icon-project-${project.id}`).tap();
  } else if (own) {
    await page.getByTestId(`desktop-icon-project-${project.id}`).dblclick();
  } else {
    await page.getByTestId('desktop-icon-projects').dblclick();
    await page.getByTestId(`projects-card-${project.id}`).click();
  }
  await expect(page.getByTestId('project-detail')).toHaveAttribute('data-project', project.id);
}

/** Las webs externas de los proyectos se sustituyen por una página local: los tests no salen a internet. */
export async function stubExternalSites(context: BrowserContext) {
  await context.route(/^https:\/\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><title>stub</title><p data-stub>Sitio externo simulado: ${new URL(route.request().url()).host}</p>`,
    }),
  );
}

/** Abre Correo desde el dock: ventana en escritorio, pantalla completa en móvil. */
export async function openMail(page: Page, projectName: string) {
  if (projectName.endsWith('movil')) await page.getByTestId('mobile-dock-mail').tap();
  else await page.getByTestId('dock-item-mail').click();
  const mail = page.getByTestId('mail');
  await expect(mail).toBeVisible();
  return mail;
}

/**
 * Sustituye el script de Turnstile por uno de prueba que entrega un token al instante y uno nuevo
 * en cada `reset`, como el real. Así los tests no cargan nada de internet.
 */
export async function stubTurnstile(context: BrowserContext) {
  await context.route(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `(() => {
        let n = 0, callback = () => {};
        window.turnstile = {
          render(el, options) {
            callback = options.callback;
            el.textContent = 'Verificación simulada';
            setTimeout(() => callback('TOKEN-' + ++n), 0);
            return 'widget-1';
          },
          reset() { setTimeout(() => callback('TOKEN-' + ++n), 0); },
          remove() {},
        };
      })();`,
    }),
  );
}

export interface SentPayload {
  from: string;
  subject: string;
  message: string;
  turnstileToken: string;
  website: string;
}

/** Simula /api/contact y guarda lo que el formulario manda, para comprobarlo después. */
export async function stubContactApi(
  page: Page,
  reply: { status: number; body: Record<string, unknown> } = { status: 200, body: { ok: true, code: 'sent' } },
) {
  const requests: SentPayload[] = [];
  await page.route('**/api/contact', async (route) => {
    requests.push(route.request().postDataJSON() as SentPayload);
    await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  });
  return requests;
}

/** El contraste se mide con los colores finales, no a mitad de una animación de entrada. */
export const animationsDone = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));

export interface NoteFile {
  id: string;
  title: string;
  description: string;
  date: string;
  order: number;
  tags: string[];
  body: string;
}

/** Las notas tal como están en src/content/notes, en el orden en que se muestran (la más reciente primero). */
export function loadNotes(): NoteFile[] {
  const dir = join(process.cwd(), 'src/content/notes');
  const notes = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)!;
      const field = (k: string) => new RegExp(`^${k}: (.*)$`, 'm').exec(front)![1].trim();
      const unquote = (v: string) => v.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
      return {
        id: f.replace(/\.md$/, ''),
        title: unquote(field('title')),
        description: unquote(field('description')),
        date: field('date'),
        order: Number(field('order')),
        tags: field('tags').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()),
        body: body.trim(),
      };
    });
  return notes.sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order || a.id.localeCompare(b.id));
}


export interface GuestbookFile {
  id: string;
  name: string;
  detail?: string;
  relation: string;
  text: string;
  links: { network: string; url: string }[];
  date?: string;
  order?: number;
}

/** Las reseñas tal como están en src/content/guestbook, en el orden en que se muestran (las sin fecha, al final). */
export function loadGuestbook(): GuestbookFile[] {
  const dir = join(process.cwd(), 'src/content/guestbook');
  const time = (e: GuestbookFile) => (e.date ? Date.parse(e.date) : Number.NEGATIVE_INFINITY);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: f.replace(/\.json$/, ''), links: [], ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }) as GuestbookFile)
    .sort((a, b) => (time(b) === time(a) ? 0 : time(b) > time(a) ? 1 : -1) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

export interface GuestbookPayload {
  kind: string;
  name: string;
  detail: string;
  relation: string;
  text: string;
  email: string;
  links: { network: string; value: string }[];
  consent: boolean;
  turnstileToken: string;
  website: string;
}

/** Simula POST /api/guestbook y guarda lo que el formulario manda, para comprobarlo después. */
export async function stubGuestbookApi(
  page: Page,
  reply: { status: number; body: Record<string, unknown> } = { status: 200, body: { ok: true, code: 'sent' } },
) {
  const requests: GuestbookPayload[] = [];
  await page.route('**/api/guestbook', async (route) => {
    requests.push(route.request().postDataJSON() as GuestbookPayload);
    await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  });
  return requests;
}

/** Los cuatro archivos de Favoritos (S-03), en el orden de las secciones. */
export interface FavoritesFile {
  kind: 'games' | 'movies' | 'books' | 'music';
  title: string;
  credit?: { label: string; url: string };
  link?: { label: string; url: string };
  items: { id: string; title: string; cover: string; [key: string]: unknown }[];
}
export function loadFavorites(): FavoritesFile[] {
  const dir = join(process.cwd(), 'src/content/favorites');
  return ['games', 'movies', 'books', 'music'].map((k) => JSON.parse(readFileSync(join(dir, `${k}.json`), 'utf8')) as FavoritesFile);
}

/**
 * Sustituye la API de YouTube por una de mentira, que cumple el mismo contrato (`YT.Player`) y deja apuntado en `window.__yt` qué vídeos se
 * piden y cuántas veces se destruye el reproductor. Así los tests no cargan nada de internet. `endCurrent` y `failCurrent` simulan que acaba
 * una canción o que el vídeo no se puede cargar.
 */
export async function stubYouTube(context: BrowserContext) {
  await context.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `(() => {
        window.__yt = { players: [], loads: [], calls: [], destroyed: 0 };
        class Player {
          constructor(host, options) {
            this.options = options;
            this.video = options.videoId;
            this.iframe = document.createElement('iframe');
            this.iframe.setAttribute('data-fake-youtube', '');
            this.iframe.setAttribute('title', 'YouTube simulado');
            this.iframe.src = 'about:blank';
            host.replaceWith(this.iframe);
            window.__yt.players.push(this);
            window.__yt.loads.push(options.videoId);
            window.__yt.host = options.host;
            window.__yt.playerVars = options.playerVars;
            setTimeout(() => options.events.onReady && options.events.onReady({ target: this }), 0);
          }
          emit(data) { this.options.events.onStateChange && this.options.events.onStateChange({ data }); }
          loadVideoById(video) { this.video = video; window.__yt.loads.push(video); this.emit(1); }
          playVideo() { window.__yt.calls.push('play'); this.emit(1); }
          pauseVideo() { window.__yt.calls.push('pause'); this.emit(2); }
          destroy() { window.__yt.destroyed += 1; this.iframe.remove(); }
        }
        window.YT = { Player };
        setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0);
      })();`,
    }),
  );
}

export const endCurrent = (page: Page) =>
  page.evaluate(() => {
    const yt = (window as unknown as { __yt: { players: { options: { events: { onStateChange: (e: { data: number }) => void } } }[] } }).__yt;
    yt.players.at(-1)!.options.events.onStateChange({ data: 0 });
  });

export const failCurrent = (page: Page) =>
  page.evaluate(() => {
    const yt = (window as unknown as { __yt: { players: { options: { events: { onError: (e: { data: number }) => void } } }[] } }).__yt;
    yt.players.at(-1)!.options.events.onError({ data: 150 });
  });

/** Simula que YouTube cuenta un cambio de estado por su cuenta (por ejemplo, el visitante pausa con los controles del vídeo): 1 suena, 2 pausa. */
export const setPlayerState = (page: Page, data: number) =>
  page.evaluate((state) => {
    const yt = (window as unknown as { __yt: { players: { options: { events: { onStateChange: (e: { data: number }) => void } } }[] } }).__yt;
    yt.players.at(-1)!.options.events.onStateChange({ data: state });
  }, data);

/** Las órdenes que la página ha dado al reproductor: «play» y «pause». */
export const youtubeCalls = (page: Page) => page.evaluate(() => (window as unknown as { __yt?: { calls: string[] } }).__yt?.calls ?? []);

export const youtubeLoads = (page: Page) => page.evaluate(() => (window as unknown as { __yt?: { loads: string[] } }).__yt?.loads ?? []);

/**
 * La tecla para pasar al siguiente control. Safari, por defecto, solo salta entre campos de texto con Tab; para llegar a los botones se usa
 * Opción+Tab (y WebKit lo imita). Los demás navegadores pasan por todo con Tab.
 */
export const nextControlKey = (browserName: string) => (browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
