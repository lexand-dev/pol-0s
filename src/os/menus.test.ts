import { describe, expect, test } from 'vitest';
import { LINKS } from '../content/links';
import { NO_EDIT, buildMenus, type Menu, type MenuContext, type MenuEntry } from './menus';
import { PERSONA } from '../content/persona';

const base: MenuContext = {
  windows: [],
  focused: null,
  projects: [
    { id: 'mitienda', name: 'Mi Tienda' },
    { id: 'estudio', name: 'Estudio' },
  ],
  browser: null,
  theme: 'auto',
  wallpaper: 'atardecer',
  textSize: 'normal',
  fullscreen: false,
  edit: NO_EDIT,
};

const ctx = (over: Partial<MenuContext> = {}): MenuContext => ({ ...base, ...over });
const menu = (menus: Menu[], id: string) => menus.find((m) => m.id === id)!;
const item = (m: Menu, id: string) => {
  const e = m.entries.find((x): x is Extract<MenuEntry, { kind: 'item' }> => x.kind === 'item' && x.id === id);
  if (!e) throw new Error(`No existe la entrada ${id} en ${m.id}`);
  return e;
};
const items = (m: Menu) => m.entries.filter((x): x is Extract<MenuEntry, { kind: 'item' }> => x.kind === 'item');

describe('estructura', () => {
  test('hay seis menús, en el orden de la barra', () => {
    expect(buildMenus(ctx()).map((m) => m.id)).toEqual(['logo', 'archivo', 'edicion', 'visualizacion', 'ventana', 'ayuda']);
    expect(buildMenus(ctx()).map((m) => m.label)).toEqual([PERSONA.osName, 'Archivo', 'Edición', 'Visualización', 'Ventana', 'Ayuda']);
  });

  test('todas las entradas tienen un id único dentro de su menú y una acción o un enlace', () => {
    for (const m of buildMenus(ctx({ windows: [{ key: 'mail', title: 'Correo', minimized: false }], focused: 'mail' }))) {
      const ids = items(m).map((i) => i.id);
      expect(new Set(ids).size, m.id).toBe(ids.length);
      for (const i of items(m)) expect(Boolean(i.action) !== Boolean(i.href) || i.disabled, `${m.id}/${i.id}`).toBe(true);
    }
  });

  test('el menú del logo conserva Acerca de, Ajustes y Bloquear pantalla', () => {
    expect(items(menu(buildMenus(ctx()), 'logo')).map((i) => i.id)).toEqual(['about', 'settings', 'lock']);
  });
});

describe('Archivo', () => {
  test('lista un proyecto por cada uno de la colección y abre su detalle en Proyectos', () => {
    const archivo = menu(buildMenus(ctx()), 'archivo');
    expect(item(archivo, 'open-project-mitienda').action).toEqual({ type: 'open', target: { app: 'projects', arg: 'mitienda' } });
    expect(item(archivo, 'open-project-estudio').label).toBe('Estudio');
  });

  test('"Ver todos los proyectos" abre la vista general de Proyectos', () => {
    const archivo = menu(buildMenus(ctx()), 'archivo');
    expect(item(archivo, 'open-projects').action).toEqual({ type: 'open', target: { app: 'projects' } });
  });

  test('Nuevo mensaje abre Correo y Mi CV abre el CV', () => {
    const archivo = menu(buildMenus(ctx()), 'archivo');
    expect(item(archivo, 'new-message').action).toEqual({ type: 'open', target: { app: 'mail' } });
    expect(item(archivo, 'about-me').action).toEqual({ type: 'open', target: { app: 'about' } });
  });

  test('"Abrir en pestaña nueva" está desactivado sin proyecto en el Navegador y es un enlace con él', () => {
    expect(item(menu(buildMenus(ctx()), 'archivo'), 'open-external')).toMatchObject({ disabled: true });
    expect(item(menu(buildMenus(ctx()), 'archivo'), 'open-external').href).toBeUndefined();
    const con = item(menu(buildMenus(ctx({ browser: { url: 'https://recetario.example.com' } })), 'archivo'), 'open-external');
    expect(con).toMatchObject({ disabled: false, href: 'https://recetario.example.com' });
  });

  test('"Cerrar ventana" solo está activo con una ventana con foco', () => {
    expect(item(menu(buildMenus(ctx()), 'archivo'), 'close-window').disabled).toBe(true);
    const w = [{ key: 'mail', title: 'Correo', minimized: false }];
    expect(item(menu(buildMenus(ctx({ windows: w, focused: 'mail' })), 'archivo'), 'close-window').disabled).toBe(false);
    expect(item(menu(buildMenus(ctx({ windows: w, focused: null })), 'archivo'), 'close-window').disabled).toBe(true);
  });
});

