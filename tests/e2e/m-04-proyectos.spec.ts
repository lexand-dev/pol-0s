import { expect, test } from '@playwright/test';
import { enter, inFolder, loadProjects, onDesktop, openProjectDetail, stubExternalSites } from './helpers';

const projects = loadProjects();
const folder = inFolder(projects);
const own = onDesktop(projects);
const embeddable = folder.find((p) => p.embeddable)!;
const blocked = folder.find((p) => !p.embeddable)!;

test.describe('M-04 Proyectos: carpeta e iconos propios', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubExternalSites(context);
    await enter(page);
  });

  test('hay proyectos en la carpeta y alguno con icono propio, y ninguno cae en los dos sitios', async () => {
    expect(folder.length).toBeGreaterThan(0);
    expect(own.length).toBeGreaterThan(0);
    expect(folder.length + own.length).toBe(projects.length);
  });

  test('en el escritorio, los proyectos de la carpeta no tienen icono suelto y los de GitHub sí, con su nombre', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'En móvil los proyectos van en una carpeta (otro test)');
    await expect(page.getByTestId('desktop-icon-projects')).toContainText('Proyectos');
    for (const p of folder) await expect(page.getByTestId(`desktop-icon-project-${p.id}`), p.id).toHaveCount(0);
    for (const p of own) await expect(page.getByTestId(`desktop-icon-project-${p.id}`)).toContainText(p.name);
  });

  test('un proyecto con icono propio muestra su imagen, y su imagen carga de verdad', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'En móvil los proyectos van en una carpeta (otro test)');
    for (const p of own) {
      const icon = page.getByTestId(`desktop-icon-project-${p.id}`);
      expect(p.icon, `${p.id} debería tener icono propio`).toBeTruthy();
      const img = icon.locator('img');
      await expect(img).toHaveAttribute('src', p.icon!);
      // Un icono roto saldría con ancho natural 0.
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  });

  test('la carpeta Proyectos muestra los de la carpeta y no los que tienen icono propio', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'Doble clic es de escritorio');
    await page.getByTestId('desktop-icon-projects').dblclick();
    await expect(page.getByTestId('projects')).toBeVisible();
    for (const p of folder) await expect(page.getByTestId(`projects-card-${p.id}`), p.id).toBeVisible();
    for (const p of own) await expect(page.getByTestId(`projects-card-${p.id}`), p.id).toHaveCount(0);
  });

  test('abrir un proyecto de la carpeta enseña su detalle en Proyectos, no en el Navegador', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'Doble clic es de escritorio');
    await openProjectDetail(page, testInfo.project.name, embeddable);
    const win = page.getByTestId('window-projects');
    await expect(win.getByTestId('project-name')).toHaveText(embeddable.name);
    await expect(page.getByTestId('window-browser')).toHaveCount(0);
  });

  test('doble clic en el icono propio abre su detalle en Proyectos, aunque no esté en la carpeta', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'Doble clic es de escritorio');
    await openProjectDetail(page, testInfo.project.name, own[0]);
    const win = page.getByTestId('window-projects');
    await expect(win.getByTestId('project-name')).toHaveText(own[0].name);
    // Desde su detalle se vuelve a la vista general, que sigue sin incluirlo.
    await win.getByTestId('projects-back').click();
    await expect(win.getByTestId('projects')).toBeVisible();
    await expect(win.getByTestId(`projects-card-${own[0].id}`)).toHaveCount(0);
  });

  test('desde el detalle, "Abrir en el Navegador" carga ese proyecto', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'Doble clic es de escritorio');
    await openProjectDetail(page, testInfo.project.name, embeddable);
    await page.getByTestId('project-open-browser').click();
    const win = page.getByTestId('window-browser');
    await expect(win.getByTestId('browser-address')).toContainText(embeddable.domain);
    await expect(win.getByTestId('browser-frame')).toHaveAttribute('src', embeddable.url);
    await expect(win.getByTestId('browser-loading')).toHaveCount(0);
  });

  test('con Proyectos ya abierto, el icono propio navega en la misma ventana', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'Doble clic es de escritorio');
    await openProjectDetail(page, testInfo.project.name, folder[0]);
    await expect(page.getByTestId('project-name')).toHaveText(folder[0].name);
    await page.getByTestId(`desktop-icon-project-${own[0].id}`).dblclick();
    await expect(page.getByTestId('window-projects')).toHaveCount(1);
    await expect(page.getByTestId('project-name')).toHaveText(own[0].name);
  });

  test('un proyecto que no se deja incrustar ofrece abrirlo en una pestaña nueva, no una ventana en blanco', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('movil'), 'Doble clic es de escritorio');
    await openProjectDetail(page, testInfo.project.name, blocked);
    const win = page.getByTestId('window-projects');
    await expect(win.getByTestId('project-open-browser')).toHaveCount(0);
    const visit = win.getByTestId('project-visit');
    await expect(visit).toHaveAttribute('href', blocked.url);
    await expect(visit).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('window-browser')).toHaveCount(0);
  });

  test('en móvil, la carpeta Proyectos tiene los de la carpeta y los de GitHub van sueltos en la pantalla de inicio', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.endsWith('movil'), 'Solo móvil');
    for (const p of own) await expect(page.getByTestId(`mobile-icon-project-${p.id}`)).toContainText(p.name);
    await page.getByTestId('mobile-icon-folder-projects').tap();
    const dialog = page.getByTestId('mobile-folder');
    for (const p of folder) await expect(dialog.getByTestId(`mobile-icon-project-${p.id}`)).toContainText(p.name);
    for (const p of own) await expect(dialog.getByTestId(`mobile-icon-project-${p.id}`)).toHaveCount(0);
    await page.getByTestId(`mobile-icon-project-${embeddable.id}`).tap();
    const sheet = page.getByTestId('mobile-sheet');
    await expect(sheet.getByTestId('project-name')).toHaveText(embeddable.name);
    await sheet.getByTestId('project-open-browser').tap();
    await expect(sheet.getByTestId('browser-frame')).toHaveAttribute('src', embeddable.url);

    await page.getByTestId('mobile-back').tap();
    await openProjectDetail(page, testInfo.project.name, blocked);
    await expect(sheet.getByTestId('project-visit')).toBeVisible();
  });
});
