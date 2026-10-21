import { describe, expect, test, vi } from 'vitest';
import { PERSONA } from '../content/persona';
import {
  MAX_BODY_BYTES,
  handleContact,
  type ContactDeps,
  type ContactRequest,
  type OutgoingEmail,
} from './contact-service';

const SECRET_TEXT = 'Texto privado del visitante 9f3a';

const goodBody = {
  from: 'ana@ejemplo.com',
  subject: 'Hola Pol',
  message: SECRET_TEXT,
  turnstileToken: 'token-bueno',
  website: '',
};

function setup(overrides: Partial<ContactDeps> = {}) {
  const sent: OutgoingEmail[] = [];
  const logged: unknown[] = [];
  const deps: ContactDeps = {
    limiter: { limit: vi.fn(async () => ({ success: true })) },
    verifyTurnstile: vi.fn(async () => true),
    sendEmail: vi.fn(async (m: OutgoingEmail) => void sent.push(m)),
    config: { to: 'pol@destino.test', from: 'contacto@m.ejemplo.test' },
    log: (e) => void logged.push(e),
    ...overrides,
  };
  const request = (over: Partial<ContactRequest & { body: unknown }> = {}): ContactRequest => {
    const text = typeof over.body === 'string' ? over.body : JSON.stringify(over.body ?? goodBody);
    return {
      method: 'POST',
      contentType: 'application/json',
      contentLength: text.length,
      ip: '203.0.113.7',
      readBody: async () => text,
      ...over,
    };
  };
  return { deps, sent, logged, request };
}

describe('envío correcto', () => {
  test('responde 200, envía un correo y lo hace una sola vez', async () => {
    const { deps, sent, request } = setup();
    const r = await handleContact(request(), deps);
    expect(r).toEqual({ status: 200, body: { ok: true, code: 'sent' } });
    expect(sent).toHaveLength(1);
  });

  test('el destino sale de la configuración, aunque la petición traiga otro "to"', async () => {
    const { deps, sent, request } = setup();
    await handleContact(request({ body: { ...goodBody, to: 'atacante@malo.test', cc: 'x@y.test', bcc: 'z@y.test' } }), deps);
    expect(sent[0].to).toBe('pol@destino.test');
    expect(JSON.stringify(sent[0])).not.toContain('atacante');
    expect(JSON.stringify(sent[0])).not.toContain('x@y.test');
  });

  test('va como texto plano, con el remitente de la configuración y "responder a" el visitante', async () => {
    const { deps, sent, request } = setup();
    await handleContact(request(), deps);
    const m = sent[0];
    expect(m.from).toEqual({ email: 'contacto@m.ejemplo.test', name: PERSONA.osName });
    expect(m.replyTo).toBe('ana@ejemplo.com');
    expect(m.subject).toBe(`[${PERSONA.osName}] Hola Pol`);
    expect(m.text).toContain(SECRET_TEXT);
    expect(m.text).toContain('ana@ejemplo.com');
    expect(m).not.toHaveProperty('html');
  });

  test('pasa a Turnstile el token y la IP', async () => {
    const { deps, request } = setup();
    await handleContact(request(), deps);
    expect(deps.verifyTurnstile).toHaveBeenCalledWith('token-bueno', '203.0.113.7');
  });
});

describe('peticiones que no pasan el primer filtro', () => {
  test('405 con otro método, sin tocar nada más', async () => {
    const { deps, request } = setup();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect((await handleContact(request({ method }), deps)).status).toBe(405);
    }
    expect(deps.limiter.limit).not.toHaveBeenCalled();
  });

  test('415 si no es JSON', async () => {
    const { deps, request } = setup();
    expect((await handleContact(request({ contentType: 'text/plain' }), deps)).status).toBe(415);
    expect((await handleContact(request({ contentType: null }), deps)).status).toBe(415);
  });

  test('413 si el cuerpo es mayor de 16 KB, por la cabecera o por el contenido real', async () => {
    const { deps, request } = setup();
    expect((await handleContact(request({ contentLength: MAX_BODY_BYTES + 1 }), deps)).status).toBe(413);
    const big = JSON.stringify({ ...goodBody, message: 'a'.repeat(MAX_BODY_BYTES) });
    expect((await handleContact(request({ body: big, contentLength: null }), deps)).status).toBe(413);
  });
});

