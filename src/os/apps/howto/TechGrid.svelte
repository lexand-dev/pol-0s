<script lang="ts">
  import { TECHS, initials } from '../../../lib/tech-logos';
</script>

<!-- Las tecnologías con su logo (S-10). Se pinta igual dentro de la ventana y en la página pública; no necesita JavaScript. -->
<ul class="techs" data-testid="howto-techs">
  {#each TECHS as tech (tech.id)}
    <li class="tech" data-testid={`howto-tech-${tech.id}`} data-logo={tech.logo ? 'svg' : 'text'}>
      <span class="logo" aria-hidden="true">
        {#if tech.logo}
          <svg viewBox="0 0 24 24" focusable="false"><path d={tech.logo} /></svg>
        {:else}
          <span class="initials">{initials(tech.name)}</span>
        {/if}
      </span>
      <span class="text">
        <strong class="name">{tech.name}</strong>
        <span class="role">{tech.role}</span>
      </span>
    </li>
  {/each}
</ul>

<style>
  /* `ul.techs.techs`: gana en especificidad al `ul` genérico del texto que la rodea. */
  ul.techs.techs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    margin: 4px 0 18px;
    padding: 0;
    list-style: none;
  }
  .tech {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.045);
    box-shadow: inset 0 0 0 1px var(--paper-line);
  }
  .logo {
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--paper-bg);
    color: var(--paper-fg);
    box-shadow: inset 0 0 0 1px var(--paper-line);
  }
  .logo svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
  }
  .initials {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .text {
    display: grid;
    gap: 1px;
    min-width: 0;
    line-height: 1.3;
  }
  .name {
    font-size: calc(14px * var(--text-scale));
  }
  .role {
    font-size: calc(13px * var(--text-scale));
    color: var(--paper-muted);
  }
</style>
