/**
 * Lógica pura de las notas (S-01): el orden, las direcciones, el enlace profundo `/?nota=` y la fecha. La usan las páginas, la
 * ventana, la Terminal y los tests, así que no depende de Astro ni del DOM.
 */

export interface NoteSortable {
  id: string;
  date: Date | string;
  order?: number;
}

const time = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();

/** De la más reciente a la más antigua; las de una misma fecha, por su número (`order`) y, si no, por su nombre. */
export function sortNotes<T extends NoteSortable>(notes: readonly T[]): T[] {
  return [...notes].sort((a, b) => time(b.date) - time(a.date) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

/** Un nombre de nota: minúsculas, números y guiones. Es lo que va en la dirección. */
export const NOTE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** La página pública de una nota. La barra final es la forma canónica en Cloudflare. */
export const noteHref = (id: string) => `/notas/${id}/`;

/** Los datos de una nota para la ventana (se piden al abrirla, no al entrar). */
export const noteDataHref = (id: string) => `/notas/${id}.json`;

/** El enlace de la página pública que entra al escritorio con esa nota abierta. */
export const openInOsHref = (id: string) => `/?nota=${encodeURIComponent(id)}`;

/** La nota que pide la dirección (`?nota=…`), si existe. Un nombre que no existe o raro se ignora. */
export function noteFromSearch(search: string, known: readonly string[]): string | null {
  const id = new URLSearchParams(search).get('nota');
  return id && NOTE_ID.test(id) && known.includes(id) ? id : null;
}

/** «10 de octubre de 2026». */
export function formatNoteDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
