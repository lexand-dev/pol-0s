import { describe, expect, test } from 'vitest';
import {
  BOTTOM_GRIP,
  DOCK_SPACE,
  bringAllToFront,
  cascade,
  EDGE,
  MENU_H,
  MIN_H,
  MIN_W,
  close,
  createState,
  fitToViewport,
  focus,
  minimize,
  move,
  open,
  resize,
  tile,
  tileRect,
  toggleMaximize,
  windowKey,
  type OpenSpec,
  type WMState,
} from './window-manager';

const vp = { width: 1280, height: 800 };
const spec = (app: string, arg?: string): OpenSpec => ({ app, arg, title: app, width: 600, height: 400 });
const win = (s: WMState, key: string) => {
  const w = s.windows.find((x) => x.key === key);
  if (!w) throw new Error(`No existe la ventana ${key}`);
  return w;
};

describe('abrir ventanas', () => {
  test('abre la ventana con foco y por encima de las demás', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    expect(s.focused).toBe('tools');
    expect(win(s, 'tools').z).toBeGreaterThan(win(s, 'mail').z);
  });

  test('la primera ventana se abre centrada entre la barra de menú y el dock', () => {
    const { rect } = win(open(createState(), spec('mail'), vp), 'mail');
    expect(rect.x).toBe(Math.round((vp.width - rect.w) / 2));
    expect(rect.y).toBe(Math.round(MENU_H + (vp.height - MENU_H - DOCK_SPACE - rect.h) / 2));
  });

  test('cada ventana nueva se abre escalonada respecto a la anterior', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    expect(win(s, 'tools').rect.x).toBeGreaterThan(win(s, 'mail').rect.x);
    expect(win(s, 'tools').rect.y).toBeGreaterThan(win(s, 'mail').rect.y);
  });

  test('reabrir una app no duplica la ventana: la trae al frente y la restaura si estaba minimizada', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    s = minimize(s, 'mail');
    s = open(s, spec('mail'), vp);
    expect(s.windows.filter((w) => w.key === 'mail')).toHaveLength(1);
    expect(win(s, 'mail').minimized).toBe(false);
    expect(s.focused).toBe('mail');
  });

  test('el navegador es una sola ventana que cambia de proyecto', () => {
    let s = open(createState(), spec('browser', 'estudio'), vp);
    s = open(s, spec('browser', 'panel'), vp);
    expect(s.windows).toHaveLength(1);
    expect(win(s, 'browser').arg).toBe('panel');
  });

  test('cada vez que se pide abrir una ventana existente se cuenta, aunque sea con lo mismo', () => {
    let s = open(createState(), spec('browser', 'estudio'), vp);
    expect(win(s, 'browser').opens).toBe(1);
    s = open(s, spec('browser', 'estudio'), vp);
    expect(win(s, 'browser').opens).toBe(2);
  });

  test('abrir sin contenido una ventana que ya tiene uno lo conserva', () => {
    let s = open(createState(), spec('browser', 'estudio'), vp);
    s = open(s, spec('browser'), vp);
    expect(win(s, 'browser').arg).toBe('estudio');
  });

  test('cada nota abre su propia ventana', () => {
    expect(windowKey('note', 'una')).toBe('note:una');
    let s = open(createState(), spec('note', 'una'), vp);
    s = open(s, spec('note', 'otra'), vp);
    expect(s.windows.map((w) => w.key)).toEqual(['note:una', 'note:otra']);
  });

  test('en una pantalla pequeña la ventana no es más grande que la pantalla', () => {
    const small = { width: 800, height: 500 };
    const s = open(createState(), { ...spec('browser'), width: 900, height: 600 }, small);
    const { rect } = win(s, 'browser');
    expect(rect.x + rect.w).toBeLessThanOrEqual(small.width);
    expect(rect.y).toBeGreaterThanOrEqual(MENU_H);
  });
});

