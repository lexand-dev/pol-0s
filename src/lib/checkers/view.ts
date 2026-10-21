/**
 * Cómo se ve el tablero de las damas en el escritorio (C-06): una proyección en perspectiva con giro e inclinación, calculada en cada vista
 * (sin librerías 3D), y la vista elegida guardada en el navegador. Lógica pura: la ventana solo pinta lo que sale de aquí.
 */

export interface View {
  /** Giro alrededor del eje vertical, en grados (0 = desde el lado de quien juega). */
  rot: number;
  /** Inclinación de la cámara, en grados (90 = desde arriba). */
  tilt: number;
}

export const DEFAULT_VIEW: View = { rot: 0, tilt: 52 };
export const TILT_MIN = 28;
export const TILT_MAX = 82;
export const VIEW_KEY = 'pol-os:damas:vista';

/** El lienzo del SVG. */
export const VW = 560;
export const VH = 420;
/** Una casilla, en unidades del tablero; el marco y el grosor, en las mismas unidades. */
export const CELL = 46;
export const FRAME = 0.55 * CELL;
export const THICK = 0.5 * CELL;
export const PIECE_R = 0.36 * CELL;
export const PIECE_H = 0.16 * CELL;

const HALF = 4 * CELL;
export const OUTER = HALF + FRAME;
/** Distancia de la cámara: cuanto más lejos, menos perspectiva. */
const DIST = OUTER * 4.2;
/**
 * Escala fija, la del peor caso: el tablero no cambia de tamaño al girarlo ni al inclinarlo. Se calcula para la diagonal (giro de 45°) con el
 * margen de la perspectiva.
 */
const SCALE = Math.min((VW - 16) / (2 * OUTER * Math.SQRT2 * 1.06), (VH - 16) / (2 * OUTER * Math.SQRT2 * 1.06 * 0.9 + THICK));

export const clampTilt = (t: number) => Math.max(TILT_MIN, Math.min(TILT_MAX, t));
export const normRot = (r: number) => ((r % 360) + 360) % 360;
export const clampView = (v: View): View => ({ rot: normRot(v.rot), tilt: clampTilt(v.tilt) });

/** Un punto proyectado: posición en el lienzo, profundidad (más grande, más lejos) y escala de la perspectiva en ese punto. */
export interface Projected {
  x: number;
  y: number;
  depth: number;
  scale: number;
}

export interface Projector {
  /** `x` a la derecha, `z` hacia quien mira y `y` hacia arriba, en unidades del tablero con el centro en 0. */
  project(x: number, z: number, y?: number): Projected;
  /** Seno de la inclinación: cuánto se aplastan los círculos del suelo. */
  squash: number;
  /** El giro aplicado a un vector del suelo (para saber hacia dónde mira una cara). */
  turn(x: number, z: number): [number, number];
}

export function projector(view: View): Projector {
  const th = (view.rot * Math.PI) / 180;
  const ph = (view.tilt * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const sp = Math.sin(ph);
  const cp = Math.cos(ph);
  const turn = (x: number, z: number): [number, number] => [x * cos - z * sin, x * sin + z * cos];
  const raw = (x: number, z: number, y: number) => {
    const [X, Z] = turn(x, z);
    const depth = -Z * cp - y * sp;
    const f = DIST / (DIST + depth);
    return { x: X * SCALE * f, y: (Z * sp - y * cp) * SCALE * f, depth, scale: SCALE * f };
  };
  // Centrado según lo que ocupa el tablero en esta vista (la escala no cambia, solo la posición).
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, z] of [
    [-OUTER, -OUTER],
    [OUTER, -OUTER],
    [OUTER, OUTER],
    [-OUTER, OUTER],
  ]) {
    for (const y of [0, -THICK]) {
      const p = raw(x, z, y);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const ox = VW / 2 - (minX + maxX) / 2;
  const oy = VH / 2 - (minY + maxY) / 2 + 6;
  return {
    project: (x, z, y = 0) => {
      const p = raw(x, z, y);
      return { x: ox + p.x, y: oy + p.y, depth: p.depth, scale: p.scale };
    },
    squash: sp,
    turn,
  };
}

/** El centro de una casilla en unidades del tablero (columna 0 a la izquierda y fila 0 al fondo, vistas desde quien juega). */
export const cellCenter = (r: number, c: number): [number, number] => [(c - 3.5) * CELL, (r - 3.5) * CELL];

/** Un camino cerrado por estos puntos. */
export const polygon = (pts: readonly { x: number; y: number }[]) => 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + 'z';

// ─── Guardar la vista ────────────────────────────────────────────────────────────────────────────
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** La vista guardada, o la de siempre si no hay o no se puede leer (navegación privada, almacenamiento bloqueado o un valor roto). */
export function loadView(storage: Storage | null | undefined): View {
  try {
    const v: unknown = JSON.parse(storage?.getItem(VIEW_KEY) ?? 'null');
    if (v && typeof v === 'object' && 'rot' in v && 'tilt' in v && Number.isFinite(v.rot) && Number.isFinite(v.tilt)) {
      return clampView({ rot: v.rot as number, tilt: v.tilt as number });
    }
  } catch {
    /* sin almacenamiento o con un valor roto: la vista de siempre */
  }
  return { ...DEFAULT_VIEW };
}

export function saveView(storage: Storage | null | undefined, view: View) {
  try {
    storage?.setItem(VIEW_KEY, JSON.stringify(clampView(view)));
  } catch {
    /* sin almacenamiento: la vista vale solo para esta partida */
  }
}
