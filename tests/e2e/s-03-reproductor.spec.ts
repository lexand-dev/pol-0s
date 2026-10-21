import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, enter, failCurrent, loadFavorites, nextControlKey, setPlayerState, stubExternalSites, stubYouTube, youtubeCalls, youtubeLoads } from './helpers';

const [, movies, , music] = loadFavorites();
const isMobile = (name: string) => name.endsWith('movil');

async function openSection(page: Page, projectName: string, id: 'movies' | 'music') {
  if (isMobile(projectName)) await page.getByTestId('mobile-icon-favorites').tap();
  else await page.getByTestId('desktop-icon-favorites').dblclick();
  await expect(page.getByTestId('favorites-card-music')).toBeVisible();
  await page.getByTestId(`favorites-card-${id}`).click();
  await expect(page.getByTestId('favorites-title')).toBeVisible();
}

const play = (page: Page, index: number) => page.getByTestId(`favorites-play-${music.items[index].id}`).click();

test.describe('S-03 Reproductor: controles', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
    await stubYouTube(context);
    await enter(page);
  });

  test('una barra bajo el vídeo con anterior, reproducir/pausar y siguiente, y la posición en la lista', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 2);
    const mini = page.getByTestId('miniplayer');
    await expect(mini).toBeVisible();
    for (const id of ['prev', 'toggle', 'next']) await expect(page.getByTestId(`miniplayer-${id}`)).toBeVisible();
    await expect(page.getByTestId('miniplayer-subtitle')).toHaveText(`${music.items[2].artist as string} · 3 de ${music.items.length}`);
    const video = (await page.getByTestId('miniplayer-video').boundingBox())!;
    const bar = (await page.getByTestId('miniplayer-toggle').boundingBox())!;
    expect(bar.y).toBeGreaterThanOrEqual(video.y + video.height);
  });

  test('«anterior» y «siguiente» cambian de canción y de posición', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 1);
    await page.getByTestId('miniplayer-next').click();
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items[2].title);
    await expect(page.getByTestId('miniplayer-subtitle')).toContainText('3 de');
    await page.getByTestId('miniplayer-prev').click();
    await page.getByTestId('miniplayer-prev').click();
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items[0].title);
    expect(await youtubeLoads(page)).toEqual([music.items[1].video, music.items[2].video, music.items[1].video, music.items[0].video]);
  });

  test('en la primera canción «anterior» está desactivado, y en la última, «siguiente»; pulsarlos no hace nada', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 0);
    const prev = page.getByTestId('miniplayer-prev');
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('miniplayer-next')).toHaveAttribute('aria-disabled', 'false');
    await prev.click({ force: true }); // Playwright trata aria-disabled como desactivado: se fuerza el clic para comprobar que no hace nada
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items[0].title);
    await play(page, music.items.length - 1);
    const next = page.getByTestId('miniplayer-next');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(prev).toHaveAttribute('aria-disabled', 'false');
    await next.click({ force: true });
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items.at(-1)!.title);
  });

  test('el botón desactivado sigue enfocable: el teclado no pierde el sitio al llegar al final de la lista', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay teclado.');
    await openSection(page, testInfo.project.name, 'music');
    await play(page, music.items.length - 2);
    const next = page.getByTestId('miniplayer-next');
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items.at(-1)!.title);
    await expect(next).toBeFocused();
  });

  test('reproducir/pausar da la orden al vídeo y el botón cambia de nombre', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 0);
    const toggle = page.getByTestId('miniplayer-toggle');
    await expect(toggle).toHaveAccessibleName('Pausar');
    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Reproducir');
    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Pausar');
    expect((await youtubeCalls(page)).slice(-2)).toEqual(['pause', 'play']);
  });

  test('el botón refleja el estado real: si el vídeo se pausa por su cuenta, pasa a «Reproducir»', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 0);
    const toggle = page.getByTestId('miniplayer-toggle');
    await expect(toggle).toHaveAccessibleName('Pausar');
    await setPlayerState(page, 2);
    await expect(toggle).toHaveAccessibleName('Reproducir');
    await setPlayerState(page, 1);
    await expect(toggle).toHaveAccessibleName('Pausar');
  });

  test('un tráiler solo tiene reproducir/pausar: sin anterior, siguiente ni posición', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'movies');
    await page.getByTestId(`favorites-trailer-${movies.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer-toggle')).toBeVisible();
    await expect(page.getByTestId('miniplayer-prev')).toHaveCount(0);
    await expect(page.getByTestId('miniplayer-next')).toHaveCount(0);
    await expect(page.getByTestId('miniplayer-subtitle')).not.toContainText(' de ');
  });

  test('si el vídeo no carga, desaparecen los controles y queda el aviso con el enlace', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 0);
    await expect(page.getByTestId('miniplayer-toggle')).toBeVisible();
    await failCurrent(page);
    await expect(page.getByTestId('miniplayer-error')).toBeVisible();
    await expect(page.getByTestId('miniplayer-toggle')).toHaveCount(0);
    await expect(page.getByTestId('miniplayer-fallback')).toBeVisible();
  });

  test('en la lista, la canción que suena queda marcada y su botón lo dice', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 1);
    const row = page.getByTestId(`favorites-item-${music.items[1].id}`);
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId(`favorites-play-${music.items[1].id}`)).toHaveAccessibleName(/sonando ahora/);
    await expect(page.getByTestId(`favorites-play-${music.items[0].id}`)).toHaveAccessibleName(/^Reproducir/);
    await page.getByTestId('miniplayer-next').click();
    await expect(page.getByTestId(`favorites-item-${music.items[2].id}`)).toHaveAttribute('aria-current', 'true');
    await expect(row).not.toHaveAttribute('aria-current', 'true');
  });

  test('los botones se tocan bien: 48 px (móvil) o 36 px (escritorio) en la barra, y sin solaparse', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 1);
    const min = isMobile(testInfo.project.name) ? 48 : 36;
    const boxes = [];
    for (const id of ['prev', 'toggle', 'next']) {
      const box = (await page.getByTestId(`miniplayer-${id}`).boundingBox())!;
      expect(box.width, id).toBeGreaterThanOrEqual(min);
      expect(box.height, id).toBeGreaterThanOrEqual(min);
      boxes.push(box);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x, `separación ${i}`).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width + 8);
    const close = (await page.getByTestId('miniplayer-close').boundingBox())!;
    expect(close.width).toBeGreaterThanOrEqual(isMobile(testInfo.project.name) ? 44 : 32);
  });

  test('en el móvil, los botones de la lista (play y enlace) miden al menos 44 px', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), 'Solo en pantalla táctil.');
    await openSection(page, testInfo.project.name, 'music');
    for (const item of music.items) {
      const row = page.getByTestId(`favorites-item-${item.id}`);
      for (const target of [page.getByTestId(`favorites-play-${item.id}`), row.getByRole('link')]) {
        const box = (await target.boundingBox())!;
        expect(box.width, item.id).toBeGreaterThanOrEqual(44);
        expect(box.height, item.id).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('el reproductor cabe en la pantalla, no desborda y el vídeo sigue por encima de 200 px', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 0);
    const viewport = page.viewportSize()!;
    const mini = (await page.getByTestId('miniplayer').boundingBox())!;
    expect(mini.x).toBeGreaterThanOrEqual(0);
    expect(mini.y).toBeGreaterThanOrEqual(0);
    expect(mini.x + mini.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(mini.y + mini.height).toBeLessThanOrEqual(viewport.height + 1);
    const video = (await page.getByTestId('miniplayer-video').boundingBox())!;
    expect(video.width).toBeGreaterThanOrEqual(200);
    expect(video.height).toBeGreaterThanOrEqual(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (isMobile(testInfo.project.name)) expect(mini.width).toBeGreaterThan(viewport.width - 40);
  });

  test('con el reproductor abierto, la última canción de la lista se puede alcanzar y no queda tapada', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 0);
    await expect(page.getByTestId('miniplayer-toggle')).toBeVisible();
    const last = page.getByTestId(`favorites-play-${music.items.at(-1)!.id}`);
    await last.scrollIntoViewIfNeeded();
    await page.getByTestId('favorites-list-music').evaluate((el) => el.closest('.scroll')!.scrollTo({ top: 99999 }));
    const covered = await last.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit !== null && !el.contains(hit) && !!hit.closest('[data-testid="miniplayer"]');
    });
    expect(covered).toBe(false);
    await last.click();
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items.at(-1)!.title);
  });

  test('con el teclado: se llega a anterior, reproducir/pausar y siguiente, y Enter los acciona', async ({ page, browserName }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay teclado.');
    await openSection(page, testInfo.project.name, 'music');
    await play(page, 1);
    await page.getByTestId('miniplayer-prev').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items[0].title);
    await page.keyboard.press(nextControlKey(browserName));
    await expect(page.getByTestId('miniplayer-toggle')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('miniplayer-toggle')).toHaveAccessibleName('Reproducir');
    await page.keyboard.press(nextControlKey(browserName));
    await expect(page.getByTestId('miniplayer-next')).toBeFocused();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`el reproductor con sus controles no tiene problemas de accesibilidad (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openSection(page, testInfo.project.name, 'music');
      await play(page, 1);
      await expect(page.getByTestId('miniplayer-toggle')).toBeVisible();
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});
