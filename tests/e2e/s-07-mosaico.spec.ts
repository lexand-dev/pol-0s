import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DOCK_SPACE, MENU_H } from '../../src/os/windows/window-manager';
import { animationsDone, enter, nextControlKey } from './helpers';

// Pantalla de 1280 × 800 (la del proyecto "escritorio"): la zona útil va de la barra de menú al espacio del dock.
const USABLE = { y: MENU_H, h: 800 - MENU_H - DOCK_SPACE };

const rect = async (win: Locator) => {
  const b = await win.boundingBox();
  if (!b) throw new Error('La ventana no tiene caja');
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
};
const rectOf = (win: Locator) => () => rect(win);

async function openMail(page: Page) {
  await page.getByTestId('dock-item-mail').click();
  const win = page.getByTestId('window-mail');
  await expect(win).toBeVisible();
  await expect(page.getByTestId('mail')).toBeVisible();
  // La ventana entra con una animación de escala: se mide cuando ya ha terminado.
  await animationsDone(page);
  return win;
}

/** Deja el ratón sobre el botón verde y espera al cuadro de mitades. */
async function openTileMenu(win: Locator) {
  await win.getByTestId('window-maximize').hover();
  const menu = win.getByTestId('tile-menu');
  await expect(menu).toBeVisible();
  return menu;
}

