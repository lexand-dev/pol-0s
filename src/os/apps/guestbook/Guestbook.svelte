<script lang="ts">
  import { PERSONA } from '../../../content/persona';
  import { formatNoteDate } from '../../../lib/notes';
  import {
    LIMITS,
    NETWORKS,
    RELATIONS,
    networkLabel,
    relationLabel,
    validateGuestbook,
    type FieldErrors,
    type FieldName,
    type Kind,
    type NetworkId,
    type RelationId,
    type SocialLink,
  } from '../../../lib/guestbook';
  import { UI_SVG } from '../../icons';
  import { prefs } from '../../stores/prefs.svelte';
  import { loadTurnstile, siteKey, type TurnstileApi } from '../mail/turnstile-client';

  interface Entry {
    id: string;
    name: string;
    detail?: string;
    relation: RelationId;
    text: string;
    links: SocialLink[];
    date?: string;
  }

  type View = 'list' | 'form' | 'sent';
  type Captcha = 'loading' | 'ready' | 'failed' | 'unconfigured';
  type LinkRow = { network: NetworkId; value: string };

  const MESSAGES = {
    rate_limited: 'Has enviado demasiadas peticiones seguidas, o ya te hemos mandado un enlace hace un momento. Espera un minuto y vuelve a intentarlo.',
    captcha_failed: 'No hemos podido verificar que eres una persona. Inténtalo de nuevo.',
    captcha_pending: 'Espera un momento a que termine la verificación y vuelve a enviar.',
    generic: 'No se ha podido enviar. Inténtalo de nuevo en unos minutos.',
  } as const;

  // ─── La lista ─────────────────────────────────────────────────────────────────────────────────────────────
  let view = $state<View>('list');
  let entries = $state<Entry[] | null>(null);
  let loadFailed = $state(false);

  // Las reseñas se piden al abrir la app (un archivo estático del propio sitio): la home no las lleva.
  $effect(() => {
    let cancelled = false;
    fetch('/libro-de-visitas.json')
      .then((res) => (res.ok ? (res.json() as Promise<Entry[]>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!cancelled) entries = data;
      })
      .catch(() => {
        if (!cancelled) loadFailed = true;
      });
    return () => {
      cancelled = true;
    };
  });

  // ─── El formulario ────────────────────────────────────────────────────────────────────────────────────────
  // Los valores se conservan en todos los errores: el visitante no pierde lo que ha escrito.
  let kind = $state<Kind>('new');
  let name = $state('');
  let detail = $state('');
  let relation = $state<RelationId | ''>('');
  let text = $state('');
  let email = $state('');
  let links = $state<LinkRow[]>([{ network: 'linkedin', value: '' }]);
  let consent = $state(false);
  let website = $state(''); // campo trampa: un humano no lo ve
  let errors = $state<FieldErrors>({});
  let banner = $state('');
  let sending = $state(false);
  let sentKind = $state<Kind>('new');
  let captcha = $state<Captcha>('loading');
  let token = '';

  let captchaBox: HTMLDivElement | undefined = $state();
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;

  const FIELD_IDS: Record<FieldName, string> = {
    kind: 'gb-kind',
    name: 'gb-name',
    detail: 'gb-detail',
    relation: 'gb-relation',
    text: 'gb-text',
    email: 'gb-email',
    links: 'gb-link-value-0',
    consent: 'gb-consent',
  };
  const ORDER: FieldName[] = ['kind', 'name', 'detail', 'relation', 'text', 'links', 'email', 'consent'];

  const removing = $derived(kind === 'remove');

  // El widget de Turnstile se pinta cuando aparece el formulario y se retira al salir de él.
  $effect(() => {
    const box = captchaBox;
    if (!box) return;
    let cancelled = false;
    const key = siteKey();
    if (!key) {
      captcha = 'unconfigured';
      return;
    }
    captcha = 'loading';
    token = '';
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled) return;
        api = turnstile;
        widgetId = turnstile.render(box, {
          sitekey: key,
          theme: prefs.isDark ? 'dark' : 'light',
          callback: (t) => (token = t),
          'expired-callback': () => (token = ''),
          'error-callback': () => (token = ''),
        });
        captcha = 'ready';
      },
      () => {
        if (!cancelled) captcha = 'failed';
      },
    );
    return () => {
      cancelled = true;
      if (api && widgetId) api.remove(widgetId);
      widgetId = null;
    };
  });

  /** El token solo vale una vez: tras cada intento se pide otro. */
  function renewToken() {
    token = '';
    if (api && widgetId) api.reset(widgetId);
  }

  function focusFirstError(found: FieldErrors) {
    const first = ORDER.find((f) => found[f]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  const addLink = () => {
    if (links.length < LIMITS.links) links = [...links, { network: 'linkedin', value: '' }];
  };
  const removeLink = (i: number) => (links = links.filter((_, j) => j !== i));

  function openForm() {
    banner = '';
    errors = {};
    view = 'form';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (sending) return;
    banner = '';

    // Las filas de red sin rellenar no viajan.
    const input = { kind, name, detail, relation, text, email, links: links.filter((l) => l.value.trim() !== ''), consent };
    const checked = validateGuestbook(input);
    if (!checked.ok) {
      errors = checked.errors;
      focusFirstError(checked.errors);
      return;
    }
    errors = {};
    if (!token) {
      banner = MESSAGES.captcha_pending;
      return;
    }

    sending = true;
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, turnstileToken: token, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; fields?: FieldErrors };
      if (res.ok && data.ok) {
        sentKind = kind;
        view = 'sent';
        sending = false;
        return;
      }
      if (res.status === 422 && data.fields) {
        errors = data.fields;
        focusFirstError(data.fields);
      } else if (res.status === 429) banner = MESSAGES.rate_limited;
      else if (res.status === 403) banner = MESSAGES.captcha_failed;
      else banner = MESSAGES.generic;
    } catch {
      banner = MESSAGES.generic;
    }
    sending = false;
    renewToken();
  }

  function reset() {
    kind = 'new';
    name = detail = text = email = website = '';
    relation = '';
    links = [{ network: 'linkedin', value: '' }];
    consent = false;
    errors = {};
    banner = '';
    view = 'list';
  }

  const canSend = $derived(!sending && (captcha === 'ready' || captcha === 'loading'));
  const SENT: Record<Kind, string> = {
    new: 'Tu reseña ya está en camino.',
    edit: 'Tu petición de edición ya está en camino.',
    remove: 'Tu petición para retirar la reseña ya está en camino.',
  };