describe('Edición', () => {
  const edicion = (edit: Partial<MenuContext['edit']>) => menu(buildMenus(ctx({ edit: { ...NO_EDIT, ...edit } })), 'edicion');

  test('sin campo de texto ni selección todo está desactivado', () => {
    expect(items(edicion({})).every((i) => i.disabled)).toBe(true);
  });

  test('con un campo con texto seleccionado se activan Cortar, Copiar y Seleccionar todo', () => {
    const e = edicion({ textField: true, selection: true });
    expect(['cut', 'copy', 'select-all'].map((id) => item(e, id).disabled)).toEqual([false, false, false]);
    expect(item(e, 'undo').disabled).toBe(true);
  });

  test('Deshacer y Rehacer dependen del historial del campo', () => {
    expect(item(edicion({ textField: true, canUndo: true }), 'undo').disabled).toBe(false);
    expect(item(edicion({ textField: true, canUndo: true }), 'redo').disabled).toBe(true);
    expect(item(edicion({ textField: true, canRedo: true }), 'redo').disabled).toBe(false);
    expect(item(edicion({ textField: false, canUndo: true }), 'undo').disabled).toBe(true);
  });

  test('Copiar funciona con una selección en cualquier sitio, pero Cortar solo en un campo', () => {
    const e = edicion({ textField: false, selection: true });
    expect(item(e, 'copy').disabled).toBe(false);
    expect(item(e, 'cut').disabled).toBe(true);
  });

  test('Seleccionar todo se activa con una ventana aunque no haya campo de texto', () => {
    const e = menu(buildMenus(ctx({ windows: [{ key: 'about', title: 'Sobre mí', minimized: false }], focused: 'about' })), 'edicion');
    expect(item(e, 'select-all').disabled).toBe(false);
  });

  test('no hay "Pegar": el navegador no lo permite desde un menú', () => {
    expect(items(edicion({ textField: true, selection: true })).map((i) => i.id)).not.toContain('paste');
  });
});

describe('Visualización', () => {
  test('marca la apariencia, el fondo y el tamaño del texto activos, y solo esos', () => {
    const v = menu(buildMenus(ctx({ theme: 'dark', wallpaper: 'mar', textSize: 'grande' })), 'visualizacion');
    expect(items(v).filter((i) => i.checked).map((i) => i.id)).toEqual(['theme-dark', 'wallpaper-mar', 'text-grande']);
    for (const i of items(v).filter((x) => /^(theme|wallpaper|text)-/.test(x.id))) expect(i.control).toBe('radio');
  });

  test('ofrece los tres tamaños de texto y cada uno despacha su acción', () => {
    const v = menu(buildMenus(ctx()), 'visualizacion');
    const sizes = items(v).filter((i) => i.id.startsWith('text-'));
    expect(sizes.map((i) => i.label)).toEqual(['Normal', 'Grande', 'Muy grande']);
    expect(sizes.map((i) => i.action)).toEqual([
      { type: 'textSize', value: 'normal' },
      { type: 'textSize', value: 'grande' },
      { type: 'textSize', value: 'muy-grande' },
    ]);
    expect(sizes.every((i) => !i.disabled)).toBe(true);
  });

  test('ofrece los tres temas y los cuatro fondos de Ajustes', () => {
    const v = menu(buildMenus(ctx()), 'visualizacion');
    expect(items(v).filter((i) => i.id.startsWith('theme-')).map((i) => i.label)).toEqual(['Claro', 'Oscuro', 'Automático']);
    expect(items(v).filter((i) => i.id.startsWith('wallpaper-'))).toHaveLength(4);
  });

  test('Pantalla completa es una casilla que refleja el estado', () => {
    expect(item(menu(buildMenus(ctx()), 'visualizacion'), 'fullscreen')).toMatchObject({ control: 'checkbox', checked: false });
    expect(item(menu(buildMenus(ctx({ fullscreen: true })), 'visualizacion'), 'fullscreen').checked).toBe(true);
  });
});

