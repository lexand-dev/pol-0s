/**
 * Menús de la barra de menú (S-05). Función pura: recibe el estado (ventanas, proyectos, preferencias…)
 * y devuelve qué menús y qué acciones hay, cuáles están desactivadas y cuáles llevan marca. La barra
 * solo los pinta y despacha la acción; aquí no hay DOM ni estado propio, así que se prueba sin navegador.
 */
import { LINKS } from '../content/links';
import { TEXT_SIZES, WALLPAPERS, type TextSizeId, type ThemePref, type WallpaperId } from '../lib/prefs';
import type { AppId, OpenTarget } from './apps/registry';
import { PERSONA } from '../content/persona';

export type MenuId = 'logo' | 'archivo' | 'edicion' | 'visualizacion' | 'ventana' | 'ayuda';
export type EditCommand = 'undo' | 'redo' | 'cut' | 'copy' | 'selectAll';

/** Lo que ocurre al elegir una entrada. La despacha quien conoce el estado real (OS.svelte y la barra). */
export type Action =
  | { type: 'open'; target: OpenTarget }
  | { type: 'lock' }
  | { type: 'window'; op: 'close' | 'minimize' | 'maximize' | 'tileLeft' | 'tileRight' | 'cascade' | 'bringAll' }
  | { type: 'focusWindow'; key: string }
  | { type: 'theme'; value: ThemePref }
  | { type: 'wallpaper'; value: WallpaperId }
  | { type: 'textSize'; value: TextSizeId }
  | { type: 'fullscreen' }
  | { type: 'edit'; command: EditCommand };

export type MenuEntry =
  | { kind: 'separator' }
  | { kind: 'label'; label: string }
  | {
      kind: 'item';
      /** Estable: se usa en los tests y para el `data-testid`. */
      id: string;
      label: string;
      disabled: boolean;
      /** `radio` y `checkbox` llevan marca cuando están activos. */
      control?: 'radio' | 'checkbox';
      checked?: boolean;
      /** Acción interna. Una entrada con `href` es un enlace externo y no lleva acción. */
      action?: Action;
      href?: string;
    };

export interface Menu {
  id: MenuId;
  label: string;
  entries: MenuEntry[];
}

/** Estado del campo de texto y de la selección en el momento de abrir el menú. */
export interface EditState {
  textField: boolean;
  selection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface MenuContext {
  windows: { key: string; title: string; minimized: boolean }[];
  focused: string | null;
  projects: { id: string; name: string }[];
  /** Proyecto que muestra el Navegador ahora, si hay uno. */
  browser: { url: string } | null;
  theme: ThemePref;
  wallpaper: WallpaperId;
  textSize: TextSizeId;
  fullscreen: boolean;
  edit: EditState;
}

export const NO_EDIT: EditState = { textField: false, selection: false, canUndo: false, canRedo: false };

const sep = (): MenuEntry => ({ kind: 'separator' });
const label = (text: string): MenuEntry => ({ kind: 'label', label: text });

function item(id: string, text: string, action: Action, o: { disabled?: boolean; control?: 'radio' | 'checkbox'; checked?: boolean } = {}): MenuEntry {
  return { kind: 'item', id, label: text, disabled: o.disabled ?? false, action, ...(o.control ? { control: o.control, checked: o.checked ?? false } : {}) };
}

const link = (id: string, text: string, href: string): MenuEntry => ({ kind: 'item', id, label: text, disabled: false, href });

const open = (app: AppId, arg?: string): Action => ({ type: 'open', target: { app, ...(arg ? { arg } : {}) } });

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'auto', label: 'Automático' },
];

