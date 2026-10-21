import { describe, expect, test } from 'vitest';
import { GAME_IDS, type Line } from '../commands';
import {
  GUESS_TRIES,
  MENU,
  HANGMAN_MISSES,
  WORDLE_LENGTH,
  WORDLE_TRIES,
  fold,
  guess,
  hangman,
  isWord,
  masked,
  score,
  startGame,
  wordle,
  wordleRow,
  type GuessState,
  type HangmanState,
  type WordleState,
} from './games';
import { HANGMAN_WORDS, WORDLE_WORDS } from './words';

const flat = (lines: Line[]) => lines.map((l) => l.map((s) => s.text).join('')).join('\n');
const first = () => 0;
const wordleWith = (display: string): WordleState => ({ solution: fold(display), display, guesses: [], discarded: [] });
const hangmanWith = (display: string): HangmanState => ({ solution: fold(display), display, hits: [], misses: [] });

describe('palabras', () => {
  test('las tildes no cuentan y la ñ es una letra propia', () => {
    expect(fold('Acción')).toBe('accion');
    expect(fold('Píxel')).toBe('pixel');
    expect(fold('SUEÑO')).toBe('sueño');
    expect(fold('Contraseña')).toBe('contraseña');
    expect(isWord('sueño')).toBe(true);
    for (const bad of ['', 'abc1', 'dos palabras', '<b>', 'ab-c']) expect(isWord(bad), bad).toBe(false);
  });

  test(`las de Wordle tienen ${WORDLE_LENGTH} letras, solo letras y no se repiten`, () => {
    const folded = WORDLE_WORDS.map(fold);
    for (const w of folded) {
      expect([...w].length, w).toBe(WORDLE_LENGTH);
      expect(isWord(w), w).toBe(true);
    }
    expect(new Set(folded).size).toBe(folded.length);
    expect(folded.length).toBeGreaterThanOrEqual(50);
  });

  test('las del ahorcado son una sola palabra, solo letras y no se repiten', () => {
    const folded = HANGMAN_WORDS.map(fold);
    for (const w of folded) {
      expect(isWord(w), w).toBe(true);
      expect([...w].length, w).toBeGreaterThanOrEqual(5);
    }
    expect(new Set(folded).size).toBe(folded.length);
    expect(folded.length).toBeGreaterThanOrEqual(35);
  });
});

