<script lang="ts">
  import { PERSONA } from '../../../content/persona';
  import { onMount } from 'svelte';
  import { validateContact, type FieldErrors, type FieldName } from '../../../lib/contact';
  import { UI_SVG } from '../../icons';
  import { prefs } from '../../stores/prefs.svelte';
  import { loadTurnstile, siteKey, type TurnstileApi } from './turnstile-client';

  type Status = 'editing' | 'sending' | 'sent';
  type Captcha = 'loading' | 'ready' | 'failed' | 'unconfigured';

  const MESSAGES = {
    rate_limited: 'Has enviado demasiados mensajes seguidos. Espera un minuto y vuelve a intentarlo.',
    captcha_failed: 'No hemos podido verificar que eres una persona. Inténtalo de nuevo.',
    captcha_pending: 'Espera un momento a que termine la verificación y vuelve a enviar.',
    generic: 'No se ha podido enviar el mensaje. Inténtalo de nuevo en unos minutos.',
  } as const;

  // Los valores se conservan en todos los errores: el visitante no pierde lo que ha escrito.
  let from = $state('');
  let subject = $state('');
  let message = $state('');
  let website = $state(''); // campo trampa: un humano no lo ve
  let errors = $state<FieldErrors>({});
  let banner = $state('');
  let status = $state<Status>('editing');
  let captcha = $state<Captcha>('loading');
  let token = '';

  let captchaBox: HTMLDivElement | undefined = $state();
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;

  const FIELD_IDS: Record<FieldName, string> = { from: 'mail-from', subject: 'mail-subject', message: 'mail-message' };

  onMount(() => {
    let cancelled = false;
    const key = siteKey();
    if (!key) {
      captcha = 'unconfigured';
      return;
    }
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !captchaBox) return;
        api = turnstile;
        widgetId = turnstile.render(captchaBox, {
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
    };
  });

  /** El token solo vale una vez: tras cada intento se pide otro. */
  function renewToken() {
    token = '';
    if (api && widgetId) api.reset(widgetId);
  }

  function focusFirstError(found: FieldErrors) {
    const first = (['from', 'subject', 'message'] as const).find((f) => found[f]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (status !== 'editing') return;
    banner = '';

    const checked = validateContact({ from, subject, message });
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

    status = 'sending';
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checked.value, turnstileToken: token, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; fields?: FieldErrors };
      if (res.ok && data.ok) {
        status = 'sent';
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
    status = 'editing';
    renewToken();
  }

  function writeAnother() {
    from = subject = message = website = '';
    errors = {};
    banner = '';
    status = 'editing';
    renewToken();
  }

  const canSend = $derived(status === 'editing' && (captcha === 'ready' || captcha === 'loading'));
</script>

<div class="mail" data-testid="mail">
  {#if status === 'sent'}
    <div class="sent" data-testid="mail-sent" role="status">
      <span class="sent-icon" aria-hidden="true">{@html UI_SVG.check}</span>
      <h2>Mensaje enviado</h2>
      <p>Gracias por escribir. {PERSONA.firstName} lo leerá y te responderá al correo que has indicado.</p>
      <button class="button ghost" data-testid="mail-again" onclick={writeAnother}>Escribir otro</button>
    </div>
  {:else}
    <form class="form" novalidate onsubmit={submit}>
      <div class="bar">
        <strong>Mensaje nuevo</strong>
        <button class="button" type="submit" data-testid="mail-send" disabled={!canSend}>
          {@html UI_SVG.send}{status === 'sending' ? 'Enviando…' : 'Enviar'}
        </button>
      </div>

      <div class="row">
        <span class="label" id="mail-to-label">Para:</span>
        <span class="chip" data-testid="mail-to" role="textbox" aria-readonly="true" aria-labelledby="mail-to-label" tabindex="0">
          <span class="avatar" aria-hidden="true">{PERSONA.initials}</span>{PERSONA.name}
        </span>
        <span class="fixed">{@html UI_SVG.lock}Fijo</span>
      </div>

      <div class="row">
        <label class="label" for="mail-from">De:</label>
        <input
          id="mail-from"
          data-testid="mail-from"
          type="email"
          autocomplete="email"
          placeholder="tu@correo.com"
          bind:value={from}
          aria-invalid={errors.from ? 'true' : undefined}
          aria-describedby={errors.from ? 'mail-error-from' : undefined}
        />
      </div>
      {#if errors.from}<p class="error" id="mail-error-from" data-testid="mail-error-from">{errors.from}</p>{/if}

      <div class="row">
        <label class="label" for="mail-subject">Asunto:</label>
        <input
          id="mail-subject"
          data-testid="mail-subject"
          type="text"
          placeholder="¿De qué quieres hablar?"
          bind:value={subject}
          aria-invalid={errors.subject ? 'true' : undefined}
          aria-describedby={errors.subject ? 'mail-error-subject' : undefined}
        />
      </div>
      {#if errors.subject}<p class="error" id="mail-error-subject" data-testid="mail-error-subject">{errors.subject}</p>{/if}

      <textarea
        id="mail-message"
        data-testid="mail-message"
        aria-label="Mensaje"
        placeholder="Escribe tu mensaje…"
        bind:value={message}
        aria-invalid={errors.message ? 'true' : undefined}
        aria-describedby={errors.message ? 'mail-error-message' : undefined}
      ></textarea>
      {#if errors.message}<p class="error pad" id="mail-error-message" data-testid="mail-error-message">{errors.message}</p>{/if}

      <!-- Campo trampa: fuera de pantalla y de la tabulación. Si llega relleno, es un bot. -->
      <div class="trap" aria-hidden="true">
        <label>Sitio web <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} /></label>
      </div>

      <div class="foot">
        <div class="captcha" bind:this={captchaBox} data-testid="mail-captcha"></div>
        {#if captcha === 'failed' || captcha === 'unconfigured'}
          <p class="notice" data-testid="mail-captcha-failed" role="alert">
            {captcha === 'failed'
              ? 'No se ha podido cargar la verificación anti-bots. Revisa tu conexión y vuelve a abrir Correo.'
              : 'La verificación anti-bots no está configurada, así que el envío está desactivado.'}
          </p>
        {/if}
        {#if banner}<p class="notice error-text" data-testid="mail-banner" role="alert">{banner}</p>{/if}
      </div>
    </form>
  {/if}
</div>

<style>
  .mail {
    height: 100%;
    display: flex;
    flex-direction: column;
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
    gap: 8px;
    padding: 8px 14px;
    background: var(--chrome);
    border-bottom: 1px solid var(--line);
  }
  .row {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 16px;
    border-bottom: 1px solid var(--line);
  }
  .label {
    flex: none;
    width: 58px;
    color: var(--muted);
  }
  input[type='email'],
  input[type='text']:not([name='website']) {
    flex: 1;
    min-width: 0;
    height: 38px;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    color: var(--fg);
  }
  input:focus-visible,
  textarea:focus-visible {
    outline: none;
  }
  .row:focus-within {
    background: var(--accent-soft);
  }
  /* El gris de la etiqueta no llega a 4,5:1 sobre el fondo de la fila enfocada. */
  .row:focus-within .label {
    color: var(--fg);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px 3px 4px;
    border-radius: 99px;
    font-weight: 500;
    background: var(--accent-soft);
  }
  .avatar {
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: calc(10px * var(--text-scale));
    font-weight: 700;
    color: var(--accent-fg);
    background: var(--accent-solid);
  }
  .fixed {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: calc(12px * var(--text-scale));
    color: var(--muted);
  }
  .fixed :global(svg) {
    width: 11px;
    height: 11px;
  }
  textarea {
    flex: 1;
    min-height: 140px;
    padding: 14px 16px;
    resize: none;
    border: 0;
    outline: none;
    font: inherit;
    font-size: calc(15px * var(--text-scale));
    line-height: 1.55;
    color: var(--fg);
    background: transparent;
  }
  [aria-invalid='true'] {
    box-shadow: inset 0 -2px 0 var(--danger);
  }
  .error {
    flex: none;
    margin: 0;
    padding: 4px 16px 6px 82px;
    font-size: calc(13px * var(--text-scale));
    color: var(--danger);
  }
  .error.pad {
    padding-left: 16px;
  }
  .trap {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  .foot {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--line);
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
  .button :global(svg) {
    width: 15px;
    height: 15px;
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
    max-width: 34ch;
    color: var(--muted);
    line-height: 1.5;
  }
</style>
