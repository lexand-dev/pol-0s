import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { loadGuestbook } from '../e2e/helpers';

/**
 * S-09 contra la COMPILACIÓN: el archivo de reseñas, la página de confirmación (con su script en línea bajo la política real) y los
 * endpoints del Worker. Siempre en localhost.
 */

const SITE = 'https://example.com';
const entries = loadGuestbook();
const sha = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const token = 'A'.repeat(60);

async function trackViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: unknown[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: unknown[] }).__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI }),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: unknown[] }).__csp);

test.describe('S-09 Libro de visitas: contra la compilación', () => {
  test('el archivo de reseñas es JSON, trae una entrada por reseña y nunca un correo', async ({ request }) => {
    const res = await request.get('/libro-de-visitas.json');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('json');
    const body = await res.json();
    expect(body.map((e: { id: string }) => e.id)).toEqual(entries.map((e) => e.id));
    expect(JSON.stringify(body)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+|mailto:|"email"/);
    for (const e of body) expect(Object.keys(e).sort().every((k) => ['date', 'detail', 'id', 'links', 'name', 'relation', 'text'].includes(k))).toBe(true);
  });

  test('la página de confirmación no se indexa, no está en el mapa del sitio y lleva las cabeceras de seguridad', async ({ request }) => {
    const res = await request.get('/libro-de-visitas/confirmar/');
    expect(res.status()).toBe(200);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex"');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('libro-de-visitas');
    expect(sitemap).not.toContain(`${SITE}/libro`);
  });

  test('todo script o estilo en línea de la página de confirmación está autorizado por hash, sin unsafe-inline', async ({ request }) => {
    const html = await (await request.get('/libro-de-visitas/confirmar/')).text();
    const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/i)![1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const policy = Object.fromEntries(
      meta
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => [d.split(/\s+/)[0], d.split(/\s+/).slice(1)]),
    ) as Record<string, string[]>;
    expect(policy['script-src'].join(' ')).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(policy['style-src'].join(' ')).not.toMatch(/unsafe-inline/);
    const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi)].filter(([, attrs]) => !/type="application\/ld\+json"/.test(attrs));
    expect(inline.length).toBeGreaterThan(0);
    for (const [, , body] of inline) expect(policy['script-src'], body.slice(0, 60)).toContain(sha(body));
    for (const [, body] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) expect(policy['style-src'], body.slice(0, 60)).toContain(sha(body));
  });

  test('con la política activa, la página de confirmación funciona: muestra el botón, confirma y no registra violaciones', async ({ page }) => {
    const consoleCsp: string[] = [];
    page.on('console', (m) => /content security policy|refused to/i.test(m.text()) && consoleCsp.push(m.text()));
    page.on('pageerror', (e) => consoleCsp.push(`pageerror: ${e.message}`));
    await trackViolations(page);
    const requests: unknown[] = [];
    await page.route('**/api/guestbook/confirm', (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, code: 'confirmed' }) });
    });
    await page.goto(`/libro-de-visitas/confirmar/#${token}`);
    await expect(page.getByTestId('confirm-button')).toBeVisible();
    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('confirm-done')).toBeVisible();
    expect(requests).toEqual([{ token }]);
    expect(await violations(page)).toEqual([]);
    expect(consoleCsp).toEqual([]);
  });

  test('el fragmento con la reseña cifrada nunca llega al servidor', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => seen.push(r.url()));
    await page.goto(`/libro-de-visitas/confirmar/#${token}`);
    await expect(page.getByTestId('confirm-button')).toBeVisible();
    expect(seen.filter((u) => u.includes(token))).toEqual([]);
  });

  test('los endpoints del Worker responden con sus cabeceras en la versión compilada', async ({ request }) => {
    for (const path of ['/api/guestbook', '/api/guestbook/confirm']) {
      const res = await request.post(path, { data: {}, headers: { 'cf-connecting-ip': `192.0.2.${path.length}` } });
      expect([422, 429], path).toContain(res.status());
      expect(res.headers()['content-security-policy'], path).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(res.headers()['cache-control'], path).toBe('no-store');
    }
  });
});
