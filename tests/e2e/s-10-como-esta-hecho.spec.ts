import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TECHS } from '../../src/lib/tech-logos';
import { animationsDone, enter, loadProjects, openProjectDetail, stubExternalSites } from './helpers';

const isMobile = (name: string) => name.endsWith('movil');
const polOs = loadProjects().find((p) => p.id === 'este-portfolio')!;
const SECTIONS = ['que-es', 'tecnologias', 'como-funciona-por-dentro', 'como-se-actualizan-solos-los-datos', 'el-formulario-de-correo-y-el-libro-de-visitas', 'como-se-trabaja', 'limitaciones-los-bloqueos-de-laliga'];

/** Abre el documento como lo haría un visitante: doble clic en su icono o, en móvil, un toque en la pantalla de inicio. */
async function openHowTo(page: Page, projectName: string) {
  if (isMobile(projectName)) await page.getByTestId('mobile-icon-howto').tap();
  else await page.getByTestId('desktop-icon-howto').dblclick();
  const doc = page.getByTestId('howto');
  await expect(doc).toBeVisible();
  await expect(page.getByTestId('howto-title')).toBeVisible();
  return doc;
}

test.describe('S-10 Cómo está hecho', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
    await enter(page);
  });

  test('se abre desde el escritorio con su título y un índice con las siete secciones', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    await expect(page.getByTestId('howto-title')).toHaveText('Cómo está hecho este portfolio');
    for (const id of SECTIONS) await expect(doc.getByTestId(`howto-toc-${id}`)).toBeVisible();
    await expect(doc.locator('[data-testid^="howto-toc-"]')).toHaveCount(SECTIONS.length);
    for (const id of SECTIONS) await expect(doc.locator(`h2[id="${id}"]`)).toHaveCount(1);
  });

  test('se abre desde el detalle del proyecto Pol OS, y solo desde ese', async ({ page }, testInfo) => {
    await openProjectDetail(page, testInfo.project.name, polOs);
    await page.getByTestId('project-howto').click();
    await expect(page.getByTestId('howto')).toBeVisible();
    await expect(page.getByTestId('howto-title')).toBeVisible();

    // En cualquier otro proyecto no hay botón.
    const other = loadProjects().find((p) => p.id !== 'este-portfolio' && p.placement === 'folder')!;
    await page.getByTestId(isMobile(testInfo.project.name) ? 'mobile-back' : 'window-close').first().click();
    await openProjectDetail(page, testInfo.project.name, other);
    await expect(page.getByTestId('project-howto')).toHaveCount(0);
  });

  test('se abre desde la Terminal con `open readme` y con `open como`', async ({ page }, testInfo) => {
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
    else await page.getByTestId('dock-item-terminal').click();
    const input = page.getByTestId('terminal-input');
    await expect(input).toBeFocused();
    await input.fill('ls');
    await input.press('Enter');
    await expect(page.getByTestId('terminal-log')).toContainText('Cómo está hecho');
    await input.fill('open readme');
    await input.press('Enter');
    await expect(page.getByTestId('howto')).toBeVisible();
    if (isMobile(testInfo.project.name)) return; // en móvil el documento ocupa la pantalla y la Terminal queda debajo
    await page.getByTestId('window-howto').getByTestId('window-close').click();
    await expect(page.getByTestId('howto')).toHaveCount(0);
    await page.getByTestId('terminal-input').fill('open como');
    await page.getByTestId('terminal-input').press('Enter');
    await expect(page.getByTestId('howto')).toBeVisible();
  });

  test('cada punto del índice lleva a su sección y la deja a la vista', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    await animationsDone(page);
    const last = SECTIONS.at(-1)!;
    await doc.getByTestId(`howto-toc-${last}`).click();
    const heading = doc.locator(`h2[id="${last}"]`);
    await expect(heading).toBeFocused();
    await expect
      .poll(async () => {
        const desk = (await doc.locator('.desk').boundingBox())!;
        const h = (await heading.boundingBox())!;
        return h.y >= desk.y - 1 && h.y + h.height <= desk.y + desk.height + 1;
      })
      .toBe(true);
    // Y no toca la dirección de la página.
    expect(new URL(page.url()).hash).toBe('');
  });

  test('cada tecnología sale con su nombre y su logo, o con sus iniciales si no tiene logo', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    await expect(doc.locator('[data-testid^="howto-tech-"]')).toHaveCount(TECHS.length);
    for (const t of TECHS) {
      const item = doc.getByTestId(`howto-tech-${t.id}`);
      await expect(item).toContainText(t.name);
      await expect(item).toContainText(t.role);
      if (t.logo) {
        await expect(item).toHaveAttribute('data-logo', 'svg');
        await expect(item.locator('svg path')).toHaveAttribute('d', t.logo);
        const size = await item.locator('svg').boundingBox();
        expect(size!.width, t.id).toBeGreaterThan(10);
      } else {
        await expect(item).toHaveAttribute('data-logo', 'text');
        await expect(item.locator('svg')).toHaveCount(0);
        await expect(item.locator('.initials')).not.toBeEmpty();
      }
    }
    expect(TECHS.some((t) => !t.logo)).toBe(true);
  });

  test('el texto cuenta la actualización de datos, el Libro de visitas y los bloqueos de LaLiga', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    const body = doc.getByTestId('howto-body');
    await expect(body).toContainText('token de GitHub de solo lectura');
    await expect(body).toContainText('cifrada y autenticada');
    await expect(body).toContainText('LaLiga');
    await expect(body).toContainText('hayahora.futbol');
    await expect(body).toContainText('Por qué no se ha cambiado');
  });

  test('los enlaces externos se abren en una pestaña nueva y sin dar acceso a Pol OS', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    const links = doc.getByTestId('howto-body').locator('a[href^="http"]');
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute('target', '_blank');
      await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
    }
  });

  test('los enlaces a apps del texto abren esa app en el escritorio', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    await doc.getByRole('link', { name: 'Stack', exact: true }).click();
    await expect(page.getByTestId('stack')).toBeVisible();
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-back').tap();
    else await page.getByTestId('window-stack').getByTestId('window-close').click();
    await openHowTo(page, testInfo.project.name);
    await page.getByTestId('howto').getByRole('link', { name: 'Libro de visitas' }).click();
    await expect(page.getByTestId('guestbook')).toBeVisible();
  });

  test('no enseña ninguna clave, token, correo ni nombre de secreto', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    const text = await doc.getByTestId('howto-body').innerText();
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(text).not.toMatch(/\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{10,}/);
    expect(text).not.toMatch(/GUESTBOOK_SECRET|STACK_GITHUB_TOKEN|TURNSTILE_SECRET_KEY|CONTACT_TO|SITE_URL/);
  });

  test('si el documento no se puede cargar, avisa en vez de quedarse vacío', async ({ page }, testInfo) => {
    await page.route('**/como-esta-hecho.json', (route) => route.abort());
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-icon-howto').tap();
    else await page.getByTestId('desktop-icon-howto').dblclick();
    await expect(page.getByTestId('howto-error')).toBeVisible();
    await expect(page.getByTestId('howto-title')).toHaveCount(0);
  });

  test('no se desborda por los lados, ni con el texto más grande', async ({ page }, testInfo) => {
    const doc = await openHowTo(page, testInfo.project.name);
    const overflow = () => doc.locator('.desk').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.evaluate(() => document.documentElement.setAttribute('data-text', 'muy-grande'));
    await animationsDone(page);
    expect(await overflow()).toBeLessThanOrEqual(1);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`el documento no tiene problemas de accesibilidad (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openHowTo(page, testInfo.project.name);
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page }).include('[data-testid="howto"]').analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});
