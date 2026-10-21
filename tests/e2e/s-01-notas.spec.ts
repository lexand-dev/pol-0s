import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LINKS } from '../../src/content/links';
import { animationsDone, enter, loadNotes, stubExternalSites } from './helpers';
import { PERSONA } from '../../src/content/persona';

const notes = loadNotes();
const first = notes[0];
const other = notes[3];
const newsletter = LINKS.find((l) => l.id === 'newsletter')!;

const isMobile = (name: string) => name.endsWith('movil');

/** Abre la lista de notas como lo haría un visitante: doble clic en la carpeta del escritorio o, en móvil, la carpeta de inicio. */
async function openFolder(page: Page, projectName: string) {
  if (isMobile(projectName)) {
    await page.getByTestId('mobile-icon-folder-notes').tap();
    await expect(page.getByTestId('mobile-folder')).toBeVisible();
  } else {
    await page.getByTestId('desktop-icon-notes').dblclick();
    await expect(page.getByTestId('notes-folder')).toBeVisible();
  }
}

/** Abre una nota: en escritorio con doble clic en su icono; en móvil con un toque en la carpeta. */
async function openNote(page: Page, projectName: string, id: string) {
  if (isMobile(projectName)) {
    await openFolder(page, projectName);
    await page.getByTestId(`mobile-icon-note-${id}`).tap();
  } else {
    await openFolder(page, projectName);
    await page.getByTestId(`notes-item-${id}`).dblclick();
  }
  await expect(page.getByTestId('note')).toHaveAttribute('data-note', id);
  await expect(page.getByTestId('note-title')).toBeVisible();
}

