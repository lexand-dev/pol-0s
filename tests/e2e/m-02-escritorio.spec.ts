import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { animationsDone, enter } from './helpers';

/** Medir durante la animación de entrada daría una ventana escalada al 94 %. */
const settled = (locator: Locator) =>
  locator.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

const box = async (locator: Locator) => {
  await settled(locator);
  const b = await locator.boundingBox();
  if (!b) throw new Error('El elemento no tiene caja visible');
  return b;
};

async function drag(page: Page, from: Locator, dx: number, dy: number) {
  const b = await box(from);
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

test.describe('M-02 Escritorio en pantallas anchas', () => {
  test.beforeEach(async ({ page }) => enter(page));

  test('muestra barra de menú, dock con las apps del sistema e iconos de contenido', async ({ page }) => {
    await expect(page.getByTestId('menubar')).toBeVisible();
    await expect(page.getByTestId('menubar-app')).toHaveText('Escritorio');
    for (const app of ['browser', 'mail', 'notes', 'terminal', 'settings']) {
      await expect(page.getByTestId(`dock-item-${app}`)).toBeVisible();
    }
    for (const id of ['projects', 'project-plantilla', 'about', 'notes', 'favorites', 'guestbook', 'stack', 'howto']) {
      await expect(page.getByTestId(`desktop-icon-${id}`)).toBeVisible();
    }
  });

  test('un clic selecciona el icono sin abrir nada', async ({ page }) => {
    const icon = page.getByTestId('desktop-icon-about');
    await icon.click();
    await expect(icon).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('doble clic abre la app en una ventana', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    const win = page.getByTestId('window-about');
    await expect(win).toBeVisible();
    await expect(win.getByTestId('about')).toBeVisible();
    await expect(page.getByTestId('menubar-app')).toHaveText('Vista previa');
  });

  test('un proyecto se abre en Proyectos, con su detalle', async ({ page }) => {
    await page.getByTestId('desktop-icon-projects').dblclick();
    await page.getByTestId('projects-card-recetario').click();
    await expect(page.getByTestId('window-projects')).toContainText('Recetario');
  });

  test('la ventana se mueve arrastrando la barra de título', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    const win = page.getByTestId('window-about');
    const before = await box(win);
    await drag(page, win.getByTestId('window-titlebar'), -150, 60);
    const after = await box(win);
    expect(after.x).toBeCloseTo(before.x - 150, 0);
    expect(after.y).toBeCloseTo(before.y + 60, 0);
  });

  test('la ventana se redimensiona desde la esquina', async ({ page }) => {
    await page.getByTestId('desktop-icon-stack').dblclick();
    const win = page.getByTestId('window-stack');
    const before = await box(win);
    await drag(page, win.getByTestId('window-resize'), -100, -80);
    const after = await box(win);
    expect(after.width).toBeCloseTo(before.width - 100, 0);
    expect(after.height).toBeCloseTo(before.height - 80, 0);
  });

  test('pulsar una ventana de detrás la trae al frente', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    await page.getByTestId('desktop-icon-stack').dblclick();
    const about = page.getByTestId('window-about');
    const tools = page.getByTestId('window-stack');
    await expect(tools).toHaveAttribute('data-active', 'true');
    // Stack se abre encima y casi en el mismo sitio: solo se ve una franja de Sobre mí a la izquierda. Se pulsa ahí.
    await about.click({ position: { x: 8, y: 300 } });
    await expect(about).toHaveAttribute('data-active', 'true');
    await expect(tools).toHaveAttribute('data-active', 'false');
    const z = async (l: Locator) => Number(await l.evaluate((el) => getComputedStyle(el).zIndex));
    expect(await z(about)).toBeGreaterThan(await z(tools));
  });

  test('se cierra con el botón rojo y con Escape', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    await page.getByTestId('window-about').getByTestId('window-close').click();
    await expect(page.getByTestId('window-about')).toHaveCount(0);

    await page.getByTestId('desktop-icon-stack').dblclick();
    await expect(page.getByTestId('window-stack')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('window-stack')).toHaveCount(0);
  });

  test('se minimiza y vuelve desde el dock', async ({ page }) => {
    await page.getByTestId('dock-item-mail').click();
    const win = page.getByTestId('window-mail');
    await expect(win).toBeVisible();
    await win.getByTestId('window-minimize').click();
    await expect(win).toBeHidden();
    await expect(page.getByTestId('dock-minimized-mail')).toBeVisible();
    await page.getByTestId('dock-item-mail').click();
    await expect(win).toBeVisible();
    await expect(page.getByTestId('dock-minimized-mail')).toHaveCount(0);
  });

  test('una ventana minimizada aparece en el dock y se recupera desde su icono', async ({ page }) => {
    await page.getByTestId('dock-item-mail').click();
    await page.getByTestId('dock-item-terminal').click();
    // Sin nada minimizado, el dock no enseña ese apartado.
    await expect(page.locator('[data-testid^="dock-minimized-"]')).toHaveCount(0);

    await page.getByTestId('window-mail').getByTestId('window-minimize').click();
    await page.getByTestId('window-terminal').getByTestId('window-minimize').click();
    const mail = page.getByRole('button', { name: 'Recuperar Correo' });
    const terminal = page.getByRole('button', { name: /^Recuperar Terminal/ });
    await expect(mail).toBeVisible();
    await expect(terminal).toBeVisible();
    await expect(page.getByTestId('window-mail')).toBeHidden();
    await expect(page.getByTestId('window-terminal')).toBeHidden();

    // Cada icono recupera su ventana y la deja activa; el otro sigue esperando en el dock.
    await mail.click();
    await expect(page.getByTestId('window-mail')).toBeVisible();
    await expect(page.getByTestId('window-mail')).toHaveAttribute('data-active', 'true');
    await expect(mail).toHaveCount(0);
    await expect(terminal).toBeVisible();
    await expect(page.getByTestId('window-terminal')).toBeHidden();

    await terminal.click();
    await expect(page.getByTestId('window-terminal')).toBeVisible();
    await expect(page.locator('[data-testid^="dock-minimized-"]')).toHaveCount(0);
  });

  test('una ventana recuperada y luego cerrada no deja nada en el dock', async ({ page }) => {
    await page.getByTestId('dock-item-settings').click();
    await page.getByTestId('window-settings').getByTestId('window-minimize').click();
    await expect(page.getByTestId('dock-minimized-settings')).toBeVisible();
    await page.getByTestId('dock-minimized-settings').click();
    await page.getByTestId('window-settings').getByTestId('window-close').click();
    await expect(page.locator('[data-testid^="dock-minimized-"]')).toHaveCount(0);
  });

  test('ampliar ocupa todo el ancho y volver a pulsar lo restaura', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    const win = page.getByTestId('window-about');
    const before = await box(win);
    await win.getByTestId('window-maximize').click();
    expect((await box(win)).width).toBe(page.viewportSize()?.width);
    await win.getByTestId('window-maximize').click();
    expect((await box(win)).width).toBeCloseTo(before.width, 0);
  });

  test('arrastrada fuera de la pantalla, la barra de título sigue alcanzable', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    const win = page.getByTestId('window-about');
    const bar = win.getByTestId('window-titlebar');
    const viewport = page.viewportSize()!;

    await drag(page, bar, -3000, 3000);
    let b = await box(bar);
    expect(b.x + b.width).toBeGreaterThanOrEqual(80);
    expect(b.y).toBeLessThanOrEqual(viewport.height - 40);

    await drag(page, bar, 3000, -3000);
    b = await box(bar);
    expect(b.x).toBeLessThanOrEqual(viewport.width - 80);
    expect(b.y).toBeGreaterThanOrEqual(28);
  });

  test('no tiene errores de accesibilidad con una ventana abierta', async ({ page }) => {
    await page.getByTestId('desktop-icon-about').dblclick();
    await expect(page.getByTestId('window-about')).toBeVisible();
    // Sin esperar a que termine la animación de apertura, axe mide colores a medio fundir (fallaba a veces en Firefox)
    await animationsDone(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
