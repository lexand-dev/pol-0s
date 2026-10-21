import { describe, expect, test, vi } from 'vitest';
import { openToken } from './guestbook-token';
import { handleConfirm, handleSubmit, type GuestbookDeps, type GuestbookRequest, type OutgoingEmail } from './guestbook-service';
import { PERSONA } from '../content/persona';

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const SECRET = 'una-clave-de-prueba-bastante-larga-0123456789';
const SITE = 'https://example.com';

const valid = {
  kind: 'new',
  name: 'Ana Pérez',
  detail: 'Diseñadora | Madrid',
  relation: 'cliente',
  text: 'Trabajar con Pol fue muy fácil y el resultado superó lo que esperaba.',
  email: 'ana@ejemplo.com',
  links: [{ network: 'linkedin', value: 'ana-perez' }],
  consent: true,
  turnstileToken: 'ok',
};

function setup(overrides: Partial<GuestbookDeps> = {}) {
  const sent: OutgoingEmail[] = [];
  const logs: { code: string; status: number }[] = [];
  const keys: string[] = [];
  const deps: GuestbookDeps = {
    ipLimiter: { limit: async () => ({ success: true }) },
    keyLimiter: { limit: async ({ key }) => (keys.push(key), { success: true }) },
    verifyTurnstile: async (token) => token === 'ok',
    sendEmail: async (m) => void sent.push(m),
    config: { to: 'pol@ejemplo.test', from: 'contacto@m.ejemplo.test', siteUrl: SITE, secret: SECRET },
    now: () => NOW,
    log: (e) => logs.push(e),
    ...overrides,
  };
  return { deps, sent, logs, keys };
}

const request = (body: unknown, extra: Partial<GuestbookRequest> = {}): GuestbookRequest => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { method: 'POST', contentType: 'application/json', contentLength: text.length, ip: '203.0.113.7', readBody: async () => text, ...extra };
};

/** Saca el token del enlace del correo de confirmación. */
const tokenOf = (mail: OutgoingEmail) => /confirmar#([A-Za-z0-9_-]+)/.exec(mail.text)![1];

