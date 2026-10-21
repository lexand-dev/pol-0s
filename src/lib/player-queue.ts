/**
 * Los controles del mini reproductor (S-03) que solo hacen falta cuando se reproduce algo: pasar a la canción anterior y decir el lugar en la
 * lista. Viven aparte de `favorites.ts` para que la home, que ya carga ese archivo, no cargue también esto.
 */
import type { Track } from './favorites';

/** La canción que va antes de la actual en la lista, o null si es la primera (o no está en ella). */
export function previousTrack(queue: readonly Track[], currentId: string): Track | null {
  const i = queue.findIndex((t) => t.id === currentId);
  return i > 0 ? queue[i - 1] : null;
}

/** El lugar de la canción en su lista, como «3 de 10». Un tráiler suelto (lista de uno) o una canción que no está en la lista no tienen. */
export function trackPosition(queue: readonly Track[], currentId: string): string | null {
  const i = queue.findIndex((t) => t.id === currentId);
  return i >= 0 && queue.length > 1 ? `${i + 1} de ${queue.length}` : null;
}
