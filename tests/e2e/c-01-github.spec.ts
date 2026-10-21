import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { ReposFile } from '../../src/lib/repos';
import { animationsDone, enter, loadProjects, stubExternalSites } from './helpers';
import { PERSONA } from '../../src/content/persona';

const isMobile = (name: string) => name.endsWith('movil');
const projects = loadProjects();
const withRepo = projects.find((p) => p.repo)!;

/** El archivo real, tal cual lo deja la tarea diaria. */
const REAL = JSON.parse(readFileSync(new URL('../../src/content/repos.json', import.meta.url), 'utf8')) as ReposFile;

/** Unos repositorios de ejemplo, fijos: los tests no dependen de lo que Pol etiquete. */
const SAMPLE: ReposFile = {
  generatedAt: '2026-10-16',
  repos: [
    {
      name: 'ytmd',
      url: 'https://github.com/tu-usuario/ytmd',
      description: 'Aplicación de escritorio para escuchar YouTube Music.',
      homepage: 'https://ytmd.example.dev/',
      language: 'Python',
      stars: 4,
      forks: 1,
      pushedAt: '2026-10-12T10:00:00Z',
      archived: false,
    },
    {
      name: withRepo.repo!.split('/')[1],
      url: `https://github.com/${withRepo.repo}`,
      description: withRepo.summary,
      homepage: null,
      language: 'TypeScript',
      stars: 2,
      forks: 0,
      pushedAt: '2026-10-01T10:00:00Z',
      archived: false,
    },
    {
      name: 'viejo',
      url: 'https://github.com/tu-usuario/viejo',
      description: null,
      homepage: null,
      language: null,
      stars: 0,
      forks: 0,
      pushedAt: '2024-01-01T10:00:00Z',
      archived: true,
    },
  ],
};

async function serve(page: Page, data: ReposFile | 'fail' | 'real') {
  if (data === 'real') return;
  await page.route('**/repos.json', (route) => (data === 'fail' ? route.abort() : route.fulfill({ json: data })));
}

async function openGithub(page: Page, projectName: string) {
  if (isMobile(projectName)) await page.getByTestId('mobile-icon-github').tap();
  else await page.getByTestId('desktop-icon-github').dblclick();
  await expect(page.getByTestId('github')).toBeVisible();
  await expect(page.getByTestId('github')).not.toHaveClass(/loading/);
}

test.describe('C-01 GitHub', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
  });

  test('el icono de GitHub abre la ventana con los repositorios destacados, en orden; antes no se descarga', async ({ page }, testInfo) => {
    await serve(page, SAMPLE);
    const requested: string[] = [];
    // El código de la ventana. (En desarrollo, Vite pide la hoja `github.css?url` con la home; en la compilación la home no la enlaza:
    // lo comprueba s-06 con las peticiones de la home.)
    page.on('request', (r) => r.url().includes('/apps/github/Github.svelte') && requested.push(r.url()));
    await enter(page);
    expect(requested).toEqual([]);
    await openGithub(page, testInfo.project.name);
    expect(requested.length).toBeGreaterThan(0);
    await expect(page.getByTestId('github-count')).toHaveText('3 repositorios');
    await expect(page.locator('[data-testid^="github-repo-"]')).toHaveCount(3);
    const names = await page.locator('.gh-name').allTextContents();
    expect(names).toEqual(SAMPLE.repos.map((r) => r.name));
  });

  test('cada tarjeta enseña lo de GitHub y enlaza de forma segura en una pestaña nueva', async ({ page }, testInfo) => {
    // Reloj fijo: «Actualizado hace…» depende de la fecha, y la del repositorio de ejemplo (12 de octubre) envejece.
    await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
    await serve(page, SAMPLE);
    await enter(page);
    await openGithub(page, testInfo.project.name);
    const card = page.getByTestId('github-repo-ytmd');
    await expect(card).toContainText('Aplicación de escritorio para escuchar YouTube Music.');
    await expect(card).toContainText('Python');
    await expect(card).toContainText('Público');
    await expect(card.getByLabel('4 estrellas')).toBeVisible();
    await expect(card.getByLabel('1 forks')).toBeVisible();
    await expect(card).toContainText('Actualizado hace');
    const name = card.locator('.gh-name');
    await expect(name).toHaveAttribute('href', 'https://github.com/tu-usuario/ytmd');
    for (const link of [name, card.getByTestId('github-homepage')]) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    await expect(card.getByTestId('github-homepage')).toHaveText('ytmd.example.dev');
    await expect(page.getByTestId('github-repo-viejo')).toContainText('Archivado');
    const profile = page.getByTestId('github-profile');
    await expect(profile).toHaveAttribute('href', `https://github.com/${PERSONA.github}`);
    await expect(profile).toHaveAttribute('target', '_blank');
  });

  test('«En Proyectos» sale solo en el repositorio que también es un proyecto, y abre su ficha', async ({ page }, testInfo) => {
    await serve(page, SAMPLE);
    await enter(page);
    await openGithub(page, testInfo.project.name);
    await expect(page.getByTestId('github-in-projects')).toHaveCount(1);
    await page.getByTestId('github-in-projects').click();
    await expect(page.getByTestId('project-detail')).toBeVisible();
    await expect(page.getByTestId('project-detail')).toContainText(withRepo.name);
  });

  test('sin repositorios etiquetados, avisa y deja el botón al perfil', async ({ page }, testInfo) => {
    await serve(page, { generatedAt: '2026-10-16', repos: [] });
    await enter(page);
    await openGithub(page, testInfo.project.name);
    await expect(page.getByTestId('github-empty')).toBeVisible();
    await expect(page.getByTestId('github-count')).toHaveText('0 repositorios');
    await expect(page.getByTestId('github-profile')).toBeVisible();
  });

  test('con el archivo real, enseña una tarjeta por repositorio', async ({ page }, testInfo) => {
    await serve(page, 'real');
    await enter(page);
    await openGithub(page, testInfo.project.name);
    const n = REAL.repos.length;
    await expect(page.getByTestId('github-count')).toHaveText(`${n} ${n === 1 ? 'repositorio' : 'repositorios'}`);
    if (n === 0) await expect(page.getByTestId('github-empty')).toBeVisible();
    for (const r of REAL.repos) await expect(page.getByTestId(`github-repo-${r.name}`)).toBeVisible();
  });

  test('negativo: si el archivo no se puede cargar, lo dice', async ({ page }, testInfo) => {
    await serve(page, 'fail');
    await enter(page);
    await openGithub(page, testInfo.project.name);
    await expect(page.getByTestId('github-error')).toBeVisible();
  });

  test('se abre también desde la Terminal con open github', async ({ page }, testInfo) => {
    await serve(page, SAMPLE);
    await enter(page);
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
    else await page.getByTestId('dock-item-terminal').click();
    await page.getByTestId('terminal-input').fill('open github');
    await page.getByTestId('terminal-input').press('Enter');
    await expect(page.getByTestId('github-list')).toBeVisible();
  });

  test('en el móvil, una columna y sin desbordar', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), 'Solo en el móvil.');
    await serve(page, SAMPLE);
    await enter(page);
    await openGithub(page, testInfo.project.name);
    const boxes = await page.locator('[data-testid^="github-repo-"]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
    expect(new Set(boxes.map(Math.round)).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`no tiene problemas de accesibilidad (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await serve(page, SAMPLE);
      await enter(page);
      await openGithub(page, testInfo.project.name);
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});
