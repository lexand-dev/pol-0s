import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, enter, inFolder, loadProjects, openProjectDetail, stubExternalSites } from './helpers';

const projects = loadProjects();
const folderProjects = inFolder(projects);
const withRepo = projects.find((p) => p.repo && p.github && p.screenshots.length > 0 && p.embeddable)!; // planito, afloat…
const withoutRepo = projects.find((p) => !p.repo)!;
const embeddable = projects.find((p) => p.embeddable)!;
const blocked = projects.find((p) => !p.embeddable && !p.url.includes('github.com'))!;
const gifProject = projects.find((p) => p.screenshots.some((s) => s.src.endsWith('.gif')))!;
const noShots = projects.find((p) => p.screenshots.length === 0);

const isMobile = (name: string) => name.endsWith('movil');

/** Abre el detalle de un proyecto como lo haría un visitante (ver `openProjectDetail`). */
const openDetail = (page: Page, projectName: string, id: string) => openProjectDetail(page, projectName, projects.find((p) => p.id === id)!);

/** La vista general: icono Proyectos del escritorio y, en móvil, el botón de volver del detalle. */
async function openOverview(page: Page, projectName: string) {
  if (isMobile(projectName)) {
    await openDetail(page, projectName, folderProjects[0].id);
    await page.getByTestId('projects-back').tap();
  } else {
    await page.getByTestId('desktop-icon-projects').dblclick();
  }
  await expect(page.getByTestId('projects')).toBeVisible();
}

const click = (page: Page, testId: string, projectName: string) =>
  isMobile(projectName) ? page.getByTestId(testId).tap() : page.getByTestId(testId).click();

