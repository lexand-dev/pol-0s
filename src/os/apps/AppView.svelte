<script lang="ts">
  import type { AboutData, NoteData, ProjectData } from '../items';
  import Browser from './browser/Browser.svelte';
  import Help from './Help.svelte';
  import Mail from './mail/Mail.svelte';
  import Settings from './Settings.svelte';
  import type { OpenTarget } from './registry';

  // Punto único donde cada app pinta su contenido. Sobre mí, Proyectos, Stack y las notas se cargan al abrirlas, no al
  // entrar: son las que más código y datos llevan y la home tiene un presupuesto de JavaScript (S-06).
  interface Props {
    target: OpenTarget;
    projects: ProjectData[];
    notes: NoteData[];
    about: AboutData;
    /** Veces que se ha pedido abrir la ventana (ver WindowState.opens). */
    nav?: number;
  }

  let { target, projects, notes, about, nav = 0 }: Props = $props();
</script>

{#if target.app === 'settings'}
  <Settings />
{:else if target.app === 'help'}
  <Help />
{:else if target.app === 'mail'}
  <Mail />
{:else if target.app === 'about'}
  {#await import('./about/About.svelte') then { default: About }}
    <About {about} />
  {/await}
{:else if target.app === 'stack'}
  {#await import('./stack/Stack.svelte') then { default: Stack }}
    <Stack />
  {/await}
{:else if target.app === 'projects'}
  {#await import('./projects/Projects.svelte') then { default: Projects }}
    <Projects {projects} initial={target.arg ?? null} {nav} />
  {/await}
{:else if target.app === 'favorites'}
  {#await import('./favorites/Favorites.svelte') then { default: Favorites }}
    <Favorites initial={target.arg ?? null} {nav} />
  {/await}
{:else if target.app === 'howto'}
  {#await import('./howto/HowTo.svelte') then { default: HowTo }}
    <HowTo />
  {/await}
{:else if target.app === 'guestbook'}
  {#await import('./guestbook/Guestbook.svelte') then { default: Guestbook }}
    <Guestbook />
  {/await}
{:else if target.app === 'notes'}
  {#await import('./notes/NotesFolder.svelte') then { default: NotesFolder }}
    <NotesFolder {notes} />
  {/await}
{:else if target.app === 'note' && target.arg}
  {#await import('./notes/Note.svelte') then { default: Note }}
    <Note id={target.arg} />
  {/await}
{:else if target.app === 'github'}
  {#await import('./github/Github.svelte') then { default: Github }}
    <Github {projects} />
  {/await}
{:else if target.app === 'checkers'}
  {#await import('./checkers/Checkers.svelte') then { default: Checkers }}
    <Checkers />
  {/await}
{:else if target.app === 'memory'}
  {#await import('./memory/Memory.svelte') then { default: Memory }}
    <Memory />
  {/await}
{:else if target.app === 'terminal'}
  {#await import('./terminal/Terminal.svelte') then { default: Terminal }}
    <Terminal {projects} {notes} />
  {/await}
{:else if target.app === 'browser'}
  <Browser {projects} initial={target.arg ?? null} {nav} />
{/if}
