/**
 * Los minijuegos de la Terminal (S-04): Wordle, ahorcado y adivina el número. Cada juego es una máquina de estados pura —`start` da el estado
 * inicial y `play` el siguiente a partir de lo que se escribe—, sin red, sin `eval` y con la salida como segmentos de texto, igual que los
 * comandos. La Terminal carga este archivo solo cuando se escribe el nombre de un juego.
 */
import type { GameId, Line, Segment, Tone } from '../commands';
import { HANGMAN_WORDS, WORDLE_WORDS } from './words';

/** Un número en [0, 1). En la web sale de `crypto`; los tests lo fijan. */
export type Rand = () => number;

export interface Turn<S> {
  state: S;
  lines: Line[];
  done: boolean;
}

export interface Game<S> {
  start(rand: Rand): Turn<S>;
  play(state: S, input: string): Turn<S>;
}

const seg = (text: string, tone?: Tone): Segment => (tone ? { text, tone } : { text });
const text = (s: string, tone?: Tone): Line => [seg(s, tone)];
const pick = <T>(list: readonly T[], rand: Rand): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/** Minúsculas y sin tildes, pero la ñ sigue siendo ñ: «Acción» → «accion», «Sueño» → «sueño». */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC');

/** Solo letras del alfabeto español, una vez quitadas las tildes. */
export const isWord = (s: string) => /^[a-zñ]+$/.test(s);

/** Las letras de una palabra ya plegada, con la ñ como una sola. */
const letters = (s: string) => [...s];

// ─── Wordle ──────────────────────────────────────────────────────────────────────────────────────
export const WORDLE_LENGTH = 5;
export const WORDLE_TRIES = 6;

export type Mark = 'hit' | 'near' | 'miss';

/**
 * Cómo queda cada letra de un intento. Primero las que están en su sitio; después, de izquierda a derecha, las que están en otro, sin gastar
 * más apariciones de las que tiene la solución (una letra que sale una vez en la solución y dos en el intento solo se marca una vez).
 */
export function score(guess: string, solution: string): Mark[] {
  const g = letters(guess);
  const s = letters(solution);
  const marks: Mark[] = g.map((c, i) => (c === s[i] ? 'hit' : 'miss'));
  const left = new Map<string, number>();
  s.forEach((c, i) => marks[i] !== 'hit' && left.set(c, (left.get(c) ?? 0) + 1));
  g.forEach((c, i) => {
    if (marks[i] === 'hit') return;
    const n = left.get(c) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(c, n - 1);
    }
  });
  return marks;
}

const MARK_WORD: Record<Mark, string> = { hit: 'en su sitio', near: 'en otro sitio', miss: 'no está' };

/** Una fila del tablero: cada letra con su marca de texto (no solo el color) y, para lectores de pantalla, la misma fila dicha con palabras. */
export function wordleRow(guess: string, marks: Mark[]): Line {
  const cells = letters(guess).map((c, i): Segment => {
    const m = marks[i];
    const up = c.toUpperCase();
    const shown = m === 'hit' ? `[${up}]` : m === 'near' ? `(${up})` : `·${c}·`;
    return { text: `${shown} `, tone: m === 'miss' ? 'muted' : m, hidden: true };
  });
  const spoken = letters(guess)
    .map((c, i) => `${c.toUpperCase()} ${MARK_WORD[marks[i]]}`)
    .join(', ');
  return [...cells, { text: spoken, sr: true }];
}

export interface WordleState {
  solution: string;
  /** La solución tal como se escribe, con sus tildes. */
  display: string;
  guesses: string[];
  discarded: string[];
}

export const wordle: Game<WordleState> = {
  start(rand) {
    const display = pick(WORDLE_WORDS, rand);
    return {
      state: { solution: fold(display), display, guesses: [], discarded: [] },
      lines: [
        text('Wordle', 'accent'),
        text(`Adivina la palabra de ${WORDLE_LENGTH} letras en ${WORDLE_TRIES} intentos. Va de tecnología, producto o de este portfolio.`),
        [seg('[A]', 'hit'), seg(' en su sitio · '), seg('(A)', 'near'), seg(' en otro sitio · '), seg('·a·', 'muted'), seg(' no está. Las tildes no cuentan.')],
        text('Escribe salir para dejarlo.', 'muted'),
      ],
      done: false,
    };
  },
  play(state, input) {
    const guess = fold(input.trim());
    if (letters(guess).length !== WORDLE_LENGTH || !isWord(guess)) {
      return { state, lines: [text(`Tiene que ser una palabra de ${WORDLE_LENGTH} letras, sin números ni espacios. No gasta intento.`, 'error')], done: false };
    }
    const marks = score(guess, state.solution);
    const guesses = [...state.guesses, guess];
    const found = new Set(letters(state.solution));
    const discarded = [...new Set([...state.discarded, ...letters(guess).filter((c) => !found.has(c))])].sort();
    const next = { ...state, guesses, discarded };
    const row = wordleRow(guess, marks);
    if (guess === state.solution) {
      return { state: next, lines: [row, text(`¡Bien! Era «${state.display}», en ${guesses.length} de ${WORDLE_TRIES}.`, 'accent'), text('Escribe wordle para jugar otra.', 'muted')], done: true };
    }
    if (guesses.length >= WORDLE_TRIES) {
      return { state: next, lines: [row, text(`Se acabaron los intentos. Era «${state.display}».`, 'error'), text('Escribe wordle para jugar otra.', 'muted')], done: true };
    }
    return {
      state: next,
      lines: [
        row,
        text(`Intento ${guesses.length} de ${WORDLE_TRIES}.${discarded.length ? ` Descartadas: ${discarded.join(' ')}` : ''}`, 'muted'),
      ],
      done: false,
    };
  },
};

