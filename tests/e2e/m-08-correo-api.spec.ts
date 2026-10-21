import { expect, test } from '@playwright/test';

/**
 * El endpoint real, solo por las ramas que no llaman a servicios externos: nada de esto envía un
 * correo ni contacta con Turnstile. Cada prueba usa su propia IP (cabecera que Cloudflare fija en
 * el borde) para que el límite de envíos de unas no afecte a otras.
 */
test.describe('M-08 Endpoint de contacto', () => {
  test.skip(({ isMobile }) => isMobile, 'El endpoint no depende del tamaño de pantalla');

  // Una IP distinta por petición, sin que dos coincidan: el límite es de 3 envíos por minuto y, con IPs al azar entre
  // 250, de vez en cuando dos pruebas caían en la misma y una recibía un 429 de más. La base es aleatoria por
  // ejecución porque el limitador del servidor de desarrollo conserva su estado entre ejecuciones seguidas; dentro de
  // ella, el proceso de test y un contador hacen única cada IP.
  const runBase = 1 + Math.floor(Math.random() * 250);
  let counter = 0;
  const randomIp = () => `203.${runBase}.${1 + test.info().parallelIndex}.${1 + (counter++ % 250)}`;
  const post = (request: import('@playwright/test').APIRequestContext, data: unknown, ip = randomIp()) =>
    request.post('/api/contact', { data, headers: { 'cf-connecting-ip': ip } });
  const valid = { from: 'ana@ejemplo.com', subject: 'Hola', message: 'Texto', turnstileToken: 'sin-validar' };

  test('un GET no está permitido y avisa de qué método vale', async ({ request }) => {
    const res = await request.get('/api/contact', { headers: { 'cf-connecting-ip': randomIp() } });
    expect(res.status()).toBe(405);
    expect(res.headers()['allow']).toBe('POST');
    expect((await res.json()).code).toBe('method_not_allowed');
  });

  test('un cuerpo que no es JSON da 415', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: 'hola',
      headers: { 'content-type': 'text/plain', 'cf-connecting-ip': randomIp() },
    });
    expect(res.status()).toBe(415);
  });

  test('campos vacíos o inválidos dan 422 con el campo que falla', async ({ request }) => {
    const empty = await post(request, {});
    expect(empty.status()).toBe(422);
    expect(Object.keys((await empty.json()).fields).sort()).toEqual(['from', 'message', 'subject']);

    const badEmail = await post(request, { ...valid, from: 'no-es-correo' });
    expect(Object.keys((await badEmail.json()).fields)).toEqual(['from']);

    const injection = await post(request, { ...valid, subject: 'Hola\r\nBcc: otro@x.com' });
    expect(Object.keys((await injection.json()).fields)).toEqual(['subject']);

    const long = await post(request, { ...valid, message: 'a'.repeat(5001) });
    expect(Object.keys((await long.json()).fields)).toEqual(['message']);
  });

  test('un JSON roto o que no es un objeto da 422', async ({ request }) => {
    for (const data of ['{no es json', '[1,2]']) {
      const res = await request.post('/api/contact', {
        data,
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': randomIp() },
      });
      expect(res.status()).toBe(422);
      expect((await res.json()).code).toBe('invalid_body');
    }
  });

  test('sin token de Turnstile da 403 y no envía nada', async ({ request }) => {
    const { turnstileToken: _omit, ...withoutToken } = valid;
    const res = await post(request, withoutToken);
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ ok: false, code: 'captcha_failed' });
  });

  test('un cuerpo de más de 16 KB da 413', async ({ request }) => {
    const res = await post(request, { ...valid, message: 'a'.repeat(20_000) });
    expect(res.status()).toBe(413);
  });

  test('el campo trampa relleno responde 200 sin comprobar nada más', async ({ request }) => {
    const res = await post(request, { ...valid, website: 'http://spam.test' });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, code: 'sent' });
  });

  test('a partir del cuarto envío en un minuto desde la misma IP da 429', async ({ request }) => {
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await post(request, {}, ip)).status());
    expect(statuses).toEqual([422, 422, 422, 429, 429]);
    // Otra IP no queda afectada.
    expect((await post(request, {}, randomIp())).status()).toBe(422);
  });

  test('no devuelve detalles internos en ninguna respuesta de error', async ({ request }) => {
    for (const data of [{}, { ...valid, message: '' }, 'roto']) {
      const res = await request.post('/api/contact', {
        data,
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': randomIp() },
      });
      const text = await res.text();
      expect(text).not.toMatch(/stack|at \w+ \(|node_modules|\/Volumes|CONTACT_TO|TURNSTILE_SECRET/i);
    }
  });
});
