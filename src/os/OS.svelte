<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { noteFromSearch } from '../lib/notes';
  import { APPS, type AppId, type OpenTarget } from './apps/registry';
  import { desktopItems, mobileItems, type AboutData, type Item, type NoteData, type ProjectData } from './items';
  import type { Action } from './menus';
  import { setActionHandler } from './stores/os-actions';
  import { player } from './stores/player.svelte';
  import { prefs } from './stores/prefs.svelte';
  import Desktop from './shell/Desktop.svelte';
  import LockScreen, { type Avatar } from './shell/LockScreen.svelte';
  import MobileHome from './shell/MobileHome.svelte';
  import * as WM from './windows/window-manager';

  let { projects, notes, avatar, about }: { projects: ProjectData[]; notes: NoteData[]; avatar: Avatar; about: AboutData } = $props();

  /** Mismo punto de corte que docs/design-system.md: por debajo de 768px es móvil. */
  const MOBILE_QUERY = '(max-width: 767px)';

  let unlocked = $state(false);
  let mobile = $state(false);
  let wm = $state.raw(WM.createState());

  /** El mini reproductor pasa por delante de todas las ventanas (S-03): al ponerse algo a sonar y al tocarlo. */
  function raisePlayer() {
    const zTop = wm.zTop + 1;
    wm = { ...wm, zTop };
    player.z = zTop;
  }
  $effect(() => {
    if (player.current) untrack(raisePlayer);
  });
  let sheet = $state.raw<OpenTarget | null>(null);
  let folder = $state.raw<Item | null>(null);
  let viewport: WM.Viewport = { width: 1280, height: 800 };
  let fullscreen = $state(false);

  // Enlace profundo (S-01): la página pública de una nota enlaza a `/?nota=<nombre>`. Se guarda al cargar y se abre al entrar,
  // porque antes hay que pasar por la pantalla de acceso.
  let pendingNote: string | null = null;

  const deskItems = $derived(desktopItems(projects));
  const homeItems = $derived(mobileItems(projects, notes));

  const appName = $derived.by(() => {
    const w = wm.windows.find((x) => x.key === wm.focused);
    return w ? APPS[w.app as AppId].menu : 'Escritorio';
  });

  function titleFor(target: OpenTarget): string {
    if (target.app === 'note') return notes.find((n) => n.id === target.arg)?.title ?? APPS.note.title;
    return APPS[target.app].title;
  }

  function openApp(target: OpenTarget) {
    if (mobile) {
      folder = null;
      sheet = target;
      return;
    }
    const def = APPS[target.app];
    wm = WM.open(wm, { ...target, title: titleFor(target), width: def.width, height: def.height }, viewport);
  }

  /** Al cruzar el punto de corte, lo que estaba abierto sigue abierto (M-03, caso negativo). */
  function setMode(nextMobile: boolean) {
    if (nextMobile === mobile) return;
    if (nextMobile) {
      const focused = wm.windows.find((w) => w.key === wm.focused && !w.minimized);
      wm = WM.createState();
      mobile = true;
      sheet = focused ? { app: focused.app as AppId, arg: focused.arg } : null;
    } else {
      const keep = sheet;
      sheet = null;
      folder = null;
      mobile = false;
      if (keep) openApp(keep);
    }
  }

  function lock() {
    player.close();
    wm = WM.createState();
    sheet = null;
    folder = null;
    unlocked = false;
  }

  /** Despacha lo que se elige en los menús de la barra (S-05). Edición la resuelve la propia barra. */
  function runAction(action: Action) {
    switch (action.type) {
      case 'open':
        openApp(action.target);
        break;
      case 'lock':
        lock();
        break;
      case 'theme':
        prefs.set({ theme: action.value });
        break;
      case 'wallpaper':
        prefs.set({ wallpaper: action.value });
        break;
      case 'textSize':
        prefs.set({ textSize: action.value });
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'focusWindow':
        wm = WM.focus(wm, action.key);
        break;
      case 'window': {
        // En móvil no hay ventanas: cerrar es volver a la pantalla de inicio.
        if (mobile) {
          if (action.op === 'close') sheet = null;
          break;
        }
        const key = wm.focused;
        if (action.op === 'cascade') wm = WM.cascade(wm, viewport);
        else if (action.op === 'bringAll') wm = WM.bringAllToFront(wm);
        else if (key && action.op === 'close') wm = WM.close(wm, key);
        else if (key && action.op === 'minimize') wm = WM.minimize(wm, key);
        else if (key && action.op === 'maximize') wm = WM.toggleMaximize(wm, key, viewport);
        else if (key && action.op === 'tileLeft') wm = WM.tile(wm, key, 'left', viewport);
        else if (key && action.op === 'tileRight') wm = WM.tile(wm, key, 'right', viewport);
        break;
      }
      case 'edit':
        break;
    }
  }

  /** El navegador puede rechazarlo (iPad, algunos navegadores): si falla, no pasa nada. */
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* sin efecto */
    }
  }

  $effect(() => {
    if (!unlocked || !pendingNote) return;
    const id = pendingNote;
    pendingNote = null;
    untrack(() => openApp({ app: 'note', arg: id }));
  });

  onMount(() => {
    pendingNote = noteFromSearch(location.search, notes.map((n) => n.id));
    // La dirección vuelve a ser la de siempre: recargar no debe reabrir la nota.
    if (pendingNote) history.replaceState(null, '', location.pathname + location.hash);
    const stopPrefs = prefs.init();
    setActionHandler(runAction);
    const onFullscreen = () => (fullscreen = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    const mq = matchMedia(MOBILE_QUERY);
    viewport = { width: innerWidth, height: innerHeight };
    mobile = mq.matches;

    const onChange = () => setMode(mq.matches);
    const onResize = () => {
      viewport = { width: innerWidth, height: innerHeight };
      if (!mobile) wm = WM.fitToViewport(wm, viewport);
    };
    mq.addEventListener('change', onChange);
    addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      stopPrefs();
      setActionHandler(null);
      mq.removeEventListener('change', onChange);
      removeEventListener('resize', onResize);
    };
  });

  function onkeydown(e: KeyboardEvent) {
    if (!unlocked || e.key !== 'Escape' || e.defaultPrevented) return;
    if (mobile) {
      if (folder) folder = null;
      else sheet = null;
      return;
    }
    if ((e.target as Element).closest('input, textarea, [contenteditable="true"], [role="menu"]')) return;
    if (wm.focused) wm = WM.close(wm, wm.focused);
  }

  /** Salida de la pantalla de acceso: se desenfoca y se amplía un poco. */
  function leave(_node: Element) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      duration: reduce ? 0 : 450,
      css: (t: number) => `opacity: ${t}; transform: scale(${1 + (1 - t) * 0.04}); filter: blur(${(1 - t) * 10}px);`,
    };
  }
