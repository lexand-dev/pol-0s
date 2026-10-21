import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LINKS } from '../../src/content/links';
import { animationsDone, enter, loadProjects, openMail, stubExternalSites, stubTurnstile } from './helpers';
import { PERSONA } from '../../src/content/persona';

const projects = loadProjects();

/** Abre la Terminal desde el dock: ventana en escritorio, pantalla completa en móvil. */
async function openTerminal(page: Page, projectName: string) {
  if (projectName.endsWith('movil')) await page.getByTestId('mobile-dock-terminal').tap();
  else await page.getByTestId('dock-item-terminal').click();
  await expect(page.getByTestId('terminal')).toBeVisible();
  await expect(page.getByTestId('terminal-input')).toBeFocused();
}

/** Escribe una línea y la ejecuta, como lo haría un visitante. */
async function run(page: Page, command: string) {
  const input = page.getByTestId('terminal-input');
  await input.fill(command);
  await input.press('Enter');
}

const log = (page: Page) => page.getByTestId('terminal-log');

test.describe('S-04 Terminal', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
    await stubTurnstile(context);
    await enter(page);
  });

  test('se abre con el aviso y la línea enfocada, y help lista los comandos', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await expect(page.getByTestId('terminal').getByText('pol@pol-os ~ %')).toBeVisible();
    await expect(log(page)).toContainText('escribe help');

    await run(page, 'help');
    for (const name of ['about', 'projects', 'open <algo>', 'ls', 'social', 'contact', 'theme <modo>', 'wallpaper <fondo>', 'neofetch']) {
      await expect(log(page)).toContainText(name);
    }
    await expect(log(page)).toContainText('Hay otros comandos que no salen en esta lista');
    await expect(page.getByTestId('terminal-input')).toHaveValue('');
  });

  test('about da el nombre y los enlaces, y projects lista un proyecto por cada uno de la colección', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await run(page, 'about');
    await expect(log(page)).toContainText(PERSONA.name);
    await expect(log(page)).toContainText('example.com/newsletter');

    await run(page, 'projects');
    for (const p of projects) {
      await expect(log(page)).toContainText(p.id);
      await expect(log(page)).toContainText(p.summary);
    }
  });

  test('social muestra los tres enlaces y se abren en una pestaña nueva', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await run(page, 'social');
    const links = log(page).locator('a');
    await expect(links).toHaveCount(LINKS.length);
    for (const [i, l] of LINKS.entries()) {
      await expect(links.nth(i)).toHaveAttribute('href', l.url);
      await expect(links.nth(i)).toHaveAttribute('target', '_blank');
      await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
    }
  });

  test('open abre un proyecto en el Navegador y una app por su nombre', async ({ page }, testInfo) => {
    const project = projects[0];
    await openTerminal(page, testInfo.project.name);
    await run(page, `open ${project.id}`);
    await expect(page.getByTestId('browser')).toBeVisible();
    await expect(page.getByTestId('browser-address')).toContainText(project.domain);

    if (testInfo.project.name.endsWith('movil')) {
      await page.getByTestId('mobile-back').tap();
      await openTerminal(page, testInfo.project.name);
    } else {
      await page.getByTestId('window-terminal').getByTestId('terminal-input').focus();
    }
    await run(page, 'open correo');
    await expect(page.getByTestId('mail')).toBeVisible();
  });

  test('theme y wallpaper hacen lo mismo que Ajustes', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await run(page, 'theme oscuro');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await run(page, 'wallpaper mar');
    await expect(page.locator('html')).toHaveAttribute('data-wall', 'mar');
    await expect(log(page)).toContainText('Tema: oscuro.');

    if (!testInfo.project.name.endsWith('movil')) {
      await page.getByTestId('dock-item-settings').click();
      await expect(page.getByTestId('settings-theme-dark')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('settings-wall-mar')).toHaveAttribute('aria-checked', 'true');
    }
  });

  test('lock bloquea la pantalla y exit cierra la terminal', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.endsWith('movil');
    await openTerminal(page, testInfo.project.name);
    await run(page, 'exit');
    await expect(page.getByTestId('terminal')).toHaveCount(0);
    if (mobile) await expect(page.getByTestId('mobile-home')).toBeVisible();
    else await expect(page.getByTestId('window-terminal')).toHaveCount(0);

    await openTerminal(page, testInfo.project.name);
    await run(page, 'lock');
    await expect(page.getByTestId('lock-screen')).toBeVisible();
  });

  test('las flechas recorren el historial, Tab completa y Ctrl+L y clear limpian', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    const input = page.getByTestId('terminal-input');
    await run(page, 'help');
    await run(page, 'about');

    await input.press('ArrowUp');
    await expect(input).toHaveValue('about');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('help');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('about');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('');

    await input.fill('proj');
    await input.press('Tab');
    await expect(input).toHaveValue('projects ');
    await input.fill('open recet');
    await input.press('Tab');
    await expect(input).toHaveValue('open recetario ');
    // "como-" es el principio de varias notas (S-01): hay más de una opción, así que las lista sin completar.
    await input.fill('open como-');
    await input.press('Tab');
    await expect(input).toHaveValue('open como-');
    await expect(log(page)).toContainText('como-anadir-un-proyecto');

    // Con varias opciones, Tab las lista sin tocar lo escrito.
    await input.fill('c');
    await input.press('Tab');
    await expect(input).toHaveValue('c');
    await expect(log(page)).toContainText('clear   contact');

    await input.press('Control+l');
    await expect(page.getByTestId('terminal-line')).toHaveCount(0);

    await run(page, 'whoami');
    await expect(page.getByTestId('terminal-line')).not.toHaveCount(0);
    await run(page, 'clear');
    await expect(page.getByTestId('terminal-line')).toHaveCount(0);
  });

  test('en el móvil, la letra mide al menos 16px: Safari en iPhone no amplía la página al escribir', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.endsWith('movil'), 'Solo en el móvil.');
    await openTerminal(page, testInfo.project.name);
    const size = await page.getByTestId('terminal-input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test('Ctrl+C cancela la línea sin ejecutarla', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    const input = page.getByTestId('terminal-input');
    await input.fill('open rumbo');
    await input.press('Control+c');
    await expect(input).toHaveValue('');
    await expect(log(page)).toContainText('open rumbo^C');
    await expect(page.getByTestId('browser')).toHaveCount(0);
  });

  test('una ventana minimizada conserva su historial al recuperarla', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'En móvil no hay ventanas que minimizar');
    await openTerminal(page, testInfo.project.name);
    await run(page, 'echo todavia-sigo-aqui');
    const win = page.getByTestId('window-terminal');
    await win.getByTestId('window-minimize').click();
    await expect(win).toBeHidden();

    await page.getByTestId('dock-item-terminal').click();
    await expect(win).toBeVisible();
    await expect(log(page)).toContainText('todavia-sigo-aqui');
  });

  test('un mensaje a medio escribir en Correo sigue ahí tras minimizar y recuperar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'En móvil no hay ventanas que minimizar');
    const mail = await openMail(page, testInfo.project.name);
    await mail.getByTestId('mail-message').fill('Un borrador que no quiero perder.');
    const win = page.getByTestId('window-mail');
    await win.getByTestId('window-minimize').click();
    await expect(win).toBeHidden();

    await page.getByTestId('dock-item-mail').click();
    await expect(win).toBeVisible();
    await expect(page.getByTestId('mail-message')).toHaveValue('Un borrador que no quiero perder.');
  });

  test.describe('casos negativos', () => {
    test('un comando que no existe lo dice y sugiere uno parecido', async ({ page }, testInfo) => {
      await openTerminal(page, testInfo.project.name);
      await run(page, 'patata');
      await expect(log(page)).toContainText('comando no encontrado: patata');
      await expect(log(page)).toContainText('Escribe help');

      await run(page, 'projcts');
      await expect(log(page)).toContainText('¿Quisiste decir projects?');
    });

    test('el HTML escrito se ve como texto: no crea elementos ni ejecuta nada', async ({ page }, testInfo) => {
      let dialogs = 0;
      page.on('dialog', async (d) => {
        dialogs++;
        await d.dismiss();
      });
      await openTerminal(page, testInfo.project.name);
      await run(page, 'echo <img src=x onerror=alert(1)><script>alert(2)</script>');
      await expect(log(page)).toContainText('<img src=x onerror=alert(1)><script>alert(2)</script>');
      await expect(log(page).locator('img, script')).toHaveCount(0);
      // Margen para que un onerror, si existiera, llegara a saltar.
      await page.waitForTimeout(300);
      expect(dialogs).toBe(0);
    });

    test('una línea de más de 200 caracteres se rechaza', async ({ page }, testInfo) => {
      await openTerminal(page, testInfo.project.name);
      await run(page, 'echo ' + 'a'.repeat(250));
      await expect(log(page)).toContainText('demasiado larga');
      // Bienvenida, la línea escrita y el error: `echo` no llegó a ejecutarse.
      await expect(page.getByTestId('terminal-line')).toHaveCount(3);
    });

    test('open con algo que no existe da error y no abre nada', async ({ page }, testInfo) => {
      await openTerminal(page, testInfo.project.name);
      await run(page, 'open https://malo.test');
      await expect(log(page)).toContainText('no encuentro');
      await expect(page.getByTestId('browser')).toHaveCount(0);
    });

    test('sudo y rm responden sin hacer nada', async ({ page }, testInfo) => {
      await openTerminal(page, testInfo.project.name);
      await run(page, 'sudo rm -rf /');
      await expect(log(page)).toContainText('sudoers');
      await run(page, 'rm -rf /');
      await expect(log(page)).toContainText('Buen intento');
      await expect(page.getByTestId('terminal')).toBeVisible();
      await expect(page.getByTestId('lock-screen')).toHaveCount(0);
    });
  });

  test('la terminal no tiene errores de accesibilidad con el sistema en claro ni en oscuro', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await run(page, 'help');
    await run(page, 'social');
    await run(page, 'patata');
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await animationsDone(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `tema ${theme}`).toEqual([]);
    }
  });
});