// ─── Ahorcado ────────────────────────────────────────────────────────────────────────────────────
export const HANGMAN_MISSES = 6;

/** El muñeco, de 0 a 6 fallos. */
const GALLOWS: readonly string[][] = Array.from({ length: HANGMAN_MISSES + 1 }, (_, n) => [
  '  +---+',
  '  |   |',
  `  |   ${n >= 1 ? 'O' : ' '}`,
  `  |  ${n >= 3 ? '/' : ' '}${n >= 2 ? '|' : ' '}${n >= 4 ? '\\' : ' '}`,
  `  |  ${n >= 5 ? '/' : ' '} ${n >= 6 ? '\\' : ' '}`,
  '  |',
  '=====',
]);

export interface HangmanState {
  solution: string;
  display: string;
  hits: string[];
  misses: string[];
}

/** La palabra con las letras acertadas a la vista y un guion bajo en el resto: «t e _ _ i _ a _». Respeta las tildes de la palabra. */
export function masked(state: Pick<HangmanState, 'display' | 'hits'>): string {
  return [...state.display.normalize('NFC')].map((c) => (state.hits.includes(fold(c)) ? c : '_')).join(' ');
}

const hangmanBoard = (s: HangmanState): Line[] => [
  ...GALLOWS[s.misses.length].map((r) => [{ text: r, tone: 'muted', hidden: true }] as Line),
  text(masked(s)),
  text(`Fallos: ${s.misses.length ? s.misses.join(' ') : 'ninguno'} (${HANGMAN_MISSES - s.misses.length} restantes)`, 'muted'),
];

export const hangman: Game<HangmanState> = {
  start(rand) {
    const display = pick(HANGMAN_WORDS, rand);
    const state: HangmanState = { solution: fold(display), display, hits: [], misses: [] };
    return {
      state,
      lines: [
        text('Ahorcado', 'accent'),
        text(`Adivina la palabra letra a letra antes de ${HANGMAN_MISSES} fallos. Escribe una letra y pulsa Enter. Las tildes no cuentan.`),
        text('Escribe salir para dejarlo.', 'muted'),
        ...hangmanBoard(state),
      ],
      done: false,
    };
  },
  play(state, input) {
    const letter = fold(input.trim());
    if (letters(letter).length !== 1 || !isWord(letter)) {
      return { state, lines: [text('Escribe una sola letra. No gasta intento.', 'error')], done: false };
    }
    if (state.hits.includes(letter) || state.misses.includes(letter)) {
      return { state, lines: [text(`La ${letter} ya la has dicho. No gasta intento.`, 'muted')], done: false };
    }
    const inWord = letters(state.solution).includes(letter);
    const next: HangmanState = inWord ? { ...state, hits: [...state.hits, letter] } : { ...state, misses: [...state.misses, letter] };
    const solved = letters(next.solution).every((c) => next.hits.includes(c));
    if (solved) {
      return { state: next, lines: [text(masked(next)), text(`¡Salvado! Era «${state.display}».`, 'accent'), text('Escribe hangman para jugar otra.', 'muted')], done: true };
    }
    if (next.misses.length >= HANGMAN_MISSES) {
      return { state: next, lines: [...hangmanBoard(next), text(`Ahorcado. Era «${state.display}».`, 'error'), text('Escribe hangman para jugar otra.', 'muted')], done: true };
    }
    return { state: next, lines: [text(inWord ? `Sí, la ${letter} está.` : `No, la ${letter} no está.`, inWord ? 'accent' : 'error'), ...hangmanBoard(next)], done: false };
  },
};

