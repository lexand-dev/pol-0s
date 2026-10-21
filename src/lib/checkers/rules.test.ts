import { describe, expect, test } from 'vitest';
import {
  QUIET_LIMIT,
  applyMove,
  count,
  describeMove,
  initialBoard,
  isDark,
  isLegal,
  legalMoves,
  newGame,
  outcome,
  positionKey,
  squareName,
  type Board,
  type Color,
  type GameState,
  type Move,
  type Piece,
} from './rules';

/**
 * Un tablero dibujado fila a fila, de arriba (fila 8 de las blancas) abajo: `.` vacía, `w`/`r` peón y `W`/`R` dama. Solo se ponen fichas en
 * casillas oscuras.
 */
function draw(rows: string[]): Board {
  let id = 0;
  return rows.flatMap((line) =>
    [...line.replace(/\s/g, '')].map((ch): Piece | null => (ch === '.' ? null : { id: id++, color: ch.toLowerCase() as Color, king: ch === ch.toUpperCase() })),
  );
}
const at = (name: string) => {
  const c = 'abcdefgh'.indexOf(name[0]);
  const r = 8 - Number(name[1]);
  return r * 8 + c;
};
const state = (rows: string[], turn: Color = 'w'): GameState => newGame(draw(rows), turn);
const paths = (moves: Move[]) => moves.map((m) => m.path.map(squareName).join('-')).sort();

describe('salida', () => {
  test('12 fichas por bando en las casillas oscuras de las tres primeras filas', () => {
    const b = initialBoard();
    expect(count(b, 'w')).toBe(12);
    expect(count(b, 'r')).toBe(12);
    b.forEach((p, s) => p && expect(isDark(s), squareName(s)).toBe(true));
    expect(squareName(at('a1'))).toBe('a1');
    expect(isDark(at('a1'))).toBe(true);
    expect(isDark(at('h1'))).toBe(false);
  });

  test('empiezan las blancas, con 7 jugadas posibles', () => {
    const g = newGame();
    expect(g.turn).toBe('w');
    expect(legalMoves(g)).toHaveLength(7);
  });
});

describe('peones', () => {
  test('avanzan una casilla en diagonal, solo hacia delante', () => {
    const g = state(['........', '........', '........', '........', '...w....', '........', '........', '........']);
    expect(paths(legalMoves(g))).toEqual(['d4-c5', 'd4-e5']);
    const red = state(['........', '........', '........', '...r....', '........', '........', '........', '........'], 'r');
    expect(paths(legalMoves(red))).toEqual(['d5-c4', 'd5-e4']);
  });

  test('capturan hacia delante y nunca hacia atrás', () => {
    const forward = state(['........', '........', '........', '..r.....', '...w....', '........', '........', '........']);
    expect(paths(legalMoves(forward))).toEqual(['d4-b6']);
    const backward = state(['........', '........', '........', '........', '...w....', '....r...', '........', '........']);
    expect(legalMoves(backward).every((m) => m.captures.length === 0)).toBe(true);
  });

  test('capturar es obligatorio, y en cadena hasta el final', () => {
    const g = state(['........', '........', '...r....', '........', '...r....', '..w.....', '........', '......w.']);
    const moves = legalMoves(g);
    expect(paths(moves)).toEqual(['c3-e5-c7']);
    expect(moves[0].captures.map(squareName)).toEqual(['d4', 'd6']);
  });

  test('coronan al terminar en la última fila', () => {
    const g = state(['........', '.w......', '........', '........', '........', '........', '........', 'r.......']);
    const next = applyMove(g, legalMoves(g)[0]);
    const crowned = next.board.find((p) => p?.color === 'w')!;
    expect(crowned.king).toBe(true);
  });
});

describe('damas (voladoras)', () => {
  test('se mueven a cualquier distancia en las cuatro diagonales', () => {
    const g = state(['........', '........', '........', '........', '...W....', '........', '........', '........']);
    expect(legalMoves(g)).toHaveLength(13);
  });

  test('capturan a distancia y caen en cualquier casilla libre detrás', () => {
    const g = state(['........', '........', '.....r..', '........', '...W....', '........', '........', '........']);
    const moves = legalMoves(g);
    expect(paths(moves)).toEqual(['d4-g7', 'd4-h8']);
    expect(moves.every((m) => squareName(m.captures[0]) === 'f6')).toBe(true);
  });

  test('no capturan dos fichas seguidas ni saltan las propias', () => {
    const twoInRow = state(['........', '......r.', '.....r..', '........', '...W....', '........', '........', '........']);
    expect(legalMoves(twoInRow).every((m) => m.captures.length === 0)).toBe(true);
    const ownInWay = state(['........', '......r.', '........', '....w...', '...W....', '........', '........', '........']);
    expect(legalMoves(ownInWay).every((m) => m.captures.length === 0)).toBe(true);
  });

  test('las fichas capturadas siguen en el tablero hasta el final: no se saltan dos veces', () => {
    // Una dama que podría volver a pasar por encima de la misma ficha si se retirara a mitad de la jugada.
    const g = state(['........', '........', '...r.r..', '........', '...r.r..', '........', '.W......', '........']);
    for (const m of legalMoves(g)) expect(new Set(m.captures).size).toBe(m.captures.length);
  });
});

