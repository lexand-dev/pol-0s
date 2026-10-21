import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, enter, loadProjects, stubExternalSites, stubTurnstile } from './helpers';

const projects = loadProjects();
const embeddable = projects.find((p) => p.embeddable)!;

const trigger = (page: Page, id: string) => page.getByTestId(`menu-trigger-${id}`);
const menu = (page: Page, id: string) => page.getByTestId(`menu-${id}`);
const item = (page: Page, menuId: string, id: string) => page.getByTestId(`menu-item-${menuId}-${id}`);

/** Abre un menú con un clic y devuelve la entrada pedida. */
async function pick(page: Page, menuId: string, id: string) {
  await trigger(page, menuId).click();
  await expect(menu(page, menuId)).toBeVisible();
  return item(page, menuId, id);
}

const openWindow = async (page: Page, testId: string) => {
  await page.getByTestId(testId).dblclick();
};

test.describe('S-05 Menús de la barra de menú', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubExternalSites(context);
    await stubTurnstile(context);
    await page.emulateMedia({ colorScheme: 'light' });
    await enter(page);
  });

  test('los seis menús se abren con un clic, se cierran con otro y muestran sus acciones', async ({ page }) => {
    for (const id of ['logo', 'archivo', 'edicion', 'visualizacion', 'ventana', 'ayuda']) {
      await trigger(page, id).click();
      await expect(menu(page, id)).toBeVisible();
      await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'true');
      expect(await menu(page, id).locator('[role^="menuitem"]').count(), id).toBeGreaterThan(2);
      await trigger(page, id).click();
      await expect(menu(page, id)).toHaveCount(0);
    }
  });

  test('con un menú abierto, pasar el ratón por otro lo abre', async ({ page }) => {
    await trigger(page, 'archivo').click();
    await trigger(page, 'ventana').hover();
    await expect(menu(page, 'ventana')).toBeVisible();
    await expect(menu(page, 'archivo')).toHaveCount(0);
  });

  test('con un menú abierto, hacer clic en otro título lo deja abierto, y otro clic lo cierra', async ({ page }) => {
    await trigger(page, 'archivo').click();
    await trigger(page, 'edicion').click(); // el ratón pasa por encima (lo abre) y después hace clic
    await expect(menu(page, 'edicion')).toBeVisible();
    await expect(menu(page, 'archivo')).toHaveCount(0);
    await trigger(page, 'edicion').click();
    await expect(menu(page, 'edicion')).toHaveCount(0);
  });

  test('sin ningún menú abierto, pasar el ratón no abre nada', async ({ page }) => {
    await trigger(page, 'archivo').hover();
    await expect(menu(page, 'archivo')).toHaveCount(0);
  });

  test('un clic fuera cierra el menú sin ejecutar nada', async ({ page }) => {
    await trigger(page, 'archivo').click();
    await page.mouse.click(400, 500);
    await expect(menu(page, 'archivo')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Escape cierra el menú y no la ventana que hay debajo', async ({ page }) => {
    await openWindow(page, 'desktop-icon-about');
    await expect(page.getByTestId('window-about')).toBeVisible();
    await trigger(page, 'archivo').click();
    await page.keyboard.press('Escape');
    await expect(menu(page, 'archivo')).toHaveCount(0);
    await expect(page.getByTestId('window-about')).toBeVisible();
    await page.keyboard.press('Escape'); // ya sin menú, sí cierra la ventana
    await expect(page.getByTestId('window-about')).toHaveCount(0);
  });

  test.describe('Archivo', () => {
    test('"Nuevo mensaje" abre Correo', async ({ page }) => {
      await (await pick(page, 'archivo', 'new-message')).click();
      await expect(page.getByTestId('window-mail')).toBeVisible();
      await expect(menu(page, 'archivo')).toHaveCount(0);
    });

    test('abrir un proyecto muestra su detalle en Proyectos', async ({ page }) => {
      await (await pick(page, 'archivo', `open-project-${embeddable.id}`)).click();
      await expect(page.getByTestId('window-projects').getByTestId('project-name')).toHaveText(embeddable.name);
    });

    test('"Ver todos los proyectos" abre la vista general', async ({ page }) => {
      await (await pick(page, 'archivo', 'open-projects')).click();
      await expect(page.getByTestId('window-projects').getByTestId('projects')).toBeVisible();
    });

    test('"Mi CV" abre el CV', async ({ page }) => {
      await (await pick(page, 'archivo', 'about-me')).click();
      await expect(page.getByTestId('window-about')).toBeVisible();
    });

    test('hay una entrada por cada proyecto de la colección', async ({ page }) => {
      await trigger(page, 'archivo').click();
      await expect(menu(page, 'archivo').locator('[data-testid^="menu-item-archivo-open-project-"]')).toHaveCount(projects.length);
    });

    test('"Abrir en pestaña nueva" sigue al proyecto que muestra el Navegador', async ({ page, context }) => {
      // Sin Navegador: desactivado y sin efecto
      const disabled = await pick(page, 'archivo', 'open-external');
      await expect(disabled).toHaveAttribute('aria-disabled', 'true');
      let opened = false;
      context.on('page', () => (opened = true));
      await disabled.click({ force: true });
      await page.waitForTimeout(300);
      expect(opened).toBe(false);
      await page.keyboard.press('Escape');

      // Con un proyecto en el Navegador: es un enlace a su dirección, en una pestaña nueva
      await page.getByTestId('dock-item-browser').click();
      await page.getByTestId('window-browser').getByTestId(`browser-fav-${embeddable.id}`).click();
      const link = await pick(page, 'archivo', 'open-external');
      await expect(link).toHaveAttribute('href', embeddable.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('"Cerrar ventana" cierra la activa; sin ventanas está desactivado y no hace nada', async ({ page }) => {
      const none = await pick(page, 'archivo', 'close-window');
      await expect(none).toHaveAttribute('aria-disabled', 'true');
      await none.click({ force: true });
      await expect(page.getByTestId('menubar')).toBeVisible();
      await page.keyboard.press('Escape');

      await openWindow(page, 'desktop-icon-about');
      await (await pick(page, 'archivo', 'close-window')).click();
      await expect(page.getByTestId('window-about')).toHaveCount(0);
    });
  });

  test.describe('Edición', () => {
    test('sin campo de texto ni selección todo está desactivado', async ({ page }) => {
      await trigger(page, 'edicion').click();
      for (const id of ['undo', 'redo', 'cut', 'copy']) await expect(item(page, 'edicion', id), id).toHaveAttribute('aria-disabled', 'true');
    });

    test('Cortar y Deshacer actúan sobre el campo de Correo sin quitarle el foco', async ({ page }) => {
      await page.getByTestId('dock-item-mail').click();
      const field = page.getByTestId('mail-subject');
      await field.click();
      await page.keyboard.type('Hola Pol');
      await page.keyboard.press('ControlOrMeta+a');
      await expect(field).toHaveValue('Hola Pol');

      await trigger(page, 'edicion').click();
      await expect(item(page, 'edicion', 'cut')).not.toHaveAttribute('aria-disabled', 'true');
      await expect(item(page, 'edicion', 'copy')).not.toHaveAttribute('aria-disabled', 'true');
      await item(page, 'edicion', 'cut').click();
      await expect(field).toHaveValue('');
      await expect(field).toBeFocused();

      await trigger(page, 'edicion').click();
      await expect(item(page, 'edicion', 'undo')).not.toHaveAttribute('aria-disabled', 'true');
      await item(page, 'edicion', 'undo').click();
      await expect(field).toHaveValue('Hola Pol');
    });

    test('"Seleccionar todo" en una ventana de solo lectura selecciona su contenido', async ({ page }) => {
      await openWindow(page, 'desktop-icon-about');
      await expect(page.getByTestId('window-about')).toBeVisible();
      await (await pick(page, 'edicion', 'select-all')).click();
      const selected = await page.evaluate(() => getSelection()?.toString() ?? '');
      expect(selected.length).toBeGreaterThan(10);
    });
  });

  test.describe('Visualización', () => {
    test('Oscuro cambia el tema, la marca se mueve y coincide con Ajustes', async ({ page }) => {
      await (await pick(page, 'visualizacion', 'theme-dark')).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      const dark = await pick(page, 'visualizacion', 'theme-dark');
      await expect(dark).toHaveAttribute('aria-checked', 'true');
      await expect(item(page, 'visualizacion', 'theme-light')).toHaveAttribute('aria-checked', 'false');
      await page.keyboard.press('Escape');

      await page.getByTestId('dock-item-settings').click();
      await expect(page.getByTestId('settings-theme-dark')).toHaveAttribute('aria-checked', 'true');
    });

    test('elegir un fondo lo aplica y lo marca', async ({ page }) => {
      await (await pick(page, 'visualizacion', 'wallpaper-mar')).click();
      await expect(page.locator('html')).toHaveAttribute('data-wall', 'mar');
      await expect(await pick(page, 'visualizacion', 'wallpaper-mar')).toHaveAttribute('aria-checked', 'true');
    });

    test('elegir un tamaño de texto lo aplica, lo marca y coincide con Ajustes', async ({ page }) => {
      await (await pick(page, 'visualizacion', 'text-grande')).click();
      await expect(page.locator('html')).toHaveAttribute('data-text', 'grande');
      await expect(await pick(page, 'visualizacion', 'text-grande')).toHaveAttribute('aria-checked', 'true');
      await expect(item(page, 'visualizacion', 'text-normal')).toHaveAttribute('aria-checked', 'false');
      await page.keyboard.press('Escape');

      await page.getByTestId('dock-item-settings').click();
      await expect(page.getByTestId('settings-text-grande')).toHaveAttribute('aria-checked', 'true');
    });

    test('Pantalla completa es una casilla que no rompe nada si el navegador la rechaza', async ({ page }) => {
      const full = await pick(page, 'visualizacion', 'fullscreen');
      await expect(full).toHaveAttribute('role', 'menuitemcheckbox');
      await expect(full).toHaveAttribute('aria-checked', 'false');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await full.click();
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
      await expect(page.getByTestId('desktop')).toBeVisible();
      // Si el navegador la concedió, la marca lo refleja; si no, sigue sin marca.
      const on = await page.evaluate(() => !!document.fullscreenElement);
      await trigger(page, 'visualizacion').click();
      await expect(item(page, 'visualizacion', 'fullscreen')).toHaveAttribute('aria-checked', String(on));
      if (on) await page.evaluate(() => document.exitFullscreen());
    });
  });

  test.describe('Ventana', () => {
    test('sin ventanas todo está desactivado', async ({ page }) => {
      await trigger(page, 'ventana').click();
      for (const id of ['minimize', 'maximize', 'close', 'cascade', 'bring-all']) {
        await expect(item(page, 'ventana', id), id).toHaveAttribute('aria-disabled', 'true');
      }
      await expect(menu(page, 'ventana').locator('[data-testid^="menu-item-ventana-window-"]')).toHaveCount(0);
    });

    test('lista las ventanas abiertas, marca la activa y recupera una minimizada', async ({ page }) => {
      await openWindow(page, 'desktop-icon-about');
      await openWindow(page, 'desktop-icon-stack');
      await page.getByTestId('window-stack').getByTestId('window-minimize').click();
      await expect(page.getByTestId('window-stack')).toBeHidden();

      await trigger(page, 'ventana').click();
      await expect(item(page, 'ventana', 'window-about')).toHaveAttribute('aria-checked', 'true');
      await expect(item(page, 'ventana', 'window-stack')).toContainText('(minimizada)');
      await item(page, 'ventana', 'window-stack').click();
      await expect(page.getByTestId('window-stack')).toBeVisible();
      await expect(page.getByTestId('window-stack')).toHaveAttribute('data-active', 'true');
    });

    test('Minimizar, Ampliar y Cerrar actúan sobre la ventana activa', async ({ page }) => {
      await openWindow(page, 'desktop-icon-about');
      const win = page.getByTestId('window-about');
      const before = (await win.boundingBox())!;

      await (await pick(page, 'ventana', 'maximize')).click();
      await expect.poll(async () => (await win.boundingBox())!.width).toBeGreaterThan(before.width + 100);

      await (await pick(page, 'ventana', 'minimize')).click();
      await expect(win).toBeHidden();

      await trigger(page, 'ventana').click();
      await item(page, 'ventana', 'window-about').click();
      await expect(win).toBeVisible();

      await (await pick(page, 'ventana', 'close')).click();
      await expect(win).toHaveCount(0);
    });

    test('Ordenar en cascada escalona las ventanas y Traer todo al frente recupera las minimizadas', async ({ page }) => {
      for (const id of ['about', 'stack', 'notes']) await openWindow(page, `desktop-icon-${id}`);
      await page.getByTestId('window-notes').getByTestId('window-minimize').click();
      await expect(page.getByTestId('window-notes')).toBeHidden();

      await (await pick(page, 'ventana', 'cascade')).click();
      const a = (await page.getByTestId('window-about').boundingBox())!;
      const t = (await page.getByTestId('window-stack').boundingBox())!;
      expect(t.x).toBeGreaterThan(a.x);
      expect(t.y).toBeGreaterThan(a.y);

      await (await pick(page, 'ventana', 'bring-all')).click();
      await expect(page.getByTestId('window-notes')).toBeVisible();
    });
  });

  test.describe('Ayuda', () => {
    test('"Cómo usar Pol OS" abre la guía', async ({ page }) => {
      await (await pick(page, 'ayuda', 'help-guide')).click();
      const win = page.getByTestId('window-help');
      await expect(win).toBeVisible();
      await expect(win.getByTestId('help')).toContainText('Doble clic');
      await expect(page.getByTestId('menubar-app')).toHaveText('Ayuda');
    });

    test('"Escribir a Pol" abre Correo', async ({ page }) => {
      await (await pick(page, 'ayuda', 'write-to-pol')).click();
      await expect(page.getByTestId('window-mail')).toBeVisible();
    });

    test('los enlaces externos se abren en una pestaña nueva y de forma segura', async ({ page }) => {
      await trigger(page, 'ayuda').click();
      for (const id of ['newsletter', 'github', 'linkedin', 'whatsapp']) {
        const link = item(page, 'ayuda', `link-${id}`);
        await expect(link).toHaveAttribute('href', /^https:\/\//);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
      }
    });
  });

  test.describe('Menú de Pol OS (logo)', () => {
    test('conserva Acerca de, Ajustes y Bloquear pantalla', async ({ page }) => {
      await (await pick(page, 'logo', 'settings')).click();
      await expect(page.getByTestId('window-settings')).toBeVisible();
      await (await pick(page, 'logo', 'lock')).click();
      await expect(page.getByTestId('lock-screen')).toBeVisible();
    });
  });

  test.describe('Teclado', () => {
    test('flechas entre menús y entre acciones, Enter ejecuta y Escape devuelve el foco al menú', async ({ page }) => {
      await trigger(page, 'archivo').focus();
      await page.keyboard.press('ArrowRight');
      await expect(trigger(page, 'edicion')).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(trigger(page, 'archivo')).toBeFocused();

      await page.keyboard.press('ArrowDown');
      await expect(menu(page, 'archivo')).toBeVisible();
      await expect(item(page, 'archivo', 'new-message')).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.locator(':focus')).not.toHaveAttribute('data-testid', 'menu-item-archivo-new-message');

      await page.keyboard.press('Escape');
      await expect(menu(page, 'archivo')).toHaveCount(0);
      await expect(trigger(page, 'archivo')).toBeFocused();

      await page.keyboard.press('ArrowDown');
      await expect(item(page, 'archivo', 'new-message')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('window-mail')).toBeVisible();
    });

    test('con un menú abierto, izquierda y derecha pasan al contiguo; las acciones desactivadas se saltan', async ({ page }) => {
      await trigger(page, 'ventana').focus();
      await page.keyboard.press('ArrowDown');
      // Sin ventanas, todo el menú Ventana está desactivado: no hay nada a lo que dar foco.
      await expect(menu(page, 'ventana')).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await expect(menu(page, 'ayuda')).toBeVisible();
      await expect(item(page, 'ayuda', 'help-guide')).toBeFocused();
    });

    test('Inicio y Fin van a la primera y la última acción', async ({ page }) => {
      await trigger(page, 'ayuda').focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('End');
      await expect(item(page, 'ayuda', 'link-whatsapp')).toBeFocused();
      await page.keyboard.press('Home');
      await expect(item(page, 'ayuda', 'help-guide')).toBeFocused();
    });
  });

  test('los menús usan los roles de accesibilidad correctos', async ({ page }) => {
    await expect(page.getByRole('menubar')).toBeVisible();
    await trigger(page, 'visualizacion').click();
    await expect(page.getByRole('menu', { name: 'Visualización' })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: 'Oscuro' })).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Pantalla completa' })).toBeVisible();
  });

  test('no hay errores de accesibilidad con un menú abierto, en claro y en oscuro', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await (await pick(page, 'visualizacion', `theme-${theme}`)).click();
      for (const id of ['archivo', 'ventana', 'ayuda', 'visualizacion']) {
        await trigger(page, id).click();
        await expect(menu(page, id)).toBeVisible();
        await animationsDone(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, `${id} en ${theme}`).toEqual([]);
        await page.keyboard.press('Escape');
      }
    }
  });
});
