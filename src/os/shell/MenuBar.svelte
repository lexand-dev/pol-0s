<script lang="ts">
  import { PERSONA } from '../../content/persona';
  import { onMount, tick } from 'svelte';
  import { formatMenuClock } from '../../lib/clock';
  import { UI_SVG } from '../icons';
  import { NO_EDIT, buildMenus, type Action, type EditCommand, type EditState, type MenuContext, type MenuEntry, type MenuId } from '../menus';
  import { prefs } from '../stores/prefs.svelte';

  interface Props {
    appName: string;
    /** El estado de la escena. La parte de Edición (campo de texto, selección) la lee esta barra del DOM. */
    ctx: Omit<MenuContext, 'edit'>;
    onaction: (action: Action) => void;
  }

  let { appName, ctx, onaction }: Props = $props();

  let now = $state<Date | null>(null);
  let openId = $state<MenuId | null>(null);
  let focusIndex = $state(0);
  /** Menú que se abrió solo por pasar el ratón: el primer clic encima lo deja abierto, no lo cierra. */
  let openedByHover: MenuId | null = null;
  let edit = $state<EditState>(NO_EDIT);
  let bar: HTMLElement | undefined = $state();
  /** Lo que tenía el foco antes de tocar la barra: Cortar, Copiar y Deshacer actúan sobre ello. */
  let lastFocus: HTMLElement | null = null;

  const menus = $derived(buildMenus({ ...ctx, edit }));

  onMount(() => {
    now = new Date();
    const id = setInterval(() => (now = new Date()), 15_000);
    return () => clearInterval(id);
  });

  // ─── Estado de Edición, leído del DOM al abrir un menú ──────────────────────────────────────
  const isTextField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
    (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(text|email|search|url|tel)$/.test(el.type))) &&
    !el.readOnly &&
    !el.disabled &&
    el.getAttribute('name') !== 'website'; // el campo trampa nunca cuenta

  function query(command: string): boolean {
    try {
      return document.queryCommandEnabled(command);
    } catch {
      return false;
    }
  }

  function readEdit(el: Element | null): EditState {
    const field = isTextField(el);
    const selection = field ? el.selectionStart !== el.selectionEnd : !(getSelection()?.isCollapsed ?? true);
    return { textField: field, selection, canUndo: field && query('undo'), canRedo: field && query('redo') };
  }

  function rememberFocus() {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !bar?.contains(active)) lastFocus = active;
    edit = readEdit(lastFocus && document.contains(lastFocus) ? lastFocus : null);
  }

  /**
   * Lo que había en un campo antes de cortar desde el menú. Safari no deja ejecutar `execCommand('undo')` desde código (Chrome sí), así que
   * «Deshacer» del menú no deshacía un «Cortar» del menú: si el navegador no deshace, se recupera de aquí.
   */
  const beforeCut = new WeakMap<Element, { value: string; start: number | null; end: number | null }[]>();

  function runEdit(command: EditCommand) {
    const target = lastFocus && document.contains(lastFocus) ? lastFocus : null;
    target?.focus();
    const field = isTextField(target) ? target : null;
    const before = field ? { value: field.value, start: field.selectionStart, end: field.selectionEnd } : null;
    if (command === 'cut' && field && before) beforeCut.set(field, [...(beforeCut.get(field) ?? []), before]);
    if (command === 'selectAll' && !isTextField(target)) {
      const body = ctx.focused ? document.querySelector(`[data-testid="window-${ctx.focused}"] [data-window-body]`) : null;
      if (body) getSelection()?.selectAllChildren(body);
      return;
    }
    try {
      // `execCommand` está marcado como obsoleto pero es la única vía que respeta el historial de
      // deshacer del campo. Si algún día se retira, estas acciones simplemente no hacen nada.
      document.execCommand(command);
    } catch {
      /* sin efecto */
    }
    if (command === 'undo' && field && before && field.value === before.value) {
      const last = beforeCut.get(field)?.pop();
      if (last) {
        field.value = last.value;
        field.setSelectionRange(last.start ?? last.value.length, last.end ?? last.value.length);
        // Para que el formulario (Svelte) se entere del cambio, como si lo hubiera escrito el visitante.
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  // ─── Abrir, cerrar y recorrer ───────────────────────────────────────────────────────────────
  const enabledItems = (menu: Element | null | undefined) =>
    [...(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];
  const triggers = () => [...(bar?.querySelectorAll<HTMLElement>('[data-trigger]') ?? [])];

  async function openMenu(id: MenuId, focusFirst: boolean) {
    rememberFocus();
    openId = id;
    focusIndex = menus.findIndex((m) => m.id === id);
    if (focusFirst) {
      await tick();
      enabledItems(bar?.querySelector('[role="menu"]'))[0]?.focus();
    }
  }

  function closeMenu(returnToTrigger = false) {
    const index = menus.findIndex((m) => m.id === openId);
    openId = null;
    openedByHover = null;
    if (returnToTrigger && index >= 0) triggers()[index]?.focus();
  }

  function onTriggerClick(id: MenuId, e: MouseEvent) {
    if (openedByHover === id) {
      openedByHover = null;
      return;
    }
    if (openId === id) closeMenu();
    else openMenu(id, e.detail === 0); // detail 0: se activó con el teclado
  }

  function onTriggerEnter(id: MenuId) {
    if (!openId || openId === id) return;
    openMenu(id, false);
    openedByHover = id;
  }

  function onTriggerKey(id: MenuId, i: number, e: KeyboardEvent) {
    const all = triggers();
    const move = (to: number) => {
      const next = (to + all.length) % all.length;
      focusIndex = next;
      // Con un menú abierto, pasar al contiguo lo abre y deja el foco en su primera acción (guía APG).
      if (openId) openMenu(menus[next].id, true);
      else all[next]?.focus();
    };
    if (e.key === 'ArrowRight') (e.preventDefault(), move(i + 1));
    else if (e.key === 'ArrowLeft') (e.preventDefault(), move(i - 1));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(id, true).then(async () => {
        if (e.key === 'ArrowUp') enabledItems(bar?.querySelector('[role="menu"]')).at(-1)?.focus();
      });
    }
  }

  function onMenuKey(e: KeyboardEvent) {
    const menu = e.currentTarget as HTMLElement;
    const items = enabledItems(menu);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => (e.preventDefault(), items[(i + items.length) % items.length]?.focus());
    const index = menus.findIndex((m) => m.id === openId);
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at <= 0 ? items.length - 1 : at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length;
      openMenu(menus[next].id, true);
    } else if (e.key === 'Tab') closeMenu();
  }

  function choose(entry: MenuEntry) {
    if (entry.kind !== 'item' || entry.disabled) return;
    closeMenu();
    if (entry.action?.type === 'edit') runEdit(entry.action.command);
    else if (entry.action) onaction(entry.action);
  }

  // Escape cierra el menú y no la ventana: se intercepta antes de que llegue a OS.svelte.
  $effect(() => {
    if (!openId) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      closeMenu(bar?.contains(document.activeElement) ?? false);
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  });

  function onwindowpointerdown(e: PointerEvent) {
    if (openId && !(e.target as Element).closest('[data-menu]')) closeMenu();
  }

  const controlRole = (e: Extract<MenuEntry, { kind: 'item' }>) =>
    e.control === 'radio' ? 'menuitemradio' : e.control === 'checkbox' ? 'menuitemcheckbox' : 'menuitem';
</script>

<svelte:window onpointerdown={onwindowpointerdown} />

<header class="menubar" data-testid="menubar">
  <div class="side" role="menubar" aria-label="Menú principal" bind:this={bar} data-menu>
    {#each menus as menu, i (menu.id)}
      <div class="menu-wrap" role="none">
        <!-- El ratón no mueve el foco: el campo de texto de Correo conserva el cursor y la selección. -->
        <button
          class="item"
          class:logo={menu.id === 'logo'}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={openId === menu.id}
          aria-label={menu.id === 'logo' ? `Menú de ${PERSONA.osName}` : undefined}
          tabindex={focusIndex === i ? 0 : -1}
          data-trigger
          data-testid={`menu-trigger-${menu.id}`}
          onpointerdown={(e) => e.preventDefault()}
          onclick={(e) => onTriggerClick(menu.id, e)}
          onpointerenter={() => onTriggerEnter(menu.id)}
          onfocus={() => (focusIndex = i)}
          onkeydown={(e) => onTriggerKey(menu.id, i, e)}
        >
          {#if menu.id === 'logo'}{@html UI_SVG.logo}{:else}{menu.label}{/if}
        </button>

        {#if openId === menu.id}
          {@const marks = menu.entries.some((e) => e.kind === 'item' && e.control)}
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div class="menu" class:marks role="menu" aria-label={menu.label} data-testid={`menu-${menu.id}`} onkeydown={onMenuKey}>
            {#each menu.entries as entry, k (k)}
              {#if entry.kind === 'separator'}
                <div class="sep" role="separator"></div>
              {:else if entry.kind === 'label'}
                <div class="group" role="presentation">{entry.label}</div>
              {:else if entry.href && !entry.disabled}
                <a
                  class="entry"
                  role="menuitem"
                  tabindex="-1"
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`menu-item-${menu.id}-${entry.id}`}
                  onpointerdown={(e) => e.preventDefault()}
                  onclick={() => closeMenu()}>{entry.label}</a
                >
              {:else}
                <button
                  class="entry"
                  role={controlRole(entry)}
                  aria-checked={entry.control ? !!entry.checked : undefined}
                  aria-disabled={entry.disabled ? 'true' : undefined}
                  tabindex="-1"
                  data-testid={`menu-item-${menu.id}-${entry.id}`}
                  onpointerdown={(e) => e.preventDefault()}
                  onclick={() => choose(entry)}
                >
                  {#if entry.checked}<span class="tick" aria-hidden="true">{@html UI_SVG.tick}</span>{/if}{entry.label}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
      {#if i === 0}<span class="item app" role="none" data-testid="menubar-app">{appName}</span>{/if}
    {/each}
  </div>

  <div class="side">
    <button
      class="item icon"
      data-testid="menubar-theme"
      aria-label={prefs.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onclick={() => prefs.toggleTheme()}
    >
      {@html prefs.isDark ? UI_SVG.sun : UI_SVG.moon}
    </button>
    <span class="item clock">{now ? formatMenuClock(now) : ''}</span>
  </div>
</header>

<style>
  .menubar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9000;
    height: calc(var(--menubar-h) + env(safe-area-inset-top, 0px));
    padding: env(safe-area-inset-top, 0px) 10px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--fg);
    background: var(--glass);
    border-bottom: 0.5px solid var(--glass-border);
    backdrop-filter: var(--blur-glass);
    -webkit-backdrop-filter: var(--blur-glass);
    user-select: none;
  }
  .side {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .item {
    padding: 4px 10px;
    border-radius: 5px;
    white-space: nowrap;
  }
  button.item {
    cursor: default;
  }
  button.item:hover,
  button.item[aria-expanded='true'] {
    background: var(--hover);
  }
  .icon :global(svg) {
    width: 15px;
    height: 15px;
  }
  .logo :global(svg) {
    width: 16px;
    height: 16px;
  }
  .app {
    font-weight: 700;
  }
  .clock {
    font-variant-numeric: tabular-nums;
  }
  .menu-wrap {
    position: relative;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 9500;
    min-width: 230px;
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    padding: 5px;
    border-radius: var(--r-menu);
    background: var(--glass-strong);
    border: 0.5px solid var(--glass-border);
    backdrop-filter: var(--blur-glass);
    -webkit-backdrop-filter: var(--blur-glass);
    box-shadow: var(--shadow-win);
  }
  .entry {
    position: relative;
    display: block;
    width: 100%;
    padding: 5px 10px;
    border-radius: 5px;
    text-align: left;
    text-decoration: none;
    color: inherit;
    white-space: nowrap;
  }
  .marks .entry {
    padding-left: 26px;
  }
  .tick {
    position: absolute;
    left: 8px;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translateY(-50%);
  }
  .tick :global(svg) {
    width: 12px;
    height: 12px;
  }
  .entry:hover:not([aria-disabled='true']),
  .entry:focus-visible {
    background: var(--accent-solid);
    color: var(--accent-fg);
    outline: none;
  }
  .entry[aria-disabled='true'] {
    opacity: 0.45;
  }
  .group {
    padding: 6px 10px 2px;
    font-size: calc(12px * var(--text-scale));
    font-weight: 600;
    color: var(--muted);
  }
  .marks .group {
    padding-left: 10px;
  }
  .sep {
    margin: 5px 8px;
    border-top: 1px solid var(--line);
  }
</style>
