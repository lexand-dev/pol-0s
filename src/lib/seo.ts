/**
 * SEO y vista previa (S-06): funciones puras que generan los datos estructurados y el mapa del sitio.
 * Sin DOM ni red, para probarlas aparte. No reciben nunca datos privados: solo lo que ya es público.
 */

/** Páginas fijas que un buscador debe indexar. A ellas se suman las notas (S-01), una por archivo. */
export const INDEXABLE_PATHS: readonly string[] = ['/'];

/** `https://example.com` + `/og.jpg` → dirección absoluta, sin dobles barras ni sorpresas. */
export function absoluteUrl(site: string | URL, path: string): string {
  return new URL(path, site).href;
}

export interface PersonInput {
  /** Origen del sitio, por ejemplo `https://example.com`. */
  site: string | URL;
  name: string;
  /** Ruta de la imagen, por ejemplo `/og.jpg`. */
  imagePath: string;
  /** Perfiles públicos. Solo se admiten direcciones `https://`. */
  profiles: readonly string[];
}

export function personJsonLd({ site, name, imagePath, profiles }: PersonInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: absoluteUrl(site, '/'),
    image: absoluteUrl(site, imagePath),
    sameAs: profiles.filter((p) => /^https:\/\//.test(p)),
  };
}

export interface ArticleInput {
  site: string | URL;
  /** Ruta pública de la nota, por ejemplo `/notas/mi-nota/`. */
  path: string;
  title: string;
  description: string;
  /** Fecha de publicación. */
  date: Date;
  imagePath: string;
  authorName: string;
  tags?: readonly string[];
}

/** Datos estructurados de una nota (S-01): lo que un buscador necesita para entender que es un artículo y de quién. */
export function articleJsonLd({ site, path, title, description, date, imagePath, authorName, tags = [] }: ArticleInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date.toISOString().slice(0, 10),
    inLanguage: 'es',
    url: absoluteUrl(site, path),
    mainEntityOfPage: absoluteUrl(site, path),
    image: absoluteUrl(site, imagePath),
    author: { '@type': 'Person', name: authorName, url: absoluteUrl(site, '/') },
    ...(tags.length > 0 ? { keywords: tags.join(', ') } : {}),
  };
}

/**
 * Serializa un objeto para ponerlo dentro de `<script type="application/ld+json">`. Se escapan `<`,
 * `>`, `&` y los separadores de línea de Unicode para que ningún valor pueda cerrar la etiqueta.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Mapa del sitio con las direcciones absolutas de las rutas dadas, sin repetidos y ordenadas. */
export function sitemapXml(site: string | URL, paths: readonly string[]): string {
  const urls = [...new Set(paths.map((p) => absoluteUrl(site, p)))].sort();
  const entries = urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