describe('foco, cierre y minimizado', () => {
  test('pulsar una ventana de detrás la trae al frente', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    s = focus(s, 'mail');
    expect(s.focused).toBe('mail');
    expect(win(s, 'mail').z).toBeGreaterThan(win(s, 'tools').z);
  });

  test('al cerrar, el foco pasa a la ventana visible más alta', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    s = open(s, spec('settings'), vp);
    s = close(s, 'settings');
    expect(s.windows.map((w) => w.key)).toEqual(['mail', 'tools']);
    expect(s.focused).toBe('tools');
  });

  test('al minimizar la única ventana no queda ninguna con foco', () => {
    let s = open(createState(), spec('mail'), vp);
    s = minimize(s, 'mail');
    expect(s.focused).toBeNull();
    expect(win(s, 'mail').minimized).toBe(true);
  });

  test('enfocar una ventana inexistente no cambia nada', () => {
    const s = open(createState(), spec('mail'), vp);
    expect(focus(s, 'nada')).toBe(s);
  });
});

describe('mover: la barra de título nunca sale de la pantalla (M-02, caso negativo)', () => {
  const base = () => open(createState(), spec('mail'), vp);

  test('mueve la ventana a la posición pedida si cabe', () => {
    const s = move(base(), 'mail', 200, 150, vp);
    expect(win(s, 'mail').rect).toMatchObject({ x: 200, y: 150 });
  });

  test('por la izquierda siempre quedan visibles al menos EDGE píxeles', () => {
    const { rect } = win(move(base(), 'mail', -5000, 200, vp), 'mail');
    expect(rect.x + rect.w).toBe(EDGE);
  });

  test('por la derecha siempre quedan visibles al menos EDGE píxeles', () => {
    const { rect } = win(move(base(), 'mail', 5000, 200, vp), 'mail');
    expect(rect.x).toBe(vp.width - EDGE);
  });

  test('no puede subir por encima de la barra de menú', () => {
    expect(win(move(base(), 'mail', 200, -300, vp), 'mail').rect.y).toBe(MENU_H);
  });

  test('no puede bajar tanto que la barra de título desaparezca', () => {
    expect(win(move(base(), 'mail', 200, 5000, vp), 'mail').rect.y).toBe(vp.height - BOTTOM_GRIP);
  });

  test('al cambiar el tamaño de la pantalla las ventanas vuelven a quedar alcanzables', () => {
    const s = move(base(), 'mail', 1100, 700, vp);
    const small = { width: 600, height: 400 };
    const { rect } = win(fitToViewport(s, small), 'mail');
    expect(rect.x).toBeLessThanOrEqual(small.width - EDGE);
    expect(rect.y).toBeLessThanOrEqual(small.height - BOTTOM_GRIP);
  });
});

describe('redimensionar y ampliar', () => {
  const base = () => move(open(createState(), spec('mail'), vp), 'mail', 100, 100, vp);

  test('respeta el tamaño mínimo', () => {
    const { rect } = win(resize(base(), 'mail', 10, 10, vp), 'mail');
    expect(rect.w).toBe(MIN_W);
    expect(rect.h).toBe(MIN_H);
  });

  test('no crece más allá del borde de la pantalla', () => {
    const { rect } = win(resize(base(), 'mail', 5000, 5000, vp), 'mail');
    expect(rect.x + rect.w).toBeLessThanOrEqual(vp.width);
    expect(rect.y + rect.h).toBeLessThanOrEqual(vp.height);
  });

  test('ampliar ocupa la pantalla bajo la barra de menú y volver a pulsar restaura', () => {
    const before = win(base(), 'mail').rect;
    let s = toggleMaximize(base(), 'mail', vp);
    expect(win(s, 'mail')).toMatchObject({ maximized: true, rect: { x: 0, y: MENU_H, w: vp.width } });
    s = toggleMaximize(s, 'mail', vp);
    expect(win(s, 'mail').maximized).toBe(false);
    expect(win(s, 'mail').rect).toEqual(before);
  });

  test('una ventana ampliada no se redimensiona desde la esquina', () => {
    const s = toggleMaximize(base(), 'mail', vp);
    expect(resize(s, 'mail', 400, 300, vp)).toEqual(s);
  });

  test('arrastrar una ventana ampliada la devuelve a su tamaño anterior', () => {
    const before = win(base(), 'mail').rect;
    const s = move(toggleMaximize(base(), 'mail', vp), 'mail', 300, 200, vp);
    expect(win(s, 'mail')).toMatchObject({ maximized: false, rect: { x: 300, y: 200, w: before.w, h: before.h } });
  });
});

