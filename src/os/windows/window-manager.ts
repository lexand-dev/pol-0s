/**
 * Gestor de ventanas del escritorio.
 *
 * Funciones puras: reciben el estado y devuelven uno nuevo. Los componentes Svelte guardan el
 * estado y solo llaman a estas funciones, así la lógica se prueba sin navegador.
 */

export interface Viewport {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TileSide = 'left' | 'right';

export interface WindowState {
  key: string;
  app: string;
  arg?: string;
  title: string;
  rect: Rect;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Mitad de la pantalla que ocupa la ventana, si está colocada (S-07). */
  tile?: TileSide;
  /** Tamaño y posición antes de ampliar o colocar, para restaurar. */
  restore?: Rect;
  /** Veces que se ha pedido abrir esta ventana: la app lo usa para volver a navegar a `arg`. */
  opens: number;
}

export interface WMState {
  windows: WindowState[];
  focused: string | null;
  zTop: number;
}

export interface OpenSpec {
  app: string;
  arg?: string;
  title: string;
  width: number;
  height: number;
}

/** Alto de la barra de menú. */
export const MENU_H = 32;
/** Espacio reservado al dock al calcular tamaños iniciales y ventanas ampliadas. */
export const DOCK_SPACE = 84;
export const MIN_W = 320;
export const MIN_H = 220;
/** Parte de la ventana que siempre queda dentro de la pantalla por los lados. */
export const EDGE = 90;
/** Margen inferior: la barra de título nunca baja de aquí. */
export const BOTTOM_GRIP = 44;
const CASCADE = 28;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const createState = (): WMState => ({ windows: [], focused: null, zTop: 10 });

export const windowKey = (app: string, arg?: string) => (app === 'note' && arg ? `note:${arg}` : app);

/** Coloca la ventana de forma que su barra de título siempre se pueda agarrar. */
export function clampPosition(rect: Rect, vp: Viewport): Rect {
  return {
    ...rect,
    x: clamp(rect.x, EDGE - rect.w, vp.width - EDGE),
    y: clamp(rect.y, MENU_H, Math.max(MENU_H, vp.height - BOTTOM_GRIP)),
  };
}

function maximizedRect(vp: Viewport): Rect {
  return { x: 0, y: MENU_H, w: vp.width, h: Math.max(MIN_H, vp.height - MENU_H - DOCK_SPACE) };
}

/** Mitad de la zona útil (la de ampliar): de la barra de menú al espacio del dock, sin huecos ni solapes. */
export function tileRect(side: TileSide, vp: Viewport): Rect {
  const full = maximizedRect(vp);
  const half = Math.floor(full.w / 2);
  return side === 'left' ? { ...full, w: half } : { ...full, x: half, w: full.w - half };
}

export function focus(state: WMState, key: string): WMState {
  const target = state.windows.find((w) => w.key === key);
  if (!target) return state;
  const zTop = state.zTop + 1;
  return {
    zTop,
    focused: key,
    windows: state.windows.map((w) => (w.key === key ? { ...w, z: zTop, minimized: false } : w)),
  };
}

/** Abre una ventana o, si ya existe, la muestra y la trae al frente. */
export function open(state: WMState, spec: OpenSpec, vp: Viewport): WMState {
  const key = windowKey(spec.app, spec.arg);
  const existing = state.windows.find((w) => w.key === key);
  if (existing) {
    const updated = { ...existing, arg: spec.arg ?? existing.arg, title: spec.title, opens: existing.opens + 1 };
    return focus({ ...state, windows: state.windows.map((w) => (w.key === key ? updated : w)) }, key);
  }

  const w = Math.max(MIN_W, Math.min(spec.width, vp.width - 40));
  const h = Math.max(MIN_H, Math.min(spec.height, vp.height - MENU_H - DOCK_SPACE - 16));
  // La primera ventana sale centrada (entre la barra de menú y el dock); las siguientes, en cascada hacia abajo a la derecha.
  const step = (state.windows.length % 5) * CASCADE;
  const x = clamp((vp.width - w) / 2 + step, 10, Math.max(10, vp.width - w - 10));
  const y = clamp(
    MENU_H + (vp.height - MENU_H - DOCK_SPACE - h) / 2 + step,
    MENU_H + 8,
    Math.max(MENU_H + 8, vp.height - h - 10),
  );

  const zTop = state.zTop + 1;
  const win: WindowState = {
    key,
    app: spec.app,
    arg: spec.arg,
    title: spec.title,
    rect: { x: Math.round(x), y: Math.round(y), w, h },
    z: zTop,
    minimized: false,
    maximized: false,
    opens: 1,
  };
  return { zTop, focused: key, windows: [...state.windows, win] };
}

/** La ventana visible más alta pasa a tener el foco. */
function focusTop(state: WMState): WMState {
  const visible = state.windows.filter((w) => !w.minimized);
  if (visible.length === 0) return { ...state, focused: null };
  const top = visible.reduce((a, b) => (b.z > a.z ? b : a));
  return { ...state, focused: top.key };
}

export function close(state: WMState, key: string): WMState {
  return focusTop({ ...state, windows: state.windows.filter((w) => w.key !== key) });
}

export function minimize(state: WMState, key: string): WMState {
  return focusTop({
    ...state,
    windows: state.windows.map((w) => (w.key === key ? { ...w, minimized: true } : w)),
  });
}

function update(state: WMState, key: string, fn: (w: WindowState) => WindowState): WMState {
  return { ...state, windows: state.windows.map((w) => (w.key === key ? fn(w) : w)) };
}

/** Mueve la ventana. Si estaba ampliada, recupera su tamaño anterior. */
export function move(state: WMState, key: string, x: number, y: number, vp: Viewport): WMState {
  return update(state, key, (w) => {
    const base = (w.maximized || w.tile) && w.restore ? { ...w.restore } : { ...w.rect };
    return { ...w, maximized: false, tile: undefined, restore: undefined, rect: clampPosition({ ...base, x, y }, vp) };
  });
}

export function resize(state: WMState, key: string, width: number, height: number, vp: Viewport): WMState {
  return update(state, key, (w) => {
    if (w.maximized || w.tile) return w;
    const maxW = Math.max(MIN_W, vp.width - w.rect.x - 4);
    const maxH = Math.max(MIN_H, vp.height - w.rect.y - 4);
    return { ...w, rect: { ...w.rect, w: clamp(width, MIN_W, maxW), h: clamp(height, MIN_H, maxH) } };
  });
}

/** Ampliar; si ya está ampliada o colocada en una mitad, vuelve al tamaño que tenía antes. */
export function toggleMaximize(state: WMState, key: string, vp: Viewport): WMState {
  return update(state, key, (w) => {
    if (w.maximized || w.tile) {
      return { ...w, maximized: false, tile: undefined, rect: clampPosition(w.restore ?? w.rect, vp), restore: undefined };
    }
    return { ...w, maximized: true, restore: { ...w.rect }, rect: maximizedRect(vp) };
  });
}

/**
 * Coloca la ventana en la mitad izquierda o derecha. El tamaño anterior se guarda solo la primera vez:
 * pasar de una mitad a otra, o de ampliada a una mitad, no lo pisa, y restaurar vuelve siempre al original.
 */
export function tile(state: WMState, key: string, side: TileSide, vp: Viewport): WMState {
  return update(state, key, (w) => ({
    ...w,
    maximized: false,
    tile: side,
    restore: w.restore ?? { ...w.rect },
    rect: tileRect(side, vp),
  }));
}

/** Al cambiar el tamaño de la pantalla, ninguna barra de título puede quedarse fuera. */
export function fitToViewport(state: WMState, vp: Viewport): WMState {
  return {
    ...state,
    windows: state.windows.map((w) =>
      w.maximized
        ? { ...w, rect: maximizedRect(vp) }
        : w.tile
          ? { ...w, rect: tileRect(w.tile, vp) }
          : { ...w, rect: clampPosition(w.rect, vp) },
    ),
  };
}

/**
 * Ordena en cascada las ventanas visibles, sin ampliar ni colocar en una mitad, de la más antigua (abajo) a la más reciente
 * (arriba). No cambia su tamaño ni su orden de apilado. Es la acción "Ordenar en cascada" del menú Ventana.
 */
export function cascade(state: WMState, vp: Viewport): WMState {
  const ordered = state.windows.filter((w) => !w.minimized && !w.maximized && !w.tile).sort((a, b) => a.z - b.z);
  const placed = new Map<string, Rect>();
  ordered.forEach((w, i) => {
    const step = (i % 8) * CASCADE;
    placed.set(w.key, clampPosition({ ...w.rect, x: 40 + step, y: MENU_H + 24 + step }, vp));
  });
  return { ...state, windows: state.windows.map((w) => (placed.has(w.key) ? { ...w, rect: placed.get(w.key)! } : w)) };
}

/**
 * Recupera las ventanas minimizadas y sube todas por encima de lo que hubiera, conservando su orden
 * relativo. El foco no cambia si ya había una ventana con foco. Es "Traer todo al frente".
 */
export function bringAllToFront(state: WMState): WMState {
  if (state.windows.length === 0) return state;
  const ordered = [...state.windows].sort((a, b) => a.z - b.z);
  let z = state.zTop;
  const raised = new Map(ordered.map((w) => [w.key, ++z]));
  const windows = state.windows.map((w) => ({ ...w, minimized: false, z: raised.get(w.key)! }));
  const focused = state.focused && windows.some((w) => w.key === state.focused) ? state.focused : ordered[ordered.length - 1].key;
  return { windows, focused, zTop: z };
}
