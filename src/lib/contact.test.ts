import { describe, expect, test } from 'vitest';
import { LIMITS, validateContact } from './contact';

const valid = { from: 'ana@ejemplo.com', subject: 'Hola', message: 'Quería preguntarte algo.' };
const errorsOf = (input: unknown) => {
  const r = validateContact(input);
  return r.ok ? {} : r.errors;
};

describe('validateContact', () => {
  test('acepta un mensaje correcto y recorta los espacios', () => {
    const r = validateContact({ from: '  ana@ejemplo.com ', subject: ' Hola ', message: ' Texto ' });
    expect(r).toEqual({ ok: true, value: { from: 'ana@ejemplo.com', subject: 'Hola', message: 'Texto' } });
  });

  test('los campos vacíos o solo con espacios dan su error', () => {
    expect(Object.keys(errorsOf({ from: '', subject: '   ', message: '' })).sort()).toEqual(['from', 'message', 'subject']);
  });

  test.each(['sin-arroba', 'a@b', 'a@@b.com', 'a b@c.com', '@c.com', 'a@.com', 'a@c.c'])(
    'rechaza el correo inválido %s',
    (from) => {
      expect(errorsOf({ ...valid, from }).from).toMatch(/válido/);
    },
  );

  test.each(['ana@ejemplo.com', 'ana.lopez+web@sub.ejemplo.co', 'a_b-c@dominio.es'])('acepta el correo %s', (from) => {
    expect(validateContact({ ...valid, from }).ok).toBe(true);
  });

  test('rechaza saltos de línea en el correo y en el asunto (inyección de cabeceras)', () => {
    expect(errorsOf({ ...valid, from: 'ana@ejemplo.com\r\nBcc: otro@x.com' }).from).toBeDefined();
    expect(errorsOf({ ...valid, subject: 'Hola\nBcc: otro@x.com' }).subject).toMatch(/una sola línea/);
  });

  test('el mensaje sí puede tener varias líneas', () => {
    expect(validateContact({ ...valid, message: 'Línea 1\nLínea 2' }).ok).toBe(true);
  });

  test('respeta los límites exactos de longitud', () => {
    const email = (n: number) => `${'a'.repeat(n - '@ejemplo.com'.length)}@ejemplo.com`;
    expect(validateContact({ ...valid, from: email(LIMITS.email) }).ok).toBe(true);
    expect(errorsOf({ ...valid, from: email(LIMITS.email + 1) }).from).toMatch(/largo/);
    expect(validateContact({ ...valid, subject: 'a'.repeat(LIMITS.subject) }).ok).toBe(true);
    expect(errorsOf({ ...valid, subject: 'a'.repeat(LIMITS.subject + 1) }).subject).toMatch(/150/);
    expect(validateContact({ ...valid, message: 'a'.repeat(LIMITS.message) }).ok).toBe(true);
    expect(errorsOf({ ...valid, message: 'a'.repeat(LIMITS.message + 1) }).message).toMatch(/caracteres/);
  });

  test.each([null, undefined, 'texto', 42, [], { from: 1, subject: {}, message: [] }])('no se rompe con %j', (input) => {
    expect(Object.keys(errorsOf(input)).sort()).toEqual(['from', 'message', 'subject']);
  });
});