describe('Wordle', () => {
  test('marca cada letra: en su sitio, en otro sitio o no está', () => {
    expect(score('datos', 'datos')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(score('sotad', 'datos')).toEqual(['near', 'near', 'hit', 'near', 'near']);
    expect(score('fumbl', 'datos')).toEqual(['miss', 'miss', 'miss', 'miss', 'miss']);
  });

  test('una letra repetida en el intento solo se marca tantas veces como sale en la solución', () => {
    // «error» tiene tres r; «rutas» una: solo la primera r de «error» que no está en su sitio cuenta.
    expect(score('error', 'rutas')).toEqual(['miss', 'near', 'miss', 'miss', 'miss']);
    // La que está en su sitio gana a la que está en otro.
    expect(score('lisas', 'pilas')).toEqual(['near', 'hit', 'miss', 'hit', 'hit']);
  });

  test('la fila se ve con marcas de texto, no solo con color, y se dice con palabras a los lectores de pantalla', () => {
    const row = wordleRow('sotad', score('sotad', 'datos'));
    const visible = row.filter((s) => !s.sr);
    expect(visible.map((s) => s.text.trim())).toEqual(['(S)', '(O)', '[T]', '(A)', '(D)']);
    expect(visible.every((s) => s.hidden)).toBe(true);
    const spoken = row.find((s) => s.sr)!.text;
    expect(spoken).toContain('T en su sitio');
    expect(spoken).toContain('S en otro sitio');
    expect(flat([wordleRow('fumbl', score('fumbl', 'datos'))])).toContain('·f·');
  });

  test('gana al acertar, aunque se escriba con tildes o mayúsculas', () => {
    const turn = wordle.play(wordleWith('píxel'), 'PÍXEL');
    expect(turn.done).toBe(true);
    expect(flat(turn.lines)).toContain('¡Bien! Era «píxel»');
  });

  test(`pierde al intento ${WORDLE_TRIES} y enseña la solución`, () => {
    let state = wordleWith('datos');
    for (let i = 0; i < WORDLE_TRIES - 1; i++) {
      const turn = wordle.play(state, 'nubes');
      expect(turn.done).toBe(false);
      state = turn.state;
    }
    const last = wordle.play(state, 'nubes');
    expect(last.done).toBe(true);
    expect(flat(last.lines)).toContain('Era «datos»');
  });

  test('cuenta los intentos y las letras descartadas', () => {
    const turn = wordle.play(wordleWith('datos'), 'nubes');
    expect(flat(turn.lines)).toContain('Intento 1 de 6');
    expect(flat(turn.lines)).toContain('Descartadas: b e n u');
  });

  test('negativo: lo que no es una palabra de cinco letras avisa y no gasta intento', () => {
    const state = wordleWith('datos');
    for (const bad of ['', 'dato', 'datoss', 'dat0s', 'da os', '12345']) {
      const turn = wordle.play(state, bad);
      expect(turn.done, bad).toBe(false);
      expect(turn.state, bad).toBe(state);
      expect(turn.lines[0][0].tone, bad).toBe('error');
    }
  });

  test('empieza con la palabra que da el azar', () => {
    expect(wordle.start(first).state.display).toBe(WORDLE_WORDS[0]);
    expect(wordle.start(() => 0.9999).state.display).toBe(WORDLE_WORDS.at(-1));
  });
});

describe('Ahorcado', () => {
  test('descubre todas las apariciones de una letra, respetando las tildes de la palabra', () => {
    const turn = hangman.play(hangmanWith('función'), 'n');
    expect(masked(turn.state)).toBe('_ _ n _ _ _ n');
    const again = hangman.play(turn.state, 'o');
    expect(masked(again.state)).toBe('_ _ n _ _ ó n');
  });

  test('gana al completar la palabra', () => {
    let state = hangmanWith('reseña');
    let last = hangman.play(state, 'r');
    for (const c of ['e', 's', 'ñ', 'a']) {
      state = last.state;
      last = hangman.play(state, c);
    }
    expect(last.done).toBe(true);
    expect(flat(last.lines)).toContain('¡Salvado! Era «reseña»');
  });

  test(`pierde al fallo ${HANGMAN_MISSES} y dibuja el muñeco entero`, () => {
    let state = hangmanWith('red' + 'es'); // «redes»
    let last = hangman.play(state, 'z');
    for (const c of ['x', 'q', 'w', 'k', 'j']) {
      state = last.state;
      last = hangman.play(state, c);
    }
    expect(last.done).toBe(true);
    expect(flat(last.lines)).toContain('Ahorcado. Era «redes»');
    expect(flat(last.lines)).toContain('/ \\');
  });

  test('negativo: una letra repetida o varias letras no gastan intento', () => {
    const one = hangman.play(hangmanWith('datos'), 'z');
    const repeated = hangman.play(one.state, 'Z');
    expect(repeated.state.misses).toEqual(['z']);
    expect(flat(repeated.lines)).toContain('ya la has dicho');
    for (const bad of ['', 'ab', '1', '?', 'datos']) {
      const turn = hangman.play(one.state, bad);
      expect(turn.state, bad).toBe(one.state);
      expect(turn.lines[0][0].tone, bad).toBe('error');
    }
  });

  test('el dibujo es solo para la vista: los lectores de pantalla lo saltan', () => {
    const start = hangman.start(first);
    const drawing = start.lines.filter((l) => l[0].text.startsWith('  |') || l[0].text === '=====');
    expect(drawing.length).toBeGreaterThan(0);
    expect(drawing.every((l) => l[0].hidden)).toBe(true);
  });
});

describe('Adivina el número', () => {
  const at = (secret: number): GuessState => ({ secret, tries: 0 });

  test('da pistas de más alto y más bajo, y gana al acertar', () => {
    expect(flat(guess.play(at(40), '20').lines)).toContain('Más alto');
    expect(flat(guess.play(at(40), '60').lines)).toContain('Más bajo');
    const win = guess.play(at(40), '40');
    expect(win.done).toBe(true);
    expect(flat(win.lines)).toContain('¡Exacto! Era el 40, en 1 intento');
  });

  test(`pierde al intento ${GUESS_TRIES}`, () => {
    let state = at(99);
    let last = guess.play(state, '1');
    for (let i = 1; i < GUESS_TRIES; i++) {
      expect(last.done).toBe(false);
      state = last.state;
      last = guess.play(state, '1');
    }
    expect(last.done).toBe(true);
    expect(flat(last.lines)).toContain('Era el 99');
  });

  test('negativo: fuera de 1–100, decimales o texto avisan y no gastan intento', () => {
    const state = at(50);
    for (const bad of ['0', '101', '-3', '2.5', 'cincuenta', '', '1e2']) {
      const turn = guess.play(state, bad);
      expect(turn.state, bad).toBe(state);
      expect(turn.lines[0][0].tone, bad).toBe('error');
    }
  });

  test('el número del azar está siempre entre 1 y 100', () => {
    expect(guess.start(first).state.secret).toBe(1);
    expect(guess.start(() => 0.999999).state.secret).toBe(100);
  });
});

describe('la partida en la Terminal', () => {
  test('minigames lista los juegos y cómo empezar', () => {
    const list = flat(MENU);
    for (const id of GAME_IDS) expect(list).toContain(id);
    expect(list).toContain('memory');
    expect(list).toContain('checkers');
    expect(list).toContain('salir');
  });

  test('cada juego tiene su aviso e introducción', () => {
    for (const id of GAME_IDS) {
      const s = startGame(id, first);
      expect(s.prompt).toBe(`${id}>`);
      expect(flat(s.intro)).toContain('salir');
    }
  });

  test('salir (o exit) termina la partida', () => {
    for (const word of ['salir', 'SALIR', 'exit']) {
      const turn = startGame('wordle', first).play(word);
      expect(turn.done).toBe(true);
      expect(flat(turn.lines)).toContain('Partida terminada');
    }
  });

  test('negativo: un comando o el nombre de un juego no cuentan como jugada ni reinician la partida', () => {
    const s = startGame('guess', first);
    for (const word of ['help', 'guess', 'adivina', 'wordle', 'minigames']) {
      const turn = s.play(word);
      expect(turn.done).toBe(false);
      expect(flat(turn.lines)).toContain('Escribe salir');
    }
    // La partida sigue donde estaba: el número es 1 y se acierta al primer intento válido.
    expect(flat(s.play('1').lines)).toContain('en 1 intento');
  });
});
