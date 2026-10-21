import { expect, test, type APIRequestContext } from '@playwright/test';
import { LINKS, PROFILE_LINKS } from '../../src/content/links';
import { PERSONA } from '../../src/content/persona';

/**
 * S-06 contra la COMPILACIÓN. Las direcciones absolutas de los metadatos apuntan a example.com (la
 * producción); aquí solo se toma su ruta y se pide al servidor local: nunca se sale a internet.
 */

const SITE = 'https://example.com';
const local = (absolute: string) => {
  const u = new URL(absolute);
  expect(u.origin, `${absolute} debe ser de ${SITE}`).toBe(SITE);
  return u.pathname + u.search;
};

/** Ancho y alto de un PNG (cabecera IHDR). */
function pngSize(b: Buffer) {
  expect(b.subarray(1, 4).toString(), 'firma PNG').toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** Ancho y alto de un JPEG (primer marcador de tipo SOF). */
function jpegSize(b: Buffer) {
  expect(b.readUInt16BE(0), 'firma JPEG').toBe(0xffd8);
  let i = 2;
  while (i < b.length) {
    expect(b[i], 'marcador JPEG').toBe(0xff);
    const marker = b[i + 1];
    const length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error('JPEG sin marcador SOF');
}

async function get(request: APIRequestContext, path: string) {
  const res = await request.get(path);
  expect(res.status(), path).toBe(200);
  return res;
}

const meta = (html: string, attr: 'name' | 'property', key: string) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];

test.describe('S-06 Vista previa y SEO técnico', () => {
  let html: string;
  test.beforeAll(async ({ request }) => {
    html = await (await get(request, '/')).text();
  });

  test('título, descripción y dirección canónica son absolutos y razonables', async () => {
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
    const description = meta(html, 'name', 'description') ?? '';
    expect(title.length).toBeGreaterThan(5);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(description.length).toBeGreaterThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/example\.com\/">/);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toMatch(/<html lang="es"/);
  });

  test('Open Graph y Twitter llevan lo necesario para una tarjeta con imagen grande', async () => {
    expect(meta(html, 'property', 'og:type')).toBe('website');
    expect(meta(html, 'property', 'og:title')).toBe(html.match(/<title>([^<]+)<\/title>/)![1]);
    expect(meta(html, 'property', 'og:description')).toBe(meta(html, 'name', 'description'));
    expect(meta(html, 'property', 'og:url')).toBe(`${SITE}/`);
    expect(meta(html, 'property', 'og:site_name')).toBe(PERSONA.osName);
    expect(meta(html, 'property', 'og:locale')).toBe('es_ES');
    expect(meta(html, 'property', 'og:image')).toBe(`${SITE}/og.jpg`);
    expect(meta(html, 'property', 'og:image:width')).toBe('1200');
    expect(meta(html, 'property', 'og:image:height')).toBe('630');
    expect(meta(html, 'property', 'og:image:alt')).toContain(PERSONA.name);
    expect(meta(html, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'name', 'twitter:image')).toBe(`${SITE}/og.jpg`);
    expect(meta(html, 'name', 'twitter:title')).toBe(meta(html, 'property', 'og:title'));
  });

  test('la imagen para compartir existe, es un JPEG de 1200 × 630 y pesa menos de 300 KB', async ({ request }) => {
    const res = await get(request, local(meta(html, 'property', 'og:image')!));
    expect(res.headers()['content-type']).toBe('image/jpeg');
    const body = await res.body();
    expect(body.length).toBeLessThan(300 * 1024);
    expect(jpegSize(body)).toEqual({ width: 1200, height: 630 });
  });

  test('los iconos enlazados existen, con su tipo y su tamaño', async ({ request }) => {
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');

    const svg = await get(request, '/favicon.svg');
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    expect(await svg.text()).toContain('<svg');

    const ico = await (await get(request, '/favicon.ico')).body();
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]); // cabecera ICO
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(1);

    const apple = await get(request, '/apple-touch-icon.png');
    expect(apple.headers()['content-type']).toBe('image/png');
    expect(pngSize(await apple.body())).toEqual({ width: 180, height: 180 });
  });

  test('el manifiesto es un JSON válido y sus iconos existen con el tamaño declarado', async ({ request }) => {
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest">');
    const manifest = await (await get(request, '/site.webmanifest')).json();
    expect(manifest).toMatchObject({ name: PERSONA.osName, lang: 'es', start_url: '/' });
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons as { src: string; sizes: string; type: string }[]) {
      const res = await get(request, icon.src);
      expect(res.headers()['content-type']).toBe(icon.type);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(await res.body())).toEqual({ width: w, height: h });
    }
  });

  test('robots.txt permite el sitio, excluye /api/ y enlaza el mapa', async ({ request }) => {
    const res = await get(request, '/robots.txt');
    expect(res.headers()['content-type']).toContain('text/plain');
    const robots = await res.text();
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
    expect(robots).not.toMatch(/demo/);
    expect(robots).toMatch(/^Sitemap: https:\/\/example\.com\/sitemap\.xml$/m);
  });

  test('sitemap.xml es XML bien formado, de example.com, y solo lista páginas que existen y se indexan', async ({ request }) => {
    const res = await get(request, '/sitemap.xml');
    expect(res.headers()['content-type']).toContain('xml');
    const xml = await res.text();
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect((xml.match(/<urlset/g) ?? []).length).toBe(1);
    expect((xml.match(/<url>/g) ?? []).length).toBe((xml.match(/<\/url>/g) ?? []).length);

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toContain(`${SITE}/`);
    for (const loc of locs) {
      expect(loc.startsWith(`${SITE}/`), loc).toBe(true);
      expect(new URL(loc).pathname, loc).not.toMatch(/^\/(api|demo)(\/|$)/);
      await get(request, local(loc)); // existe de verdad
    }
  });

  test('los datos estructurados son una persona, sin correo y con perfiles https', async () => {
    const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(raw, 'falta el bloque JSON-LD').toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data).toMatchObject({ '@context': 'https://schema.org', '@type': 'Person', name: PERSONA.name, url: `${SITE}/`, image: `${SITE}/og.jpg` });
    expect(data.sameAs).toEqual(PROFILE_LINKS.map((l) => l.url));
    // WhatsApp es un canal de contacto, no un perfil: ni su enlace ni el número salen en los datos estructurados.
    expect(JSON.stringify(data)).not.toMatch(/wa\.me|34600000000|whatsapp/i);
    for (const url of data.sameAs as string[]) expect(url).toMatch(/^https:\/\//);
  });

  test('sin JavaScript hay un bloque con los tres enlaces', async () => {
    const block = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';
    for (const link of LINKS) expect(block, link.label).toContain(`href="${link.url}"`);
  });

  test('ningún metadato, ni el HTML, el manifiesto, el mapa o robots.txt contiene un correo', async ({ request }) => {
    const textos = [
      html,
      await (await get(request, '/site.webmanifest')).text(),
      await (await get(request, '/sitemap.xml')).text(),
      await (await get(request, '/robots.txt')).text(),
    ];
    for (const texto of textos) {
      expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      expect(texto).not.toMatch(/gmail|mailto:/i);
    }
  });

  test('/api/ queda fuera del mapa', async ({ request }) => {
    expect(await (await get(request, '/sitemap.xml')).text()).not.toContain('/api/');
  });
});
