import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { animationsDone, enter, loadGuestbook, stubGuestbookApi, stubTurnstile } from './helpers';

const entries = loadGuestbook();
const isMobile = (name: string) => name.endsWith('movil');

/** Abre el libro como lo haría un visitante: doble clic en el icono del escritorio o toque en la pantalla de inicio. */
async function openBook(page: Page, projectName: string) {
  if (isMobile(projectName)) await page.getByTestId('mobile-icon-guestbook').tap();
  else await page.getByTestId('desktop-icon-guestbook').dblclick();
  const book = page.getByTestId('guestbook');
  await expect(book).toBeVisible();
  return book;
}

async function openForm(page: Page, projectName: string) {
  const book = await openBook(page, projectName);
  await book.getByTestId('guestbook-write').click();
  await expect(book.getByTestId('guestbook-form')).toBeVisible();
  return book;
}

const valid = {
  name: 'Ana Pérez',
  detail: 'Diseñadora | Madrid',
  text: 'Trabajar con Pol fue muy fácil y el resultado superó lo que esperaba.',
  email: 'ana@ejemplo.com',
};

async function fill(book: Locator, values: Partial<typeof valid> & { relation?: string; link?: string }) {
  if (values.name !== undefined) await book.getByTestId('guestbook-name').fill(values.name);
  if (values.detail !== undefined) await book.getByTestId('guestbook-detail').fill(values.detail);
  if (values.relation !== undefined) await book.getByTestId('guestbook-relation').selectOption(values.relation);
  if (values.text !== undefined) await book.getByTestId('guestbook-text').fill(values.text);
  if (values.link !== undefined) await book.getByTestId('guestbook-link-value-0').fill(values.link);
  if (values.email !== undefined) await book.getByTestId('guestbook-email').fill(values.email);
}

const fillAll = (book: Locator) => fill(book, { ...valid, relation: 'cliente', link: 'ana-perez' });

