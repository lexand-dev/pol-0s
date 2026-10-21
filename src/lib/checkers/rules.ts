/**
 * El reglamento de las damas españolas (C-06), como lógica pura: generar las jugadas legales, aplicarlas y decidir el final. Sin DOM ni azar.
 *
 * Tablero de 8 × 8 guardado como 64 casillas (`r * 8 + c`), con la fila 0 arriba. Se juega en las casillas oscuras (`(r + c)` impar), así que
 * la esquina de abajo a la derecha de cada jugador es clara. Las blancas empiezan abajo (filas 5 a 7) y suben; las rojas, arriba (0 a 2) y bajan.
 *
 * Reglas (contrastadas con Ludoteka, Wikipedia y Magnojuegos; la FEDA no publica su reglamento en línea):
 * - Los peones avanzan una casilla en diagonal y capturan solo hacia delante.
 * - La dama es voladora: se mueve y captura a cualquier distancia en diagonal y cae en cualquier casilla libre tras la ficha capturada. No puede
 *   saltar sus propias fichas ni dos contrarias seguidas.
 * - Capturar es obligatorio y en cadena. Las fichas capturadas se retiran al final de la jugada: hasta entonces estorban y no se saltan dos veces.
 * - Ley de la cantidad: hay que capturar el máximo de fichas. Ley de la calidad, con la misma cantidad: capturar con dama antes que con peón; si
 *   sigue el empate, la que se lleva más damas; y si sigue, la que encuentra antes una dama.
 * - Un peón corona al terminar la jugada en la última fila.
 * - Pierde quien no tiene fichas o no puede mover. Tablas por triple repetición o tras 40 jugadas por bando sin capturas ni movimientos de peón
 *   (este límite es nuestro: las fuentes no dan la cifra).
 */

export type Color = 'w' | 'r';

export interface Piece {
  /** Fijo durante la partida: sirve para animar la ficha. */
  id: number;
  color: Color;
  king: boolean;
}

export type Board = readonly (Piece | null)[];

export interface Move {
  /** Casilla de salida y cada casilla en la que cae (una, si no captura). */
  path: readonly number[];
  /** Las casillas de las fichas capturadas, en orden. */
  captures: readonly number[];
}

export interface GameState {
  board: Board;
  turn: Color;
  /** Medias jugadas seguidas sin capturas ni movimientos de peón. */
  quiet: number;
  /** Cuántas veces ha salido cada posición (con el turno), para las tablas por repetición. */
  seen: Readonly<Record<string, number>>;
}

export type Outcome =
  | { kind: 'win'; winner: Color; reason: 'no-pieces' | 'no-moves' }
  | { kind: 'draw'; reason: 'repetition' | 'quiet' };

export const SIZE = 8;
/** 40 jugadas por bando. */
export const QUIET_LIMIT = 80;
export const REPETITIONS = 3;

export const sq = (r: number, c: number) => r * SIZE + c;
export const row = (s: number) => Math.floor(s / SIZE);
export const col = (s: number) => s % SIZE;
export const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
export const isDark = (s: number) => (row(s) + col(s)) % 2 === 1;
export const other = (c: Color): Color => (c === 'w' ? 'r' : 'w');

/** Dirección hacia delante de cada color: las blancas suben (fila menor). */
const forward = (c: Color) => (c === 'w' ? -1 : 1);
const lastRow = (c: Color) => (c === 'w' ? 0 : SIZE - 1);
const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** La posición de salida: 12 fichas por bando en las casillas oscuras de las tres primeras filas. */
export function initialBoard(): Piece[] {
  const board: (Piece | null)[] = Array(SIZE * SIZE).fill(null);
  let id = 0;
  for (let s = 0; s < SIZE * SIZE; s++) {
    if (!isDark(s)) continue;
    if (row(s) < 3) board[s] = { id: id++, color: 'r', king: false };
    else if (row(s) > 4) board[s] = { id: id++, color: 'w', king: false };
  }
  return board as Piece[];
}

export const positionKey = (board: Board, turn: Color) =>
  turn + board.map((p) => (p ? (p.king ? p.color.toUpperCase() : p.color) : '.')).join('');

export function newGame(board: Board = initialBoard(), turn: Color = 'w'): GameState {
  return { board, turn, quiet: 0, seen: { [positionKey(board, turn)]: 1 } };
}

// ─── Generar jugadas ─────────────────────────────────────────────────────────────────────────────

/** Todas las capturas completas de la ficha que está en `from` (cadenas que ya no pueden seguir). */
function capturesFrom(board: Board, from: number): Move[] {
  const piece = board[from]!;
  const out: Move[] = [];
  // La ficha que mueve ya no está en su casilla de salida: esa casilla cuenta como libre.
  const empty = (s: number) => s === from || board[s] === null;

  const walk = (pos: number, path: number[], captured: number[]) => {
    let extended = false;
    for (const [dr, dc] of DIAGONALS) {
      if (!piece.king && dr !== forward(piece.color)) continue;
      let r = row(pos) + dr;
      let c = col(pos) + dc;
      if (piece.king) {
        while (inside(r, c) && empty(sq(r, c))) {
          r += dr;
          c += dc;
        }
      }
      if (!inside(r, c)) continue;
      const mid = sq(r, c);
      const target = board[mid];
      if (!target || target.color === piece.color || captured.includes(mid) || mid === from) continue;
      let lr = r + dr;
      let lc = c + dc;
      // Detrás tiene que haber al menos una casilla libre (no se capturan dos fichas seguidas).
      while (inside(lr, lc) && empty(sq(lr, lc))) {
        extended = true;
        walk(sq(lr, lc), [...path, sq(lr, lc)], [...captured, mid]);
        if (!piece.king) break;
        lr += dr;
        lc += dc;
      }
    }
    if (!extended && captured.length > 0) out.push({ path, captures: captured });
  };

  walk(from, [from], []);
  return out;
}

