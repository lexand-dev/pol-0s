import { expect, test, type Page } from '@playwright/test';
import { LINKS } from '../../src/content/links';
import { loadNotes } from '../e2e/helpers';
import { PERSONA } from '../../src/content/persona';

/**
 * S-01 contra la COMPILACIÓN: las páginas públicas de las notas, el mapa del sitio y la 404.
 * Las direcciones absolutas apuntan a example.com (producción); aquí solo se toma su ruta y se pide
 * al servidor local: nunca se sale a internet.
 */

const SITE = 'https://example.com';
const notes = loadNotes();
const newsletter = LINKS.find((l) => l.id === 'newsletter')!;

async function trackViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: unknown[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: unknown[] }).__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI }),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: unknown[] }).__csp);

const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html: string, attr: 'name' | 'property', key: string) =>
  decode(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html)?.[1] ?? '');

test.describe('S-01 Notas: páginas públicas', () => {
  test('hay una página por nota y se lee sin JavaScript: título, subtítulo, fecha y texto', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const n of notes) {
      const res = await page.goto(`/notas/${n.id}/`);
      expect(res?.status(), n.id).toBe(200);
      await expect(page.getByTestId('note-title')).toHaveText(n.title);
      await expect(page.getByTestId('note-subtitle')).toHaveText(n.description);
      await expect(page.getByTestId('note-date')).toHaveAttribute('datetime', n.date);
      for (const tag of n.tags) await expect(page.getByTestId('note-tags')).toContainText(tag);
      const text = (await page.getByTestId('note-body').innerText()).length;
      expect(text, `${n.id}: el texto no está`).toBeGreaterThan(n.body.length * 0.6);
    }
    await context.close();
  });

  test('cada página lleva su título, descripción, dirección canónica y Open Graph de artículo', async ({ request }) => {
    for (const n of notes) {
      const html = await (await request.get(`/notas/${n.id}/`)).text();
      expect(html, n.id).toContain('<html lang="es"');
      expect(decode(html.match(/<title>([^<]*)<\/title>/)![1]), n.id).toBe(`${n.title} · ${PERSONA.name}`);
      expect(meta(html, 'name', 'description'), n.id).toBe(n.description);
      expect(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], n.id).toBe(`${SITE}/notas/${n.id}/`);
      expect(meta(html, 'property', 'og:type'), n.id).toBe('article');
      expect(meta(html, 'property', 'og:url'), n.id).toBe(`${SITE}/notas/${n.id}/`);
      expect(meta(html, 'property', 'og:image'), n.id).toBe(`${SITE}/og.jpg`);
      expect(meta(html, 'name', 'twitter:card'), n.id).toBeTruthy();
      expect(html, n.id).not.toMatch(/noindex/i);
    }
  });

  test('el título cabe en una pestaña y la descripción en un resultado de búsqueda', async ({ request }) => {
    for (const n of notes) {
      const html = await (await request.get(`/notas/${n.id}/`)).text();
      const title = decode(html.match(/<title>([^<]*)<\/title>/)![1]);
      expect(title.length, `${n.id}: ${title}`).toBeLessThanOrEqual(90);
      expect(meta(html, 'name', 'description')!.length, n.id).toBeLessThanOrEqual(160);
    }
  });

  test('los datos estructurados son un BlogPosting con su fecha, su autor y sin correo', async ({ request }) => {
    for (const n of notes) {
      const html = await (await request.get(`/notas/${n.id}/`)).text();
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const article = blocks.find((b) => b['@type'] === 'BlogPosting');
      expect(article, `${n.id}: falta el BlogPosting`).toBeTruthy();
      expect(article).toMatchObject({
        '@context': 'https://schema.org',
        headline: n.title,
        datePublished: n.date,
        url: `${SITE}/notas/${n.id}/`,
        author: { '@type': 'Person', name: PERSONA.name },
      });
      expect(JSON.stringify(blocks), n.id).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+|mailto:/);
    }
  });

  test('"Abrir en el escritorio" lleva a /?nota=<nombre> y la suscripción a la newsletter se abre fuera', async ({ page }) => {
    const n = notes[2];
    await page.goto(`/notas/${n.id}/`);
    await expect(page.getByTestId('note-open-in-os')).toHaveAttribute('href', `/?nota=${n.id}`);
    const cta = page.getByTestId('note-subscribe').getByRole('link');
    await expect(cta).toHaveAttribute('href', newsletter.url);
    await expect(cta).toHaveAttribute('target', '_blank');
    await expect(cta).toHaveAttribute('rel', /noopener/);
    await expect(page.getByTestId('note-home')).toHaveAttribute('href', '/');

    await page.getByTestId('note-open-in-os').click();
    await expect(page.getByTestId('lock-enter')).toBeFocused();
    await page.getByTestId('lock-enter').click();
    await expect(page.getByTestId('note')).toHaveAttribute('data-note', n.id);
  });

  test('el texto de la nota sale con sus enlaces seguros y sin HTML ajeno', async ({ request }) => {
    for (const n of notes) {
      const html = await (await request.get(`/notas/${n.id}/`)).text();
      const body = html.match(/data-testid="note-body"[^>]*>([\s\S]*?)<\/div>\s*<aside/)?.[1] ?? '';
      expect(body.length, n.id).toBeGreaterThan(300);
      expect(body, n.id).not.toMatch(/<script|<iframe|\son\w+=|javascript:/i);
      for (const [, tag] of body.matchAll(/<a\s([^>]*)>/g)) {
        if (/href="https?:/.test(tag)) {
          expect(tag, `${n.id}: ${tag}`).toContain('target="_blank"');
          expect(tag, `${n.id}: ${tag}`).toMatch(/rel="[^"]*noopener/);
        }
      }
    }
  });

  test('el endpoint JSON de cada nota es el que usa la ventana', async ({ request }) => {
    for (const n of notes) {
      const res = await request.get(`/notas/${n.id}.json`);
      expect(res.status(), n.id).toBe(200);
      expect(res.headers()['content-type'], n.id).toContain('json');
      const data = await res.json();
      expect(data).toMatchObject({ id: n.id, title: n.title, description: n.description, tags: n.tags });
      expect(data.html.length, n.id).toBeGreaterThan(300);
    }
  });

  test('el mapa del sitio lista cada nota y todas existen', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const n of notes) {
      expect(locs, n.id).toContain(`${SITE}/notas/${n.id}/`);
      expect((await request.get(`/notas/${n.id}/`)).status()).toBe(200);
    }
  });

  test('las páginas de notas llevan las mismas cabeceras de seguridad que la home', async ({ request }) => {
    const res = await request.get(`/notas/${notes[0].id}/`);
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    const html = await res.text();
    const policy = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/i);
    expect(policy, 'falta la etiqueta <meta> de la CSP').not.toBeNull();
    expect(policy![1]).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  test('abrir una página de nota con la política activa no registra ninguna violación', async ({ page }) => {
    const consoleCsp: string[] = [];
    page.on('console', (m) => /content security policy|refused to/i.test(m.text()) && consoleCsp.push(m.text()));
    await trackViolations(page);
    await page.goto(`/notas/${notes[0].id}/`);
    await expect(page.getByTestId('note-title')).toBeVisible();
    expect(await violations(page)).toEqual([]);
    expect(consoleCsp).toEqual([]);
  });

  test('una dirección que no existe devuelve 404 con la página del sitio y su cabecera de seguridad', async ({ page, request }) => {
    for (const path of ['/notas/no-existe/', '/no-existe', '/notas/..%2F..%2Fetc%2Fpasswd/']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      expect(await res.text(), path).toContain('data-testid="not-found"');
      expect(res.headers()['x-content-type-options'], path).toBe('nosniff');
    }
    const res = await page.goto('/notas/no-existe/');
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId('not-found')).toBeVisible();
    await expect(page.getByTestId('not-found')).toContainText('Esta página no existe');
    await expect(page.getByTestId('not-found-home')).toHaveAttribute('href', '/');
  });
});