test.describe('S-01 Notas', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
  });

  test('la carpeta tiene una nota por cada archivo, la más reciente primero', async ({ page }, testInfo) => {
    await enter(page);
    await openFolder(page, testInfo.project.name);
    if (isMobile(testInfo.project.name)) {
      const ids = await page.locator('[data-testid^="mobile-icon-note-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.replace('mobile-icon-note-', '')));
      expect(ids).toEqual(notes.map((n) => n.id));
    } else {
      const items = page.locator('[data-testid^="notes-item-"]');
      await expect(items).toHaveCount(notes.length);
      const ids = await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.replace('notes-item-', '')));
      expect(ids).toEqual(notes.map((n) => n.id));
      await expect(page.getByTestId(`notes-item-${first.id}`)).toContainText(first.title);
    }
  });

  test('una nota se abre con su título, su subtítulo, su fecha, sus etiquetas y su texto', async ({ page }, testInfo) => {
    await enter(page);
    await openNote(page, testInfo.project.name, first.id);
    await expect(page.getByTestId('note-title')).toHaveText(first.title);
    await expect(page.getByTestId('note-subtitle')).toHaveText(first.description);
    await expect(page.getByTestId('note-date')).toHaveAttribute('datetime', first.date);
    for (const tag of first.tags) await expect(page.getByTestId('note-tags')).toContainText(tag);
    // El cuerpo es el de la nota: una frase de su primer párrafo.
    const firstWords = first.body.split('\n').find((l) => /^[A-ZÁÉÍÓÚ¿¡]/.test(l))!.slice(0, 30);
    await expect(page.getByTestId('note-body')).toContainText(firstWords.replace(/[*_`[\]]/g, '').slice(0, 20));
  });

  test('cada nota termina con la invitación a suscribirse a la newsletter, en una pestaña nueva', async ({ page }, testInfo) => {
    await enter(page);
    await openNote(page, testInfo.project.name, other.id);
    const cta = page.getByTestId('note-subscribe');
    await expect(cta).toContainText(PERSONA.newsletter!.name);
    const link = cta.getByRole('link');
    await expect(link).toHaveAttribute('href', newsletter.url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('los enlaces del texto de la nota se abren en una pestaña nueva y sin referrer', async ({ page }, testInfo) => {
    await enter(page);
    await openNote(page, testInfo.project.name, first.id);
    const links = page.getByTestId('note-body').locator('a[href]');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const link = links.nth(i);
      const href = (await link.getAttribute('href'))!;
      if (!/^https?:/.test(href)) continue;
      await expect(link, href).toHaveAttribute('target', '_blank');
      await expect(link, href).toHaveAttribute('rel', /noopener/);
    }
  });

  test('si el texto no se puede cargar, la nota avisa en vez de quedarse vacía', async ({ page }, testInfo) => {
    await page.route(/\/notas\/[^/]+\.json$/, (route) => route.abort());
    await enter(page);
    if (isMobile(testInfo.project.name)) {
      await page.getByTestId('mobile-icon-folder-notes').tap();
      await page.getByTestId(`mobile-icon-note-${first.id}`).tap();
    } else {
      await page.getByTestId('desktop-icon-notes').dblclick();
      await page.getByTestId(`notes-item-${first.id}`).dblclick();
    }
    await expect(page.getByTestId('note-error')).toBeVisible();
    await expect(page.getByTestId('note-title')).toHaveCount(0);
  });

  test('un solo clic en una nota de la carpeta la selecciona, pero no la abre', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil un toque abre: no hay selección.');
    await enter(page);
    await openFolder(page, testInfo.project.name);
    const item = page.getByTestId(`notes-item-${first.id}`);
    await item.click();
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('note')).toHaveCount(0);
    // Con el teclado, Enter abre.
    await item.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('note')).toHaveAttribute('data-note', first.id);
  });

  test('la ventana de la nota lleva el título de la nota', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay ventanas.');
    await enter(page);
    await openNote(page, testInfo.project.name, other.id);
    await expect(page.getByTestId('window-note:' + other.id).getByTestId('window-titlebar')).toContainText(other.title);
  });

  test.describe('enlace directo desde la página pública de la nota', () => {
    test('/?nota=<nombre> abre la nota al entrar y deja la dirección limpia', async ({ page }) => {
      await page.goto(`/?nota=${other.id}`);
      await expect(page.getByTestId('lock-enter')).toBeFocused();
      // La dirección ya no lleva el parámetro: recargar no reabre la nota.
      expect(new URL(page.url()).search).toBe('');
      // Hasta entrar no hay nota.
      await expect(page.getByTestId('note')).toHaveCount(0);
      await page.getByTestId('lock-enter').click();
      await expect(page.getByTestId('note')).toHaveAttribute('data-note', other.id);
      await expect(page.getByTestId('note-title')).toHaveText(other.title);
    });

    test('recargar la página no reabre la nota', async ({ page }) => {
      await page.goto(`/?nota=${other.id}`);
      await expect(page.getByTestId('lock-enter')).toBeFocused();
      await page.reload();
      await expect(page.getByTestId('lock-enter')).toBeFocused();
      await page.getByTestId('lock-enter').click();
      await expect(page.getByTestId('lock-screen')).toHaveCount(0);
      await expect(page.getByTestId('note')).toHaveCount(0);
    });

    for (const bad of ['no-existe', '..%2F..%2Fetc%2Fpasswd', '%3Cscript%3Ealert(1)%3C%2Fscript%3E', 'NOTA']) {
      test(`un nombre que no existe (${bad}) se ignora sin romper nada`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`/?nota=${bad}`);
        await expect(page.getByTestId('lock-enter')).toBeFocused();
        await page.getByTestId('lock-enter').click();
        await expect(page.getByTestId('lock-screen')).toHaveCount(0);
        await expect(page.getByTestId('note')).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  });

  test('en la Terminal, notes lista las notas y open <nota> abre la que se pide', async ({ page }, testInfo) => {
    await enter(page);
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
    else await page.getByTestId('dock-item-terminal').click();
    const input = page.getByTestId('terminal-input');
    await expect(input).toBeFocused();
    await input.fill('notes');
    await input.press('Enter');
    for (const n of notes) {
      await expect(page.getByTestId('terminal-log')).toContainText(n.id);
      await expect(page.getByTestId('terminal-log')).toContainText(n.title);
    }
    await input.fill(`open ${other.id}`);
    await input.press('Enter');
    await expect(page.getByTestId('note')).toHaveAttribute('data-note', other.id);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`la carpeta y una nota no tienen problemas de accesibilidad (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await enter(page);
      await openNote(page, testInfo.project.name, first.id);
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page }).include('[data-testid="note"]').analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      if (!isMobile(testInfo.project.name)) {
        await page.getByTestId('window-note:' + first.id).getByTestId('window-close').click();
        await openFolder(page, testInfo.project.name);
        const folder = await new AxeBuilder({ page }).include('[data-testid="notes-folder"]').analyze();
        expect(folder.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      }
    });
  }

  test('la home sin JavaScript enlaza a cada nota', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    for (const n of notes) await expect(page.locator(`nav[aria-label="Notas"] a[href="/notas/${n.id}/"]`)).toHaveCount(1);
    await context.close();
  });
});