function simpleMovesFrom(board: Board, from: number): Move[] {
  const piece = board[from]!;
  const out: Move[] = [];
  for (const [dr, dc] of DIAGONALS) {
    if (!piece.king && dr !== forward(piece.color)) continue;
    let r = row(from) + dr;
    let c = col(from) + dc;
    while (inside(r, c) && board[sq(r, c)] === null) {
      out.push({ path: [from, sq(r, c)], captures: [] });
      if (!piece.king) break;
      r += dr;
      c += dc;
    }
  }
  return out;
}

/** Cuántas damas captura una jugada y en qué paso aparece la primera (para la ley de la calidad). */
function kingsCaptured(board: Board, m: Move): { count: number; first: number } {
  let count = 0;
  let first = Infinity;
  m.captures.forEach((s, i) => {
    if (board[s]?.king) {
      count++;
      first = Math.min(first, i);
    }
  });
  return { count, first };
}

/** Las jugadas legales del bando al que le toca, con la captura obligatoria y las leyes de la cantidad y la calidad. */
export function legalMoves(state: Pick<GameState, 'board' | 'turn'>): Move[] {
  const { board, turn } = state;
  const own: number[] = [];
  for (let s = 0; s < board.length; s++) if (board[s]?.color === turn) own.push(s);

  let captures = own.flatMap((s) => capturesFrom(board, s));
  if (captures.length === 0) return own.flatMap((s) => simpleMovesFrom(board, s));

  const most = Math.max(...captures.map((m) => m.captures.length));
  captures = captures.filter((m) => m.captures.length === most);
  if (captures.some((m) => board[m.path[0]]!.king)) captures = captures.filter((m) => board[m.path[0]]!.king);
  const quality = captures.map((m) => kingsCaptured(board, m));
  const mostKings = Math.max(...quality.map((q) => q.count));
  captures = captures.filter((_, i) => quality[i].count === mostKings);
  if (mostKings > 0) {
    const firsts = captures.map((m) => kingsCaptured(board, m).first);
    const earliest = Math.min(...firsts);
    captures = captures.filter((_, i) => firsts[i] === earliest);
  }
  return captures;
}

export const sameMove = (a: Move, b: Move) => a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]);
export const isLegal = (state: GameState, m: Move) => legalMoves(state).some((x) => sameMove(x, m));

// ─── Aplicar y terminar ──────────────────────────────────────────────────────────────────────────

/** Aplica una jugada legal (no la comprueba: para eso, `isLegal`). */
export function applyMove(state: GameState, m: Move): GameState {
  const board = [...state.board];
  const from = m.path[0];
  const to = m.path[m.path.length - 1];
  const piece = board[from]!;
  board[from] = null;
  for (const s of m.captures) board[s] = null;
  const crowned = !piece.king && row(to) === lastRow(piece.color);
  board[to] = crowned ? { ...piece, king: true } : piece;
  const turn = other(state.turn);
  const quiet = m.captures.length > 0 || !piece.king ? 0 : state.quiet + 1;
  const key = positionKey(board, turn);
  return { board, turn, quiet, seen: { ...state.seen, [key]: (state.seen[key] ?? 0) + 1 } };
}

/** El final de la partida, o null si sigue. */
export function outcome(state: GameState): Outcome | null {
  const hasPieces = state.board.some((p) => p?.color === state.turn);
  if (!hasPieces) return { kind: 'win', winner: other(state.turn), reason: 'no-pieces' };
  if (legalMoves(state).length === 0) return { kind: 'win', winner: other(state.turn), reason: 'no-moves' };
  if ((state.seen[positionKey(state.board, state.turn)] ?? 0) >= REPETITIONS) return { kind: 'draw', reason: 'repetition' };
  if (state.quiet >= QUIET_LIMIT) return { kind: 'draw', reason: 'quiet' };
  return null;
}

export const count = (board: Board, color: Color) => board.filter((p) => p?.color === color).length;

// ─── Nombres ─────────────────────────────────────────────────────────────────────────────────────

/** El nombre de una casilla desde el lado de las blancas: columnas a–h de izquierda a derecha y filas 1–8 de abajo arriba. */
export const squareName = (s: number) => `${'abcdefgh'[col(s)]}${SIZE - row(s)}`;

export const COLOR_NAME: Record<Color, string> = { w: 'Blancas', r: 'Rojas' };

/** La jugada dicha con palabras: «Blancas: c3 a d4», «Rojas: e5 por d4 a c3, captura 1». */
export function describeMove(color: Color, m: Move): string {
  const squares = m.path.map(squareName);
  const route = squares.length > 2 ? `${squares[0]} por ${squares.slice(1, -1).join(', ')} a ${squares.at(-1)}` : `${squares[0]} a ${squares[1]}`;
  const taken = m.captures.length ? `, captura ${m.captures.length}` : '';
  return `${COLOR_NAME[color]}: ${route}${taken}`;
}
