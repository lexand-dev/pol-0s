import { expect, test, type Page } from '@playwright/test';
import { enter, loadFavorites, stubExternalSites, stubYouTube } from '../e2e/helpers';

/**
 * S-03 contra la COMPILACIÓN: la política real deja pasar el reproductor de YouTube (y solo eso), el archivo de Favoritos se sirve entero y
 * nada de YouTube viaja con la home. YouTube se simula (nunca se sale a internet), pero bajo la política de verdad: el script de la API
 * tiene que estar permitido por `script-src`, o no se ejecuta y el reproductor no llega a crearse.
 */

const [games, movies, books, music] = loadFavorites();

async function trackViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: unknown[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: unknown[] }).__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI }),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: unknown[] }).__csp);

const parsePolicy = (policy: string) =>
  Object.fromEntries(
    policy
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.split(/\s+/)[0], d.split(/\s+/).slice(1)]),
  ) as Record<string, string[]>;

test.describe('S-03 Favoritos: contra la compilación', () => {
  test('la política permite el script de YouTube y su vídeo sin cookies, y nada más de YouTube', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/i)![1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const policy = parsePolicy(meta);
    expect(policy['script-src']).toContain('https://www.youtube.com');
    expect(policy['frame-src']).toContain('https://www.youtube-nocookie.com');
    expect(policy['frame-src']).not.toContain('https://www.youtube.com');
    for (const name of ['default-src', 'connect-src', 'img-src', 'style-src', 'form-action', 'base-uri', 'object-src']) {
      expect((policy[name] ?? []).join(' '), name).not.toMatch(/youtube|ytimg|google/);
    }
    expect(policy['script-src'].join(' ')).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  test('la home no lleva nada de YouTube: ni el script, ni la dirección de ningún vídeo', async ({ request }) => {
    // La propia política de seguridad nombra a YouTube (es lo que le permite funcionar): se mira lo que hay fuera de ella.
    const html = (await (await request.get('/')).text()).replace(/<meta http-equiv="content-security-policy"[^>]*>/i, '');
    expect(html).not.toMatch(/iframe_api|youtube|ytimg/i);
    for (const s of [music, movies]) {
      for (const item of s.items) for (const key of ['video', 'trailer'] as const) if (item[key]) expect(html).not.toContain(item[key] as string);
    }
  });

  test('el archivo de Favoritos trae las cuatro secciones en orden, con todas sus portadas y solo enlaces a Shelvid o YouTube', async ({ request }) => {
    const res = await request.get('/favoritos.json');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('json');
    const data = (await res.json()) as typeof games[];
    expect(data.map((s) => s.kind)).toEqual(['games', 'movies', 'books', 'music']);
    for (const section of data) {
      expect(section.items.length).toBeLessThanOrEqual(10);
      for (const item of section.items) {
        const cover = await request.get(item.cover);
        expect(cover.status(), item.cover).toBe(200);
        expect(cover.headers()['content-type'], item.cover).toContain('image/jpeg');
      }
    }
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+|mailto:/);
    const hosts = new Set([...text.matchAll(/https?:\/\/([^/"]+)/g)].map((m) => m[1]));
    expect([...hosts].sort()).toEqual(['www.shelvid.com']);
  });

  test('con la política activa, pulsar play carga el reproductor y no registra ninguna violación', async ({ page, context }) => {
    const consoleCsp: string[] = [];
    page.on('console', (m) => /content security policy|refused to/i.test(m.text()) && consoleCsp.push(m.text()));
    page.on('pageerror', (e) => consoleCsp.push(`pageerror: ${e.message}`));
    await stubExternalSites(context);
    await stubYouTube(context);
    await trackViolations(page);
    await enter(page);

    await page.getByTestId('desktop-icon-favorites').dblclick();
    await page.getByTestId('favorites-card-music').click();
    // Hasta aquí no se ha pedido la API de YouTube.
    expect(await page.evaluate(() => 'YT' in window)).toBe(false);
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer')).toHaveAttribute('data-video', music.items[0].video as string);
    // El script de la API se ejecutó bajo la política real (si `script-src` no lo permitiera, no habría `YT`) y creó el vídeo.
    expect(await page.evaluate(() => 'YT' in window)).toBe(true);
    await expect(page.locator('iframe[data-fake-youtube]')).toHaveCount(1);

    await page.getByTestId('miniplayer-next').click();
    await page.getByTestId('favorites-back').click();
    await page.getByTestId('favorites-card-movies').click();
    await page.getByTestId(`favorites-trailer-${movies.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer')).toHaveAttribute('data-video', movies.items[0].trailer as string);
    expect(await violations(page)).toEqual([]);
    expect(consoleCsp).toEqual([]);
  });

  test('un vídeo de otro dominio que no es el de YouTube sin cookies sigue bloqueado', async ({ page }) => {
    await trackViolations(page);
    await page.goto('/');
    await expect(page.getByTestId('lock-enter')).toBeFocused();
    await page.evaluate(() => {
      for (const src of ['https://www.youtube.com/embed/ha3fizDeark', 'https://evil.example/embed']) {
        const f = document.createElement('iframe');
        f.src = src;
        document.body.appendChild(f);
      }
    });
    await expect.poll(async () => (await violations(page)).length).toBeGreaterThanOrEqual(2);
    expect((await violations(page)).map((v) => (v as { directive: string }).directive)).toEqual(expect.arrayContaining(['frame-src']));
  });
});
