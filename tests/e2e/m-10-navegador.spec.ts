import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, enter, loadProjects, stubExternalSites } from './helpers';
import { PERSONA } from '../../src/content/persona';

const projects = loadProjects();
const urls = new Set(projects.map((p) => p.url));
const embeddable = projects.filter((p) => p.embeddable);
const blocked = projects.find((p) => !p.embeddable)!;

/** Abre el Navegador desde el dock y devuelve su contenedor. */
async function openBrowser(page: Page, projectName: string) {
  if (projectName.endsWith('movil')) await page.getByTestId('mobile-dock-browser').tap();
  else await page.getByTestId('dock-item-browser').click();
  const browser = page.getByTestId('browser');
  await expect(browser).toBeVisible();
  return browser;
}

test.describe('M-10 Navegador con favoritos de proyectos', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubExternalSites(context);
    await enter(page);
  });

  test('abierto desde el dock muestra Favoritos con todos los proyectos', async ({ page }, testInfo) => {
    const browser = await openBrowser(page, testInfo.project.name);
    await expect(browser.getByTestId('browser-start')).toBeVisible();
    await expect(browser.getByTestId('browser-address')).toContainText('Favoritos');
    const favs = browser.locator('[data-testid^="browser-fav-"]');
    await expect(favs).toHaveCount(projects.length);
    for (const [i, p] of projects.entries()) await expect(favs.nth(i)).toHaveAccessibleName(p.name);
    // Solo el icono y el nombre, como los Favoritos de Safari: el nombre accesible es el nombre, sin descripción
    // ni etiquetas (la inicial del icono es decorativa y no cuenta).
    for (const p of projects) await expect(browser.getByTestId(`browser-tile-${p.id}`)).toHaveAccessibleName(p.name);
  });

  test('cada favorito carga su proyecto, y el iframe solo apunta a proyectos', async ({ page }, testInfo) => {
    const browser = await openBrowser(page, testInfo.project.name);
    for (const p of projects) {
      await browser.getByTestId(`browser-fav-${p.id}`).click();
      await expect(browser.getByTestId(`browser-fav-${p.id}`)).toHaveAttribute('aria-pressed', 'true');
      await expect(browser.getByTestId('browser-address')).toContainText(p.domain);
      if (p.embeddable) {
        const frame = browser.getByTestId('browser-frame');
        await expect(frame).toHaveAttribute('src', p.url);
        await expect(frame).toHaveAttribute('sandbox', /allow-scripts/);
        // Una página del mismo origen nunca recibe allow-same-origin: no podría salir del sandbox.
        if (p.url.startsWith('/')) await expect(frame).not.toHaveAttribute('sandbox', /allow-same-origin/);
      } else {
        await expect(browser.getByTestId('browser-blocked')).toBeVisible();
      }
      const frames = browser.getByTestId('browser-frame');
      if ((await frames.count()) > 0) expect(urls.has((await frames.getAttribute('src')) ?? '')).toBe(true);
    }
  });

  test('la página cargada se ve dentro de la ventana', async ({ page }, testInfo) => {
    const local = embeddable.find((p) => p.url.startsWith('/'));
    test.skip(!local, 'Hace falta un proyecto con página local');
    const browser = await openBrowser(page, testInfo.project.name);
    await browser.getByTestId(`browser-fav-${local!.id}`).click();
    await expect(page.frameLocator('[data-testid="browser-frame"]').locator('h1')).toBeVisible();
    await expect(browser.getByTestId('browser-loading')).toHaveCount(0);
  });

  test('atrás, adelante y Favoritos recorren lo visitado', async ({ page }, testInfo) => {
    test.skip(embeddable.length < 2, 'Hacen falta dos proyectos incrustables');
    const [a, b] = embeddable;
    const browser = await openBrowser(page, testInfo.project.name);
    await expect(browser.getByTestId('browser-back')).toBeDisabled();
    await browser.getByTestId(`browser-fav-${a.id}`).click();
    await browser.getByTestId(`browser-fav-${b.id}`).click();
    await expect(browser.getByTestId('browser-frame')).toHaveAttribute('src', b.url);

    await browser.getByTestId('browser-back').click();
    await expect(browser.getByTestId('browser-frame')).toHaveAttribute('src', a.url);
    await browser.getByTestId('browser-forward').click();
    await expect(browser.getByTestId('browser-frame')).toHaveAttribute('src', b.url);
    await expect(browser.getByTestId('browser-forward')).toBeDisabled();

    await browser.getByTestId('browser-home').click();
    await expect(browser.getByTestId('browser-start')).toBeVisible();
    await browser.getByTestId('browser-back').click();
    await expect(browser.getByTestId('browser-frame')).toHaveAttribute('src', b.url);
  });

  test('"Abrir en pestaña nueva" abre la URL del proyecto', async ({ page, context }, testInfo) => {
    const p = embeddable[0];
    const browser = await openBrowser(page, testInfo.project.name);
    await browser.getByTestId(`browser-fav-${p.id}`).click();
    const button = browser.getByTestId('browser-open-external');
    await expect(button).toHaveAttribute('href', p.url);
    await expect(button).toHaveAttribute('target', '_blank');
    const [tab] = await Promise.all([context.waitForEvent('page'), button.click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe(new URL(p.url, page.url()).href);
  });

  test('un sitio no incrustable muestra el aviso con su botón para abrirlo fuera', async ({ page }, testInfo) => {
    const browser = await openBrowser(page, testInfo.project.name);
    await browser.getByTestId(`browser-fav-${blocked.id}`).click();
    const notice = browser.getByTestId('browser-blocked');
    await expect(notice).toContainText(`no se puede abrir dentro de ${PERSONA.osName}`);
    const open = notice.getByTestId('browser-blocked-open');
    await expect(open).toHaveText(/Abrir en pestaña nueva/);
    await expect(open).toHaveAttribute('href', blocked.url);
    await expect(open).toHaveAttribute('target', '_blank');
    await expect(browser.getByTestId('browser-frame')).toHaveCount(0);
  });

  test('Favoritos y el aviso de sitio no incrustable no tienen errores de accesibilidad', async ({ page }, testInfo) => {
    const browser = await openBrowser(page, testInfo.project.name);
    await animationsDone(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await browser.getByTestId(`browser-fav-${blocked.id}`).click();
    await expect(browser.getByTestId('browser-blocked')).toBeVisible();
    await animationsDone(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('no hay forma de escribir una dirección', async ({ page }, testInfo) => {
    const browser = await openBrowser(page, testInfo.project.name);
    await expect(browser.locator('input, textarea, [contenteditable="true"]')).toHaveCount(0);
  });
});