export function buildMenus(ctx: MenuContext): Menu[] {
  const hasWindow = ctx.windows.some((w) => w.key === ctx.focused);
  const edit = ctx.edit;

  const archivo: MenuEntry[] = [
    item('new-message', 'Nuevo mensaje…', open('mail')),
    sep(),
    label('Proyectos'),
    item('open-projects', 'Ver todos los proyectos', open('projects')),
    ...ctx.projects.map((p) => item(`open-project-${p.id}`, p.name, open('projects', p.id))),
    sep(),
    item('about-me', 'Mi CV', open('about')),
    ctx.browser
      ? link('open-external', 'Abrir en pestaña nueva', ctx.browser.url)
      : { kind: 'item', id: 'open-external', label: 'Abrir en pestaña nueva', disabled: true },
    sep(),
    item('close-window', 'Cerrar ventana', { type: 'window', op: 'close' }, { disabled: !hasWindow }),
  ];

  const edicion: MenuEntry[] = [
    item('undo', 'Deshacer', { type: 'edit', command: 'undo' }, { disabled: !(edit.textField && edit.canUndo) }),
    item('redo', 'Rehacer', { type: 'edit', command: 'redo' }, { disabled: !(edit.textField && edit.canRedo) }),
    sep(),
    item('cut', 'Cortar', { type: 'edit', command: 'cut' }, { disabled: !(edit.textField && edit.selection) }),
    item('copy', 'Copiar', { type: 'edit', command: 'copy' }, { disabled: !edit.selection }),
    sep(),
    item('select-all', 'Seleccionar todo', { type: 'edit', command: 'selectAll' }, { disabled: !edit.textField && !hasWindow }),
  ];

  const visualizacion: MenuEntry[] = [
    label('Apariencia'),
    ...THEMES.map((t) =>
      item(`theme-${t.value}`, t.label, { type: 'theme', value: t.value }, { control: 'radio', checked: ctx.theme === t.value }),
    ),
    sep(),
    label('Fondo de pantalla'),
    ...WALLPAPERS.map((w) =>
      item(`wallpaper-${w.id}`, w.label, { type: 'wallpaper', value: w.id }, { control: 'radio', checked: ctx.wallpaper === w.id }),
    ),
    sep(),
    label('Tamaño del texto'),
    ...TEXT_SIZES.map((z) =>
      item(`text-${z.id}`, z.label, { type: 'textSize', value: z.id }, { control: 'radio', checked: ctx.textSize === z.id }),
    ),
    sep(),
    item('fullscreen', 'Pantalla completa', { type: 'fullscreen' }, { control: 'checkbox', checked: ctx.fullscreen }),
  ];

  const ventana: MenuEntry[] = [
    item('minimize', 'Minimizar', { type: 'window', op: 'minimize' }, { disabled: !hasWindow }),
    item('maximize', 'Ampliar', { type: 'window', op: 'maximize' }, { disabled: !hasWindow }),
    item('tile-left', 'Mitad izquierda', { type: 'window', op: 'tileLeft' }, { disabled: !hasWindow }),
    item('tile-right', 'Mitad derecha', { type: 'window', op: 'tileRight' }, { disabled: !hasWindow }),
    item('close', 'Cerrar', { type: 'window', op: 'close' }, { disabled: !hasWindow }),
    sep(),
    item('cascade', 'Ordenar en cascada', { type: 'window', op: 'cascade' }, { disabled: ctx.windows.length === 0 }),
    item('bring-all', 'Traer todo al frente', { type: 'window', op: 'bringAll' }, { disabled: ctx.windows.length === 0 }),
    ...(ctx.windows.length > 0
      ? [
          sep(),
          ...ctx.windows.map((w) =>
            item(`window-${w.key}`, w.minimized ? `${w.title} (minimizada)` : w.title, { type: 'focusWindow', key: w.key }, {
              control: 'radio',
              checked: w.key === ctx.focused && !w.minimized,
            }),
          ),
        ]
      : []),
  ];

  const ayuda: MenuEntry[] = [
    item('help-guide', `Cómo usar ${PERSONA.osName}`, open('help')),
    item('write-to-pol', `Escribir a ${PERSONA.firstName}…`, open('mail')),
    sep(),
    ...LINKS.map((l) => link(`link-${l.id}`, l.label, l.url)),
  ];

  return [
    {
      id: 'logo',
      label: PERSONA.osName,
      entries: [
        item('about', `Acerca de ${PERSONA.name}`, open('about')),
        item('settings', 'Ajustes…', open('settings')),
        sep(),
        item('lock', 'Bloquear pantalla', { type: 'lock' }),
      ],
    },
    { id: 'archivo', label: 'Archivo', entries: archivo },
    { id: 'edicion', label: 'Edición', entries: edicion },
    { id: 'visualizacion', label: 'Visualización', entries: visualizacion },
    { id: 'ventana', label: 'Ventana', entries: ventana },
    { id: 'ayuda', label: 'Ayuda', entries: ayuda },
  ];
}