test.describe('S-08 Proyectos: vista general y detalle', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
    await enter(page);
  });

  test('la vista general muestra una tarjeta por proyecto, con su nombre y su frase', async ({ page }, testInfo) => {
    await openOverview(page, testInfo.project.name);
    for (const p of folderProjects) {
      const card = page.getByTestId(`projects-card-${p.id}`);
      await expect(card).toContainText(p.name);
      await expect(card).toContainText(p.summary);
    }
    await expect(page.locator('[data-testid^="projects-card-"]')).toHaveCount(folderProjects.length);
  });

  test('pulsar una tarjeta abre su detalle, y "Proyectos" vuelve a la vista general', async ({ page }, testInfo) => {
    await openOverview(page, testInfo.project.name);
    await click(page, `projects-card-${embeddable.id}`, testInfo.project.name);
    await expect(page.getByTestId('project-name')).toHaveText(embeddable.name);
    await expect(page.getByTestId('project-detail')).toContainText(embeddable.details[0]);
    for (const tech of embeddable.stack) await expect(page.getByTestId('project-made-with')).toContainText(tech);

    await click(page, 'projects-back', testInfo.project.name);
    await expect(page.getByTestId('projects')).toBeVisible();
    await expect(page.getByTestId('project-detail')).toHaveCount(0);
  });

  test('el icono Proyectos del escritorio abre la vista general', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil la vista general se alcanza desde un detalle');
    await page.getByTestId('desktop-icon-projects').dblclick();
    await expect(page.getByTestId('window-projects').getByTestId('projects')).toBeVisible();
  });

  test('un proyecto con repositorio público muestra sus lenguajes, etiquetas, licencia y el botón del repositorio', async ({ page }, testInfo) => {
    await openDetail(page, testInfo.project.name, withRepo.id);
    const langs = page.getByTestId('project-languages');
    await expect(langs).toBeVisible();
    for (const l of withRepo.github!.languages.slice(0, 2)) await expect(langs).toContainText(l.name);
    await expect(langs.getByRole('img')).toHaveAccessibleName(/^Lenguajes del repositorio: .+ \d+ %/);
    if (withRepo.github!.license) await expect(page.getByTestId('project-license')).toContainText(withRepo.github!.license);
    const repo = page.getByTestId('project-repo');
    await expect(repo).toHaveAttribute('href', `https://github.com/${withRepo.repo}`);
    await expect(repo).toHaveAttribute('target', '_blank');
    await expect(repo).toHaveAttribute('rel', /noopener/);
  });

  test('uno incrustable tiene "Abrir en el Navegador", y ese botón carga el proyecto', async ({ page }, testInfo) => {
    await openDetail(page, testInfo.project.name, embeddable.id);
    await expect(page.getByTestId('project-visit')).toHaveCount(0);
    await click(page, 'project-open-browser', testInfo.project.name);
    await expect(page.getByTestId('browser-frame')).toHaveAttribute('src', embeddable.url);
  });

  test('las capturas se muestran con su texto alternativo, cargan de verdad y se amplían', async ({ page }, testInfo) => {
    const p = withRepo;
    await openDetail(page, testInfo.project.name, p.id);
    const shots = page.locator('[data-testid^="project-shot-"]');
    await expect(shots).toHaveCount(p.screenshots.length);
    for (const [i, s] of p.screenshots.entries()) {
      await expect(page.getByTestId(`project-shot-${i}`)).toHaveAccessibleName(`Ampliar: ${s.alt}`);
    }
    const first = page.getByTestId('project-shot-0');
    await first.scrollIntoViewIfNeeded();
    await expect.poll(() => first.locator('img').evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    await click(page, 'project-shot-0', testInfo.project.name);
    const box = page.getByTestId('project-lightbox');
    await expect(box).toBeVisible();
    await expect(page.getByTestId('project-lightbox-image')).toHaveAttribute('alt', p.screenshots[0].alt);
    await expect.poll(() => page.getByTestId('project-lightbox-image').evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    await click(page, 'project-lightbox-next', testInfo.project.name);
    await expect(page.getByTestId('project-lightbox-image')).toHaveAttribute('alt', p.screenshots[1].alt);
    await click(page, 'project-lightbox-prev', testInfo.project.name);
    await expect(page.getByTestId('project-lightbox-image')).toHaveAttribute('alt', p.screenshots[0].alt);
    await click(page, 'project-lightbox-close', testInfo.project.name);
    await expect(box).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test('Escape cierra la captura ampliada y no la ventana; las flechas pasan de una a otra', async ({ page }, testInfo) => {
    await openDetail(page, testInfo.project.name, withRepo.id);
    await page.getByTestId('project-shot-0').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('project-lightbox')).toBeVisible();
    await expect(page.getByTestId('project-lightbox-close')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('project-lightbox-image')).toHaveAttribute('alt', withRepo.screenshots[1].alt);
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('project-lightbox-image')).toHaveAttribute('alt', withRepo.screenshots[0].alt);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('project-lightbox')).toHaveCount(0);
    await expect(page.getByTestId('project-detail')).toBeVisible();
    if (!isMobile(testInfo.project.name)) await expect(page.getByTestId('window-projects')).toBeVisible();
    await expect(page.getByTestId('project-shot-0')).toBeFocused();
  });

  test('un GIF se anima y, con movimiento reducido, se ve su imagen fija', async ({ page }, testInfo) => {
    await openDetail(page, testInfo.project.name, gifProject.id);
    const i = gifProject.screenshots.findIndex((s) => s.src.endsWith('.gif'));
    const s = gifProject.screenshots[i];
    const img = page.getByTestId(`project-shot-${i}`).locator('img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).currentSrc)).toContain(s.src);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).currentSrc)).toContain(s.still!);
  });

  test('la terminal abre Proyectos con `open proyectos`', async ({ page }, testInfo) => {
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
    else await page.getByTestId('dock-item-terminal').click();
    const input = page.getByTestId('terminal-input');
    await input.fill('open proyectos');
    await input.press('Enter');
    await expect(page.getByTestId('projects')).toBeVisible();
  });

  test.describe('casos negativos', () => {
    test('un proyecto sin repositorio no enseña lenguajes ni botón de repositorio, solo lo que tiene', async ({ page }, testInfo) => {
      await openDetail(page, testInfo.project.name, withoutRepo.id);
      await expect(page.getByTestId('project-languages')).toHaveCount(0);
      await expect(page.getByTestId('project-topics')).toHaveCount(0);
      await expect(page.getByTestId('project-license')).toHaveCount(0);
      await expect(page.getByTestId('project-repo')).toHaveCount(0);
      if (withoutRepo.stack.length > 0) await expect(page.getByTestId('project-made-with')).toBeVisible();
    });

    test('uno que no se deja incrustar ofrece "Visitar sitio" en una pestaña nueva y no "Abrir en el Navegador"', async ({ page }, testInfo) => {
      await openDetail(page, testInfo.project.name, blocked.id);
      await expect(page.getByTestId('project-open-browser')).toHaveCount(0);
      const visit = page.getByTestId('project-visit');
      await expect(visit).toContainText('Visitar sitio');
      await expect(visit).toHaveAttribute('href', blocked.url);
      await expect(visit).toHaveAttribute('target', '_blank');
    });

    test('un proyecto cuya dirección es la de GitHub dice "Ver en GitHub" y no repite el botón del repositorio', async ({ page }, testInfo) => {
      const gh = projects.find((p) => p.url.includes('github.com'))!;
      await openDetail(page, testInfo.project.name, gh.id);
      await expect(page.getByTestId('project-visit')).toContainText('Ver en GitHub');
      await expect(page.getByTestId('project-repo')).toHaveCount(0);
    });

    test('un proyecto sin capturas no enseña ese apartado', async ({ page }, testInfo) => {
      test.skip(!noShots, 'Todos los proyectos tienen capturas');
      await openDetail(page, testInfo.project.name, noShots!.id);
      await expect(page.getByTestId('project-screenshots')).toHaveCount(0);
    });

    test('un proyecto que no existe no rompe la app: se queda en la vista general', async ({ page }, testInfo) => {
      test.skip(isMobile(testInfo.project.name), 'Se prueba desde el escritorio');
      await page.getByTestId('desktop-icon-projects').dblclick();
      await expect(page.getByTestId('projects')).toBeVisible();
      await expect(page.getByTestId('project-detail')).toHaveCount(0);
    });
  });

  test('la vista general y el detalle no tienen errores de accesibilidad en claro ni en oscuro', async ({ page }, testInfo) => {
    await openDetail(page, testInfo.project.name, withRepo.id);
    await click(page, 'project-shot-0', testInfo.project.name);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await animationsDone(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `ampliación, tema ${theme}`).toEqual([]);
    }
    await click(page, 'project-lightbox-close', testInfo.project.name);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await animationsDone(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `detalle, tema ${theme}`).toEqual([]);
    }
    await click(page, 'projects-back', testInfo.project.name);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, 'vista general').toEqual([]);
  });
});
