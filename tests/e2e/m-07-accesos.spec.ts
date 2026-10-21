import { expect, test } from '@playwright/test';
import { enter } from './helpers';

// GitHub ya no es un enlace: abre su ventana de repositorios (C-01, tests/e2e/c-01-github.spec.ts).
const SHORTCUTS = [
  { id: 'newsletter', url: 'https://example.com/newsletter' },
  { id: 'linkedin', url: 'https://www.linkedin.com/in/tu-perfil/' },
  { id: 'whatsapp', url: 'https://wa.me/34600000000?text=Hola%2C%20te%20escribo%20desde%20tu%20portfolio.' },
];

test.describe('M-07 Accesos directos externos', () => {
  test.beforeEach(async ({ page, context }) => {
    // Los tests no salen a internet: las webs externas se sustituyen por una página vacía.
    for (const host of ['example.com', 'github.com', 'www.linkedin.com', 'wa.me']) {
      await context.route(`https://${host}/**`, (route) => route.fulfill({ status: 200, body: 'ok' }));
    }
    await enter(page);
  });

  test('los accesos externos apuntan a su web y se abren en una pestaña nueva', async ({ page }) => {
    for (const { id, url } of SHORTCUTS) {
      const link = page.getByTestId(`desktop-icon-${id}`);
      await expect(link).toBeVisible();
      expect(new URL((await link.getAttribute('href'))!).href).toBe(url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('cada acceso muestra el icono de su servicio y la imagen carga', async ({ page }) => {
    for (const id of [...SHORTCUTS.map((s) => s.id), 'github']) {
      const img = page.getByTestId(`desktop-icon-${id}`).locator('img');
      await expect(img).toHaveAttribute('src', new RegExp(`^/links/.+\\.png$`));
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), id).toBeGreaterThan(0);
    }
  });

  test('un solo clic selecciona y no abre la web', async ({ page, context }) => {
    let opened = false;
    context.on('page', () => (opened = true));
    await page.getByTestId('desktop-icon-linkedin').click();
    await page.waitForTimeout(500);
    expect(opened).toBe(false);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('doble clic abre la web en una pestaña nueva', async ({ page, context }) => {
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByTestId('desktop-icon-linkedin').dblclick()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe('https://www.linkedin.com/in/tu-perfil/');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('WhatsApp abre una conversación con el número configurado y un primer mensaje que dice de dónde llega', async ({ page, context }) => {
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByTestId('desktop-icon-whatsapp').dblclick()]);
    const url = new URL(tab.url());
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/34600000000');
    expect(url.searchParams.get('text')).toBe('Hola, te escribo desde tu portfolio.');
  });

  test('el icono de WhatsApp es el de la app: casilla verde con el símbolo blanco', async ({ page }) => {
    const img = page.getByTestId('desktop-icon-whatsapp').locator('img');
    await expect(img).toHaveAttribute('src', '/links/whatsapp.png');
    const [r, g, b] = await img.evaluate(async (el) => {
      const image = el as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 8;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0, 8, 8);
      return [...ctx.getImageData(0, 0, 1, 1).data]; // la esquina: el verde de la casilla
    });
    expect(g).toBeGreaterThan(r + 60);
    expect(g).toBeGreaterThan(b + 60);
  });
});
