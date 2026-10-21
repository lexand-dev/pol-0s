import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { HOWTO_PATH } from '../lib/howto';
import { noteHref } from '../lib/notes';
import { INDEXABLE_PATHS, sitemapXml } from '../lib/seo';
import { PERSONA } from '../content/persona';

// Se genera al compilar: es un archivo estático más. No hace falta ejecutarlo en cada petición.
export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const notes = await getCollection('notes');
  return new Response(sitemapXml(site ?? PERSONA.siteUrl, [...INDEXABLE_PATHS, HOWTO_PATH, ...notes.map((n) => noteHref(n.id))]), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
