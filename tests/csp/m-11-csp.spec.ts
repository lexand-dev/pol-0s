import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { enter, loadNotes, loadProjects, stubContactApi, stubExternalSites, stubGuestbookApi, stubTurnstile, stubYouTube } from '../e2e/helpers';

type Violation = { directive: string; blocked: string; sample: string };

/** Anota toda violación de la CSP que el navegador detecta, venga de donde venga. */
async function trackViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: unknown[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: unknown[] }).__csp.push({
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        sample: e.sample,
      }),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp);

const sha = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

/** Separa en directivas la política de la etiqueta <meta>. */
const parsePolicy = (policy: string) =>
  Object.fromEntries(
    policy
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  ) as Record<string, string[]>;

const projects = loadProjects();
const embeddable = projects.find((p) => p.embeddable && p.url.startsWith('https://'))!;
const blocked = projects.find((p) => !p.embeddable)!;

test.describe('M-11 Cabeceras de seguridad', () => {
  test('las páginas estáticas llevan las cabeceras de seguridad', async ({ request }) => {
    // La 404 propia (S-01) se revisa en s-01-notas-publicas.spec.ts.
    for (const path of ['/']) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h['content-security-policy'], path).toContain("frame-ancestors 'self'");
      expect(h['x-content-type-options'], path).toBe('nosniff');
      expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
      expect(h['permissions-policy'], path).toContain('camera=()');
    }
  });

  test('el endpoint de contacto lleva sus propias cabeceras, aunque _headers no le aplique', async ({ request }) => {
    const res = await request.post('/api/contact', { data: {}, headers: { 'cf-connecting-ip': '203.0.113.9' } });
    const h = res.headers();
    expect(h['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['cache-control']).toBe('no-store');
  });

  test('la política de la home es estricta y todo script o estilo en línea lleva su hash', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/i);
    expect(meta, 'falta la etiqueta <meta> de la CSP').not.toBeNull();
    const policy = parsePolicy(meta![1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));

    for (const name of ['script-src', 'style-src']) {
      expect(policy[name].join(' '), name).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    }
    expect(policy['default-src']).toEqual(["'self'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['base-uri']).toEqual(["'none'"]);
    expect(policy['form-action']).toEqual(["'self'"]);
    expect(policy['script-src']).toContain('https://challenges.cloudflare.com');

    // Cada <script> en línea que se ejecuta y cada <style> en línea están autorizados por hash.
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
      ([, attrs]) => !/type="(?!module|text\/javascript)/.test(attrs),
    );
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const [, , body] of inlineScripts) expect(policy['script-src'], body.slice(0, 60)).toContain(sha(body));
    for (const [, body] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
      expect(policy['style-src'], body.slice(0, 60)).toContain(sha(body));
    }
    // No hay atributos style="" en el HTML servido: la política no los autoriza.
    expect(html).not.toMatch(/\sstyle="/i);
  });

  test('los marcos permitidos son Pol OS, Turnstile, el vídeo de YouTube sin cookies y solo los proyectos incrustables', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/i)![1];
    const frames = parsePolicy(meta.replace(/&#39;/g, "'"))['frame-src'];
    const origins = projects.filter((p) => p.embeddable && p.url.startsWith('https://')).map((p) => new URL(p.url).origin);
    expect(frames.sort()).toEqual(["'self'", 'https://challenges.cloudflare.com', 'https://www.youtube-nocookie.com', ...origins].sort());
    for (const p of projects.filter((x) => !x.embeddable && x.url.startsWith('https://'))) {
      expect(frames).not.toContain(new URL(p.url).origin);
    }
  });

  test('un recorrido por todas las apps no provoca ninguna violación de la política', async ({ page, context }) => {
    const consoleCsp: string[] = [];
    page.on('console', (m) => /content security policy|refused to/i.test(m.text()) && consoleCsp.push(m.text()));
    page.on('pageerror', (e) => consoleCsp.push(`pageerror: ${e.message}`));

    // Playwright aplica primero la última simulación registrada: la de Turnstile, la más concreta, va al final.
    await stubExternalSites(context);
    await stubTurnstile(context);
    await stubYouTube(context);
    await trackViolations(page);
    const sent = await stubContactApi(page);
    const reviews = await stubGuestbookApi(page);
    await enter(page);

    // Ajustes: tema y fondo
    await page.getByTestId('dock-item-settings').click();
    await page.getByTestId('settings-theme-dark').click();
    await page.getByTestId('settings-wall-mar').click();
    await page.getByTestId('settings-theme-auto').click();
    await page.getByTestId('menubar-theme').click();

    // Navegador: favoritos, los proyectos externos incrustables (simulados) y uno que no lo es
    await page.getByTestId('dock-item-browser').click();
    const browser = page.getByTestId('browser');
    await expect(browser.getByTestId('browser-start')).toBeVisible();
    for (const p of projects.filter((x) => x.embeddable && x.url.startsWith('https://'))) {
      await browser.getByTestId(`browser-fav-${p.id}`).click();
      await expect(page.frameLocator('[data-testid="browser-frame"]').locator('p[data-stub]')).toBeVisible();
    }
    await browser.getByTestId(`browser-fav-${blocked.id}`).click();
    await expect(browser.getByTestId('browser-blocked')).toBeVisible();
    // Se cierra: abierta, la ventana cae encima de los iconos que el recorrido abre después
    await page.getByTestId('window-browser').getByTestId('window-close').click();

    // Correo: widget (simulado), envío y confirmación
    await page.getByTestId('dock-item-mail').click();
    const mail = page.getByTestId('mail');
    await expect(mail.getByTestId('mail-captcha')).toContainText('Verificación simulada');
    await mail.getByTestId('mail-from').fill('ana@ejemplo.com');
    await mail.getByTestId('mail-subject').fill('Hola');
    await mail.getByTestId('mail-message').fill('Probando la política.');
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-sent')).toBeVisible();
    expect(sent).toHaveLength(1);

    // Ventanas: mover, redimensionar, ampliar, minimizar, abrir otras apps y el menú de Pol OS
    const win = page.getByTestId('window-mail');
    await win.getByTestId('window-maximize').click();
    await win.getByTestId('window-maximize').click();
    await win.getByTestId('window-minimize').click();
    for (const id of ['about', 'stack', 'notes']) await page.getByTestId(`desktop-icon-${id}`).dblclick();
    // Favoritos (S-03): las cuatro secciones y el mini reproductor de YouTube (simulado, bajo la política real)
    await page.getByTestId('desktop-icon-favorites').dblclick();
    for (const id of ['games', 'movies', 'books', 'music']) {
      await page.getByTestId(`favorites-card-${id}`).click();
      await expect(page.getByTestId('favorites-title')).toBeVisible();
      if (id === 'music') await page.locator('[data-testid^="favorites-play-"]').first().click();
      await page.getByTestId('favorites-back').click();
    }
    await expect(page.getByTestId('miniplayer')).toBeVisible();
    await page.getByTestId('miniplayer-close').click();
    await page.getByTestId('window-favorites').getByTestId('window-close').click();

    // Cómo está hecho (S-10): el documento con sus logos en línea, desde el escritorio y desde el detalle de Pol OS
    await page.getByTestId('desktop-icon-howto').dblclick();
    await expect(page.getByTestId('howto-techs')).toBeVisible();
    await page.getByTestId('window-howto').getByTestId('window-close').click();
    await page.getByTestId('desktop-icon-projects').dblclick();
    await page.getByTestId('projects-card-este-portfolio').click();
    await page.getByTestId('project-howto').click();
    await expect(page.getByTestId('howto-title')).toBeVisible();
    await page.getByTestId('window-howto').getByTestId('window-close').click();
    await page.getByTestId('window-projects').getByTestId('window-close').click();

    // Libro de visitas (S-09): la lista, el formulario con su widget (simulado) y el envío
    await page.getByTestId('desktop-icon-guestbook').dblclick();
    await expect(page.getByTestId('guestbook-list')).toBeVisible();
    await page.getByTestId('guestbook-write').click();
    await expect(page.getByTestId('guestbook-captcha')).toContainText('Verificación simulada');
    await page.getByTestId('guestbook-name').fill('Ana Pérez');
    await page.getByTestId('guestbook-relation').selectOption('cliente');
    await page.getByTestId('guestbook-text').fill('Trabajar con Pol fue muy fácil y el resultado superó lo que esperaba.');
    await page.getByTestId('guestbook-email').fill('ana@ejemplo.com');
    await page.getByTestId('guestbook-consent').check();
    await page.getByTestId('guestbook-send').click();
    await expect(page.getByTestId('guestbook-sent')).toBeVisible();
    expect(reviews).toHaveLength(1);
    await page.getByTestId('window-guestbook').getByTestId('window-close').click();

    // Notas (S-01): la carpeta y una nota, cuyo texto se pide al abrirla
    await page.getByTestId(`notes-item-${loadNotes()[0].id}`).dblclick();
    await expect(page.getByTestId('note-title')).toBeVisible();
    await page.getByTestId('menu-trigger-logo').click();
    await page.getByTestId('menu-item-logo-settings').click();

    // Menús de la barra (S-05): se abren todos, se usan sus acciones y no registran violaciones
    for (const id of ['archivo', 'edicion', 'visualizacion', 'ventana', 'ayuda']) {
      await page.getByTestId(`menu-trigger-${id}`).click();
      await expect(page.getByTestId(`menu-${id}`)).toBeVisible();
    }
    await page.getByTestId('menu-item-ayuda-help-guide').click();
    await expect(page.getByTestId('window-help')).toBeVisible();
    await page.getByTestId('menu-trigger-ventana').click();
    await page.getByTestId('menu-item-ventana-cascade').click();
    await page.getByTestId('menu-trigger-visualizacion').click();
    await page.getByTestId('menu-item-visualizacion-wallpaper-grafito').click();

    // Terminal (S-04): comandos, salida con enlaces, autocompletado y acciones sobre el sistema
    await page.getByTestId('dock-item-terminal').click();
    const term = page.getByTestId('terminal-input');
    for (const command of ['help', 'neofetch', 'about', 'social', 'projects', 'theme oscuro', 'theme auto', 'echo <img src=x onerror=alert(1)>', 'cowsay hola']) {
      await term.fill(command);
      await term.press('Enter');
    }
    await term.fill('open recet');
    await term.press('Tab');
    await term.press('Enter');
    await expect(page.getByTestId('window-browser')).toBeVisible();

    // Mi CV (M-06): el documento, con su foto y sus enlaces
    await page.getByTestId('dock-item-terminal').click();
    await page.getByTestId('terminal-input').fill('open cv');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('about')).toBeVisible();
    await expect(page.getByTestId('about-download')).toBeVisible();
    await page.getByTestId('window-about').getByTestId('window-close').click();

    // Minijuegos (S-04, C-05, C-06): un juego de texto, el memory y las damas, cuya hoja de estilos se enlaza al abrir la ventana
    await page.getByTestId('dock-item-terminal').click();
    for (const command of ['minigames', 'wordle', 'salir', 'memory']) {
      await page.getByTestId('terminal-input').fill(command);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('memory')).toBeVisible();
    await page.getByTestId('memory-card-0').click();
    await page.getByTestId('window-memory').getByTestId('window-close').click();
    await page.getByTestId('dock-item-terminal').click();
    await page.getByTestId('terminal-input').fill('checkers');
    await page.keyboard.press('Enter');
    const board = page.getByTestId('checkers');
    await expect(board).toBeVisible();
    // La hoja de las damas ha llegado: la ventana deja de estar oculta y las casillas tienen su color.
    await expect(board).not.toHaveClass(/loading/);
    expect(await page.getByTestId('checkers-sq-c3').evaluate((el) => getComputedStyle(el).fill)).not.toBe('rgb(0, 0, 0)');
    // El color sale al azar: se espera al turno de quien juega y se usan el tablero y los botones de vista.
    await expect(page.getByTestId('checkers-turn')).toContainText('Tu turno');
    await page.getByTestId('checkers-board').getByRole('button').first().focus();
    await page.getByTestId('checkers-rot-right').click();
    await page.getByTestId('checkers-reset-view').click();
    await page.getByTestId('window-checkers').getByTestId('window-close').click();

    // Proyectos (S-08): vista general, detalle, galería y captura ampliada
    await page.getByTestId('desktop-icon-projects').dblclick();
    await expect(page.getByTestId('projects')).toBeVisible();
    await page.getByTestId('projects-card-recetario').click();
    await expect(page.getByTestId('project-detail')).toBeVisible();
    await page.getByTestId('project-shot-0').click();
    await expect(page.getByTestId('project-lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('projects-back').click();
    await page.getByTestId('window-projects').getByTestId('window-close').click();

    // Mosaico (S-07): el cuadro del botón verde coloca la ventana en una mitad
    const tiled = page.getByTestId('window-browser');
    await tiled.getByTestId('window-maximize').hover();
    await tiled.getByTestId('tile-left').click();
    await expect.poll(async () => Math.round((await tiled.boundingBox())?.width ?? 0)).toBe(640);

    expect(await violations(page)).toEqual([]);
    expect(consoleCsp).toEqual([]);
  });

  test('si la foto del acceso no carga, quedan las iniciales y la política no registra ninguna violación', async ({ page }) => {
    await trackViolations(page);
    await page.route('**/*', (route) => (route.request().resourceType() === 'image' ? route.abort() : route.continue()));
    await page.goto('/');
    await expect(page.getByTestId('lock-initials')).toHaveText('PM');
    await expect(page.getByTestId('lock-photo')).toHaveCount(0);
    expect(await violations(page)).toEqual([]);
  });

  test('el modo móvil tampoco provoca violaciones', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubExternalSites(context);
    await stubTurnstile(context);
    await trackViolations(page);
    await enter(page);
    await page.getByTestId('mobile-icon-folder-projects').click();
    await page.getByTestId(`mobile-icon-project-${embeddable.id}`).click();
    await expect(page.getByTestId('project-detail')).toBeVisible();
    await page.getByTestId('project-open-browser').click();
    await expect(page.frameLocator('[data-testid="browser-frame"]').locator('p[data-stub]')).toBeVisible();
    await page.getByTestId('mobile-back').click();
    await page.getByTestId('mobile-icon-folder-notes').click();
    await page.getByTestId(`mobile-icon-note-${loadNotes()[0].id}`).click();
    await expect(page.getByTestId('note-title')).toBeVisible();
    await page.getByTestId('mobile-back').click();
    await page.getByTestId('mobile-dock-mail').click();
    await expect(page.getByTestId('mail')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test.describe('la política bloquea de verdad', () => {
    test.beforeEach(async ({ page }) => {
      await trackViolations(page);
      await page.goto('/');
      await expect(page.getByTestId('lock-enter')).toBeFocused();
    });

    test('un script en línea sin autorizar', async ({ page }) => {
      await page.evaluate(() => {
        const s = document.createElement('script');
        s.textContent = 'window.__pwned = true';
        document.body.appendChild(s);
      });
      expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
      expect((await violations(page)).map((v) => v.directive)).toContain('script-src-elem');
    });

    test('un script de un dominio no permitido', async ({ page }) => {
      await page.evaluate(() => {
        const s = document.createElement('script');
        s.src = 'https://dominio-no-permitido.example/x.js';
        document.body.appendChild(s);
      });
      await expect.poll(async () => (await violations(page)).map((v) => v.directive)).toContain('script-src-elem');
    });

    test('una imagen, una conexión y un marco de un dominio no permitido', async ({ page }) => {
      await page.evaluate(() => {
        new Image().src = 'https://dominio-no-permitido.example/p.png';
        fetch('https://dominio-no-permitido.example/').catch(() => undefined);
        const f = document.createElement('iframe');
        f.src = 'https://dominio-no-permitido.example/';
        document.body.appendChild(f);
      });
      await expect
        .poll(async () => (await violations(page)).map((v) => v.directive))
        .toEqual(expect.arrayContaining(['img-src', 'connect-src', 'frame-src']));
    });

    test('un estilo en línea sin autorizar', async ({ page }) => {
      await page.evaluate(() => {
        const s = document.createElement('style');
        s.textContent = 'body { outline: 5px solid red }';
        document.head.appendChild(s);
      });
      expect((await violations(page)).map((v) => v.directive)).toContain('style-src-elem');
    });
  });

  test('otra web no puede incrustar Pol OS', async ({ page, context }) => {
    await context.route('http://otro-origen.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><iframe id="v" src="http://localhost:4322/" width="800" height="600"></iframe>' }),
    );
    await page.goto('http://otro-origen.test/');
    await expect.poll(() => page.frames().length).toBeGreaterThan(1);
    await page.waitForTimeout(1500);
    const child = page.frames().find((f) => f !== page.mainFrame())!;
    expect(child.url()).not.toBe('http://localhost:4322/');
    await expect(child.locator('[data-testid="lock-screen"]')).toHaveCount(0);
  });
});
