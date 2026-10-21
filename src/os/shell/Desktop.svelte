<script lang="ts">
  import type { Snippet } from 'svelte';
  import AppView from '../apps/AppView.svelte';
  import type { AppId, OpenTarget } from '../apps/registry';
  import { APP_ICONS, DOCK, type AboutData, type Item, type NoteData, type ProjectData } from '../items';
  import Window from '../windows/Window.svelte';
  import type { TileSide, WMState } from '../windows/window-manager';
  import DesktopIcon from './DesktopIcon.svelte';
  import Dock from './Dock.svelte';
  import MenuBar from './MenuBar.svelte';
  import type { Action, MenuContext } from '../menus';
  import { browserView } from '../stores/browser.svelte';
  import { prefs } from '../stores/prefs.svelte';

  interface Props {
    wm: WMState;
    items: Item[];
    projects: ProjectData[];
    notes: NoteData[];
    about: AboutData;
    appName: string;
    onopen: (target: OpenTarget) => void;
    onfocus: (key: string) => void;
    onclose: (key: string) => void;
    onminimize: (key: string) => void;
    onmaximize: (key: string) => void;
    ontile: (key: string, side: TileSide) => void;
    onmove: (key: string, x: number, y: number) => void;
    onresize: (key: string, w: number, h: number) => void;
    onmenuaction: (action: Action) => void;
    fullscreen: boolean;
    /** Lo que va entre las ventanas además de ellas (el mini reproductor). */
    children?: Snippet;
  }

  let { wm, items, projects, notes, about, appName, onopen, onfocus, onclose, onminimize, onmaximize, ontile, onmove, onresize, onmenuaction, fullscreen, children }: Props =
    $props();

  let selected = $state<string | null>(null);

  const minimized = $derived(
    wm.windows.filter((w) => w.minimized).map((w) => ({ key: w.key, title: w.title, icon: APP_ICONS[w.app as AppId] })),
  );

  const running = $derived(new Set<AppId>(wm.windows.map((w) => (w.app === 'note' ? 'notes' : (w.app as AppId)))));

  // Lo que los menús necesitan saber de la escena. Edición lo completa la propia barra leyendo el DOM.
  const menuCtx = $derived.by((): Omit<MenuContext, 'edit'> => {
    const shown = wm.windows.some((w) => w.app === 'browser') ? projects.find((p) => p.id === browserView.projectId) : undefined;
    return {
      windows: wm.windows.map((w) => ({ key: w.key, title: w.title, minimized: w.minimized })),
      focused: wm.focused,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      browser: shown ? { url: shown.url } : null,
      theme: prefs.current.theme,
      wallpaper: prefs.current.wallpaper,
      textSize: prefs.current.textSize,
      fullscreen,
    };
  });

  function onbackground(e: PointerEvent) {
    if (!(e.target as Element).closest('[data-testid^="desktop-icon-"]')) selected = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="desktop" data-testid="desktop" onpointerdown={onbackground}>
  <MenuBar {appName} ctx={menuCtx} onaction={onmenuaction} />

  <div class="icons" role="group" aria-label="Escritorio">
    {#each items as item (item.id)}
      <DesktopIcon
        {item}
        selected={selected === item.id}
        onselect={() => (selected = item.id)}
        onopen={() => item.open && onopen(item.open)}
      />
    {/each}
  </div>

  <div class="windows">
    <!-- Las minimizadas siguen en el documento, solo ocultas: así conservan su estado (historial de la
         Terminal, un mensaje a medio escribir en Correo…). -->
    {#each wm.windows as win (win.key)}
      <Window
          {win}
          active={wm.focused === win.key}
          onfocus={() => onfocus(win.key)}
          onclose={() => onclose(win.key)}
          onminimize={() => onminimize(win.key)}
          onmaximize={() => onmaximize(win.key)}
          ontile={(side) => ontile(win.key, side)}
          onmove={(x, y) => onmove(win.key, x, y)}
          onresize={(w, h) => onresize(win.key, w, h)}
        >
          <AppView target={{ app: win.app as AppId, arg: win.arg }} {projects} {notes} {about} nav={win.opens} />
        </Window>
    {/each}
    {@render children?.()}
  </div>

  <Dock items={DOCK} {running} {minimized} onopen={(app) => onopen({ app })} onrestore={onfocus} />
</div>

<style>
  .desktop {
    position: absolute;
    inset: 0;
    animation: fade-in 0.45s ease both;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  /* Columnas desde la derecha, como en macOS. */
  .icons {
    position: absolute;
    top: calc(var(--menubar-h) + env(safe-area-inset-top, 0px) + 14px);
    right: 14px;
    bottom: 96px;
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(auto-fill, 98px);
    grid-auto-columns: 96px;
    gap: 4px 6px;
    align-content: start;
    direction: rtl;
  }
  .windows {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
