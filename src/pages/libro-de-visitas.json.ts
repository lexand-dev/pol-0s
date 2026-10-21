import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortEntries } from '../lib/guestbook';

// Las reseñas aprobadas del Libro de visitas (S-09) para la ventana del escritorio: un archivo estático más, generado al compilar.
// La ventana lo pide al abrirse, así la home no lleva el texto de todas. Nunca contiene el correo de nadie: la colección no lo admite.
export const prerender = true;

export const GET: APIRoute = async () => {
  const entries = (await getCollection('guestbook')).map((e) => ({
    id: e.id,
    name: e.data.name,
    detail: e.data.detail,
    relation: e.data.relation,
    text: e.data.text,
    links: e.data.links,
    date: e.data.date,
    order: e.data.order,
  }));
  return Response.json(sortEntries(entries).map(({ order: _order, ...entry }) => entry));
};
