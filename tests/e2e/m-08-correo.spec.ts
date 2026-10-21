import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';
import { animationsDone, enter, openMail, stubContactApi, stubTurnstile } from './helpers';
import { PERSONA } from '../../src/content/persona';

const fill = async (mail: Locator, values: { from?: string; subject?: string; message?: string }) => {
  if (values.from !== undefined) await mail.getByTestId('mail-from').fill(values.from);
  if (values.subject !== undefined) await mail.getByTestId('mail-subject').fill(values.subject);
  if (values.message !== undefined) await mail.getByTestId('mail-message').fill(values.message);
};
const valid = { from: 'ana@ejemplo.com', subject: 'Hola Pol', message: 'Me gustaría hablar contigo.' };

test.describe('M-08 Correo', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubTurnstile(context);
    await enter(page);
  });

  test('"Para" aparece relleno, bloqueado y sin enseñar ninguna dirección', async ({ page }, testInfo) => {
    const mail = await openMail(page, testInfo.project.name);
    const to = mail.getByTestId('mail-to');
    await expect(to).toContainText(PERSONA.name);
    await expect(to).toHaveAttribute('aria-readonly', 'true');
    await expect(mail.locator('input[type="email"], input[type="text"]:not([name="website"])')).toHaveCount(2); // De y Asunto
    expect(await mail.innerText()).not.toContain('@');
  });

  test('en el móvil, los campos miden al menos 16px: Safari en iPhone no amplía la página al tocarlos', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.endsWith('movil'), 'Solo en el móvil.');
    const mail = await openMail(page, testInfo.project.name);
    for (const id of ['mail-from', 'mail-subject', 'mail-message']) {
      const size = await mail.getByTestId(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size, id).toBeGreaterThanOrEqual(16);
    }
  });

  test('con datos válidos y la verificación resuelta, enviar muestra la confirmación', async ({ page }, testInfo) => {
    const requests = await stubContactApi(page);
    const mail = await openMail(page, testInfo.project.name);
    await expect(mail.getByTestId('mail-captcha')).toContainText('Verificación simulada');
    await fill(mail, valid);
    await mail.getByTestId('mail-send').click();

    await expect(mail.getByTestId('mail-sent')).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ ...valid, website: '' });
    expect(requests[0].turnstileToken).toMatch(/^TOKEN-/);
    // El destino no viaja desde el navegador: el servidor lo pone él.
    expect(Object.keys(requests[0]).sort()).toEqual(['from', 'message', 'subject', 'turnstileToken', 'website']);

    await mail.getByTestId('mail-again').click();
    await expect(mail.getByTestId('mail-from')).toHaveValue('');
    await expect(mail.getByTestId('mail-subject')).toHaveValue('');
    await expect(mail.getByTestId('mail-message')).toHaveValue('');
  });

  test('los campos vacíos muestran su error junto al campo y no se envía nada', async ({ page }, testInfo) => {
    const requests = await stubContactApi(page);
    const mail = await openMail(page, testInfo.project.name);
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-error-from')).toContainText('Escribe tu correo');
    await expect(mail.getByTestId('mail-error-subject')).toContainText('Añade un asunto');
    await expect(mail.getByTestId('mail-error-message')).toContainText('vacío');
    await expect(mail.getByTestId('mail-from')).toBeFocused();
    expect(requests).toHaveLength(0);
  });

  test('un correo con formato inválido da error y, al corregirlo, se envía lo escrito', async ({ page }, testInfo) => {
    const requests = await stubContactApi(page);
    const mail = await openMail(page, testInfo.project.name);
    await fill(mail, { ...valid, from: 'ana@@ejemplo' });
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-error-from')).toContainText('no parece válido');
    await expect(mail.getByTestId('mail-subject')).toHaveValue(valid.subject);
    await expect(mail.getByTestId('mail-message')).toHaveValue(valid.message);
    expect(requests).toHaveLength(0);

    await fill(mail, { from: valid.from });
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-sent')).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  for (const { status, body, text } of [
    { status: 429, body: { ok: false, code: 'rate_limited' }, text: 'demasiados mensajes' },
    { status: 403, body: { ok: false, code: 'captcha_failed' }, text: 'verificar que eres una persona' },
    { status: 502, body: { ok: false, code: 'send_failed' }, text: 'No se ha podido enviar' },
  ]) {
    test(`si el servidor responde ${status}, se ve un mensaje claro y no se pierde lo escrito`, async ({ page }, testInfo) => {
      const requests = await stubContactApi(page, { status, body });
      const mail = await openMail(page, testInfo.project.name);
      await fill(mail, valid);
      await mail.getByTestId('mail-send').click();

      await expect(mail.getByTestId('mail-banner')).toContainText(text);
      await expect(mail.getByTestId('mail-sent')).toHaveCount(0);
      await expect(mail.getByTestId('mail-from')).toHaveValue(valid.from);
      await expect(mail.getByTestId('mail-message')).toHaveValue(valid.message);
      await expect(mail.getByTestId('mail-send')).toBeEnabled();

      // El token solo vale una vez: el siguiente intento lleva uno nuevo.
      await page.waitForTimeout(100);
      await mail.getByTestId('mail-send').click();
      await expect.poll(() => requests.length).toBe(2);
      expect(requests[1].turnstileToken).not.toBe(requests[0].turnstileToken);
    });
  }

  test('un 422 del servidor se muestra junto al campo que falla', async ({ page }, testInfo) => {
    await stubContactApi(page, {
      status: 422,
      body: { ok: false, code: 'validation_failed', fields: { subject: 'El asunto admite hasta 150 caracteres.' } },
    });
    const mail = await openMail(page, testInfo.project.name);
    await fill(mail, valid);
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-error-subject')).toContainText('hasta 150');
    await expect(mail.getByTestId('mail-from')).toHaveValue(valid.from);
  });

  test('si no hay red, avisa y deja reintentar', async ({ page }, testInfo) => {
    await page.route('**/api/contact', (route) => route.abort('connectionfailed'));
    const mail = await openMail(page, testInfo.project.name);
    await fill(mail, valid);
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-banner')).toContainText('No se ha podido enviar');
    await expect(mail.getByTestId('mail-message')).toHaveValue(valid.message);
  });

  test('el campo trampa no se puede alcanzar con el teclado y viaja vacío', async ({ page }, testInfo) => {
    const requests = await stubContactApi(page);
    const mail = await openMail(page, testInfo.project.name);
    const trap = mail.locator('input[name="website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(trap).toHaveAttribute('autocomplete', 'off');
    await fill(mail, valid);
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-sent')).toBeVisible();
    expect(requests[0].website).toBe('');
  });

  test('si la verificación anti-bots no carga, lo dice y no deja enviar', async ({ page, context }, testInfo) => {
    await context.unroute(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
    await context.route(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, (route) => route.abort('blockedbyclient'));
    const requests = await stubContactApi(page);
    const mail = await openMail(page, testInfo.project.name);
    await expect(mail.getByTestId('mail-captcha-failed')).toContainText('No se ha podido cargar la verificación');
    await fill(mail, valid);
    await expect(mail.getByTestId('mail-send')).toBeDisabled();
    expect(requests).toHaveLength(0);
  });

  test('no tiene errores de accesibilidad, ni con errores a la vista', async ({ page }, testInfo) => {
    const mail = await openMail(page, testInfo.project.name);
    await expect(mail.getByTestId('mail-captcha')).toContainText('Verificación simulada');
    await mail.getByTestId('mail-send').click();
    await expect(mail.getByTestId('mail-error-from')).toBeVisible();
    await animationsDone(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
