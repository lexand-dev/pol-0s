import { describe, expect, test } from 'vitest';
import { INDEXABLE_PATHS, absoluteUrl, articleJsonLd, jsonLdScript, personJsonLd, sitemapXml } from './seo';

const site = 'https://example.com';

describe('absoluteUrl', () => {
  test('une el origen y la ruta con una sola barra', () => {
    expect(absoluteUrl(site, '/og.jpg')).toBe('https://example.com/og.jpg');
    expect(absoluteUrl(`${site}/`, '/og.jpg')).toBe('https://example.com/og.jpg');
    expect(absoluteUrl(new URL(site), '/')).toBe('https://example.com/');
  });
});

describe('personJsonLd', () => {
  const data = personJsonLd({
    site,
    name: 'Pol Marzà',
    imagePath: '/og.jpg',
    profiles: ['https://github.com/tu-usuario', 'https://www.linkedin.com/in/tu-perfil/', 'http://inseguro.test', 'javascript:alert(1)'],
  });

  test('es una persona de schema.org con su nombre, su dirección y su imagen absolutas', () => {
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Pol Marzà',
      url: 'https://example.com/',
      image: 'https://example.com/og.jpg',
    });
  });

  test('solo incluye perfiles https', () => {
    expect(data.sameAs).toEqual(['https://github.com/tu-usuario', 'https://www.linkedin.com/in/tu-perfil/']);
  });

  test('no lleva correo ni ningún campo de contacto', () => {
    const texto = JSON.stringify(data);
    expect(texto).not.toMatch(/@gmail|email|telephone|mailto/i);
    expect(Object.keys(data).sort()).toEqual(['@context', '@type', 'image', 'name', 'sameAs', 'url']);
  });
});

describe('jsonLdScript', () => {
  test('es JSON válido que devuelve el mismo objeto', () => {
    const data = { a: 'Marzà', b: [1, 2], c: { d: true } };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  test('un valor no puede cerrar la etiqueta ni inyectar otra', () => {
    const out = jsonLdScript({ name: '</script><script>alert(1)</script>', amp: 'a&b' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>', amp: 'a&b' });
  });

  test('escapa los separadores de línea de Unicode', () => {
    const out = jsonLdScript({ x: 'a\u2028b\u2029c' });
    expect(out).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(out).x).toBe('a\u2028b\u2029c');
  });
});

describe('sitemapXml', () => {
  test('lista la home con su dirección absoluta y declara el espacio de nombres', () => {
    const xml = sitemapXml(site, INDEXABLE_PATHS);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://example.com/</loc>');
  });

  test('sin repetidos y ordenado', () => {
    const xml = sitemapXml(site, ['/b', '/a', '/a/', '/b']);
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual(['https://example.com/a', 'https://example.com/a/', 'https://example.com/b']);
  });

  test('escapa los caracteres especiales de XML', () => {
    const xml = sitemapXml(site, ['/buscar?a=1&b=2']);
    expect(xml).toContain('<loc>https://example.com/buscar?a=1&amp;b=2</loc>');
    expect(xml).not.toMatch(/&b=/);
  });

  test('sin páginas es un mapa vacío pero válido', () => {
    const xml = sitemapXml(site, []);
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('<url>');
  });

  test('hoy solo la home es indexable, y nunca la API ni las demostraciones', () => {
    expect(INDEXABLE_PATHS).toEqual(['/']);
    expect(INDEXABLE_PATHS.join(' ')).not.toMatch(/api|demo/);
  });
});

describe('articleJsonLd', () => {
  const data = articleJsonLd({
    site,
    path: '/notas/mi-nota/',
    title: 'Mi nota',
    description: 'Una descripción.',
    date: new Date('2026-10-10T00:00:00Z'),
    imagePath: '/og.jpg',
    authorName: 'Pol Marzà',
    tags: ['método', 'IA'],
  });

  test('es un BlogPosting con su dirección absoluta, su fecha, su autor y su idioma', () => {
    expect(data).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'Mi nota',
      datePublished: '2026-10-10',
      inLanguage: 'es',
      url: 'https://example.com/notas/mi-nota/',
      author: { '@type': 'Person', name: 'Pol Marzà' },
      keywords: 'método, IA',
    });
  });

  test('sin etiquetas no lleva palabras clave', () => {
    const none = articleJsonLd({ site, path: '/notas/x/', title: 'x', description: 'x', date: new Date(), imagePath: '/og.jpg', authorName: 'Pol' });
    expect(none).not.toHaveProperty('keywords');
  });

  test('no incluye ningún correo', () => {
    expect(JSON.stringify(data)).not.toMatch(/@[\w-]+\.\w+|mailto/);
  });
});

