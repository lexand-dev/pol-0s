import { describe, expect, test } from 'vitest';
import { DEFAULT_PREFS, PREFS_BOOT_SCRIPT, PREFS_KEY, TEXT_SIZES, applyPrefs, loadPrefs, parsePrefs, savePrefs } from './prefs';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};

const throwing = {
  getItem: () => {
    throw new DOMException('Bloqueado', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('Bloqueado', 'SecurityError');
  },
};

describe('leer preferencias', () => {
  test('sin nada guardado usa Automático, Atardecer y el texto normal', () => {
    expect(loadPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ theme: 'auto', wallpaper: 'atardecer', textSize: 'normal' });
  });

  test('recupera lo que se guardó', () => {
    const storage = memoryStorage({ [PREFS_KEY]: JSON.stringify({ theme: 'dark', wallpaper: 'mar', textSize: 'grande' }) });
    expect(loadPrefs(storage)).toEqual({ theme: 'dark', wallpaper: 'mar', textSize: 'grande' });
  });

  test('con el almacenamiento bloqueado usa los valores por defecto sin lanzar', () => {
    expect(() => loadPrefs(throwing)).not.toThrow();
    expect(loadPrefs(throwing)).toEqual(DEFAULT_PREFS);
  });

  test('sin almacenamiento disponible usa los valores por defecto', () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
  });

  test('un tema, un fondo o un tamaño que no existe vuelve al valor por defecto', () => {
    expect(parsePrefs(JSON.stringify({ theme: 'rosa', wallpaper: 'mar' }))).toEqual({ theme: 'auto', wallpaper: 'mar', textSize: 'normal' });
    expect(parsePrefs(JSON.stringify({ theme: 'dark', wallpaper: '../x' }))).toEqual({ theme: 'dark', wallpaper: 'atardecer', textSize: 'normal' });
    for (const bad of ['enorme', '2', 2, null, '../x', '__proto__']) {
      expect(parsePrefs(JSON.stringify({ textSize: bad })).textSize, String(bad)).toBe('normal');
    }
  });

  test('un valor corrupto no rompe la lectura', () => {
    expect(parsePrefs('{no es json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('null')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"dark"')).toEqual(DEFAULT_PREFS);
  });
});

describe('guardar preferencias', () => {
  test('guarda en la clave del proyecto', () => {
    const storage = memoryStorage();
    expect(savePrefs(storage, { theme: 'light', wallpaper: 'alba', textSize: 'muy-grande' })).toBe(true);
    expect(JSON.parse(storage.data.get(PREFS_KEY)!)).toEqual({ theme: 'light', wallpaper: 'alba', textSize: 'muy-grande' });
  });

  test('si el almacenamiento falla, no lanza y avisa con false', () => {
    expect(savePrefs(throwing, DEFAULT_PREFS)).toBe(false);
    expect(savePrefs(null, DEFAULT_PREFS)).toBe(false);
  });
});

describe('script de arranque del <head>', () => {
  test('es JavaScript válido y no contiene la etiqueta de cierre de script', () => {
    expect(() => new Function(PREFS_BOOT_SCRIPT)).not.toThrow();
    expect(PREFS_BOOT_SCRIPT).not.toMatch(/<\/script/i);
  });
});

describe('tamaño del texto', () => {
  test('son tres pasos, de menor a mayor, y el normal es el de siempre', () => {
    expect(TEXT_SIZES.map((t) => t.id)).toEqual(['normal', 'grande', 'muy-grande']);
    expect(TEXT_SIZES[0].scale).toBe(1);
    const scales = TEXT_SIZES.map((t) => t.scale);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
    expect(scales[2]).toBeLessThanOrEqual(1.25);
  });

  test('applyPrefs pone data-text salvo con el tamaño normal, que lo quita', () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
    } as unknown as HTMLElement;
    applyPrefs(root, { ...DEFAULT_PREFS, textSize: 'grande' });
    expect(attrs.get('data-text')).toBe('grande');
    applyPrefs(root, { ...DEFAULT_PREFS, textSize: 'normal' });
    expect(attrs.has('data-text')).toBe(false);
  });

  test('el script de arranque aplica el tamaño guardado y solo uno de la lista', () => {
    const run = (stored: unknown) => {
      const attrs = new Map<string, string>();
      const doc = { documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v) } };
      const storage = { getItem: () => JSON.stringify(stored) };
      new Function('document', 'localStorage', PREFS_BOOT_SCRIPT)(doc, storage);
      return attrs.get('data-text');
    };
    expect(run({ textSize: 'grande' })).toBe('grande');
    expect(run({ textSize: 'muy-grande' })).toBe('muy-grande');
    expect(run({ textSize: 'normal' })).toBeUndefined();
    expect(run({ textSize: 'enorme' })).toBeUndefined();
    expect(run({})).toBeUndefined();
  });
});