describe('ordenar en cascada', () => {
  const three = () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    s = open(s, spec('settings'), vp);
    return s;
  };

  test('escalona las ventanas visibles, la más reciente la última, sin cambiar su tamaño', () => {
    const s = three();
    const before = s.windows.map((w) => ({ key: w.key, w: w.rect.w, h: w.rect.h }));
    const c = cascade(s, vp);
    const [a, b, d] = ['mail', 'tools', 'settings'].map((k) => win(c, k).rect);
    expect(b.x - a.x).toBe(d.x - b.x);
    expect(b.y - a.y).toBe(d.y - b.y);
    expect(b.x).toBeGreaterThan(a.x);
    expect(c.windows.map((w) => ({ key: w.key, w: w.rect.w, h: w.rect.h }))).toEqual(before);
  });

  test('no mueve las minimizadas ni las ampliadas, y conserva el orden de apilado y el foco', () => {
    let s = minimize(three(), 'tools');
    s = toggleMaximize(s, 'settings', vp);
    const c = cascade(s, vp);
    expect(win(c, 'tools').rect).toEqual(win(s, 'tools').rect);
    expect(win(c, 'settings').rect).toEqual(win(s, 'settings').rect);
    expect(c.windows.map((w) => w.z)).toEqual(s.windows.map((w) => w.z));
    expect(c.focused).toBe(s.focused);
  });

  test('con muchas ventanas el escalón vuelve a empezar y ninguna barra de título queda fuera', () => {
    let s = createState();
    for (let i = 0; i < 12; i++) s = open(s, spec('note', `n${i}`), vp);
    for (const w of cascade(s, vp).windows) {
      expect(w.rect.y).toBeGreaterThanOrEqual(MENU_H);
      expect(w.rect.x + w.rect.w).toBeGreaterThanOrEqual(EDGE);
    }
  });

  test('sin ventanas no hace nada', () => {
    const s = createState();
    expect(cascade(s, vp)).toEqual(s);
  });
});

describe('traer todo al frente', () => {
  test('recupera las minimizadas y las sube todas, conservando su orden relativo', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    s = open(s, spec('settings'), vp);
    s = minimize(s, 'tools');
    const order = (st: WMState) => [...st.windows].sort((a, b) => a.z - b.z).map((w) => w.key);
    const raised = bringAllToFront(s);
    expect(raised.windows.every((w) => !w.minimized)).toBe(true);
    expect(order(raised)).toEqual(order(s));
    expect(Math.min(...raised.windows.map((w) => w.z))).toBeGreaterThan(s.zTop);
  });

  test('mantiene el foco y, si no había ninguno, lo da a la ventana de arriba', () => {
    let s = open(createState(), spec('mail'), vp);
    s = open(s, spec('tools'), vp);
    expect(bringAllToFront(s).focused).toBe('tools');
    s = minimize(minimize(s, 'tools'), 'mail');
    expect(s.focused).toBeNull();
    expect(bringAllToFront(s).focused).toBe('tools');
  });

  test('sin ventanas no hace nada', () => {
    const s = createState();
    expect(bringAllToFront(s)).toBe(s);
  });
});

