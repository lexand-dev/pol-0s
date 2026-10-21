import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { externalLinks } from '../../lib/cv';

// Los datos de cada nota para la ventana del escritorio: es un archivo estático más, generado al compilar. La ventana lo pide
// al abrir la nota, así la home no carga el texto de todas.
export const prerender = true;

export const getStaticPaths = (async () => (await getCollection('notes')).map((entry) => ({ params: { slug: entry.id }, props: { entry } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as { entry: Awaited<ReturnType<typeof getCollection<'notes'>>>[number] };
  return Response.json({
    id: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    date: entry.data.date.toISOString(),
    tags: entry.data.tags,
    // El texto sale de un archivo del propio repositorio, nunca de un visitante.
    html: externalLinks(entry.rendered?.html ?? ''),
  });
};
