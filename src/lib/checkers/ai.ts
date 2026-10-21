/**
 * La máquina de las damas (C-06): negamax con poda alfa-beta y profundización iterativa, con un tope de tiempo para no bloquear la ventana.
 * Lógica pura: el reloj y el azar se inyectan, para poder probarla.
 */
import { SIZE, applyMove, legalMoves, outcome, row, type Color, type GameState, type Move } from './rules';

export type Level = 'easy' | 'normal';

export interface Think {
  level: Level;
  /** Un número en [0, 1). */
  rand: () => number;
  /** Milisegundos. */
  now: () => number;
  /** Tiempo máximo para pensar. */
  budgetMs?: number;
}

const WIN = 100_000;
const MAN = 100;
const KING = 320;

/** Lo buena que es la posición para `me`: material, avance de los peones y fichas que guardan su última fila. */
export function evaluate(state: GameState, me: Color): number {
  let score = 0;
  state.board.forEach((p, s) => {
    if (!p) return;
    let v = p.king ? KING : MAN;
    if (!p.king) {
      const advanced = p.color === 'w' ? SIZE - 1 - row(s) : row(s);
      v += advanced * 4;
      if ((p.color === 'w' && row(s) === SIZE - 1) || (p.color === 'r' && row(s) === 0)) v += 6;
    }
    score += p.color === me ? v : -v;
  });
  return score;
}

class Timeout extends Error {}

function negamax(state: GameState, depth: number, alpha: number, beta: number, ply: number, deadline: number, now: () => number): number {
  if (now() > deadline) throw new Timeout();
  const end = outcome(state);
  if (end) return end.kind === 'draw' ? 0 : end.winner === state.turn ? WIN - ply : -(WIN - ply);
  if (depth === 0) return evaluate(state, state.turn);
  let best = -Infinity;
  for (const m of legalMoves(state)) {
    const score = -negamax(applyMove(state, m), depth - 1, -beta, -alpha, ply + 1, deadline, now);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** La mejor jugada que encuentra hasta `maxDepth`, cortando cuando se acaba el tiempo (se queda con la última profundidad completa). */
function search(state: GameState, moves: Move[], maxDepth: number, deadline: number, now: () => number): Move {
  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let bestScore = -Infinity;
      let bestHere = best;
      // La mejor de la vuelta anterior, primero: así la poda corta antes.
      const ordered = [best, ...moves.filter((m) => m !== best)];
      for (const m of ordered) {
        const score = -negamax(applyMove(state, m), depth - 1, -Infinity, -bestScore, 1, deadline, now);
        if (score > bestScore) {
          bestScore = score;
          bestHere = m;
        }
      }
      best = bestHere;
      if (bestScore >= WIN - depth) break;
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }
  return best;
}

/**
 * La jugada de la máquina. **Fácil** mira dos medias jugadas y una de cada tres veces juega al azar; **Normal** profundiza hasta 8 dentro del tope de
 * tiempo. Si solo hay una jugada legal, la juega sin pensar. Devuelve null si no hay ninguna.
 */
export function chooseMove(state: GameState, opts: Think): Move | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  if (opts.level === 'easy' && opts.rand() < 1 / 3) return moves[Math.min(moves.length - 1, Math.floor(opts.rand() * moves.length))];
  const deadline = opts.now() + (opts.budgetMs ?? 300);
  return search(state, moves, opts.level === 'easy' ? 2 : 8, deadline, opts.now);
}
