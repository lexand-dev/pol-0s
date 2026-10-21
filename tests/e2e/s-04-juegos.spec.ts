import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { HANGMAN_WORDS, WORDLE_WORDS } from '../../src/os/terminal/games/words';
import { animationsDone, enter, stubExternalSites } from './helpers';

const PROMPT = 'pol@pol-os ~ %';

/**
 * Fija el azar de los juegos: la Terminal pide un único número a `crypto` para elegir palabra o número, y aquí se devuelve 0 (la primera
 * palabra de cada lista, el número 1). Cualquier otro uso de `crypto` sigue igual.
 */
async function fixRandom(page: Page) {
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = 0;
        return array;
      }
      return original(array as unknown as Uint8Array<ArrayBuffer>) as unknown as T;
    }) as typeof crypto.getRandomValues;
  });
}

async function openTerminal(page: Page, projectName: string) {
  if (projectName.endsWith('movil')) await page.getByTestId('mobile-dock-terminal').tap();
  else await page.getByTestId('dock-item-terminal').click();
  await expect(page.getByTestId('terminal-input')).toBeFocused();
}

async function type(page: Page, line: string) {
  const input = page.getByTestId('terminal-input');
  await input.fill(line);
  await input.press('Enter');
}

const log = (page: Page) => page.getByTestId('terminal-log');
const promptText = (page: Page) => page.getByTestId('terminal-prompt');

async function startGame(page: Page, id: string) {
  await type(page, id);
  await expect(promptText(page)).toHaveText(`${id}>`);
}

test.describe('S-04 Juegos de la Terminal', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
    await fixRandom(page);
    await enter(page);
  });

  test('help enseña minigames, y minigames lista los juegos', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await type(page, 'help');
    await expect(log(page)).toContainText('minijuegos para pasar el rato');
    await type(page, 'minigames');
    for (const id of ['wordle', 'hangman', 'guess']) await expect(log(page)).toContainText(id);
  });

  test('antes de pedir los minijuegos no se descarga su código; al pedirlos, sí', async ({ page }, testInfo) => {
    const requested: string[] = [];
    page.on('request', (r) => r.url().includes('/terminal/games/') && requested.push(r.url()));
    await openTerminal(page, testInfo.project.name);
    await type(page, 'help');
    await expect(log(page)).toContainText('minijuegos para pasar el rato');
    expect(requested).toEqual([]);
    await type(page, 'minigames');
    await expect(log(page)).toContainText('hangman');
    expect(requested.length).toBeGreaterThan(0);
  });

  test('lo que se escribe mientras el juego se descarga cuenta como jugada, no como comando', async ({ page }, testInfo) => {
    // Se retrasa la descarga del juego para escribir antes de que llegue, como en una conexión lenta.
    await page.route('**/terminal/games/games.ts*', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await openTerminal(page, testInfo.project.name);
    await type(page, 'wordle');
    await type(page, 'nubes');
    await expect(log(page)).toContainText('Intento 1 de 6');
    await expect(log(page)).not.toContainText('comando no encontrado');
  });

  test('Wordle: marca cada letra, cuenta intentos y se gana; el aviso vuelve a la Terminal', async ({ page }, testInfo) => {
    const solution = WORDLE_WORDS[0];
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'wordle');
    await expect(page.getByTestId('terminal-input')).toHaveAccessibleName('Jugada');
    await type(page, 'nubes');
    await expect(log(page)).toContainText('Intento 1 de 6');
    await expect(log(page)).toContainText('·n·');
    await type(page, solution);
    await expect(log(page)).toContainText(`¡Bien! Era «${solution}», en 2 de 6.`);
    await expect(promptText(page)).toHaveText(PROMPT);
    await expect(page.getByTestId('terminal-input')).toHaveAccessibleName('Comando');
  });

  test('Wordle: cada fila se dice también con palabras para los lectores de pantalla', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'wordle');
    await type(page, 'sotad');
    const row = log(page).getByTestId('terminal-line').filter({ has: page.locator('.sr-only') }).last();
    await expect(row.locator('.sr-only')).toHaveText(/T en su sitio/);
    await expect(row.locator('.hit')).toHaveText(['[T] ']);
    await expect(row.locator('.near')).toHaveText(['(S) ', '(O) ', '(A) ', '(D) ']);
    await expect(row.locator('[aria-hidden="true"]')).toHaveCount(5);
  });

  test('Wordle: al sexto fallo se pierde y enseña la palabra', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'wordle');
    for (let i = 0; i < 6; i++) await type(page, 'nubes');
    await expect(log(page)).toContainText(`Se acabaron los intentos. Era «${WORDLE_WORDS[0]}».`);
    await expect(promptText(page)).toHaveText(PROMPT);
  });

  test('negativo: una jugada inválida avisa sin gastar intento, y el nombre de un juego no reinicia la partida', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'wordle');
    await type(page, 'abc');
    await expect(log(page)).toContainText('No gasta intento');
    await type(page, 'wordle');
    await expect(log(page)).toContainText('Escribe salir para terminar la partida');
    await type(page, 'help');
    await expect(promptText(page)).toHaveText('wordle>');
    await type(page, 'nubes');
    await expect(log(page)).toContainText('Intento 1 de 6');
  });

  test('Ahorcado: descubre letras, se gana y se pierde', async ({ page }, testInfo) => {
    const word = HANGMAN_WORDS[0];
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'hangman');
    await type(page, 'z');
    await expect(log(page)).toContainText('No, la z no está.');
    for (const c of new Set(word)) await type(page, c);
    await expect(log(page)).toContainText(`¡Salvado! Era «${word}».`);
    await expect(promptText(page)).toHaveText(PROMPT);

    await startGame(page, 'hangman');
    for (const c of ['z', 'x', 'q', 'w', 'k', 'j']) await type(page, c);
    await expect(log(page)).toContainText(`Ahorcado. Era «${word}».`);
  });

  test('Adivina: pistas, acierto y derrota', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'guess');
    await type(page, '50');
    await expect(log(page)).toContainText('Más bajo. Te quedan 6 intentos.');
    await type(page, '1');
    await expect(log(page)).toContainText('¡Exacto! Era el 1, en 2 intentos.');

    await startGame(page, 'guess');
    for (let i = 0; i < 7; i++) await type(page, '2');
    await expect(log(page)).toContainText('Se acabaron los intentos. Era el 1.');
    await expect(promptText(page)).toHaveText(PROMPT);
  });

  test('salir y Ctrl+C terminan la partida; las jugadas no entran en el historial', async ({ page }, testInfo) => {
    await openTerminal(page, testInfo.project.name);
    await startGame(page, 'guess');
    await type(page, '50');
    await type(page, 'salir');
    await expect(log(page)).toContainText('Partida terminada.');
    await expect(promptText(page)).toHaveText(PROMPT);

    const input = page.getByTestId('terminal-input');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('guess');

    await input.fill('');
    await startGame(page, 'wordle');
    await input.press('Control+c');
    await expect(promptText(page)).toHaveText(PROMPT);
    await type(page, 'date');
    await expect(log(page)).not.toContainText('No gasta intento');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`una partida no tiene problemas de accesibilidad (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openTerminal(page, testInfo.project.name);
      await startGame(page, 'wordle');
      await type(page, 'sotad');
      await type(page, 'salir');
      await startGame(page, 'hangman');
      await type(page, 'z');
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});
