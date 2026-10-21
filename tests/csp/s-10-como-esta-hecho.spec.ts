import { expect, test, type Page } from '@playwright/test';
import { TECHS } from '../../src/lib/tech-logos';
import { PERSONA } from '../../src/content/persona';

/**
 * S-10 contra la COMPILACIÓN: la página pública de «Cómo está hecho», su archivo de datos y el mapa del sitio. Las direcciones absolutas
 * apuntan a example.com (producción); aquí solo se toma su ruta y se pide al servidor local: nunca se sale a internet.
 */

const SITE = 'https://example.com';
const SECTIONS = ['que-es', 'tecnologias', 'como-funciona-por-dentro', 'como-se-actualizan-solos-los-datos', 'el-formulario-de-correo-y-el-libro-de-visitas', 'como-se-trabaja', 'limitaciones-los-bloqueos-de-laliga'];

async function trackViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: unknown[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: unknown[] }).__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI }),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: unknown[] }).__csp);

const meta = (html: string, attr: 'name' | 'property', key: string) =>
  new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html)?.[1]?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

test.describe('S-10 Cómo está hecho: contra la compilación', () => {
  test('la página pública responde 200 con su título, su descripción y su dirección canónica', async ({ request }) => {
    const res = await request.get('/como-esta-hecho/');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.match(/<title>([^<]*)<\/title>/)![1]).toBe(`Cómo está hecho este portfolio · ${PERSONA.osName}`);
    expect(meta(html, 'name', 'description')!.length).toBeGreaterThan(60);
    expect(meta(html, 'name', 'description')!.length).toBeLessThanOrEqual(200);
    expect(html.match(/<link rel="canonical" href="([^"]+)"/)![1]).toBe(`${SITE}/como-esta-hecho/`);
    expect(meta(html, 'property', 'og:url')).toBe(`${SITE}/como-esta-hecho/`);
    expect(html).not.toMatch(/noindex/i);
  });

  test('se lee entera sin JavaScript: índice, secciones, tecnologías con su logo en línea y texto', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/como-esta-hecho/');
    await expect(page.getByTestId('howto-title')).toHaveText('Cómo está hecho este portfolio');
    for (const id of SECTIONS) {
      await expect(page.locator(`h2[id="${id}"]`), id).toHaveCount(1);
      await expect(page.getByTestId('howto-toc').locator(`a[href="#${id}"]`), id).toHaveCount(1);
    }
    for (const t of TECHS) {
      const item = page.getByTestId(`howto-tech-${t.id}`);
      await expect(item).toContainText(t.name);
      if (t.logo) await expect(item.locator('svg path')).toHaveAttribute('d', t.logo);
      else await expect(item.locator('svg')).toHaveCount(0);
    }
    expect((await page.getByTestId('howto-body').innerText()).length).toBeGreaterThan(4000);
    await context.close();
  });

  test('un punto del índice lleva a su sección', async ({ page }) => {
    await page.goto('/como-esta-hecho/');
    await page.getByTestId('howto-toc').getByRole('link', { name: 'Limitaciones: los bloqueos de LaLiga' }).click();
    expect(new URL(page.url()).hash).toBe('#limitaciones-los-bloqueos-de-laliga');
    await expect(page.locator('h2[id="limitaciones-los-bloqueos-de-laliga"]')).toBeInViewport();
  });

  test('los enlaces a apps del escritorio no salen como enlaces rotos, y los externos se abren fuera', async ({ request }) => {
    const html = await (await request.get('/como-esta-hecho/')).text();
    expect(html).not.toMatch(/href="#abrir-/);
    for (const [, tag] of html.matchAll(/<a\s([^>]*href="https?:[^"]*"[^>]*)>/g)) {
      expect(tag, tag).toContain('target="_blank"');
      expect(tag, tag).toMatch(/rel="[^"]*noopener/);
    }
  });

  test('el archivo de datos de la ventana trae el índice y las dos mitades del texto, sin secretos', async ({ request }) => {
    const res = await request.get('/como-esta-hecho.json');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('json');
    const data = await res.json();
    expect(data.toc.map((t: { id: string }) => t.id)).toEqual(SECTIONS);
    expect(data.before.length).toBeGreaterThan(300);
    expect(data.after.length).toBeGreaterThan(3000);
    expect(data.before + data.after).not.toContain('{{tecnologias}}');
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+|mailto:/);
    expect(text).not.toMatch(/GUESTBOOK_SECRET|STACK_GITHUB_TOKEN|TURNSTILE_SECRET_KEY|CONTACT_TO|SITE_URL/);
  });

  test('está en el mapa del sitio y existe', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain(`<loc>${SITE}/como-esta-hecho/</loc>`);
  });

  test('lleva las cabeceras de seguridad y, con la política activa, no registra ninguna violación', async ({ page }) => {
    const consoleCsp: string[] = [];
    page.on('console', (m) => /content security policy|refused to/i.test(m.text()) && consoleCsp.push(m.text()));
    await trackViolations(page);
    const res = await page.goto('/como-esta-hecho/');
    const h = res!.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(h['x-content-type-options']).toBe('nosniff');
    await expect(page.getByTestId('howto-techs')).toBeVisible();
    expect(await violations(page)).toEqual([]);
    expect(consoleCsp).toEqual([]);
  });
});
