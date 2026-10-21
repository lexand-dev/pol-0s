/**
 * Geometría de los gráficos del Stack (M-05): el rosco de categorías y la línea de año a año. Todo es puro:
 * recibe números y devuelve coordenadas, así que se prueba sin navegador. Sin librerías: la home tiene presupuesto de JavaScript.
 */
import type { StackTool } from './stack';

export interface ValueItem {
  id: string;
  value: number;
}

// ─── Rosco ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Arc {
  id: string;
  value: number;
  /** Ángulos en grados, desde las 12 en punto y en el sentido de las agujas del reloj. */
  start: number;
  end: number;
  /** Fracción del total, de 0 a 1. */
  share: number;
  /** El trazo SVG de la porción. */
  d: string;
}

const polar = (cx: number, cy: number, radius: number, degrees: number) => {
  const a = ((degrees - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
};
const fixed = (n: number) => n.toFixed(3).replace(/\.?0+$/, '');

/** El trazo de una porción de rosco entre `start` y `end` grados, con radio exterior `outer` e interior `inner`. */
export function ringPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const [x1, y1] = polar(cx, cy, outer, start);
  const [x2, y2] = polar(cx, cy, outer, end);
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M${fixed(x1)} ${fixed(y1)}`,
    `A${fixed(outer)} ${fixed(outer)} 0 ${large} 1 ${fixed(x2)} ${fixed(y2)}`,
    `L${fixed(x3)} ${fixed(y3)}`,
    `A${fixed(inner)} ${fixed(inner)} 0 ${large} 0 ${fixed(x4)} ${fixed(y4)}`,
    'Z',
  ].join(' ');
}

/**
 * Las porciones de un rosco, una por elemento con valor positivo, cada una proporcional a su valor. Entre porciones queda un hueco de
 * `gap` grados (no con un solo elemento, que da la vuelta entera).
 */
export function donutArcs(items: readonly ValueItem[], geometry: { cx: number; cy: number; outer: number; inner: number; gap?: number }): Arc[] {
  const list = items.filter((i) => Number.isFinite(i.value) && i.value > 0);
  const total = list.reduce((sum, i) => sum + i.value, 0);
  if (total === 0) return [];
  const gap = list.length > 1 ? (geometry.gap ?? 0) : 0;
  const room = 360 - gap * list.length;
  let cursor = 0;
  return list.map((i) => {
    const sweep = (i.value / total) * room;
    const start = cursor + gap / 2;
    // Una vuelta completa no se puede dibujar con un solo arco: se queda a una centésima.
    const end = list.length === 1 ? start + 359.99 : start + sweep;
    cursor += sweep + gap;
    return { id: i.id, value: i.value, start, end, share: i.value / total, d: ringPath(geometry.cx, geometry.cy, geometry.outer, geometry.inner, start, end) };
  });
}

// ─── Año a año ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface YearStep {
  year: number;
  /** Herramientas que entraron ese año, de más a menos usadas. */
  added: string[];
  /** Herramientas acumuladas hasta ese año, incluido. */
  total: number;
}

/** El acumulado de herramientas año a año, sin saltarse ninguno: un año sin altas repite el total anterior. */
export function cumulativeByYear(tools: readonly Pick<StackTool, 'name' | 'repos' | 'since'>[]): YearStep[] {
  if (tools.length === 0) return [];
  const first = Math.min(...tools.map((t) => t.since));
  const last = Math.max(...tools.map((t) => t.since));
  const steps: YearStep[] = [];
  let total = 0;
  for (let year = first; year <= last; year++) {
    const added = tools
      .filter((t) => t.since === year)
      .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name, 'es'))
      .map((t) => t.name);
    total += added.length;
    steps.push({ year, added, total });
  }
  return steps;
}

export interface LinePoint {
  /** Posición como porcentaje de la caja: x desde la izquierda, y desde abajo. */
  x: number;
  y: number;
}

/** Los puntos de la línea, uno por columna (centrados en ella) y escalados al mayor total. */
export function linePoints(totals: readonly number[], padding = 8): LinePoint[] {
  const max = Math.max(0, ...totals);
  if (max === 0) return totals.map((_, i) => ({ x: ((i + 0.5) / totals.length) * 100, y: 0 }));
  return totals.map((total, i) => ({ x: ((i + 0.5) / totals.length) * 100, y: padding + (total / max) * (100 - 2 * padding) }));
}
