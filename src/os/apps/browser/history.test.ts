import { describe, expect, test } from 'vitest';
import { back, canGoBack, canGoForward, createHistory, current, forward, visit } from './history';

const known = new Set(['mitienda', 'estudio', 'panel']);

describe('historial del Navegador', () => {
  test('empieza en Favoritos o en el proyecto con el que se abre', () => {
    expect(current(createHistory())).toBeNull();
    expect(current(createHistory('estudio'))).toBe('estudio');
  });

  test('visitar avanza y permite volver atrás', () => {
    let h = visit(createHistory(), 'mitienda', known);
    h = visit(h, 'estudio', known);
    expect(current(h)).toBe('estudio');
    expect(canGoBack(h)).toBe(true);
    expect(canGoForward(h)).toBe(false);
    h = back(h);
    expect(current(h)).toBe('mitienda');
    expect(canGoForward(h)).toBe(true);
    h = forward(h);
    expect(current(h)).toBe('estudio');
  });

  test('visitar después de volver atrás descarta lo que había delante', () => {
    let h = visit(visit(createHistory(), 'mitienda', known), 'estudio', known);
    h = visit(back(h), 'panel', known);
    expect(h.entries).toEqual([null, 'mitienda', 'panel']);
    expect(canGoForward(h)).toBe(false);
  });

  test('volver a visitar lo mismo no duplica la entrada', () => {
    const h = visit(createHistory('estudio'), 'estudio', known);
    expect(h.entries).toEqual(['estudio']);
  });

  test('un proyecto que no existe no entra en el historial', () => {
    const h = createHistory('estudio');
    expect(visit(h, 'https://otra-web.com', known)).toBe(h);
    expect(visit(h, 'inventado', known)).toBe(h);
  });

  test('atrás al principio y adelante al final no hacen nada', () => {
    const h = createHistory();
    expect(back(h)).toBe(h);
    expect(forward(h)).toBe(h);
  });

  test('Favoritos también es una entrada a la que se vuelve', () => {
    const h = back(visit(createHistory('mitienda'), null, known));
    expect(current(h)).toBe('mitienda');
    expect(current(forward(h))).toBeNull();
  });
});
