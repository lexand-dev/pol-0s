import { describe, expect, test } from 'vitest';
import { TOKEN_TTL_MS, fingerprint, openToken, sealToken } from './guestbook-token';

const SECRET = 'una-clave-de-prueba-bastante-larga-0123456789';
const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const data = { kind: 'new', name: 'Ana Pérez', email: 'ana@ejemplo.com', text: 'Una reseña de prueba con acentos: ñ, é, 🙌.' };

describe('sealToken / openToken', () => {
  test('lo que se cifra se recupera igual', async () => {
    const token = await sealToken(data, SECRET, NOW);
    expect(await openToken(token, SECRET, NOW + 1000)).toEqual({ ok: true, data });
  });

  test('es un texto seguro para ir en una dirección y no deja ver la reseña ni el correo', async () => {
    const token = await sealToken(data, SECRET, NOW);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    for (const secreto of ['Ana', 'ejemplo', 'reseña', 'prueba']) expect(token).not.toContain(secreto);
    expect(atob(token.replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('ana@ejemplo.com');
  });

  test('dos tokens de lo mismo no son iguales (cada uno lleva su propio vector)', async () => {
    expect(await sealToken(data, SECRET, NOW)).not.toBe(await sealToken(data, SECRET, NOW));
  });

  test('caduca a las 48 horas: hasta el último momento vale, después no', async () => {
    const token = await sealToken(data, SECRET, NOW);
    expect((await openToken(token, SECRET, NOW + TOKEN_TTL_MS)).ok).toBe(true);
    expect(await openToken(token, SECRET, NOW + TOKEN_TTL_MS + 1)).toEqual({ ok: false, reason: 'expired' });
    expect(TOKEN_TTL_MS).toBe(48 * 3600 * 1000);
  });

  test('un token manipulado, cortado o vacío se rechaza como inválido', async () => {
    const token = await sealToken(data, SECRET, NOW);
    const flipped = token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21);
    for (const bad of [flipped, token.slice(0, -4), token.slice(0, 10), '', 'no es base64!!', `${token}x`, 'A'.repeat(200)]) {
      expect(await openToken(bad, SECRET, NOW), bad.slice(0, 20)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  test('un token cifrado con otra clave se rechaza', async () => {
    const token = await sealToken(data, SECRET, NOW);
    expect(await openToken(token, `${SECRET}-otra`, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('un token caducado y manipulado es inválido, no «caducado»: no se revela nada de un token falso', async () => {
    const token = await sealToken(data, SECRET, NOW);
    const flipped = token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21);
    expect(await openToken(flipped, SECRET, NOW + TOKEN_TTL_MS * 5)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('fingerprint', () => {
  test('es estable, distinto para textos distintos y no contiene el texto', async () => {
    const a = await fingerprint('ana@ejemplo.com');
    expect(a).toBe(await fingerprint('ana@ejemplo.com'));
    expect(a).not.toBe(await fingerprint('bea@ejemplo.com'));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});