// ─── Adivina el número ───────────────────────────────────────────────────────────────────────────
export const GUESS_MAX = 100;
export const GUESS_TRIES = 7;

export interface GuessState {
  secret: number;
  tries: number;
}

export const guess: Game<GuessState> = {
  start(rand) {
    return {
      state: { secret: 1 + Math.min(GUESS_MAX - 1, Math.floor(rand() * GUESS_MAX)), tries: 0 },
      lines: [
        text('Adivina el número', 'accent'),
        text(`He pensado un número del 1 al ${GUESS_MAX}. Tienes ${GUESS_TRIES} intentos y te diré si es más alto o más bajo.`),
        text('Escribe salir para dejarlo.', 'muted'),
      ],
      done: false,
    };
  },
  play(state, input) {
    const raw = input.trim();
    const n = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > GUESS_MAX) {
      return { state, lines: [text(`Escribe un número entero del 1 al ${GUESS_MAX}. No gasta intento.`, 'error')], done: false };
    }
    const next = { ...state, tries: state.tries + 1 };
    if (n === state.secret) {
      return { state: next, lines: [text(`¡Exacto! Era el ${state.secret}, en ${next.tries} ${next.tries === 1 ? 'intento' : 'intentos'}.`, 'accent'), text('Escribe guess para jugar otra.', 'muted')], done: true };
    }
    if (next.tries >= GUESS_TRIES) {
      return { state: next, lines: [text(`Se acabaron los intentos. Era el ${state.secret}.`, 'error'), text('Escribe guess para jugar otra.', 'muted')], done: true };
    }
    const left = GUESS_TRIES - next.tries;
    return { state: next, lines: [text(`${n < state.secret ? 'Más alto' : 'Más bajo'}. Te ${left === 1 ? 'queda 1 intento' : `quedan ${left} intentos`}.`)], done: false };
  },
};

// ─── La lista ────────────────────────────────────────────────────────────────────────────────────
const SUMMARIES: Record<GameId, string> = {
  wordle: 'una palabra de 5 letras en 6 intentos',
  hangman: 'el ahorcado: letra a letra, antes de 6 fallos',
  guess: 'adivina un número del 1 al 100 en 7 intentos',
};

/** Lo que enseña `minigames`. */
export const MENU: Line[] = [
  text('Minijuegos:'),
  ...(Object.keys(SUMMARIES) as GameId[]).map((id): Line => [seg('  '), seg(id.padEnd(10), 'accent'), seg(SUMMARIES[id])]),
  [seg('  '), seg('memory'.padEnd(10), 'accent'), seg('parejas con los logos de mi Stack, en una ventana')],
  [seg('  '), seg('checkers'.padEnd(10), 'accent'), seg('damas españolas contra la máquina, en una ventana')],
  text('Escribe su nombre para empezar; durante la partida, salir o Ctrl+C la terminan.', 'muted'),
];

// ─── La partida en la Terminal ───────────────────────────────────────────────────────────────────
/** Lo que la Terminal necesita de una partida en curso: su aviso y qué hacer con cada línea. El estado vive dentro. */
export interface Session {
  id: GameId;
  prompt: string;
  intro: Line[];
  play(input: string): { lines: Line[]; done: boolean };
}

const NAMES: Record<GameId, string> = { wordle: 'Wordle', hangman: 'el ahorcado', guess: 'adivina el número' };
const EXIT = new Set(['salir', 'exit', 'quit']);
const GAME_WORDS = new Set<string>(['wordle', 'hangman', 'guess', 'ahorcado', 'adivina', 'memory', 'checkers', 'minigames', 'help', 'ayuda']);

function session<S>(id: GameId, game: Game<S>, rand: Rand): Session {
  const first = game.start(rand);
  let state = first.state;
  return {
    id,
    prompt: `${id}>`,
    intro: first.lines,
    play(input) {
      const word = fold(input.trim());
      if (EXIT.has(word)) return { lines: [text('Partida terminada.', 'muted')], done: true };
      // Un comando o el nombre de un juego no se toman como jugada (y no reinician la partida sin avisar).
      if (GAME_WORDS.has(word)) {
        return { lines: [text(`Estás jugando a ${NAMES[id]}. Escribe salir para terminar la partida y volver a la Terminal.`, 'muted')], done: false };
      }
      const turn = game.play(state, input);
      state = turn.state;
      return { lines: turn.lines, done: turn.done };
    },
  };
}

export function startGame(id: GameId, rand: Rand): Session {
  if (id === 'wordle') return session(id, wordle, rand);
  if (id === 'hangman') return session(id, hangman, rand);
  return session(id, guess, rand);
}

/** El azar de la web: `crypto`, que no se puede predecir desde fuera. */
export const cryptoRand: Rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
