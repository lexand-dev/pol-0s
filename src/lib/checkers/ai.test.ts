import { describe, expect, test } from 'vitest';
import { chooseMove, evaluate } from './ai';
import { applyMove, legalMoves, newGame, outcome, sameMove, squareName, type Board, type Color, type GameState, type Piece } from './rules';

function draw(rows: string[]): Board {
  let id = 0;
  return rows.flatMap((line) => [...line].map((ch): Piece | null => (ch === '.' ? null : { id: id++, color: ch.toLowerCase() as Color, king: ch === ch.toUpperCase() })));
}
/** Un reloj de mentira que avanza 1 ms cada vez que se mira: así el tope de tiempo se puede probar sin esperar. */
const fakeClock = () => {
  let t = 0;
  return () => t++;
};
/** Un azar repetible. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe('la máquina', () => {
  test('en los dos niveles, juega siempre una jugada legal, a lo largo de partidas enteras', () => {
    for (const level of ['easy', 'normal'] as const) {
      let g: GameState = newGame();
      const rand = seeded(level === 'easy' ? 7 : 11);
      for (let ply = 0; ply < 120 && !outcome(g); ply++) {
        const m = chooseMove(g, { level, rand, now: fakeClock(), budgetMs: 2000 })!;
        expect(legalMoves(g).some((x) => sameMove(x, m)), `${level}, media jugada ${ply}`).toBe(true);
        g = applyMove(g, m);
      }
    }
  });

  test('con una captura obligatoria, la hace', () => {
    // Rojas: un peón en d4 que la blanca de c3 captura. Si las blancas mueven otra ficha, no ganan.
    const g = newGame(draw(['........', '........', '........', '........', '...r....', '..w.....', '........', '.....w..']));
    const m = chooseMove(g, { level: 'normal', rand: () => 0.5, now: fakeClock(), budgetMs: 5000 })!;
    expect(m.path.map(squareName)).toEqual(['c3', 'e5']);
  });

  test('Normal no regala una ficha si puede evitarlo', () => {
    // Si la blanca de d2 sube a c3 o e3, la roja de d4 la captura; si espera con h2-g3, no pasa nada.
    const g = newGame(draw(['........', '........', '........', '........', '...r....', '........', '...w...w', '........']));
    const m = chooseMove(g, { level: 'normal', rand: () => 0.5, now: fakeClock(), budgetMs: 5000 })!;
    expect(squareName(m.path[0])).toBe('h2');
  });

  test('respeta el tope de tiempo: con un reloj que corre, contesta igual', () => {
    let t = 0;
    const slow = () => (t += 50);
    const m = chooseMove(newGame(), { level: 'normal', rand: () => 0.5, now: slow, budgetMs: 300 });
    expect(m).not.toBeNull();
    expect(t).toBeLessThan(2000);
  });

  test('con una sola jugada legal la juega, y sin jugadas devuelve null', () => {
    const one = newGame(draw(['........', '........', '........', '........', '........', '........', '........', 'w.......']));
    expect(chooseMove(one, { level: 'normal', rand: () => 0.5, now: fakeClock() })!.path.map(squareName)).toEqual(['a1', 'b2']);
    const none = newGame(draw(['.......r', '......w.', '.....w..', '........', '........', '........', '........', '........']), 'r');
    expect(chooseMove(none, { level: 'easy', rand: () => 0.5, now: fakeClock() })).toBeNull();
  });

  test('Fácil, con el azar a 0, juega la primera jugada legal (lo usan los tests del navegador)', () => {
    const g = newGame();
    expect(sameMove(chooseMove(g, { level: 'easy', rand: () => 0, now: fakeClock() })!, legalMoves(g)[0])).toBe(true);
  });

  test('la evaluación cuenta el material desde cada lado', () => {
    const g = newGame();
    expect(evaluate(g, 'w')).toBe(evaluate(g, 'r'));
    const up = newGame(draw(['........', '........', '........', '........', '...W....', '........', '........', '.....r..']));
    expect(evaluate(up, 'w')).toBeGreaterThan(0);
    expect(evaluate(up, 'r')).toBeLessThan(0);
  });
});
