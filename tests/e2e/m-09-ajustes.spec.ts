import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, enter, gotoLock } from './helpers';

const html = (page: Page) => page.locator('html');

/** Abre Ajustes desde el dock: en escritorio como ventana, en móvil a pantalla completa. */
async function openSettings(page: Page, projectName: string) {
  if (projectName.endsWith('movil')) await page.getByTestId('mobile-dock-settings').tap();
  else await page.getByTestId('dock-item-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
}

test.describe('M-09 Ajustes de sesión', () => {
  test.beforeEach(async ({ page }) => {
    // El tema del sistema es claro, para que "Automático" sea predecible.
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('el tema y el fondo cambian al momento y se mantienen al volver', async ({ page }, testInfo) => {
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await expect(page.getByTestId('settings-theme-auto')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('settings-wall-atardecer')).toHaveAttribute('aria-checked', 'true');

    const surface = page.getByTestId('settings');
    const lightBg = await surface.evaluate((el) => getComputedStyle(el.closest('section, [role="dialog"]')!).backgroundColor);
    const wallBefore = await page.getByTestId('wallpaper').evaluate((el) => getComputedStyle(el).backgroundImage);

    await page.getByTestId('settings-theme-dark').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    const darkBg = await surface.evaluate((el) => getComputedStyle(el.closest('section, [role="dialog"]')!).backgroundColor);
    expect(darkBg).not.toBe(lightBg);

    await page.getByTestId('settings-wall-mar').click();
    await expect(html(page)).toHaveAttribute('data-wall', 'mar');
    const wallAfter = await page.getByTestId('wallpaper').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(wallAfter).not.toBe(wallBefore);

    // Al volver, las preferencias se aplican ya en la pantalla de acceso, antes de entrar.
    await gotoLock(page);
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect(html(page)).toHaveAttribute('data-wall', 'mar');

    await page.getByTestId('lock-enter').click();
    await openSettings(page, testInfo.project.name);
    await expect(page.getByTestId('settings-theme-dark')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('settings-wall-mar')).toHaveAttribute('aria-checked', 'true');
  });

  test('Ajustes no tiene errores de accesibilidad en claro ni en oscuro', async ({ page }, testInfo) => {
    await enter(page);
    await openSettings(page, testInfo.project.name);
    for (const theme of ['light', 'dark'] as const) {
      await page.getByTestId(`settings-theme-${theme}`).click();
      await expect(html(page)).toHaveAttribute('data-theme', theme);
      await animationsDone(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `tema ${theme}`).toEqual([]);
    }
  });

  test('Automático vuelve a seguir el tema del sistema', async ({ page }, testInfo) => {
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await page.getByTestId('settings-theme-dark').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('settings-theme-auto').click();
    await expect(html(page)).not.toHaveAttribute('data-theme');
  });

  test('con el almacenamiento bloqueado funciona con los valores por defecto y sin errores', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('El almacenamiento está bloqueado', 'SecurityError');
        },
      });
    });

    await enter(page);
    await openSettings(page, testInfo.project.name);
    await expect(page.getByTestId('settings-theme-auto')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('settings-wall-atardecer')).toHaveAttribute('aria-checked', 'true');
    await expect(html(page)).toHaveAttribute('data-wall', 'atardecer');

    await page.getByTestId('settings-theme-dark').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('M-09 Tamaño del texto', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
  });

  /** El tamaño real del título «Tamaño del texto» de Ajustes, que escala con la preferencia. */
  const headingSize = (page: Page) => page.locator('#settings-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  test('por defecto es Normal y cada paso agranda el texto, sin pasarse', async ({ page }, testInfo) => {
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await expect(page.getByTestId('settings-text-normal')).toHaveAttribute('aria-checked', 'true');
    await expect(html(page)).not.toHaveAttribute('data-text');
    const normal = await headingSize(page);

    await page.getByTestId('settings-text-grande').click();
    await expect(html(page)).toHaveAttribute('data-text', 'grande');
    const grande = await headingSize(page);
    await page.getByTestId('settings-text-muy-grande').click();
    await expect(html(page)).toHaveAttribute('data-text', 'muy-grande');
    const muy = await headingSize(page);

    expect(grande).toBeCloseTo(normal * 1.1, 1);
    expect(muy).toBeCloseTo(normal * 1.2, 1);
    expect(muy).toBeGreaterThan(grande);
    expect(grande).toBeGreaterThan(normal);

    await page.getByTestId('settings-text-normal').click();
    await expect(html(page)).not.toHaveAttribute('data-text');
    expect(await headingSize(page)).toBeCloseTo(normal, 1);
  });

  test('el tamaño elegido se mantiene al recargar y se aplica antes de pintar', async ({ page }, testInfo) => {
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await page.getByTestId('settings-text-muy-grande').click();
    await expect(html(page)).toHaveAttribute('data-text', 'muy-grande');

    await page.reload();
    await expect(html(page)).toHaveAttribute('data-text', 'muy-grande');
    const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim());
    expect(scale).toBe('1.2');
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await expect(page.getByTestId('settings-text-muy-grande')).toHaveAttribute('aria-checked', 'true');
  });

  test('un valor raro guardado se ignora y se vuelve al normal', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('polos.prefs', JSON.stringify({ textSize: '9999px; x' })));
    await gotoLock(page);
    await expect(html(page)).not.toHaveAttribute('data-text');
  });

  test('con el almacenamiento bloqueado se puede cambiar durante la visita, sin errores', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('El almacenamiento está bloqueado', 'SecurityError');
        },
      });
    });
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await page.getByTestId('settings-text-grande').click();
    await expect(html(page)).toHaveAttribute('data-text', 'grande');
    expect(errors).toEqual([]);
  });

  test('con el texto más grande, Ajustes sigue sin errores de accesibilidad en claro y oscuro', async ({ page }, testInfo) => {
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await page.getByTestId('settings-text-muy-grande').click();
    for (const theme of ['light', 'dark'] as const) {
      await page.getByTestId(`settings-theme-${theme}`).click();
      await expect(html(page)).toHaveAttribute('data-theme', theme);
      await animationsDone(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `tema ${theme}`).toEqual([]);
    }
  });

  test('en el escritorio, la barra de menú sigue conteniendo su texto con el tamaño más grande', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'La barra de menú es de escritorio');
    await enter(page);
    await openSettings(page, testInfo.project.name);
    await page.getByTestId('settings-text-muy-grande').click();
    const bar = await page.getByTestId('menubar').boundingBox();
    for (const id of ['archivo', 'edicion', 'visualizacion']) {
      const trigger = await page.getByTestId(`menu-trigger-${id}`).boundingBox();
      expect(trigger!.y).toBeGreaterThanOrEqual(bar!.y);
      expect(trigger!.y + trigger!.height).toBeLessThanOrEqual(bar!.y + bar!.height - 1);
    }
  });
});

test.describe('M-09 Conmutador de tema en la barra de menú', () => {
  test('alterna entre claro y oscuro y Ajustes lo refleja', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'La barra de menú solo existe en escritorio');
    await page.emulateMedia({ colorScheme: 'light' });
    await enter(page);
    const toggle = page.getByTestId('menubar-theme');
    await expect(toggle).toHaveAccessibleName('Cambiar a tema oscuro');
    await toggle.click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAccessibleName('Cambiar a tema claro');
    await toggle.click();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');

    await page.getByTestId('menu-trigger-logo').click();
    await page.getByTestId('menu-item-logo-settings').click();
    await expect(page.getByTestId('settings-theme-light')).toHaveAttribute('aria-checked', 'true');
  });
});
