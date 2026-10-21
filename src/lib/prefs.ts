/**
 * Preferencias del visitante (M-09): tema, fondo de pantalla y tamaño del texto.
 *
 * Se guardan solo en su navegador. El almacenamiento puede no existir o lanzar excepciones
 * (ventana privada, datos bloqueados), así que nada de aquí lanza: si falla, valores por defecto.
 */

export const THEMES = ['auto', 'light', 'dark'] as const;
export type ThemePref = (typeof THEMES)[number];

export const WALLPAPERS = [
  { id: 'atardecer', label: 'Atardecer' },
  { id: 'mar', label: 'Mar' },
  { id: 'grafito', label: 'Grafito' },
  { id: 'alba', label: 'Alba' },
] as const;
export type WallpaperId = (typeof WALLPAPERS)[number]['id'];

/** Tres tamaños de texto, no libres: `scale` multiplica todos los `font-size` (variable CSS `--text-scale`). */
export const TEXT_SIZES = [
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'grande', label: 'Grande', scale: 1.1 },
  { id: 'muy-grande', label: 'Muy grande', scale: 1.2 },
] as const;
export type TextSizeId = (typeof TEXT_SIZES)[number]['id'];

export interface Prefs {
  theme: ThemePref;
  wallpaper: WallpaperId;
  textSize: TextSizeId;
}

export const PREFS_KEY = 'polos.prefs';
export const DEFAULT_PREFS: Prefs = { theme: 'auto', wallpaper: 'atardecer', textSize: 'normal' };

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

const isTheme = (v: unknown): v is ThemePref => THEMES.includes(v as ThemePref);
const isWallpaper = (v: unknown): v is WallpaperId => WALLPAPERS.some((w) => w.id === v);
const isTextSize = (v: unknown): v is TextSizeId => TEXT_SIZES.some((t) => t.id === v);

/** Convierte lo guardado en preferencias válidas. Lo que no se reconoce vuelve al valor por defecto. */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_PREFS };
    const { theme, wallpaper, textSize } = data as Record<string, unknown>;
    return {
      theme: isTheme(theme) ? theme : DEFAULT_PREFS.theme,
      wallpaper: isWallpaper(wallpaper) ? wallpaper : DEFAULT_PREFS.wallpaper,
      textSize: isTextSize(textSize) ? textSize : DEFAULT_PREFS.textSize,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function loadPrefs(storage: ReadableStorage | null): Prefs {
  try {
    return parsePrefs(storage?.getItem(PREFS_KEY) ?? null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Devuelve false si no se pudo guardar; la preferencia sigue valiendo durante la visita. */
export function savePrefs(storage: WritableStorage | null, prefs: Prefs): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/** `localStorage` puede lanzar con solo leer la propiedad (datos del sitio bloqueados). */
export function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** "Automático" quita data-theme y deja mandar a prefers-color-scheme, como hacen los tokens. */
export function applyPrefs(root: HTMLElement, prefs: Prefs) {
  if (prefs.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', prefs.theme);
  root.setAttribute('data-wall', prefs.wallpaper);
  if (prefs.textSize === 'normal') root.removeAttribute('data-text');
  else root.setAttribute('data-text', prefs.textSize);
}

/**
 * Script en línea para el <head>: aplica las preferencias antes de pintar, para que no parpadee
 * el tema ni el fondo. Se genera desde las constantes de este archivo para no duplicar reglas.
 * Si cambia, su hash en la CSP (public/_headers) tiene que cambiar también.
 */
export const PREFS_BOOT_SCRIPT = `(function(){var d=document.documentElement,t=${JSON.stringify(
  THEMES,
)},w=${JSON.stringify(WALLPAPERS.map((x) => x.id))},z=${JSON.stringify(TEXT_SIZES.map((x) => x.id))},p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY,
)})||"{}")||{}}catch(e){}if(t.indexOf(p.theme)>0)d.setAttribute("data-theme",p.theme);d.setAttribute("data-wall",w.indexOf(p.wallpaper)>=0?p.wallpaper:w[0]);if(z.indexOf(p.textSize)>0)d.setAttribute("data-text",p.textSize)})();`;
