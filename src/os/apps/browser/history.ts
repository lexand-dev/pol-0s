/**
 * Historial de una ventana del Navegador: atrás y adelante entre los proyectos visitados.
 * `null` es la página de Favoritos. Solo admite proyectos conocidos: es la única forma de que el
 * Navegador cargue algo, así que aquí no entra ninguna dirección arbitraria.
 */

export type Entry = string | null;

export interface BrowserHistory {
  entries: Entry[];
  index: number;
}

export const createHistory = (initial: Entry = null): BrowserHistory => ({ entries: [initial], index: 0 });

export const current = (h: BrowserHistory): Entry => h.entries[h.index] ?? null;
export const canGoBack = (h: BrowserHistory) => h.index > 0;
export const canGoForward = (h: BrowserHistory) => h.index < h.entries.length - 1;

/** Visita un proyecto (o Favoritos). Lo que hubiera "adelante" se descarta, como en un navegador. */
export function visit(h: BrowserHistory, entry: Entry, known: ReadonlySet<string>): BrowserHistory {
  if (entry !== null && !known.has(entry)) return h;
  if (current(h) === entry) return h;
  const entries = [...h.entries.slice(0, h.index + 1), entry];
  return { entries, index: entries.length - 1 };
}

export const back = (h: BrowserHistory): BrowserHistory => (canGoBack(h) ? { ...h, index: h.index - 1 } : h);
export const forward = (h: BrowserHistory): BrowserHistory => (canGoForward(h) ? { ...h, index: h.index + 1 } : h);