describe('Ventana', () => {
  const windows = [
    { key: 'mail', title: 'Correo', minimized: false },
    { key: 'tools', title: 'Herramientas', minimized: true },
    { key: 'note:uno', title: 'Una nota', minimized: false },
  ];

  test('sin ventanas todo está desactivado y no hay lista', () => {
    const v = menu(buildMenus(ctx()), 'ventana');
    expect(items(v).every((i) => i.disabled)).toBe(true);
    expect(items(v).some((i) => i.id.startsWith('window-'))).toBe(false);
  });

  test('lista las ventanas abiertas con marca en la activa y "(minimizada)" en las minimizadas', () => {
    const v = menu(buildMenus(ctx({ windows, focused: 'note:uno' })), 'ventana');
    const list = items(v).filter((i) => i.id.startsWith('window-'));
    expect(list.map((i) => i.label)).toEqual(['Correo', 'Herramientas (minimizada)', 'Una nota']);
    expect(list.filter((i) => i.checked).map((i) => i.id)).toEqual(['window-note:uno']);
    expect(list[1].action).toEqual({ type: 'focusWindow', key: 'tools' });
  });

  test('Mitad izquierda y derecha piden colocar la ventana activa', () => {
    const v = menu(buildMenus(ctx({ windows, focused: 'mail' })), 'ventana');
    expect(item(v, 'tile-left').action).toEqual({ type: 'window', op: 'tileLeft' });
    expect(item(v, 'tile-right').action).toEqual({ type: 'window', op: 'tileRight' });
  });

  test('una ventana minimizada nunca figura como activa', () => {
    const v = menu(buildMenus(ctx({ windows, focused: 'tools' })), 'ventana');
    expect(items(v).filter((i) => i.checked)).toEqual([]);
  });

  test('con una ventana con foco se activan Minimizar, Ampliar, Cerrar, Cascada y Traer todo al frente', () => {
    const v = menu(buildMenus(ctx({ windows, focused: 'mail' })), 'ventana');
    for (const id of ['minimize', 'maximize', 'tile-left', 'tile-right', 'close', 'cascade', 'bring-all']) expect(item(v, id).disabled, id).toBe(false);
  });

  test('con ventanas pero ninguna con foco, Minimizar, Ampliar y Cerrar siguen desactivados', () => {
    const v = menu(buildMenus(ctx({ windows, focused: null })), 'ventana');
    for (const id of ['minimize', 'maximize', 'tile-left', 'tile-right', 'close']) expect(item(v, id).disabled, id).toBe(true);
    expect(item(v, 'bring-all').disabled).toBe(false);
  });
});

describe('Ayuda', () => {
  test('abre la guía y Correo, y enlaza a las tres webs en una pestaña nueva', () => {
    const a = menu(buildMenus(ctx()), 'ayuda');
    expect(item(a, 'help-guide').action).toEqual({ type: 'open', target: { app: 'help' } });
    expect(item(a, 'write-to-pol').action).toEqual({ type: 'open', target: { app: 'mail' } });
    expect(items(a).filter((i) => i.href).map((i) => i.href)).toEqual(LINKS.map((l) => l.url));
  });

  test('los enlaces externos son siempre https', () => {
    for (const i of items(menu(buildMenus(ctx()), 'ayuda')).filter((x) => x.href)) expect(i.href).toMatch(/^https:\/\//);
  });
});
