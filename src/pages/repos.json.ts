import type { APIRoute } from 'astro';
import data from '../content/repos.json';

// Los repositorios de la ventana GitHub (C-01): un archivo estático más, generado al compilar a partir de lo que guarda la tarea diaria. La
// ventana lo pide al abrirse, así la home no lo lleva.
export const prerender = true;

export const GET: APIRoute = () => Response.json(data);
