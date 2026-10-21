import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Los endpoints reales del Libro de visitas, solo por las ramas que no envían correo ni dependen de la clave secreta: nada de
 * esto manda un mensaje. Cada prueba usa su propia IP (cabecera que Cloudflare fija en el borde) para que el límite de unas no
 * afecte a otras.
 */
test.describe('S-09 Endpoints del Libro de visitas', () => {
  test.skip(({ isMobile }) => isMobile, 'Los endpoints no dependen del tamaño de pantalla');

  // Una IP distinta por petición. La base es aleatoria por ejecución porque el limitador del servidor de desarrollo conserva su
  // estado entre ejecuciones seguidas; dentro de ella, el proceso de test y un contador hacen única cada IP.
  const runBase = 1 + Math.floor(Math.random() * 250);
  let counter = 0;
  const randomIp = () => `198.${runBase}.${1 + test.info().parallelIndex}.${1 + (counter++ % 250)}`;
  const post = (request: APIRequestContext, path: string, data: unknown, ip = randomIp()) =>
    request.post(path, { data, headers: { 'cf-connecting-ip': ip } });

  const SUBMIT = '/api/guestbook';
  const CONFIRM = '/api/guestbook/confirm';

  for (const path of [SUBMIT, CONFIRM]) {
    test(`${path}: un GET no está permitido y avisa de qué método vale`, async ({ request }) => {
      const res = await request.get(path, { headers: { 'cf-connecting-ip': randomIp() } });
      expect(res.status()).toBe(405);
      expect(res.headers()['allow']).toBe('POST');
      expect((await res.json()).code).toBe('method_not_allowed');
    });

    test(`${path}: un cuerpo que no es JSON da 415`, async ({ request }) => {
      const res = await request.post(path, { data: 'hola', headers: { 'content-type': 'text/plain', 'cf-connecting-ip': randomIp() } });
      expect(res.status()).toBe(415);
    });

    test(`${path}: un cuerpo de más de 16 KB da 413`, async ({ request }) => {
      const res = await post(request, path, { text: 'x'.repeat(17 * 1024) });
      expect(res.status()).toBe(413);
    });

    test(`${path}: un JSON roto o que no es un objeto da 422`, async ({ request }) => {
      for (const data of ['{no es json', '[1,2,3]', '"texto"']) {
        const res = await request.post(path, { data, headers: { 'content-type': 'application/json', 'cf-connecting-ip': randomIp() } });
        expect(res.status(), data).toBe(422);
        expect((await res.json()).code).toBe('invalid_body');
      }
    });

    test(`${path}: las respuestas llevan las cabeceras de seguridad y no se guardan en caché`, async ({ request }) => {
      const res = await post(request, path, {});
      const h = res.headers();
      expect(h['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('no-referrer');
      expect(h['cache-control']).toBe('no-store');
    });
  }

  test('enviar con campos vacíos da 422 con cada campo que falla', async ({ request }) => {
    const res = await post(request, SUBMIT, {});
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('validation_failed');
    expect(Object.keys(body.fields).sort()).toEqual(['consent', 'email', 'kind', 'name', 'relation', 'text']);
  });

  test('una red con una dirección ajena, o HTML en el nombre, se rechazan en el servidor aunque el formulario lo permitiera', async ({ request }) => {
    const base = { kind: 'new', name: 'Ana', relation: 'otro', text: 'Una reseña de prueba de más de veinte caracteres.', email: 'ana@ejemplo.com', consent: true, turnstileToken: 'x' };
    const res = await post(request, SUBMIT, { ...base, links: [{ network: 'linkedin', value: 'https://evil.example/in/ana' }] });
    expect(res.status()).toBe(422);
    expect(Object.keys((await res.json()).fields)).toEqual(['links']);
    const noLine = await post(request, SUBMIT, { ...base, name: 'Ana\nBcc: otro@evil.example' });
    expect(noLine.status()).toBe(422);
    expect(Object.keys((await noLine.json()).fields)).toEqual(['name']);
  });

  test('el campo trampa relleno responde 200 sin comprobar nada más', async ({ request }) => {
    const res = await post(request, SUBMIT, { website: 'http://spam.example' });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, code: 'sent' });
  });

  test('confirmar sin enlace, o con uno que no es texto, da 422', async ({ request }) => {
    for (const data of [{}, { token: '' }, { token: 42 }, { token: null }, { token: 'x'.repeat(5000) }]) {
      const res = await post(request, CONFIRM, data);
      expect(res.status(), JSON.stringify(data).slice(0, 30)).toBe(422);
      expect((await res.json()).code).toBe('invalid_token');
    }
  });

  test('a partir de la sexta petición en un minuto desde la misma IP da 429, en los dos pasos', async ({ request }) => {
    for (const path of [SUBMIT, CONFIRM]) {
      const ip = randomIp();
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) statuses.push((await post(request, path, {}, ip)).status());
      expect(statuses.slice(0, 5).every((s) => s === 422), `${path}: ${statuses}`).toBe(true);
      expect(statuses[5], path).toBe(429);
    }
  });

  test('las respuestas de error no enseñan detalles internos', async ({ request }) => {
    for (const [path, data] of [[SUBMIT, {}], [SUBMIT, { name: 'x' }], [CONFIRM, {}]] as const) {
      const body = await (await post(request, path, data)).text();
      expect(body).not.toMatch(/stack|at \w+ \(|node_modules|secret|GUESTBOOK|CONTACT_TO|TURNSTILE/i);
    }
  });

  test('con la configuración del servidor, un enlace inventado da 422 y sin ella lo dice (500): nunca manda nada', async ({ request }) => {
    const res = await post(request, CONFIRM, { token: 'A'.repeat(80) });
    const { code } = await res.json();
    if (code === 'not_configured') {
      expect(res.status()).toBe(500);
      test.info().annotations.push({ type: 'aviso', description: 'Falta GUESTBOOK_SECRET en .dev.vars: no se ha podido probar un enlace inventado.' });
    } else {
      expect(res.status()).toBe(422);
      expect(code).toBe('invalid_token');
    }
  });
});
