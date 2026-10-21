import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, endCurrent, enter, failCurrent, loadFavorites, stubExternalSites, stubYouTube, youtubeLoads } from './helpers';

const [games, movies, books, music] = loadFavorites();
const isMobile = (name: string) => name.endsWith('movil');
const YOUTUBE_HOSTS = /youtube|ytimg|googlevideo|ggpht|youtu\.be/i;

/** Abre Favoritos como lo haría un visitante: doble clic en el escritorio o un toque en la pantalla de inicio. */
async function openFavorites(page: Page, projectName: string) {
  if (isMobile(projectName)) await page.getByTestId('mobile-icon-favorites').tap();
  else await page.getByTestId('desktop-icon-favorites').dblclick();
  await expect(page.getByTestId('favorites')).toBeVisible();
  await expect(page.getByTestId('favorites-card-music')).toBeVisible();
}

async function openSection(page: Page, projectName: string, id: 'games' | 'movies' | 'books' | 'music') {
  await openFavorites(page, projectName);
  await page.getByTestId(`favorites-card-${id}`).click();
  await expect(page.getByTestId('favorites-title')).toBeVisible();
}

test.describe('S-03 Favoritos', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
    await stubYouTube(context);
    await enter(page);
  });

  test('la carpeta tiene las cuatro secciones y cada una dice que es un top 10', async ({ page }, testInfo) => {
    await openFavorites(page, testInfo.project.name);
    const counts = { games: games.items.length, movies: movies.items.length, books: books.items.length, music: music.items.length };
    for (const [id, label] of [['games', 'Videojuegos'], ['movies', 'Películas y series'], ['books', 'Libros'], ['music', 'Música']] as const) {
      const card = page.getByTestId(`favorites-card-${id}`);
      await expect(card).toContainText(label);
      // «Top N»: tantos como haya en la sección (el contenido de ejemplo de la plantilla tiene menos de diez).
      await expect(card).toContainText(`Top ${counts[id]}`);
    }
    await expect(page.locator('[data-testid^="favorites-card-"]')).toHaveCount(4);
  });

  test('cada tarjeta lleva a su sección, y «Favoritos» vuelve atrás', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'books');
    await expect(page.getByTestId('favorites-title')).toHaveText('Libros');
    await page.getByTestId('favorites-back').click();
    await expect(page.getByTestId('favorites-card-games')).toBeVisible();
  });

  test('videojuegos: diez portadas, en su orden, que enlazan con su ficha de Shelvid en una pestaña nueva', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'games');
    const grid = page.getByTestId('favorites-grid-games');
    await expect(grid.locator('li')).toHaveCount(games.items.length);
    await expect(grid.locator('.name')).toHaveText(games.items.map((g) => g.title));
    for (const g of games.items) {
      const link = page.getByTestId(`favorites-item-${g.id}`).getByRole('link');
      await expect(link).toHaveAttribute('href', g.url as string);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      expect(g.url as string).toMatch(/^https:\/\/www\.shelvid\.com\/game\//);
    }
    await expect(page.getByTestId('favorites-credit')).toContainText('Shelvid');
    await expect(page.getByTestId('favorites-credit').getByRole('link')).toHaveAttribute('href', 'https://www.shelvid.com');
  });

  test('películas y series: diez fichas con póster, año, sinopsis y botón de tráiler', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'movies');
    const grid = page.getByTestId('favorites-grid-movies');
    await expect(grid.locator('li')).toHaveCount(movies.items.length);
    for (const m of movies.items) {
      const item = page.getByTestId(`favorites-item-${m.id}`);
      await expect(item).toContainText(m.title);
      await expect(item).toContainText(String(m.year));
      await expect(item).toContainText((m.synopsis as string).slice(0, 30));
      await expect(page.getByTestId(`favorites-trailer-${m.id}`)).toBeVisible();
    }
  });

  test('libros: diez portadas con su título y su autor', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'books');
    const grid = page.getByTestId('favorites-grid-books');
    await expect(grid.locator('li')).toHaveCount(books.items.length);
    for (const b of books.items) {
      const item = page.getByTestId(`favorites-item-${b.id}`);
      await expect(item).toContainText(b.title);
      await expect(item).toContainText(b.author as string);
    }
    // El enlace final (por ejemplo, a tu perfil de lectura) solo sale si está en el archivo.
    if (books.link) await expect(page.getByTestId('favorites-link').getByRole('link')).toHaveAttribute('href', books.link.url);
    else await expect(page.getByTestId('favorites-link')).toHaveCount(0);
  });

  test('música: una lista de diez canciones con portada, título, artista, enlace a YouTube Music y play', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await expect(page.getByTestId('favorites-list-music').locator('li')).toHaveCount(music.items.length);
    for (const s of music.items) {
      const row = page.getByTestId(`favorites-item-${s.id}`);
      await expect(row).toContainText(s.title);
      await expect(row).toContainText(s.artist as string);
      await expect(row.getByRole('link')).toHaveAttribute('href', `https://music.youtube.com/watch?v=${s.video as string}`);
      await expect(row.getByRole('link')).toHaveAttribute('target', '_blank');
      await expect(page.getByTestId(`favorites-play-${s.id}`)).toBeVisible();
    }
  });

  test('todas las portadas cargan de verdad', async ({ page }, testInfo) => {
    await openFavorites(page, testInfo.project.name);
    for (const section of [games, movies, books, music]) {
      await page.getByTestId(`favorites-card-${section.kind}`).click();
      const covers = page.locator('[data-testid^="favorites-item-"] img');
      await expect(covers).toHaveCount(section.items.length);
      // Las portadas se cargan al acercarse a la pantalla (loading="lazy"), y Safari espera más que Chrome: se recorren como lo haría
      // alguien que baja por la lista.
      for (const cover of await covers.all()) await cover.scrollIntoViewIfNeeded();
      await expect
        .poll(() => covers.evaluateAll((els) => els.filter((el) => !(el as HTMLImageElement).complete || (el as HTMLImageElement).naturalWidth === 0).length), section.kind)
        .toBe(0);
      await page.getByTestId('favorites-back').click();
    }
  });

  test('antes de pulsar play no se pide nada a YouTube', async ({ page }, testInfo) => {
    const requested: string[] = [];
    page.on('request', (r) => YOUTUBE_HOSTS.test(new URL(r.url()).hostname) && requested.push(r.url()));
    await openSection(page, testInfo.project.name, 'music');
    await page.waitForTimeout(600);
    await page.getByTestId('favorites-back').click();
    await page.getByTestId('favorites-card-movies').click();
    await expect(page.getByTestId('favorites-grid-movies')).toBeVisible();
    expect(requested).toEqual([]);
    expect(await youtubeLoads(page)).toEqual([]);
    await expect(page.getByTestId('miniplayer')).toHaveCount(0);
  });

  test('pulsar play abre el mini reproductor con esa canción, desde el dominio sin cookies', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    const song = music.items[1];
    await page.getByTestId(`favorites-play-${song.id}`).click();
    const mini = page.getByTestId('miniplayer');
    await expect(mini).toBeVisible();
    await expect(mini).toHaveAttribute('data-video', song.video as string);
    await expect(page.getByTestId('miniplayer-title')).toHaveText(song.title);
    await expect(page.getByTestId('miniplayer-subtitle')).toContainText(song.artist as string);
    await expect(mini.locator('iframe[data-fake-youtube]')).toHaveCount(1);
    expect(await youtubeLoads(page)).toEqual([song.video]);
    expect(await page.evaluate(() => (window as unknown as { __yt: { host: string; playerVars: Record<string, number> } }).__yt)).toMatchObject({
      host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, rel: 0 },
    });
  });

  test('el vídeo está siempre a la vista y mide al menos 200 × 200, como piden las condiciones de YouTube', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    const box = (await page.getByTestId('miniplayer-video').boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(200);
    expect(box.height).toBeGreaterThanOrEqual(200);
    const viewport = page.viewportSize()!;
    const mini = (await page.getByTestId('miniplayer').boundingBox())!;
    expect(mini.x).toBeGreaterThanOrEqual(0);
    expect(mini.y).toBeGreaterThanOrEqual(0);
    expect(mini.x + mini.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(mini.y + mini.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.getByTestId('miniplayer-video')).toBeVisible();
    expect(await page.getByTestId('miniplayer-video').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
  });

  test('pulsar otra canción sustituye a la anterior en el mismo reproductor', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer')).toHaveAttribute('data-video', music.items[0].video as string);
    await page.getByTestId(`favorites-play-${music.items[3].id}`).click();
    await expect(page.getByTestId('miniplayer')).toHaveAttribute('data-video', music.items[3].video as string);
    await expect(page.getByTestId('miniplayer')).toHaveCount(1);
    expect(await youtubeLoads(page)).toEqual([music.items[0].video, music.items[3].video]);
    expect(await page.evaluate(() => (window as unknown as { __yt: { players: unknown[] } }).__yt.players.length)).toBe(1);
  });

  test('«siguiente» pasa a la canción siguiente de la lista y, en la última, queda desactivado', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items.at(-2)!.id}`).click();
    await expect(page.getByTestId('miniplayer-next')).toBeVisible();
    await page.getByTestId('miniplayer-next').click();
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items.at(-1)!.title);
    await expect(page.getByTestId('miniplayer-next')).toHaveAttribute('aria-disabled', 'true');
  });

  test('cuando una canción acaba, suena la siguiente; al acabar la última, se queda parado', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items.at(-2)!.id}`).click();
    await expect(page.getByTestId('miniplayer')).toBeVisible();
    await endCurrent(page);
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items.at(-1)!.title);
    await endCurrent(page);
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items.at(-1)!.title);
    expect((await youtubeLoads(page)).at(-1)).toBe(music.items.at(-1)!.video);
  });

  test('un tráiler se abre en el mismo reproductor, sin botón de siguiente', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'movies');
    const movie = movies.items[2];
    await page.getByTestId(`favorites-trailer-${movie.id}`).click();
    await expect(page.getByTestId('miniplayer')).toHaveAttribute('data-video', movie.trailer as string);
    await expect(page.getByTestId('miniplayer-title')).toHaveText(movie.title);
    await expect(page.getByTestId('miniplayer-subtitle')).toContainText('Tráiler');
    await expect(page.getByTestId('miniplayer-next')).toHaveCount(0);
  });

  test('cerrar el reproductor lo quita y destruye el vídeo; la canción en marcha no se ve marcada después', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    await expect(page.getByTestId(`favorites-item-${music.items[0].id}`)).toHaveAttribute('aria-current', 'true');
    await page.getByTestId('miniplayer-close').click();
    await expect(page.getByTestId('miniplayer')).toHaveCount(0);
    await expect(page.getByTestId(`favorites-item-${music.items[0].id}`)).not.toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => (window as unknown as { __yt: { destroyed: number } }).__yt.destroyed)).toBe(1);
  });

  test('el reproductor se apila como una ventana más: delante al sonar o al tocarlo, detrás si se toca Favoritos (en el escritorio)', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay ventanas.');
    const z = (id: string) => page.getByTestId(id).evaluate((el) => Number(getComputedStyle(el).zIndex));
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer')).toBeVisible();
    expect(await z('miniplayer')).toBeGreaterThan(await z('window-favorites'));
    // Volver a la carpeta con «Favoritos» toca la ventana: pasa por delante del reproductor.
    await page.getByTestId('favorites-back').click();
    expect(await z('window-favorites')).toBeGreaterThan(await z('miniplayer'));
    // Un tráiler vuelve a ponerlo delante.
    await page.getByTestId('favorites-card-movies').click();
    expect(await z('window-favorites')).toBeGreaterThan(await z('miniplayer'));
    await page.getByTestId(`favorites-trailer-${movies.items[0].id}`).click();
    expect(await z('miniplayer')).toBeGreaterThan(await z('window-favorites'));
    // Y tocar el reproductor también.
    await page.getByTestId('favorites-back').click();
    await page.getByTestId('miniplayer-title').click();
    expect(await z('miniplayer')).toBeGreaterThan(await z('window-favorites'));
  });

  test('el reproductor sigue sonando aunque se cierre la ventana de Favoritos (en el escritorio)', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay ventanas.');
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    await page.getByTestId('window-favorites').getByTestId('window-close').click();
    await expect(page.getByTestId('favorites')).toHaveCount(0);
    await expect(page.getByTestId('miniplayer')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __yt: { destroyed: number } }).__yt.destroyed)).toBe(0);
  });

  test('si el vídeo no se puede cargar, avisa y enlaza con YouTube sin dejar un reproductor roto', async ({ page }, testInfo) => {
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer')).toBeVisible();
    await failCurrent(page);
    await expect(page.getByTestId('miniplayer-error')).toBeVisible();
    await expect(page.getByTestId('miniplayer-fallback')).toHaveAttribute('href', `https://music.youtube.com/watch?v=${music.items[0].video as string}`);
    await expect(page.getByTestId('miniplayer-fallback')).toHaveAttribute('target', '_blank');
  });

  test('si YouTube no carga (sin conexión o bloqueado), avisa con el mismo enlace', async ({ page, context }, testInfo) => {
    await context.unroute('https://www.youtube.com/iframe_api');
    await context.route('https://www.youtube.com/iframe_api', (route) => route.abort());
    await openSection(page, testInfo.project.name, 'movies');
    await page.getByTestId(`favorites-trailer-${movies.items[0].id}`).click();
    await expect(page.getByTestId('miniplayer-error')).toBeVisible();
    await expect(page.getByTestId('miniplayer-fallback')).toHaveAttribute('href', `https://www.youtube.com/watch?v=${movies.items[0].trailer as string}`);
  });

  test('se abre también desde la Terminal: favoritos y cada sección', async ({ page }, testInfo) => {
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
    else await page.getByTestId('dock-item-terminal').click();
    const input = page.getByTestId('terminal-input');
    await expect(input).toBeFocused();
    await input.fill('open musica');
    await input.press('Enter');
    await expect(page.getByTestId('favorites-title')).toHaveText('Música');
  });

  test('con el teclado: se llega al botón de play y Enter reproduce', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), 'En móvil no hay teclado.');
    await openSection(page, testInfo.project.name, 'music');
    await page.getByTestId(`favorites-play-${music.items[0].id}`).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('miniplayer')).toBeVisible();
    await page.getByTestId('miniplayer-next').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('miniplayer-title')).toHaveText(music.items[1].title);
  });

  test('no hay contenido sin cargar: si el archivo de Favoritos falla, avisa', async ({ page }, testInfo) => {
    await page.route('**/favoritos.json', (route) => route.abort());
    if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-icon-favorites').tap();
    else await page.getByTestId('desktop-icon-favorites').dblclick();
    await expect(page.getByTestId('favorites-error')).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`Favoritos no tiene problemas de accesibilidad: tarjetas, cada sección y reproductor abierto (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      const check = async (label: string) => {
        await animationsDone(page);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`), label).toEqual([]);
      };
      await openFavorites(page, testInfo.project.name);
      await check('tarjetas');
      for (const section of [games, movies, books, music]) {
        await page.getByTestId(`favorites-card-${section.kind}`).click();
        await expect(page.getByTestId('favorites-title')).toBeVisible();
        await check(section.kind);
        await page.getByTestId('favorites-back').click();
      }
      await page.getByTestId('favorites-card-music').click();
      await page.getByTestId(`favorites-play-${music.items[0].id}`).click();
      await expect(page.getByTestId('miniplayer')).toBeVisible();
      await check('reproductor');
    });
  }
});
