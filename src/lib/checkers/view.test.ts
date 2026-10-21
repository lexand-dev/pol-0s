import { describe, expect, test } from 'vitest';
import { DEFAULT_VIEW, OUTER, THICK, TILT_MAX, TILT_MIN, VH, VIEW_KEY, VW, cellCenter, clampView, loadView, projector, saveView } from './view';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe('proyección', () => {
  test('en todas las vistas el tablero cabe en el lienzo, con su canto', () => {
    for (let rot = 0; rot < 360; rot += 15) {
      for (let tilt = TILT_MIN; tilt <= TILT_MAX; tilt += 6) {
        const p = projector({ rot, tilt });
        for (const [x, z] of [[-OUTER, -OUTER], [OUTER, -OUTER], [OUTER, OUTER], [-OUTER, OUTER]]) {
          for (const y of [0, -THICK]) {
            const q = p.project(x, z, y);
            expect(q.x, `giro ${rot}, inclinación ${tilt}`).toBeGreaterThanOrEqual(0);
            expect(q.x).toBeLessThanOrEqual(VW);
            expect(q.y).toBeGreaterThanOrEqual(0);
            expect(q.y).toBeLessThanOrEqual(VH);
          }
        }
      }
    }
  });

  test('el tamaño no cambia al girar: la casilla central mide lo mismo en cualquier giro', () => {
    const size = (rot: number) => {
      const p = projector({ rot, tilt: 52 });
      return p.project(0, 0).scale;
    };
    expect(size(0)).toBeCloseTo(size(45), 6);
    expect(size(90)).toBeCloseTo(size(200), 6);
  });

  test('hay perspectiva: lo cercano se ve más grande que lo lejano', () => {
    const p = projector(DEFAULT_VIEW);
    const [, zNear] = cellCenter(7, 3);
    const [, zFar] = cellCenter(0, 3);
    expect(p.project(0, zNear).scale).toBeGreaterThan(p.project(0, zFar).scale);
    expect(p.project(0, zNear).y).toBeGreaterThan(p.project(0, zFar).y);
  });

  test('desde arriba los círculos casi no se aplastan, y de lado sí', () => {
    expect(projector({ rot: 0, tilt: TILT_MAX }).squash).toBeGreaterThan(0.95);
    expect(projector({ rot: 0, tilt: TILT_MIN }).squash).toBeLessThan(0.5);
  });
});

describe('guardar la vista', () => {
  test('se guarda y se recupera', () => {
    const s = memory();
    saveView(s, { rot: 135, tilt: 60 });
    expect(loadView(s)).toEqual({ rot: 135, tilt: 60 });
  });

  test('una vista fuera de rango se ajusta', () => {
    expect(clampView({ rot: -45, tilt: 5 })).toEqual({ rot: 315, tilt: TILT_MIN });
    expect(clampView({ rot: 725, tilt: 120 })).toEqual({ rot: 5, tilt: TILT_MAX });
  });

  test('negativo: sin almacenamiento, con un valor roto o con un almacenamiento que falla, se usa la vista de siempre', () => {
    expect(loadView(null)).toEqual(DEFAULT_VIEW);
    const s = memory();
    s.data.set(VIEW_KEY, '{roto');
    expect(loadView(s)).toEqual(DEFAULT_VIEW);
    s.data.set(VIEW_KEY, JSON.stringify({ rot: 'x', tilt: 40 }));
    expect(loadView(s)).toEqual(DEFAULT_VIEW);
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(loadView(broken)).toEqual(DEFAULT_VIEW);
    expect(() => saveView(broken, DEFAULT_VIEW)).not.toThrow();
  });
});