describe('límite de frecuencia', () => {
  test('con el límite superado responde 429 y no valida, no verifica y no envía', async () => {
    const { deps, sent, request } = setup({ limiter: { limit: vi.fn(async () => ({ success: false })) } });
    const r = await handleContact(request(), deps);
    expect(r).toEqual({ status: 429, body: { ok: false, code: 'rate_limited' } });
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  test('la clave del límite es la IP; sin IP, una clave común', async () => {
    const { deps, request } = setup();
    await handleContact(request(), deps);
    await handleContact(request({ ip: null }), deps);
    expect(deps.limiter.limit).toHaveBeenNthCalledWith(1, { key: '203.0.113.7' });
    expect(deps.limiter.limit).toHaveBeenNthCalledWith(2, { key: 'sin-ip' });
  });
});

describe('validación', () => {
  test('422 con el campo que falla y sin llamar a Turnstile ni al correo', async () => {
    const { deps, sent, request } = setup();
    const r = await handleContact(request({ body: { ...goodBody, from: 'no-es-correo', subject: '' } }), deps);
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('validation_failed');
    expect(Object.keys(r.body.fields ?? {}).sort()).toEqual(['from', 'subject']);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  test('422 si el cuerpo no es JSON o no es un objeto', async () => {
    const { deps, request } = setup();
    for (const body of ['{no es json', '[]', '"texto"', 'null', '42']) {
      const r = await handleContact(request({ body }), deps);
      expect([r.status, r.body.code]).toEqual([422, 'invalid_body']);
    }
  });
});

describe('Turnstile', () => {
  test('403 si no hay token, sin llamar a siteverify', async () => {
    const { deps, sent, request } = setup();
    for (const turnstileToken of [undefined, '', 42, 'a'.repeat(3000)]) {
      const r = await handleContact(request({ body: { ...goodBody, turnstileToken } }), deps);
      expect([r.status, r.body.code]).toEqual([403, 'captcha_failed']);
    }
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  test('403 si Turnstile rechaza el token, y no se envía nada', async () => {
    const { deps, sent, request } = setup({ verifyTurnstile: vi.fn(async () => false) });
    const r = await handleContact(request(), deps);
    expect([r.status, r.body.code]).toEqual([403, 'captcha_failed']);
    expect(sent).toHaveLength(0);
  });
});

describe('campo trampa', () => {
  test('relleno: responde 200 como si hubiera ido bien, pero no envía ni verifica nada', async () => {
    const { deps, sent, request } = setup();
    const r = await handleContact(request({ body: { ...goodBody, website: 'http://spam.test' } }), deps);
    expect(r).toEqual({ status: 200, body: { ok: true, code: 'sent' } });
    expect(sent).toHaveLength(0);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  });
});

describe('fallos del servidor', () => {
  test('502 si falla el correo, sin detalles internos', async () => {
    const { deps, request } = setup({
      sendEmail: vi.fn(async () => {
        throw Object.assign(new Error('E_SENDER_DOMAIN_NOT_AVAILABLE: m.ejemplo.test'), { code: 'E_SENDER' });
      }),
    });
    const r = await handleContact(request(), deps);
    expect(r).toEqual({ status: 502, body: { ok: false, code: 'send_failed' } });
    expect(JSON.stringify(r)).not.toMatch(/E_SENDER|m\.ejemplo/);
  });

  test('500 si falta el destino o el remitente en la configuración', async () => {
    for (const config of [{ from: 'a@b.test' }, { to: 'a@b.test' }, {}]) {
      const { deps, sent, request } = setup({ config });
      const r = await handleContact(request(), deps);
      expect([r.status, r.body.code]).toEqual([500, 'not_configured']);
      expect(sent).toHaveLength(0);
    }
  });
});

describe('privacidad', () => {
  test('nada del mensaje, del correo del visitante ni del destino sale por el registro', async () => {
    const { deps, logged, request } = setup();
    await handleContact(request(), deps);
    await handleContact(request({ body: { ...goodBody, from: 'malo' } }), deps);
    await handleContact(request({ body: { ...goodBody, turnstileToken: '' } }), deps);
    const failing = setup({ sendEmail: vi.fn(async () => { throw new Error(SECRET_TEXT); }) });
    await handleContact(failing.request(), failing.deps);
    const everything = JSON.stringify([...logged, ...failing.logged]);
    expect(everything).not.toContain(SECRET_TEXT);
    expect(everything).not.toContain('ana@ejemplo.com');
    expect(everything).not.toContain('pol@destino.test');
    for (const event of [...logged, ...failing.logged] as object[]) {
      expect(Object.keys(event).sort()).toEqual(['code', 'status']);
    }
  });
});