test.describe('S-07 Mosaico de ventanas', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await enter(page);
  });

  test('con el ratón sobre el botón verde aparece el cuadro con sus tres opciones, y se cierra al irse', async ({ page }) => {
    const win = await openMail(page);
    await expect(win.getByTestId('tile-menu')).toHaveCount(0);
    const menu = await openTileMenu(win);
    await expect(menu).toHaveAccessibleName('Organizar ventana');
    await expect(menu.getByRole('menuitemradio', { name: 'Mitad izquierda' })).toBeVisible();
    await expect(menu.getByRole('menuitemradio', { name: 'Mitad derecha' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Ampliar' })).toBeVisible();

    await page.mouse.move(640, 760);
    await expect(menu).toBeHidden();
    await expect(win).toBeVisible();
  });

  test('"Mitad izquierda" y "Mitad derecha" colocan la ventana en su mitad, con el alto útil', async ({ page }) => {
    const win = await openMail(page);
    await (await openTileMenu(win)).getByTestId('tile-left').click();
    await expect.poll(rectOf(win)).toEqual({ x: 0, y: USABLE.y, w: 640, h: USABLE.h });
    await expect(win.getByTestId('tile-menu')).toHaveCount(0);

    await (await openTileMenu(win)).getByTestId('tile-right').click();
    await expect.poll(rectOf(win)).toEqual({ x: 640, y: USABLE.y, w: 640, h: USABLE.h });
  });

  test('dos ventanas, una en cada mitad, se ven a la vez sin solaparse', async ({ page }) => {
    const mail = await openMail(page);
    await page.getByTestId('dock-item-terminal').click();
    const term = page.getByTestId('window-terminal');
    // Primero la de arriba (la Terminal, recién abierta): así su botón verde no queda tapado por la otra.
    await (await openTileMenu(term)).getByTestId('tile-right').click();
    await (await openTileMenu(mail)).getByTestId('tile-left').click();
    await expect.poll(async () => {
      const a = await rect(mail);
      const b = await rect(term);
      return { gap: b.x - (a.x + a.w), aw: a.w, bw: b.w };
    }).toEqual({ gap: 0, aw: 640, bw: 640 });
  });

  test('Ampliar y Restaurar desde el cuadro vuelven al tamaño original, también tras una mitad', async ({ page }) => {
    const win = await openMail(page);
    const before = await rect(win);

    await (await openTileMenu(win)).getByTestId('tile-toggle').click();
    await expect.poll(async () => (await rect(win)).w).toBe(1280);
    const menu = await openTileMenu(win);
    await expect(menu.getByTestId('tile-toggle')).toHaveText('Restaurar');
    await menu.getByTestId('tile-toggle').click();
    await expect.poll(rectOf(win)).toEqual(before);

    await (await openTileMenu(win)).getByTestId('tile-left').click();
    await expect.poll(async () => (await rect(win)).w).toBe(640);
    const tiled = await openTileMenu(win);
    await expect(tiled.getByTestId('tile-left')).toHaveAttribute('aria-checked', 'true');
    await expect(tiled.getByTestId('tile-toggle')).toHaveText('Restaurar');
    await tiled.getByTestId('tile-toggle').click();
    await expect.poll(rectOf(win)).toEqual(before);
  });

  test('un clic en el botón verde sigue ampliando y no abre el cuadro', async ({ page }) => {
    const win = await openMail(page);
    await win.getByTestId('window-maximize').click();
    expect((await rect(win)).w).toBe(1280);
    await page.waitForTimeout(700);
    await expect(win.getByTestId('tile-menu')).toHaveCount(0);
  });

  test('el menú Ventana coloca la ventana activa en una mitad', async ({ page }) => {
    const win = await openMail(page);
    await page.getByTestId('menu-trigger-ventana').click();
    await page.getByTestId('menu-item-ventana-tile-left').click();
    await expect.poll(rectOf(win)).toEqual({ x: 0, y: USABLE.y, w: 640, h: USABLE.h });
    await page.getByTestId('menu-trigger-ventana').click();
    await page.getByTestId('menu-item-ventana-tile-right').click();
    await expect.poll(rectOf(win)).toEqual({ x: 640, y: USABLE.y, w: 640, h: USABLE.h });
  });

  test('con el teclado se llega al cuadro, se recorre con las flechas y Escape no cierra la ventana', async ({ page, browserName }) => {
    const win = await openMail(page);
    await win.getByTestId('window-close').focus();
    await page.keyboard.press(nextControlKey(browserName));
    await page.keyboard.press(nextControlKey(browserName));
    await expect(win.getByTestId('window-maximize')).toBeFocused();
    const menu = win.getByTestId('tile-menu');
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(win).toBeVisible();

    await page.keyboard.press('ArrowDown'); // sin cuadro abierto no hace nada
    await expect(menu).toBeHidden();
    await win.getByTestId('window-close').focus();
    await page.keyboard.press(nextControlKey(browserName));
    await page.keyboard.press(nextControlKey(browserName));
    await expect(menu).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(win.getByTestId('tile-left')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(win.getByTestId('tile-right')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(rectOf(win)).toEqual({ x: 640, y: USABLE.y, w: 640, h: USABLE.h });
    await expect(menu).toHaveCount(0);
  });

  test('una ventana colocada sigue en su mitad tras minimizarla y recuperarla', async ({ page }) => {
    const win = await openMail(page);
    await (await openTileMenu(win)).getByTestId('tile-left').click();
    await expect.poll(async () => (await rect(win)).w).toBe(640);
    await win.getByTestId('window-minimize').click();
    await expect(win).toBeHidden();
    await page.getByTestId('dock-minimized-mail').click();
    await expect(win).toBeVisible();
    // Al recuperarla vuelve a entrar con su animación: se espera a que termine.
    await expect.poll(rectOf(win)).toEqual({ x: 0, y: USABLE.y, w: 640, h: USABLE.h });
  });

  test('al cambiar el tamaño del navegador, la ventana colocada se reajusta a su mitad', async ({ page }) => {
    const win = await openMail(page);
    await (await openTileMenu(win)).getByTestId('tile-right').click();
    await expect.poll(async () => (await rect(win)).x).toBe(640);
    await page.setViewportSize({ width: 1000, height: 700 });
    await expect.poll(rectOf(win)).toEqual({ x: 500, y: USABLE.y, w: 500, h: 700 - MENU_H - DOCK_SPACE });
  });

  test.describe('casos negativos', () => {
    test('arrastrar una ventana colocada la suelta y recupera su tamaño anterior', async ({ page }) => {
      const win = await openMail(page);
      const before = await rect(win);
      await (await openTileMenu(win)).getByTestId('tile-left').click();
      await expect.poll(async () => (await rect(win)).w).toBe(640);

      const bar = await win.getByTestId('window-titlebar').boundingBox();
      if (!bar) throw new Error('Sin barra de título');
      await page.mouse.move(bar.x + 320, bar.y + 19);
      await page.mouse.down();
      await page.mouse.move(bar.x + 420, bar.y + 120, { steps: 5 });
      await page.mouse.up();

      await expect.poll(rectOf(win)).toMatchObject({ w: before.w, h: before.h });
      await expect(win.getByTestId('window-resize')).toBeVisible();
      // Y vuelve a poder ampliarse con el cuadro: ya no está colocada.
      await page.mouse.move(640, 760);
      const menu = await openTileMenu(win);
      await expect(menu.getByTestId('tile-left')).toHaveAttribute('aria-checked', 'false');
      await expect(menu.getByTestId('tile-toggle')).toHaveText('Ampliar');
    });

    test('una ventana colocada no tiene tirador de tamaño', async ({ page }) => {
      const win = await openMail(page);
      await expect(win.getByTestId('window-resize')).toBeVisible();
      await (await openTileMenu(win)).getByTestId('tile-left').click();
      await expect(win.getByTestId('window-resize')).toBeHidden();
    });

    test('si el puntero solo pasa por el botón verde, el cuadro no se abre', async ({ page }) => {
      const win = await openMail(page);
      const zoom = await win.getByTestId('window-maximize').boundingBox();
      if (!zoom) throw new Error('Sin botón verde');
      await page.mouse.move(zoom.x + 6, zoom.y + 6);
      await page.mouse.move(zoom.x + 6, zoom.y + 200);
      await page.waitForTimeout(700);
      await expect(win.getByTestId('tile-menu')).toHaveCount(0);
    });

    test('sin ventanas, las dos entradas del menú Ventana salen desactivadas y no hacen nada', async ({ page }) => {
      await page.getByTestId('menu-trigger-ventana').click();
      for (const id of ['tile-left', 'tile-right']) {
        const entry = page.getByTestId(`menu-item-ventana-${id}`);
        await expect(entry).toHaveAttribute('aria-disabled', 'true');
        await entry.click({ force: true });
      }
      await expect(page.locator('[data-testid^="window-"][role="dialog"]')).toHaveCount(0);
    });

    test('con movimiento reducido, la ventana se coloca sin animación', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const win = await openMail(page);
      await (await openTileMenu(win)).getByTestId('tile-left').click();
      expect(await rect(win)).toEqual({ x: 0, y: USABLE.y, w: 640, h: USABLE.h });
      // La regla global de movimiento reducido deja las transiciones en 0,01 ms.
      const ms = await win.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) * 1000);
      expect(ms).toBeLessThan(1);
    });
  });

  test('el cuadro no tiene errores de accesibilidad en claro ni en oscuro', async ({ page }) => {
    const win = await openMail(page);
    await openTileMenu(win);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await animationsDone(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `tema ${theme}`).toEqual([]);
    }
  });
});