describe('mosaico: mitad izquierda y derecha (S-07)', () => {
  const base = () => open(createState(), spec('mail'), vp);
  const usable = { x: 0, y: MENU_H, w: vp.width, h: vp.height - MENU_H - DOCK_SPACE };

  test('cada mitad ocupa el alto útil y el ancho a partes iguales, sin huecos ni solapes', () => {
    for (const width of [768, 1023, 1280, 1281, 1920, 2561]) {
      const v = { width, height: 800 };
      const left = tileRect('left', v);
      const right = tileRect('right', v);
      expect(left.x, `izquierda ${width}`).toBe(0);
      expect(left.x + left.w, `unión ${width}`).toBe(right.x);
      expect(right.x + right.w, `derecha ${width}`).toBe(width);
      expect(left.y).toBe(MENU_H);
      expect(left.h).toBe(right.h);
      expect(Math.abs(left.w - right.w)).toBeLessThanOrEqual(1);
    }
  });

  test('en el ancho mínimo de escritorio cada mitad supera el mínimo de ventana', () => {
    expect(tileRect('left', { width: 768, height: 600 }).w).toBeGreaterThanOrEqual(MIN_W);
  });

  test('colocar a la izquierda o a la derecha deja la ventana en su mitad y guarda el tamaño anterior', () => {
    const before = win(base(), 'mail').rect;
    const l = win(tile(base(), 'mail', 'left', vp), 'mail');
    expect(l.tile).toBe('left');
    expect(l.maximized).toBe(false);
    expect(l.rect).toEqual({ ...usable, w: 640 });
    expect(l.restore).toEqual(before);
    const r = win(tile(base(), 'mail', 'right', vp), 'mail');
    expect(r.rect).toEqual({ ...usable, x: 640, w: 640 });
  });

  test('pasar de una mitad a otra, o a ampliada, no pisa el tamaño original', () => {
    const before = win(base(), 'mail').rect;
    let s = tile(base(), 'mail', 'left', vp);
    s = tile(s, 'mail', 'right', vp);
    expect(win(s, 'mail').restore).toEqual(before);
    s = toggleMaximize(s, 'mail', vp); // colocada → vuelve al original
    expect(win(s, 'mail').tile).toBeUndefined();
    expect(win(s, 'mail').rect).toEqual(before);
  });

  test('de ampliada a una mitad se conserva el tamaño de antes de ampliar', () => {
    const before = win(base(), 'mail').rect;
    let s = toggleMaximize(base(), 'mail', vp);
    s = tile(s, 'mail', 'left', vp);
    expect(win(s, 'mail').maximized).toBe(false);
    expect(win(s, 'mail').restore).toEqual(before);
    expect(win(toggleMaximize(s, 'mail', vp), 'mail').rect).toEqual(before);
  });

  test('ampliar/restaurar sobre una ventana colocada la devuelve a su tamaño anterior', () => {
    const before = win(base(), 'mail').rect;
    const s = toggleMaximize(tile(base(), 'mail', 'right', vp), 'mail', vp);
    expect(win(s, 'mail')).toMatchObject({ maximized: false, tile: undefined, restore: undefined, rect: before });
  });

  test('arrastrar una ventana colocada la suelta y recupera su tamaño anterior', () => {
    const before = win(base(), 'mail').rect;
    const s = move(tile(base(), 'mail', 'left', vp), 'mail', 300, 200, vp);
    const w = win(s, 'mail');
    expect(w.tile).toBeUndefined();
    expect(w.restore).toBeUndefined();
    expect(w.rect).toEqual({ ...before, x: 300, y: 200 });
  });

  test('una ventana colocada no se redimensiona: se suelta moviéndola o restaurándola', () => {
    const s = tile(base(), 'mail', 'left', vp);
    expect(resize(s, 'mail', 900, 700, vp)).toEqual(s);
  });

  test('al cambiar el tamaño de la pantalla, las colocadas se reajustan a su mitad', () => {
    const s = fitToViewport(tile(base(), 'mail', 'right', vp), { width: 1000, height: 700 });
    expect(win(s, 'mail').rect).toEqual(tileRect('right', { width: 1000, height: 700 }));
  });

  test('Ordenar en cascada no toca las ventanas colocadas', () => {
    let s = open(open(createState(), spec('mail'), vp), spec('tools'), vp);
    s = tile(s, 'mail', 'left', vp);
    const placed = win(s, 'mail').rect;
    const c = cascade(s, vp);
    expect(win(c, 'mail').rect).toEqual(placed);
    expect(win(c, 'mail').tile).toBe('left');
  });

  test('dos ventanas, una en cada mitad, no se solapan', () => {
    let s = open(open(createState(), spec('mail'), vp), spec('tools'), vp);
    s = tile(tile(s, 'mail', 'left', vp), 'tools', 'right', vp);
    const a = win(s, 'mail').rect;
    const b = win(s, 'tools').rect;
    expect(a.x + a.w).toBeLessThanOrEqual(b.x);
  });

  test('minimizar y recuperar una ventana colocada la deja en su mitad', () => {
    let s = tile(base(), 'mail', 'left', vp);
    s = focus(minimize(s, 'mail'), 'mail');
    expect(win(s, 'mail')).toMatchObject({ minimized: false, tile: 'left', rect: tileRect('left', vp) });
  });

  test('colocar una ventana que no existe no hace nada', () => {
    const s = base();
    expect(tile(s, 'fantasma', 'left', vp)).toEqual(s);
  });
});
