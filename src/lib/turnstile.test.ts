import { describe, expect, test, vi } from 'vitest';
import { SITEVERIFY_URL, verifyTurnstile } from './turnstile';

const reply = (data: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => data }));

describe('verifyTurnstile', () => {
  test('envía el secreto, el token y la IP a siteverify por POST', async () => {
    const fetchFake = reply({ success: true });
    await verifyTurnstile('TOKEN', 'SECRETO', '203.0.113.7', fetchFake);
    const [url, init] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const sent = init.body as URLSearchParams;
    expect(sent.get('secret')).toBe('SECRETO');
    expect(sent.get('response')).toBe('TOKEN');
    expect(sent.get('remoteip')).toBe('203.0.113.7');
  });

  test('sin IP no envía remoteip', async () => {
    const fetchFake = reply({ success: true });
    await verifyTurnstile('T', 'S', null, fetchFake);
    expect(((fetchFake.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams).has('remoteip')).toBe(false);
  });

  test('true solo cuando success es exactamente true', async () => {
    expect(await verifyTurnstile('T', 'S', null, reply({ success: true }))).toBe(true);
    expect(await verifyTurnstile('T', 'S', null, reply({ success: false }))).toBe(false);
    expect(await verifyTurnstile('T', 'S', null, reply({ success: 'true' }))).toBe(false);
    expect(await verifyTurnstile('T', 'S', null, reply({}))).toBe(false);
  });

  test('una respuesta no OK, una excepción o un JSON roto dan false', async () => {
    expect(await verifyTurnstile('T', 'S', null, reply({ success: true }, false))).toBe(false);
    expect(await verifyTurnstile('T', 'S', null, vi.fn(async () => { throw new Error('red caída'); }))).toBe(false);
    expect(await verifyTurnstile('T', 'S', null, vi.fn(async () => ({ ok: true, json: async () => { throw new Error('roto'); } })))).toBe(false);
  });
});