describe('handleSubmit', () => {
  test('una reseña válida manda un único correo de confirmación al visitante, con un enlace a la dirección de la configuración', async () => {
    const { deps, sent } = setup();
    const res = await handleSubmit(request(valid), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, code: 'sent' } });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ana@ejemplo.com');
    expect(sent[0].from).toEqual({ email: 'contacto@m.ejemplo.test', name: PERSONA.osName });
    expect(sent[0].text).toContain(`${SITE}/libro-de-visitas/confirmar#`);
    expect(sent[0].text).toContain('48 horas');
  });

  test('el correo de confirmación no repite el texto de la reseña ni su correo, y el enlace lleva dentro lo enviado', async () => {
    const { deps, sent } = setup();
    await handleSubmit(request(valid), deps);
    expect(sent[0].text).not.toContain(valid.text);
    const opened = await openToken<{ name: string; email: string; links: { url: string }[] }>(tokenOf(sent[0]), SECRET, NOW);
    expect(opened).toMatchObject({ ok: true, data: { kind: 'new', name: 'Ana Pérez', email: 'ana@ejemplo.com' } });
  });

  test('el correo de confirmación no lleva nada de lo que escribe el visitante: sale de nuestro dominio hacia un tercero', async () => {
    const { deps, sent } = setup();
    await handleSubmit(request({ ...valid, name: 'Pol: entra en https://evil.example y pon tu clave', detail: 'Texto del detalle', text: `${valid.text} Visita https://evil.example` }), deps);
    expect(sent[0].text).not.toContain('evil.example');
    expect(sent[0].text).not.toContain('Pol: entra');
    expect(sent[0].text).not.toContain('detalle');
    const urls = sent[0].text.match(/https?:\/\/\S+/g) ?? [];
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/example\.com\/libro-de-visitas\/confirmar#[A-Za-z0-9_-]+$/);
  });

  test('la dirección del enlace sale de la configuración, nunca de la petición (ni de una cabecera Host)', async () => {
    const { deps, sent } = setup({ config: { to: 'pol@ejemplo.test', from: 'c@m.ejemplo.test', siteUrl: 'https://example.com/', secret: SECRET } });
    await handleSubmit(request({ ...valid, siteUrl: 'https://evil.example', host: 'evil.example' }), deps);
    expect(sent[0].text).toContain('https://example.com/libro-de-visitas/confirmar#');
    expect(sent[0].text).not.toContain('evil.example');
    expect(sent[0].text).not.toContain('com//libro');
  });

  test('el orden: método, tipo, tamaño, límite por IP, JSON, validación, Turnstile y configuración; lo barato va primero', async () => {
    const turnstile = vi.fn(async () => true);
    const send = vi.fn();
    const { deps } = setup({ verifyTurnstile: turnstile, sendEmail: send });
    expect((await handleSubmit(request(valid, { method: 'GET' }), deps)).status).toBe(405);
    expect((await handleSubmit(request(valid, { contentType: 'text/plain' }), deps)).status).toBe(415);
    expect((await handleSubmit(request(valid, { contentLength: 100_000 }), deps)).status).toBe(413);
    expect((await handleSubmit(request('{no es json'), deps)).status).toBe(422);
    expect((await handleSubmit(request([1, 2]), deps)).status).toBe(422);
    expect((await handleSubmit(request({}), deps)).body.code).toBe('validation_failed');
    expect(turnstile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test('un cuerpo mayor del permitido se rechaza aunque no declare su tamaño', async () => {
    const { deps, sent } = setup();
    const res = await handleSubmit(request('x'.repeat(20_000), { contentLength: null }), deps);
    expect(res.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  test('si se supera el límite por IP responde 429 antes de leer nada más', async () => {
    const readBody = vi.fn(async () => JSON.stringify(valid));
    const { deps, sent } = setup({ ipLimiter: { limit: async () => ({ success: false }) } });
    const res = await handleSubmit(request(valid, { readBody }), deps);
    expect(res.status).toBe(429);
    expect(readBody).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  test('sin IP todos comparten una clave del limitador', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const { deps } = setup({ ipLimiter: { limit } });
    await handleSubmit(request(valid, { ip: null }), deps);
    expect(limit).toHaveBeenCalledWith({ key: 'sin-ip' });
  });

  test('la validación devuelve el campo que falla y no envía nada', async () => {
    const { deps, sent } = setup();
    const res = await handleSubmit(request({ ...valid, email: 'mal', text: '' }), deps);
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.fields ?? {}).sort()).toEqual(['email', 'text']);
    expect(sent).toHaveLength(0);
  });

  test('sin Turnstile válido responde 403 y no envía nada', async () => {
    const { deps, sent } = setup();
    expect((await handleSubmit(request({ ...valid, turnstileToken: 'falso' }), deps)).status).toBe(403);
    expect((await handleSubmit(request({ ...valid, turnstileToken: undefined }), deps)).status).toBe(403);
    expect((await handleSubmit(request({ ...valid, turnstileToken: 'x'.repeat(3000) }), deps)).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  test('el campo trampa relleno responde 200 sin comprobar nada más ni enviar nada', async () => {
    const turnstile = vi.fn(async () => true);
    const { deps, sent } = setup({ verifyTurnstile: turnstile });
    const res = await handleSubmit(request({ ...valid, website: 'http://spam.example' }), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, code: 'sent' } });
    expect(turnstile).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  test('sin remitente, dirección pública o clave responde 500 y no envía nada', async () => {
    for (const config of [{ from: 'a@b.test', siteUrl: SITE }, { from: 'a@b.test', secret: SECRET }, { siteUrl: SITE, secret: SECRET }, {}]) {
      const { deps, sent } = setup({ config });
      expect((await handleSubmit(request(valid), deps)).status).toBe(500);
      expect(sent).toHaveLength(0);
    }
  });

  test('un mismo correo no recibe más de un enlace por minuto (la clave es una huella, no el correo)', async () => {
    const seen = new Set<string>();
    const { deps, sent } = setup({ keyLimiter: { limit: async ({ key }) => ({ success: !seen.has(key) && !!seen.add(key) }) } });
    expect((await handleSubmit(request(valid), deps)).status).toBe(200);
    expect((await handleSubmit(request({ ...valid, email: 'ANA@ejemplo.com' }), deps)).status).toBe(429);
    expect((await handleSubmit(request({ ...valid, email: 'otra@ejemplo.com' }), deps)).status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  test('la clave del límite por correo es una huella: no lleva el correo en claro', async () => {
    const { deps, keys } = setup();
    await handleSubmit(request(valid), deps);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^email:[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain('ana');
  });

  test('si el envío falla responde 502 sin detalles internos', async () => {
    const { deps } = setup({ sendEmail: async () => { throw new Error('secreto interno de Cloudflare'); } });
    const res = await handleSubmit(request(valid), deps);
    expect(res).toEqual({ status: 502, body: { ok: false, code: 'send_failed' } });
    expect(JSON.stringify(res)).not.toContain('secreto');
  });

  test('los tres tipos piden confirmar lo suyo', async () => {
    const { deps, sent } = setup({ keyLimiter: { limit: async () => ({ success: true }) } });
    await handleSubmit(request({ ...valid, kind: 'edit' }), deps);
    await handleSubmit(request({ kind: 'remove', name: 'Ana', email: 'ana@ejemplo.com', consent: true, turnstileToken: 'ok' }), deps);
    expect(sent[0].text).toContain('editar tu reseña');
    expect(sent[1].text).toContain('retirar tu reseña');
  });

  test('ni el texto ni el correo salen por el registro: solo códigos y estados', async () => {
    const { deps, logs } = setup();
    await handleSubmit(request(valid), deps);
    await handleSubmit(request({ ...valid, email: 'mal' }), deps);
    expect(logs.length).toBeGreaterThan(0);
    const dump = JSON.stringify(logs);
    for (const dato of ['ana@ejemplo.com', 'Pérez', valid.text]) expect(dump).not.toContain(dato);
    for (const l of logs) expect(Object.keys(l).sort()).toEqual(['code', 'status']);
  });
});

describe('handleConfirm', () => {
  async function confirmed(kind: Record<string, unknown> = {}, at = NOW) {
    const first = setup();
    await handleSubmit(request({ ...valid, ...kind }), first.deps);
    return { token: tokenOf(first.sent[0]), at };
  }

  test('un enlace válido manda la reseña a Pol: destino fijo, respuesta a la persona y el archivo ya listo', async () => {
    const { token } = await confirmed();
    const { deps, sent } = setup();
    const res = await handleConfirm(request({ token }), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, code: 'confirmed' } });
    expect(sent).toHaveLength(1);
    const mail = sent[0];
    expect(mail.to).toBe('pol@ejemplo.test');
    expect(mail.replyTo).toBe('ana@ejemplo.com');
    expect(mail.subject).toBe(`[${PERSONA.osName} · Libro de visitas] Nueva reseña: Ana Pérez`);
    expect(mail.text).toContain('ana@ejemplo.com');
    expect(mail.text).toContain(valid.text);
    expect(mail.text).toContain('src/content/guestbook/ana-perez.json');
    const json = JSON.parse(mail.text.slice(mail.text.indexOf('{')));
    expect(json).toEqual({
      name: 'Ana Pérez',
      detail: 'Diseñadora | Madrid',
      relation: 'cliente',
      text: valid.text,
      links: [{ network: 'linkedin', url: 'https://www.linkedin.com/in/ana-perez' }],
      date: '2026-10-11',
    });
    expect(JSON.stringify(json)).not.toContain('ana@ejemplo');
  });

  test('el destino no puede venir de la petición', async () => {
    const { token } = await confirmed();
    const { deps, sent } = setup();
    await handleConfirm(request({ token, to: 'otro@evil.example', replyTo: 'x@evil.example' }), deps);
    expect(sent[0].to).toBe('pol@ejemplo.test');
    expect(sent[0].replyTo).toBe('ana@ejemplo.com');
  });

  test('una edición lo dice y pide comprobar el correo; una retirada no lleva archivo', async () => {
    const edit = setup();
    await handleConfirm(request({ token: (await confirmed({ kind: 'edit' })).token }), edit.deps);
    expect(edit.sent[0].subject).toContain('Petición de edición');
    expect(edit.sent[0].text).toContain('EDITAR');
    expect(edit.sent[0].text).toContain('mismo que el de la original');

    const first = setup();
    await handleSubmit(request({ kind: 'remove', name: 'Ana Pérez', email: 'ana@ejemplo.com', consent: true, turnstileToken: 'ok' }), first.deps);
    const remove = setup();
    await handleConfirm(request({ token: tokenOf(first.sent[0]) }), remove.deps);
    expect(remove.sent[0].subject).toContain('Petición de retirada');
    expect(remove.sent[0].text).toContain('retirar su reseña');
    expect(remove.sent[0].text).not.toContain('Archivo sugerido');
  });

  test('un enlace caducado responde 410 y no manda nada a Pol', async () => {
    const { token } = await confirmed();
    const { deps, sent } = setup({ now: () => NOW + 48 * 3600 * 1000 + 1 });
    expect(await handleConfirm(request({ token }), deps)).toEqual({ status: 410, body: { ok: false, code: 'expired' } });
    expect(sent).toHaveLength(0);
  });

  test('un enlace manipulado, cortado, ajeno o vacío responde 422 y no manda nada', async () => {
    const { token } = await confirmed();
    const flipped = token.slice(0, 30) + (token[30] === 'A' ? 'B' : 'A') + token.slice(31);
    const { deps, sent } = setup();
    for (const bad of [flipped, token.slice(0, -5), 'abc', '', 'x'.repeat(5000), 42, null, undefined]) {
      const res = await handleConfirm(request({ token: bad }), deps);
      expect(res.status, String(bad).slice(0, 12)).toBe(422);
      expect(res.body.code).toBe('invalid_token');
    }
    expect(sent).toHaveLength(0);
  });

  test('un enlace hecho con otra clave no vale', async () => {
    const { token } = await confirmed();
    const { deps, sent } = setup({ config: { to: 'pol@ejemplo.test', from: 'a@b.test', siteUrl: SITE, secret: 'otra-clave-distinta-0123456789012345' } });
    expect((await handleConfirm(request({ token }), deps)).status).toBe(422);
    expect(sent).toHaveLength(0);
  });

  test('confirmar dos veces seguidas no manda dos correos a Pol', async () => {
    const { token } = await confirmed();
    const seen = new Set<string>();
    const { deps, sent } = setup({ keyLimiter: { limit: async ({ key }) => ({ success: !seen.has(key) && !!seen.add(key) }) } });
    expect((await handleConfirm(request({ token }), deps)).status).toBe(200);
    expect((await handleConfirm(request({ token }), deps)).status).toBe(429);
    expect(sent).toHaveLength(1);
  });

  test('método, tipo, tamaño y límite por IP se comprueban igual', async () => {
    const { deps, sent } = setup();
    expect((await handleConfirm(request({}, { method: 'GET' }), deps)).status).toBe(405);
    expect((await handleConfirm(request({}, { contentType: 'text/plain' }), deps)).status).toBe(415);
    expect((await handleConfirm(request({}, { contentLength: 100_000 }), deps)).status).toBe(413);
    const limited = setup({ ipLimiter: { limit: async () => ({ success: false }) } });
    expect((await handleConfirm(request({ token: 'x' }), limited.deps)).status).toBe(429);
    expect(sent).toHaveLength(0);
  });

  test('sin configuración responde 500 y si el envío falla, 502 sin detalles', async () => {
    const { token } = await confirmed();
    expect((await handleConfirm(request({ token }), setup({ config: { from: 'a@b.test', siteUrl: SITE, secret: SECRET } }).deps)).status).toBe(500);
    const res = await handleConfirm(request({ token }), setup({ sendEmail: async () => { throw new Error('interno'); } }).deps);
    expect(res).toEqual({ status: 502, body: { ok: false, code: 'send_failed' } });
  });

  test('el registro no recibe el texto ni el correo', async () => {
    const { token } = await confirmed();
    const { deps, logs } = setup();
    await handleConfirm(request({ token }), deps);
    expect(JSON.stringify(logs)).not.toMatch(/ana@ejemplo|Pérez|Trabajar con Pol/);
  });
});