describe('ley de la cantidad y de la calidad', () => {
  test('hay que capturar el máximo de fichas', () => {
    // Desde c3 se capturan dos (d4 y luego d6 o f6); desde g5, solo una (f6).
    const g = state(['........', '........', '...r.r..', '......w.', '...r....', '..w.....', '........', '........']);
    const moves = legalMoves(g);
    expect(moves.every((m) => m.captures.length === 2)).toBe(true);
    expect(paths(moves)).toEqual(['c3-e5-c7', 'c3-e5-g7']);
  });

  test('con la misma cantidad, se captura con dama antes que con peón', () => {
    const g = state(['........', '........', '........', '........', '.r...r..', 'w.....W.', '........', '........']);
    const moves = legalMoves(g);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => squareName(m.path[0]) === 'g3')).toBe(true);
  });

  test('con la misma cantidad y la misma pieza, la que se lleva más damas', () => {
    const g = state(['........', '........', '........', '........', '.R...r..', 'w...w...', '........', '........']);
    const moves = legalMoves(g);
    expect(moves.map((m) => squareName(m.captures[0]))).toEqual(['b4']);
  });
});

describe('final de la partida', () => {
  test('pierde quien se queda sin fichas', () => {
    const g = state(['........', '........', '........', '........', '........', '...w....', '........', '........'], 'r');
    expect(outcome(g)).toEqual({ kind: 'win', winner: 'w', reason: 'no-pieces' });
  });

  test('pierde quien no puede mover', () => {
    // El peón rojo de h8 no puede bajar: g7 está ocupada por una blanca que no se puede capturar (detrás, f6, también).
    const g = state(['.......r', '......w.', '.....w..', '........', '........', '........', '........', '........'], 'r');
    expect(legalMoves(g)).toHaveLength(0);
    expect(outcome(g)).toEqual({ kind: 'win', winner: 'w', reason: 'no-moves' });
  });

  test('tablas por triple repetición', () => {
    let g = state(['.W......', '........', '........', '........', '........', '........', '........', '......R.']);
    const shuffle = (from: string, to: string) => {
      const m = legalMoves(g).find((x) => squareName(x.path[0]) === from && squareName(x.path[1]) === to)!;
      g = applyMove(g, m);
    };
    for (let i = 0; i < 2; i++) {
      shuffle('b8', 'a7');
      shuffle('g1', 'h2');
      shuffle('a7', 'b8');
      shuffle('h2', 'g1');
    }
    expect(outcome(g)).toEqual({ kind: 'draw', reason: 'repetition' });
  });

  test(`tablas tras ${QUIET_LIMIT / 2} jugadas por bando sin capturas ni movimientos de peón`, () => {
    const g = { ...state(['.W......', '........', '........', '........', '........', '........', '........', '......R.']), quiet: QUIET_LIMIT };
    expect(outcome(g)).toEqual({ kind: 'draw', reason: 'quiet' });
    const moved = applyMove({ ...g, quiet: 5 }, legalMoves(g)[0]);
    expect(moved.quiet).toBe(6);
  });

  test('un movimiento de peón o una captura vuelven a contar desde cero', () => {
    const g = { ...newGame(), quiet: 30 };
    expect(applyMove(g, legalMoves(g)[0]).quiet).toBe(0);
  });

  test('la partida normal sigue', () => {
    expect(outcome(newGame())).toBeNull();
  });
});

describe('jugadas ilegales y nombres', () => {
  test('negativo: una jugada que no está entre las legales se rechaza, y no capturar cuando es obligatorio, también', () => {
    const g = state(['........', '........', '........', '..r.....', '...w....', '........', '.w......', '........']);
    expect(isLegal(g, { path: [at('b2'), at('a3')], captures: [] })).toBe(false);
    expect(isLegal(g, { path: [at('d4'), at('e5')], captures: [] })).toBe(false);
    expect(isLegal(g, { path: [at('d4'), at('b6')], captures: [at('c5')] })).toBe(true);
    expect(isLegal(newGame(), { path: [at('a3'), at('a4')], captures: [] })).toBe(false);
  });

  test('las casillas se nombran desde las blancas y las jugadas se dicen con palabras', () => {
    expect(squareName(at('c3'))).toBe('c3');
    expect(describeMove('w', { path: [at('c3'), at('d4')], captures: [] })).toBe('Blancas: c3 a d4');
    expect(describeMove('r', { path: [at('e5'), at('c3'), at('a1')], captures: [at('d4'), at('b2')] })).toBe('Rojas: e5 por c3 a a1, captura 2');
  });

  test('la clave de una posición distingue el turno y las damas', () => {
    const b = initialBoard();
    expect(positionKey(b, 'w')).not.toBe(positionKey(b, 'r'));
    const king = b.map((p, i) => (i === b.findIndex(Boolean) && p ? { ...p, king: true } : p));
    expect(positionKey(king, 'w')).not.toBe(positionKey(b, 'w'));
  });
});
