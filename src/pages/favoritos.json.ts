import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SECTIONS } from '../lib/favorites';

// Las cuatro secciones de Favoritos (S-03) para la ventana del escritorio: un archivo estático más, generado al compilar. La ventana lo pide al
// abrirse, así la home no lleva el contenido. Todo sale de archivos del repositorio, nunca de un visitante.
export const prerender = true;

export const GET: APIRoute = async () => {
  const entries = await getCollection('favorites');
  const sections = SECTIONS.map((s) => entries.find((e) => e.data.kind === s.id)?.data).filter((s) => s !== undefined);
  return Response.json(sections);
};
