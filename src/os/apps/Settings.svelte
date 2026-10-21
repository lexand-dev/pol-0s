<script lang="ts">
  import { TEXT_SIZES, WALLPAPERS, type ThemePref } from '../../lib/prefs';
  import { prefs } from '../stores/prefs.svelte';

  const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'auto', label: 'Automático' },
  ];
</script>

<div class="settings" data-testid="settings">
  <section>
    <h3 id="settings-appearance">Apariencia</h3>
    <div class="options three" role="radiogroup" aria-labelledby="settings-appearance">
      {#each THEME_OPTIONS as option (option.value)}
        <button
          class="option"
          role="radio"
          aria-checked={prefs.current.theme === option.value}
          data-testid={`settings-theme-${option.value}`}
          onclick={() => prefs.set({ theme: option.value })}
        >
          <span class={`preview theme-${option.value}`} aria-hidden="true"><span class="bar"></span></span>
          <span class="label">{option.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3 id="settings-wallpaper">Fondo de pantalla</h3>
    <div class="options four" role="radiogroup" aria-labelledby="settings-wallpaper">
      {#each WALLPAPERS as wall (wall.id)}
        <button
          class="option"
          role="radio"
          aria-checked={prefs.current.wallpaper === wall.id}
          data-testid={`settings-wall-${wall.id}`}
          onclick={() => prefs.set({ wallpaper: wall.id })}
        >
          <span class="preview" style:background={`var(--wall-${wall.id})`} aria-hidden="true"></span>
          <span class="label">{wall.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3 id="settings-text">Tamaño del texto</h3>
    <div class="options three" role="radiogroup" aria-labelledby="settings-text">
      {#each TEXT_SIZES as size (size.id)}
        <button
          class="option"
          role="radio"
          aria-checked={prefs.current.textSize === size.id}
          data-testid={`settings-text-${size.id}`}
          onclick={() => prefs.set({ textSize: size.id })}
        >
          <span class="preview sample" aria-hidden="true"><span style:font-size={`${14 * size.scale}px`}>Aa</span></span>
          <span class="label">{size.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <p class="note">Tus ajustes se guardan solo en este navegador.</p>
</div>

<style>
  .settings {
    display: grid;
    gap: 24px;
    max-width: 560px;
    padding: 22px;
  }
  h3 {
    margin: 0 0 10px;
    font-size: calc(14px * var(--text-scale));
  }
  .options {
    display: grid;
    gap: 12px;
  }
  .three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .four {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  @media (max-width: 480px) {
    .four {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    cursor: pointer;
  }
  .preview {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
  /* Miniatura del tamaño del texto: el «Aa» se pinta con el tamaño real de cada paso. */
  .sample {
    display: grid;
    place-items: center;
    background: var(--surface);
    color: var(--fg);
    font-weight: 600;
  }
  .option[aria-checked='true'] .preview {
    box-shadow: 0 0 0 3px var(--accent);
  }
  .option[aria-checked='true'] .label {
    color: var(--accent-text);
    font-weight: 600;
  }
  /* Miniaturas de apariencia: colores fijos, muestran cómo se ve cada tema sea cual sea el actual. */
  .theme-light {
    background: #ffffff;
  }
  .theme-light .bar {
    background: #f2f2f5;
  }
  .theme-dark {
    background: #232328;
  }
  .theme-dark .bar {
    background: #3a3a40;
  }
  .theme-auto {
    background: linear-gradient(90deg, #ffffff 50%, #232328 50%);
  }
  .theme-auto .bar {
    background: linear-gradient(90deg, #f2f2f5 50%, #3a3a40 50%);
  }
  .bar {
    position: absolute;
    inset: 0 0 auto;
    height: 22%;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: calc(13px * var(--text-scale));
  }
</style>
