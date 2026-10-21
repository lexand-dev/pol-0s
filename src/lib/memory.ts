/**
 * La lógica del memory (C-05): repartir, levantar cartas, comprobar parejas y contar movimientos. Funciones puras, con el azar inyectado
 * para poder probarlas; la ventana (`Memory.svelte`) solo pinta el estado y espera un segundo antes de tapar dos cartas que no son pareja.
 */

/** Una herramienta que puede salir en el juego: la del Stack, con su logo. */
export interface MemoryTool {
  id: string;
  name: string;
  /** El trazo del logo en una caja de 24 × 24. */
  logo: string;
}

export interface MemoryState {
  /** Las cartas en orden de la cuadrícula; cada herramienta sale dos veces. */
  cards: readonly MemoryTool[];
  /** Las posiciones levantadas que aún no son pareja (como mucho, dos). */
  open: readonly number[];
  /** Las herramientas ya emparejadas. */
  matched: readonly string[];
  /** Un movimiento es levantar dos cartas. */
  moves: number;
}

/** Un número en [0, 1). En la web sale de `crypto`; los tests lo fijan. */
export type Rand = () => number;

export const PAIRS = 8;

/** Las herramientas del Stack que tienen logo, en el orden del Stack, con su nombre corto si lo tiene. */
export function memoryPool(
  tools: readonly { id: string; name: string }[],
  logos: Readonly<Record<string, string>>,
  names: Readonly<Record<string, string>> = {},
): MemoryTool[] {
  return tools.filter((t) => logos[t.id]).map((t) => ({ id: t.id, name: names[t.id] ?? t.name, logo: logos[t.id] }));
}

/** Fisher-Yates con el azar que se le pase. Devuelve una copia. */
export function shuffle<T>(list: readonly T[], rand: Rand): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Una partida nueva: elige `pairs` herramientas al azar y baraja sus dos cartas. */
export function deal(pool: readonly MemoryTool[], rand: Rand, pairs = PAIRS): MemoryState {
  if (pool.length < pairs) throw new Error(`Hacen falta ${pairs} herramientas con logo y solo hay ${pool.length}`);
  const chosen = shuffle(pool, rand).slice(0, pairs);
  return { cards: shuffle([...chosen, ...chosen], rand), open: [], matched: [], moves: 0 };
}

export const isMatched = (s: MemoryState, index: number) => s.matched.includes(s.cards[index].id);
export const isFaceUp = (s: MemoryState, index: number) => isMatched(s, index) || s.open.includes(index);
export const isDone = (s: MemoryState) => s.matched.length * 2 === s.cards.length;

/** Hay dos cartas levantadas que no son pareja: hay que taparlas (`hide`) antes de seguir. */
export const mustHide = (s: MemoryState) => s.open.length === 2;

/**
 * Levanta la carta `index`. No hace nada (devuelve el mismo estado) si ya está a la vista, si ya hay dos levantadas sin pareja o si la
 * posición no existe. Al levantar la segunda cuenta un movimiento y, si son pareja, se quedan descubiertas.
 */
export function flip(s: MemoryState, index: number): MemoryState {
  if (index < 0 || index >= s.cards.length || mustHide(s) || isFaceUp(s, index)) return s;
  if (s.open.length === 0) return { ...s, open: [index] };
  const [first] = s.open;
  const moves = s.moves + 1;
  if (s.cards[first].id === s.cards[index].id) return { ...s, open: [], matched: [...s.matched, s.cards[index].id], moves };
  return { ...s, open: [first, index], moves };
}

/** Tapa las dos cartas levantadas que no eran pareja. */
export const hide = (s: MemoryState): MemoryState => (mustHide(s) ? { ...s, open: [] } : s);

/** El azar de la web: `crypto`, que no se puede predecir desde fuera. */
export const cryptoRand: Rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