test.describe('S-09 Libro de visitas', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubTurnstile(context);
    await enter(page);
  });

  test('en el móvil, los campos miden al menos 16px: Safari en iPhone no amplía la página al tocarlos', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), 'Solo en el móvil.');
    const book = await openForm(page, testInfo.project.name);
    for (const id of ['guestbook-name', 'guestbook-detail', 'guestbook-text', 'guestbook-email']) {
      const size = await book.getByTestId(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size, id).toBeGreaterThanOrEqual(16);
    }
  });

  test('muestra las reseñas aprobadas, una tarjeta por archivo y en su orden', async ({ page }, testInfo) => {
    const book = await openBook(page, testInfo.project.name);
    await expect(book.getByTestId('guestbook-list')).toBeVisible();
    const ids = await book.locator('li[data-testid^="guestbook-entry-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('guestbook-entry-', '')));
    expect(ids).toEqual(entries.map((e) => e.id));
    for (const e of entries) {
      const card = book.getByTestId(`guestbook-entry-${e.id}`);
      await expect(card.getByTestId('guestbook-entry-name')).toHaveText(e.name);
      await expect(card).toContainText(e.text.slice(0, 40));
      if (e.detail) await expect(card).toContainText(e.detail);
    }
  });

  test('las redes de cada reseña son enlaces seguros: https, pestaña nueva y sin que cuenten para buscadores', async ({ page }, testInfo) => {
    const book = await openBook(page, testInfo.project.name);
    const withLinks = entries.filter((e) => e.links.length > 0);
    expect(withLinks.length).toBeGreaterThan(0);
    for (const e of withLinks) {
      const anchors = book.getByTestId(`guestbook-entry-${e.id}`).getByRole('link');
      await expect(anchors).toHaveCount(e.links.length);
      for (const [i, l] of e.links.entries()) {
        await expect(anchors.nth(i)).toHaveAttribute('href', l.url);
        await expect(anchors.nth(i)).toHaveAttribute('target', '_blank');
        await expect(anchors.nth(i)).toHaveAttribute('rel', /nofollow/);
        await expect(anchors.nth(i)).toHaveAttribute('rel', /noopener/);
        await expect(anchors.nth(i)).toHaveAttribute('rel', /ugc/);
      }
    }
  });

  test('sin reseñas, lo dice e invita a escribir la primera', async ({ page }, testInfo) => {
    await page.route('**/libro-de-visitas.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const book = await openBook(page, testInfo.project.name);
    await expect(book.getByTestId('guestbook-empty')).toContainText('primera');
    await expect(book.getByTestId('guestbook-list')).toHaveCount(0);
  });

  test('un texto con HTML se ve como texto, nunca se interpreta', async ({ page }, testInfo) => {
    const html = '<img src=x onerror="window.__pwned=1"> y <b>negrita</b> <script>window.__pwned=1</script>';
    await page.route('**/libro-de-visitas.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'x', name: '<i>Ana</i>', relation: 'otro', text: html, links: [] }]) }),
    );
    const book = await openBook(page, testInfo.project.name);
    await expect(book.getByTestId('guestbook-entry-x')).toContainText(html);
    await expect(book.getByTestId('guestbook-entry-name')).toHaveText('<i>Ana</i>');
    await expect(book.locator('img, b, i, script')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });

  test('si las reseñas no se pueden cargar, avisa en vez de quedarse vacío', async ({ page }, testInfo) => {
    await page.route('**/libro-de-visitas.json', (route) => route.abort());
    const book = await openBook(page, testInfo.project.name);
    await expect(book.getByTestId('guestbook-error')).toBeVisible();
    await expect(book.getByTestId('guestbook-list')).toHaveCount(0);
  });

  test('los campos vacíos muestran su error junto al campo y no se envía nada', async ({ page }, testInfo) => {
    const requests = await stubGuestbookApi(page);
    const book = await openForm(page, testInfo.project.name);
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-error-name')).toContainText('nombre');
    await expect(book.getByTestId('guestbook-error-relation')).toBeVisible();
    await expect(book.getByTestId('guestbook-error-text')).toContainText('Escribe tu reseña');
    await expect(book.getByTestId('guestbook-error-email')).toContainText('correo');
    await expect(book.getByTestId('guestbook-error-consent')).toBeVisible();
    await expect(book.getByTestId('guestbook-name')).toBeFocused();
    expect(requests).toHaveLength(0);
  });

  test('un error no borra lo escrito, y al corregirlo se envía lo escrito', async ({ page }, testInfo) => {
    const requests = await stubGuestbookApi(page);
    const book = await openForm(page, testInfo.project.name);
    await fillAll(book);
    await book.getByTestId('guestbook-email').fill('ana@@ejemplo');
    await book.getByTestId('guestbook-consent').check();
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-error-email')).toContainText('no parece válido');
    await expect(book.getByTestId('guestbook-name')).toHaveValue(valid.name);
    await expect(book.getByTestId('guestbook-text')).toHaveValue(valid.text);
    expect(requests).toHaveLength(0);

    await book.getByTestId('guestbook-email').fill(valid.email);
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-sent')).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test('el envío manda lo escrito y avisa de que hay que confirmar el correo', async ({ page }, testInfo) => {
    const requests = await stubGuestbookApi(page);
    const book = await openForm(page, testInfo.project.name);
    await fillAll(book);
    await book.getByTestId('guestbook-consent').check();
    await book.getByTestId('guestbook-send').click();
    const sent = book.getByTestId('guestbook-sent');
    await expect(sent).toContainText('correo');
    await expect(sent).toContainText('Confirmar');
    expect(requests).toEqual([
      {
        kind: 'new',
        name: valid.name,
        detail: valid.detail,
        relation: 'cliente',
        text: valid.text,
        email: valid.email,
        links: [{ network: 'linkedin', value: 'ana-perez' }],
        consent: true,
        turnstileToken: expect.stringMatching(/^TOKEN-/) as unknown as string,
        website: '',
      },
    ]);

    await book.getByTestId('guestbook-again').click();
    await expect(book.getByTestId('guestbook-write')).toBeVisible();
    await book.getByTestId('guestbook-write').click();
    await expect(book.getByTestId('guestbook-name')).toHaveValue('');
  });

  test('el contador sigue lo escrito y el texto no pasa del máximo', async ({ page }, testInfo) => {
    const book = await openForm(page, testInfo.project.name);
    await expect(book.getByTestId('guestbook-count')).toHaveText('0 / 600');
    await book.getByTestId('guestbook-text').fill('a'.repeat(50));
    await expect(book.getByTestId('guestbook-count')).toHaveText('50 / 600');
    await book.getByTestId('guestbook-text').fill('a'.repeat(700));
    await expect(book.getByTestId('guestbook-text')).toHaveValue('a'.repeat(600));
  });

  test('las redes: hasta tres, se pueden quitar y una dirección que no es de la red da error', async ({ page }, testInfo) => {
    const requests = await stubGuestbookApi(page);
    const book = await openForm(page, testInfo.project.name);
    await expect(book.getByTestId('guestbook-link-remove-0')).toHaveCount(0);
    await book.getByTestId('guestbook-add-link').click();
    await book.getByTestId('guestbook-add-link').click();
    await expect(book.getByTestId('guestbook-add-link')).toHaveCount(0);
    await book.getByTestId('guestbook-link-remove-2').click();
    await expect(book.getByTestId('guestbook-add-link')).toBeVisible();

    await fill(book, { ...valid, relation: 'otro' });
    await book.getByTestId('guestbook-link-value-0').fill('https://evil.example/in/ana');
    await book.getByTestId('guestbook-consent').check();
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-error-links')).toContainText('no es un perfil válido');
    expect(requests).toHaveLength(0);

    await book.getByTestId('guestbook-link-network-0').selectOption('github');
    await book.getByTestId('guestbook-link-value-0').fill('@ana-perez');
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-sent')).toBeVisible();
    expect(requests[0].links).toEqual([{ network: 'github', value: '@ana-perez' }]);
  });

  test('editar la reseña pide el texto nuevo; retirarla solo pide nombre y correo', async ({ page }, testInfo) => {
    const requests = await stubGuestbookApi(page);
    const book = await openForm(page, testInfo.project.name);
    await book.getByTestId('guestbook-kind').selectOption('edit');
    await expect(book.getByTestId('guestbook-text')).toBeVisible();
    await expect(book.getByText('Escribe de nuevo la reseña con los cambios')).toBeVisible();

    await book.getByTestId('guestbook-kind').selectOption('remove');
    for (const hidden of ['guestbook-text', 'guestbook-relation', 'guestbook-detail', 'guestbook-add-link']) await expect(book.getByTestId(hidden)).toHaveCount(0);
    await fill(book, { name: valid.name, email: valid.email });
    await book.getByTestId('guestbook-consent').check();
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-sent')).toContainText('retirar');
    expect(requests[0]).toMatchObject({ kind: 'remove', name: valid.name, email: valid.email, consent: true });
  });

  test('el servidor puede rechazar un campo y el formulario lo enseña sin perder lo escrito', async ({ page }, testInfo) => {
    await stubGuestbookApi(page, { status: 422, body: { ok: false, code: 'validation_failed', fields: { email: 'Ese correo no parece válido.' } } });
    const book = await openForm(page, testInfo.project.name);
    await fillAll(book);
    await book.getByTestId('guestbook-consent').check();
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-error-email')).toContainText('no parece válido');
    await expect(book.getByTestId('guestbook-text')).toHaveValue(valid.text);
    await expect(book.getByTestId('guestbook-sent')).toHaveCount(0);
  });

  test('si se pasa del límite o falla la verificación, avisa y deja volver a intentarlo', async ({ page }, testInfo) => {
    await stubGuestbookApi(page, { status: 429, body: { ok: false, code: 'rate_limited' } });
    const book = await openForm(page, testInfo.project.name);
    await fillAll(book);
    await book.getByTestId('guestbook-consent').check();
    await book.getByTestId('guestbook-send').click();
    await expect(book.getByTestId('guestbook-banner')).toContainText('Espera un minuto');
    await expect(book.getByTestId('guestbook-send')).toBeEnabled();
    await expect(book.getByTestId('guestbook-email')).toHaveValue(valid.email);
  });

  test('el aviso de privacidad se puede leer y la aceptación es obligatoria', async ({ page }, testInfo) => {
    const book = await openForm(page, testInfo.project.name);
    await book.getByTestId('guestbook-privacy').locator('summary').click();
    await expect(book.getByTestId('guestbook-privacy')).toContainText('Responsable');
    await expect(book.getByTestId('guestbook-privacy')).toContainText('no se publica');
    await expect(book.getByTestId('guestbook-consent')).not.toBeChecked();
  });

  test('el campo trampa no se ve, no entra en el orden del teclado y viaja vacío', async ({ page }, testInfo) => {
    const book = await openForm(page, testInfo.project.name);
    const trap = book.locator('input[name="website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    expect(await trap.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
    const box = await trap.boundingBox();
    expect((box?.x ?? 0) < 0 || (box?.width ?? 0) <= 1).toBe(true);
  });

  test('el formulario se maneja con el teclado de principio a fin', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay teclado.');
    const requests = await stubGuestbookApi(page);
    const book = await openForm(page, testInfo.project.name);
    await book.getByTestId('guestbook-name').focus();
    await page.keyboard.type(valid.name);
    await page.keyboard.press('Tab'); // detalle
    await page.keyboard.press('Tab'); // relación
    await page.keyboard.type('Cl'); // escribir el principio de una opción la elige
    await expect(book.getByTestId('guestbook-relation')).toHaveValue('cliente');
    await page.keyboard.press('Tab');
    await page.keyboard.type(valid.text);
    await book.getByTestId('guestbook-email').focus();
    await page.keyboard.type(valid.email);
    await book.getByTestId('guestbook-consent').focus();
    await page.keyboard.press('Space');
    await book.getByTestId('guestbook-send').focus();
    await page.keyboard.press('Enter');
    await expect(book.getByTestId('guestbook-sent')).toBeVisible();
    expect(requests[0]).toMatchObject({ name: valid.name, email: valid.email, consent: true });
  });

  test('también se abre desde la Terminal y su alias', async ({ page }, testInfo) => {
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
    else await page.getByTestId('dock-item-terminal').click();
    const input = page.getByTestId('terminal-input');
    await expect(input).toBeFocused();
    await input.fill('open libro');
    await input.press('Enter');
    await expect(page.getByTestId('guestbook')).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`la lista y el formulario no tienen problemas de accesibilidad (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      const book = await openBook(page, testInfo.project.name);
      await expect(book.getByTestId('guestbook-list')).toBeVisible();
      await animationsDone(page);
      const list = await new AxeBuilder({ page }).include('[data-testid="guestbook"]').analyze();
      expect(list.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);

      await book.getByTestId('guestbook-write').click();
      await expect(book.getByTestId('guestbook-form')).toBeVisible();
      await book.getByTestId('guestbook-send').click(); // con todos los errores a la vista
      await expect(book.getByTestId('guestbook-error-name')).toBeVisible();
      await animationsDone(page);
      const form = await new AxeBuilder({ page }).include('[data-testid="guestbook"]').analyze();
      expect(form.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});

test.describe('S-09 Página de confirmación', () => {
  const token = 'A'.repeat(60);

  /** Simula POST /api/guestbook/confirm y guarda lo que la página manda. */
  async function stubConfirm(page: Page, status: number, body: Record<string, unknown> = { ok: status === 200 }) {
    const requests: unknown[] = [];
    await page.route('**/api/guestbook/confirm', async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    return requests;
  }

  test('con un enlace válido enseña el botón y no confirma nada hasta que se pulsa', async ({ page }) => {
    const requests = await stubConfirm(page, 200, { ok: true, code: 'confirmed' });
    await page.goto(`/libro-de-visitas/confirmar#${token}`);
    await expect(page.getByTestId('confirm-button')).toBeVisible();
    await page.waitForTimeout(500);
    expect(requests).toHaveLength(0);

    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('confirm-done')).toBeVisible();
    await expect(page.getByTestId('confirm-button')).toBeHidden();
    expect(requests).toEqual([{ token }]);
  });

  test('sin enlace, o con uno cortado o con caracteres raros, dice que no es válido y no ofrece confirmar', async ({ page }) => {
    for (const hash of ['', '#', '#corto', '#<script>alert(1)</script>', `#${'A'.repeat(5000)}`]) {
      await page.goto(`/libro-de-visitas/confirmar${hash}`);
      await expect(page.getByTestId('confirm-invalid'), hash.slice(0, 20)).toBeVisible();
      await expect(page.getByTestId('confirm-button')).toBeHidden();
    }
  });

  for (const [status, testId] of [
    [410, 'confirm-expired'],
    [422, 'confirm-invalid'],
    [429, 'confirm-repeated'],
    [502, 'confirm-error'],
  ] as const) {
    test(`si el servidor responde ${status}, lo explica (${testId})`, async ({ page }) => {
      await stubConfirm(page, status, { ok: false });
      await page.goto(`/libro-de-visitas/confirmar#${token}`);
      await page.getByTestId('confirm-button').click();
      await expect(page.getByTestId(testId)).toBeVisible();
    });
  }

  test('tras un error de red se puede volver a pulsar', async ({ page }) => {
    await page.route('**/api/guestbook/confirm', (route) => route.abort());
    await page.goto(`/libro-de-visitas/confirmar#${token}`);
    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('confirm-error')).toBeVisible();
    await expect(page.getByTestId('confirm-button')).toBeEnabled();
  });

  test('la página no se indexa, no tiene errores de accesibilidad y vuelve a Pol OS', async ({ page }) => {
    await page.goto(`/libro-de-visitas/confirmar#${token}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.getByTestId('confirm-home')).toHaveAttribute('href', '/');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`), scheme).toEqual([]);
    }
  });
});