</script>

<svelte:window {onkeydown} />

<div class="os">
  <div class="wallpaper" data-testid="wallpaper" aria-hidden="true"></div>

  {#if !unlocked}
    <div class="layer" out:leave>
      <LockScreen {avatar} onunlock={() => (unlocked = true)} />
    </div>
  {:else if mobile}
    <MobileHome
      items={homeItems}
      {projects}
      {notes}
      {about}
      {sheet}
      sheetTitle={sheet ? titleFor(sheet) : ''}
      {folder}
      onopen={openApp}
      onfolder={(f) => (folder = f)}
      onback={() => (sheet = null)}
    />
  {:else}
    <Desktop
      {wm}
      items={deskItems}
      {projects}
      {notes}
      {about}
      {appName}
      onopen={openApp}
      onfocus={(key) => {
        // También si ya tenía el foco pero el reproductor le pasó por delante.
        const win = wm.windows.find((w) => w.key === key);
        if (wm.focused !== key || (win && win.z < player.z)) wm = WM.focus(wm, key);
      }}
      onclose={(key) => (wm = WM.close(wm, key))}
      onminimize={(key) => (wm = WM.minimize(wm, key))}
      onmaximize={(key) => (wm = WM.toggleMaximize(wm, key, viewport))}
      ontile={(key, side) => (wm = WM.tile(wm, key, side, viewport))}
      onmove={(key, x, y) => (wm = WM.move(wm, key, x, y, viewport))}
      onresize={(key, w, h) => (wm = WM.resize(wm, key, w, h, viewport))}
      onmenuaction={runAction}
      {fullscreen}
    >
      <!-- En escritorio, el mini reproductor va entre las ventanas, con su propio sitio en el orden. -->
      {#if player.current}
        {#await import('./shell/MiniPlayer.svelte') then { default: MiniPlayer }}
          <MiniPlayer z={player.z} onraise={raisePlayer} />
        {/await}
      {/if}
    </Desktop>
  {/if}

  <!-- El mini reproductor (S-03): solo se carga y se monta cuando hay algo que reproducir. En móvil va por encima de todo. -->
  {#if unlocked && mobile && player.current}
    {#await import('./shell/MiniPlayer.svelte') then { default: MiniPlayer }}
      <MiniPlayer />
    {/await}
  {/if}
</div>

<style>
  .os {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .wallpaper {
    position: absolute;
    inset: 0;
    background: var(--wallpaper);
  }
  .wallpaper::after {
    content: '';
    position: absolute;
    inset: 0;
    background: #000000;
    opacity: var(--wall-dim);
    transition: opacity 0.4s;
  }
  .layer {
    position: absolute;
    inset: 0;
    z-index: 100;
  }
</style>
