/**
 * Lo que suena en el mini reproductor (S-03): una canción o un tráiler con la lista de la que viene. Hay uno solo: pulsar play en otro
 * elemento sustituye al anterior. La ventana de Favoritos lo pide y el mini reproductor, que se monta solo mientras hay algo, lo muestra.
 */
import { nextTrack, type Track } from '../../lib/favorites';

class PlayerStore {
  current = $state<Track | null>(null);
  queue = $state.raw<Track[]>([]);
  /**
   * Su sitio entre las ventanas (en escritorio). Sube por encima de todas al empezar algo o al tocarlo; una ventana que se toca después
   * pasa por delante, como en el Mac.
   */
  z = $state(0);

  /** Pone a sonar `track`; `queue` es la lista de la que viene (para pasar a la siguiente). */
  play(track: Track, queue: Track[] = [track]) {
    this.queue = queue;
    this.current = track;
  }

  /** La siguiente de la lista, o nada si no la hay. */
  next(): boolean {
    if (!this.current) return false;
    const following = nextTrack(this.queue, this.current.id);
    if (!following) return false;
    this.current = following;
    return true;
  }

  get hasNext(): boolean {
    return this.current !== null && nextTrack(this.queue, this.current.id) !== null;
  }

  close() {
    this.current = null;
    this.queue = [];
  }
}

export const player = new PlayerStore();