</script>

<div class="guestbook" data-testid="guestbook">
  {#if view === 'list'}
    <header class="bar">
      <div>
        <h1>Libro de visitas</h1>
        <p>Lo que dicen quienes han trabajado, aprendido o hablado con {PERSONA.firstName}.</p>
      </div>
      <button class="button" data-testid="guestbook-write" onclick={openForm}>Dejar reseña</button>
    </header>

    <div class="scroll">
      {#if entries}
        {#if entries.length === 0}
          <p class="status" data-testid="guestbook-empty">Todavía no hay reseñas. Si conoces a {PERSONA.firstName}, puedes escribir la primera.</p>
        {:else}
          <ul class="list" data-testid="guestbook-list">
            {#each entries as entry (entry.id)}
              <li class="card" data-testid={`guestbook-entry-${entry.id}`}>
                <blockquote>{entry.text}</blockquote>
                <footer>
                  <strong data-testid="guestbook-entry-name">{entry.name}</strong>
                  <span class="muted">{relationLabel(entry.relation)}{entry.detail ? ` · ${entry.detail}` : ''}</span>
                  {#if entry.date}<span class="muted">{formatNoteDate(entry.date)}</span>{/if}
                  {#if entry.links.length > 0}
                    <span class="links">
                      {#each entry.links as link (link.url)}
                        <a href={link.url} target="_blank" rel="nofollow noopener noreferrer ugc">{networkLabel(link.network)}<span aria-hidden="true">{@html UI_SVG.external}</span></a>
                      {/each}
                    </span>
                  {/if}
                </footer>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if loadFailed}
        <p class="status" role="alert" data-testid="guestbook-error">No se han podido cargar las reseñas. Revisa tu conexión y vuelve a abrir el libro.</p>
      {:else}
        <p class="status" role="status" data-testid="guestbook-loading">Cargando las reseñas…</p>
      {/if}
    </div>
  {:else if view === 'sent'}
    <div class="sent" data-testid="guestbook-sent" role="status">
      <span class="sent-icon" aria-hidden="true">{@html UI_SVG.check}</span>
      <h2>{SENT[sentKind]}</h2>
      <p>
        Te hemos enviado un correo con un enlace. Ábrelo y pulsa «Confirmar» para que sea {PERSONA.firstName} quien la revise. Caduca en 48 horas. Si no lo ves, mira en
        la carpeta de spam.
      </p>
      <button class="button ghost" data-testid="guestbook-again" onclick={reset}>Volver al libro</button>
    </div>
  {:else}
    <form class="form" novalidate onsubmit={submit} data-testid="guestbook-form">
      <header class="bar">
        <button type="button" class="back" data-testid="guestbook-back" onclick={() => (view = 'list')}>
          <span aria-hidden="true">{@html UI_SVG.back}</span> Volver
        </button>
        <button class="button" type="submit" data-testid="guestbook-send" disabled={!canSend}>{sending ? 'Enviando…' : 'Enviar'}</button>
      </header>

      <div class="scroll fields">
        <div class="field">
          <label for="gb-kind">¿Qué quieres hacer?</label>
          <select id="gb-kind" data-testid="guestbook-kind" bind:value={kind} aria-invalid={errors.kind ? 'true' : undefined}>
            <option value="new">Escribir una reseña nueva</option>
            <option value="edit">Editar mi reseña ya publicada</option>
            <option value="remove">Pedir que retiren mi reseña</option>
          </select>
          {#if kind === 'edit'}<p class="hint">Escribe de nuevo la reseña con los cambios. {PERSONA.firstName} la comparará con la que ya está y usará el correo para saber que eres tú.</p>{/if}
          {#if removing}<p class="hint">Con el nombre y el correo con el que la escribiste, {PERSONA.firstName} la retirará.</p>{/if}
          {#if errors.kind}<p class="error" data-testid="guestbook-error-kind">{errors.kind}</p>{/if}
        </div>

        <div class="field">
          <label for="gb-name">Nombre visible</label>
          <input id="gb-name" data-testid="guestbook-name" type="text" autocomplete="name" maxlength={LIMITS.name} bind:value={name}
            aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'gb-error-name' : undefined} />
          {#if errors.name}<p class="error" id="gb-error-name" data-testid="guestbook-error-name">{errors.name}</p>{/if}
        </div>

        {#if !removing}
          <div class="field">
            <label for="gb-detail">Cargo o lugar <span class="muted">(opcional)</span></label>
            <input id="gb-detail" data-testid="guestbook-detail" type="text" maxlength={LIMITS.detail} placeholder="Product Designer | Barcelona, España" bind:value={detail}
              aria-invalid={errors.detail ? 'true' : undefined} aria-describedby={errors.detail ? 'gb-error-detail' : undefined} />
            {#if errors.detail}<p class="error" id="gb-error-detail" data-testid="guestbook-error-detail">{errors.detail}</p>{/if}
          </div>

          <div class="field">
            <label for="gb-relation">¿Cómo conoces a {PERSONA.firstName}?</label>
            <select id="gb-relation" data-testid="guestbook-relation" bind:value={relation} aria-invalid={errors.relation ? 'true' : undefined}
              aria-describedby={errors.relation ? 'gb-error-relation' : undefined}>
              <option value="" disabled>Elige una opción</option>
              {#each RELATIONS as r (r.id)}<option value={r.id}>{r.label}</option>{/each}
            </select>
            {#if errors.relation}<p class="error" id="gb-error-relation" data-testid="guestbook-error-relation">{errors.relation}</p>{/if}
          </div>

          <div class="field">
            <label for="gb-text">Tu reseña</label>
            <textarea id="gb-text" data-testid="guestbook-text" rows="6" maxlength={LIMITS.text} bind:value={text}
              placeholder={`Cuenta cómo es trabajar, aprender o hablar con ${PERSONA.firstName}.`}
              aria-invalid={errors.text ? 'true' : undefined} aria-describedby={errors.text ? 'gb-error-text' : 'gb-count'}></textarea>
            <p class="hint" id="gb-count" data-testid="guestbook-count">{text.length} / {LIMITS.text}</p>
            {#if errors.text}<p class="error" id="gb-error-text" data-testid="guestbook-error-text">{errors.text}</p>{/if}
          </div>

          <fieldset class="field">
            <legend>Tus redes <span class="muted">(opcional, hasta {LIMITS.links})</span></legend>
            {#each links as row, i (i)}
              <div class="link-row">
                <select aria-label={`Red ${i + 1}`} data-testid={`guestbook-link-network-${i}`} bind:value={row.network}>
                  {#each NETWORKS as n (n.id)}<option value={n.id}>{n.label}</option>{/each}
                </select>
                <input id={`gb-link-value-${i}`} aria-label={`Usuario o dirección de la red ${i + 1}`} data-testid={`guestbook-link-value-${i}`} type="text"
                  placeholder="tu-usuario o la dirección de tu perfil" bind:value={row.value} aria-invalid={errors.links ? 'true' : undefined}
                  aria-describedby={errors.links ? 'gb-error-links' : undefined} />
                {#if links.length > 1}
                  <button type="button" class="icon-button" aria-label={`Quitar la red ${i + 1}`} data-testid={`guestbook-link-remove-${i}`} onclick={() => removeLink(i)}>
                    <span aria-hidden="true">{@html UI_SVG.close}</span>
                  </button>
                {/if}
              </div>
            {/each}
            {#if links.length < LIMITS.links}
              <button type="button" class="button ghost small" data-testid="guestbook-add-link" onclick={addLink}>Añadir otra red</button>
            {/if}
            {#if errors.links}<p class="error" id="gb-error-links" data-testid="guestbook-error-links">{errors.links}</p>{/if}
          </fieldset>
        {/if}

        <div class="field">
          <label for="gb-email">Tu correo</label>
          <input id="gb-email" data-testid="guestbook-email" type="email" autocomplete="email" placeholder="tu@correo.com" bind:value={email}
            aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? 'gb-error-email' : 'gb-email-hint'} />
          <p class="hint" id="gb-email-hint">Solo sirve para comprobar que es tuyo. No se publica.</p>
          {#if errors.email}<p class="error" id="gb-error-email" data-testid="guestbook-error-email">{errors.email}</p>{/if}
        </div>

        <div class="field consent">
          <label class="check">
            <input id="gb-consent" data-testid="guestbook-consent" type="checkbox" bind:checked={consent} aria-invalid={errors.consent ? 'true' : undefined}
              aria-describedby={errors.consent ? 'gb-error-consent' : undefined} />
            <span>He leído el aviso de privacidad y acepto que se publique lo que escribo.</span>
          </label>
          <details class="privacy" data-testid="guestbook-privacy">
            <summary>Aviso de privacidad</summary>
            <p>
              <strong>Responsable:</strong> {PERSONA.name}. <strong>Para qué uso tus datos:</strong> tu correo solo sirve para comprobar que es tuyo y para
              responderte si hace falta; no se publica ni se guarda en esta web (llega a mi bandeja de entrada). Se hará público lo que escribas en el
              nombre, el cargo o lugar, la reseña y las redes, solo si yo la apruebo. <strong>Tus derechos:</strong> puedes pedir en cualquier momento
              que edite o retire tu reseña desde este mismo formulario.
            </p>
          </details>
          {#if errors.consent}<p class="error" id="gb-error-consent" data-testid="guestbook-error-consent">{errors.consent}</p>{/if}
        </div>

        <!-- Campo trampa: fuera de pantalla y de la tabulación. Si llega relleno, es un bot. -->
        <div class="trap" aria-hidden="true">
          <label>Sitio web <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} /></label>
        </div>

        <div class="foot">
          <div class="captcha" bind:this={captchaBox} data-testid="guestbook-captcha"></div>
          {#if captcha === 'failed' || captcha === 'unconfigured'}
            <p class="notice" data-testid="guestbook-captcha-failed" role="alert">
              {captcha === 'failed'
                ? 'No se ha podido cargar la verificación anti-bots. Revisa tu conexión y vuelve a abrir el libro.'
                : 'La verificación anti-bots no está configurada, así que el envío está desactivado.'}
            </p>
          {/if}
          {#if banner}<p class="notice error-text" data-testid="guestbook-banner" role="alert">{banner}</p>{/if}
        </div>
      </div>
    </form>
  {/if}
</div>

<style>
  .guestbook {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--win-bg);
    color: var(--fg);
  }
  .form {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--chrome);
    border-bottom: 1px solid var(--line);
  }
  .bar h1 {
    margin: 0;
    font-size: calc(16px * var(--text-scale));
  }
  .bar p {
    margin: 2px 0 0;
    font-size: calc(13px * var(--text-scale));
    color: var(--muted);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
  }
  .list {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    padding: 16px 18px;
    border-radius: 12px;
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  blockquote {
    margin: 0 0 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
    font-size: calc(14px * var(--text-scale));
  }
  .muted {
    color: var(--muted);
    font-weight: 400;
  }
  .links {
    display: inline-flex;
    gap: 10px;
    margin-left: auto;
  }
  .links a {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--accent-text);
  }
  .links :global(svg) {
    width: 11px;
    height: 11px;
  }
  .status {
    margin: 40px 0;
    text-align: center;
    color: var(--muted);
  }
  .fields {
    display: grid;
    align-content: start;
    gap: 14px;
  }
  .field {
    display: grid;
    gap: 6px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  label,
  legend {
    padding: 0;
    font-weight: 600;
    font-size: calc(14px * var(--text-scale));
  }
  input[type='text'],
  input[type='email'],
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 36px;
    padding: 7px 10px;
    font: inherit;
    color: var(--fg);
    border: 0;
    border-radius: var(--r-control);
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
  textarea {
    resize: vertical;
    line-height: 1.5;
  }
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  [aria-invalid='true'] {
    box-shadow: inset 0 0 0 2px var(--danger);
  }
  .hint {
    margin: 0;
    font-size: calc(13px * var(--text-scale));
    color: var(--muted);
  }
  .error {
    margin: 0;
    font-size: calc(13px * var(--text-scale));
    color: var(--danger);
  }
  .link-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .link-row select {
    flex: none;
    width: 120px;
  }
  .icon-button {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--muted);
    cursor: pointer;
  }
  .icon-button:hover {
    background: var(--hover);
  }
  .icon-button :global(svg) {
    width: 12px;
    height: 12px;
  }
  .consent .check {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-weight: 400;
  }
  .consent input {
    margin-top: 2px;
  }
  .privacy {
    font-size: calc(13px * var(--text-scale));
    color: var(--muted);
  }
  .privacy summary {
    cursor: pointer;
    width: fit-content;
  }
  .privacy p {
    margin: 6px 0 0;
    line-height: 1.5;
  }
  .trap {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .captcha:empty {
    display: none;
  }
  .notice {
    margin: 0;
    font-size: calc(13px * var(--text-scale));
    line-height: 1.45;
    color: var(--muted);
  }
  .error-text {
    color: var(--danger);
  }
  .button {
    flex: none;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    padding: 0 14px;
    border-radius: var(--r-control);
    font-weight: 600;
    cursor: pointer;
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .button:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .button.ghost {
    color: var(--fg);
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
  .button.small {
    height: 26px;
    width: fit-content;
    font-size: calc(13px * var(--text-scale));
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-text);
    cursor: pointer;
  }
  .back :global(svg) {
    width: 14px;
    height: 14px;
  }
  .sent {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px;
    text-align: center;
  }
  .sent-icon {
    color: var(--ok);
  }
  .sent-icon :global(svg) {
    width: 48px;
    height: 48px;
  }
  .sent h2 {
    margin: 0;
    font-size: calc(18px * var(--text-scale));
  }
  .sent p {
    margin: 0;
    max-width: 42ch;
    color: var(--muted);
    line-height: 1.5;
  }
</style>
