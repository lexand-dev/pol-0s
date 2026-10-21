import type { APIRoute } from 'astro';
import { compiledContent, frontmatter } from '../content/como-esta-hecho.md';
import { externalLinks } from '../lib/cv';
import { prepareHowTo } from '../lib/howto';

// El texto de «Cómo está hecho» (S-10) para la ventana del escritorio: un archivo estático más, generado al compilar. La ventana lo pide al
// abrirse, así la home no lo lleva. El texto sale de un archivo del propio repositorio, nunca de un visitante.
export const prerender = true;

export const GET: APIRoute = async () => {
  const data = prepareHowTo(externalLinks(await compiledContent()), frontmatter);
  return Response.json(data);
};
