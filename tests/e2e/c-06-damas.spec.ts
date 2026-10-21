import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { applyMove, describeMove, legalMoves, newGame, squareName, type GameState, type Move } from '../../src/lib/checkers/rules';
import { animationsDone, enter, stubExternalSites } from './helpers';

const isMobile = (name: string) => name.endsWith('movil');

/**
 * Fija el azar de `crypto` a `value` para el número que piden las damas: con 0, juegas con blancas y la máquina, en Fácil, juega siempre su
 * primera jugada legal; con 0,9, juegas con rojas. Cualquier otro uso de `crypto` sigue igual.
 */
async function fixRandom(page: Page, value = 0) {
  await page.addInitScript((v) => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = Math.floor(v * 2 ** 32);
        return array;
      }
      return original(array as unknown as Uint8Array<ArrayBuffer>) as unknown as T;
    }) as typeof crypto.getRandomValues;
  }, value);
}

/** La respuesta de la máquina en Fácil con el azar a 0: su primera jugada legal. */
const machine = (g: GameState): GameState => applyMove(g, legalMoves(g)[0]);

/** Una secuencia corta de jugadas blancas tras la cual las blancas están obligadas a capturar (con la máquina respondiendo como arriba). */
function toForcedCapture(): Move[] {
  const search = (g: GameState, seq: Move[], depth: number): Move[] | null => {
    if (legalMoves(g).some((m) => m.captures.length > 0)) return seq;
    if (depth === 0) return null;
    for (const m of legalMoves(g)) {
      const found = search(machine(applyMove(g, m)), [...seq, m], depth - 1);
      if (found) return found;
    }
    return null;
  };
  return search(newGame(), [], 4)!;
}

async function openCheckers(page: Page, projectName: string) {
  if (isMobile(projectName)) await page.getByTestId('mobile-dock-terminal').tap();
  else await page.getByTestId('dock-item-terminal').click();
  const input = page.getByTestId('terminal-input');
  await expect(input).toBeFocused();
  await input.fill('checkers');
  await input.press('Enter');
  await expect(page.getByTestId('checkers')).toBeVisible();
}

const cell = (page: Page, name: string) => page.getByTestId(`checkers-sq-${name}`);
const pieceAt = (page: Page, name: string) => page.getByTestId(`checkers-piece-${name}`);

async function move(page: Page, m: Move) {
  for (const s of m.path) await cell(page, squareName(s)).click();
}

test.describe('C-06 Damas', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await stubExternalSites(context);
  });

  test.describe('jugando con blancas', () => {
    test.beforeEach(async ({ page }) => {
      await fixRandom(page, 0);
      await enter(page);
    });

    test('minigames la lista, y checkers abre la partida con 12 fichas por bando; antes no se descarga', async ({ page }, testInfo) => {
      const requested: string[] = [];
      page.on('request', (r) => r.url().includes('/apps/checkers/') && requested.push(r.url()));
      if (isMobile(testInfo.project.name)) await page.getByTestId('mobile-dock-terminal').tap();
      else await page.getByTestId('dock-item-terminal').click();
      const input = page.getByTestId('terminal-input');
      await input.fill('minigames');
      await input.press('Enter');
      await expect(page.getByTestId('terminal-log')).toContainText('checkers');
      expect(requested).toEqual([]);
      await input.fill('checkers');
      await input.press('Enter');
      await expect(page.getByTestId('checkers')).toBeVisible();
      expect(requested.length).toBeGreaterThan(0);
      await expect(page.locator('[data-testid^="checkers-piece-"][data-color="w"]')).toHaveCount(12);
      await expect(page.locator('[data-testid^="checkers-piece-"][data-color="r"]')).toHaveCount(12);
      await expect(page.getByTestId('checkers-turn')).toContainText('Tu turno · blancas');
      await expect(page.getByTestId('checkers')).toHaveAttribute('data-human', 'w');
      await expect(page.getByTestId('checkers')).toHaveAttribute('data-mode', isMobile(testInfo.project.name) ? 'top' : '3d');
    });

    test('elegir una ficha marca sus destinos; moverla y la máquina contesta; Deshacer vuelve atrás', async ({ page }, testInfo) => {
      await openCheckers(page, testInfo.project.name);
      await cell(page, 'c3').click();
      await expect(page.locator('.checkers-target')).toHaveCount(2);
      await expect(page.getByTestId('checkers-hint')).toHaveText('Elige la casilla de destino.');
      await cell(page, 'd4').click();
      await expect(pieceAt(page, 'd4')).toHaveAttribute('data-color', 'w');
      await expect(pieceAt(page, 'c3')).toHaveCount(0);
      const g = applyMove(newGame(), legalMoves(newGame()).find((m) => squareName(m.path[0]) === 'c3' && squareName(m.path[1]) === 'd4')!);
      const reply = legalMoves(g)[0];
      await expect(page.getByTestId('checkers-status')).toHaveText(describeMove('r', reply));
      await expect(page.getByTestId('checkers-turn')).toContainText('Tu turno');
      await page.getByTestId('checkers-undo').click();
      await expect(pieceAt(page, 'c3')).toHaveAttribute('data-color', 'w');
      await expect(pieceAt(page, 'd4')).toHaveCount(0);
      await expect(page.getByTestId('checkers-undo')).toBeDisabled();
    });

    test('negativo: si capturar es obligatorio, se marcan las fichas que capturan y las demás no se pueden elegir', async ({ page }, testInfo) => {
      const seq = toForcedCapture();
      await openCheckers(page, testInfo.project.name);
      let g = newGame();
      for (const m of seq) {
        await move(page, m);
        const afterWhite = applyMove(g, m);
        const reply = legalMoves(afterWhite)[0];
        // Se espera a que conteste la máquina antes de la siguiente jugada.
        await expect(page.getByTestId('checkers-status')).toHaveText(describeMove('r', reply));
        g = applyMove(afterWhite, reply);
      }
      await expect(page.getByTestId('checkers-turn')).toContainText('Tu turno');
      await expect(page.getByTestId('checkers-hint')).toHaveText('Capturar es obligatorio: elige una ficha marcada.');
      const captures = legalMoves(g);
      expect(captures.every((m) => m.captures.length > 0)).toBe(true);
      const capturers = new Set(captures.map((m) => squareName(m.path[0])));
      await expect(page.locator('.checkers-ring.must')).toHaveCount(capturers.size);
      // Una ficha blanca que no puede capturar no se elige y lo explica.
      const idle = g.board.findIndex((p, s) => p?.color === 'w' && !capturers.has(squareName(s)));
      await cell(page, squareName(idle)).click();
      await expect(page.getByTestId('checkers-hint')).toHaveText('Capturar es obligatorio: esa ficha no puede capturar.');
      await expect(page.locator('.checkers-target')).toHaveCount(0);
      // La captura se hace.
      const blackBefore = g.board.filter((p) => p?.color === 'r').length;
      await move(page, captures[0]);
      await expect(page.getByTestId('checkers-count')).toContainText(`Rojas ${blackBefore - captures[0].captures.length}`);
    });

    test('Rendirse termina la partida con su aviso, y «Jugar otra» empieza una nueva', async ({ page }, testInfo) => {
      await openCheckers(page, testInfo.project.name);
      await cell(page, 'c3').click();
      await cell(page, 'd4').click();
      await expect(page.getByTestId('checkers-turn')).toContainText('Tu turno');
      await page.getByTestId('checkers-resign').click();
      const end = page.getByTestId('checkers-end');
      await expect(end).toContainText('Gana la máquina');
      await expect(end).toContainText('Te has rendido.');
      await expect(page.getByTestId('checkers-turn')).toContainText('Partida terminada');
      await expect(page.getByTestId('checkers-new')).toHaveText('Jugar otra');
      await expect(page.getByTestId('checkers-status')).toContainText('Gana la máquina');
      await page.getByTestId('checkers-again').click();
      await expect(end).toHaveCount(0);
      await expect(page.getByTestId('checkers-count')).toHaveText('Blancas 12 Rojas 12');
      await expect(pieceAt(page, 'c3')).toHaveAttribute('data-color', 'w');
    });

    test('en el escritorio, arrastrar gira e inclina el tablero sin mover fichas, y la vista se recupera al reabrir', async ({ page }, testInfo) => {
      test.skip(isMobile(testInfo.project.name), 'En el móvil el tablero no se gira.');
      await openCheckers(page, testInfo.project.name);
      const board = page.getByTestId('checkers-board');
      await expect(board).toHaveAttribute('data-view', '0,52');
      const box = (await cell(page, 'c3').boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 + 40, { steps: 8 });
      await page.mouse.up();
      await expect(board).not.toHaveAttribute('data-view', '0,52');
      const turned = await board.getAttribute('data-view');
      // Arrastrar a la izquierda gira hacia la derecha (como empujar la mesa), y hacia abajo se ve más desde arriba.
      const [rot, tilt] = turned!.split(',').map(Number);
      expect(rot).toBe(40);
      expect(tilt).toBe(66);
      await expect(page.locator('.checkers-target')).toHaveCount(0);
      await expect(page.getByTestId('checkers-hint')).toHaveText('Elige una de tus fichas.');
      // Se cierra y se vuelve a abrir: la vista sigue.
      await page.getByTestId('window-checkers').getByTestId('window-close').click();
      await page.getByTestId('terminal-input').fill('checkers');
      await page.getByTestId('terminal-input').press('Enter');
      await expect(page.getByTestId('checkers-board')).toHaveAttribute('data-view', turned!);
    });

    test('cada ficha está encima de su casilla, en cualquier vista y con la ventana a otro tamaño', async ({ page }, testInfo) => {
      await openCheckers(page, testInfo.project.name);
      const check = async (label: string) => {
        const off = await page.evaluate(() => {
          const out: string[] = [];
          for (const piece of document.querySelectorAll<SVGGElement>('[data-testid^="checkers-piece-"]')) {
            const name = piece.dataset.testid!.replace('checkers-piece-', '');
            const cell = document.querySelector<SVGElement>(`[data-testid="checkers-sq-${name}"]`);
            const face = piece.querySelector('.face');
            if (!cell || !face) continue;
            const c = cell.getBoundingClientRect();
            const f = face.getBoundingClientRect();
            // La cara de la ficha está un poco por encima de la base: se admite media casilla de margen vertical y una casilla de margen horizontal.
            const dx = Math.abs(f.x + f.width / 2 - (c.x + c.width / 2));
            const dy = f.y + f.height / 2 - (c.y + c.height / 2);
            if (dx > c.width * 0.35 || dy > c.height * 0.2 || dy < -c.height * 0.9) out.push(`${name}: dx ${dx.toFixed(1)}, dy ${dy.toFixed(1)}`);
          }
          return out;
        });
        expect(off, label).toEqual([]);
      };
      await check('vista inicial');
      if (!isMobile(testInfo.project.name)) {
        await page.getByTestId('checkers-rot-right').click();
        await page.getByTestId('checkers-tilt-down').click();
        await check('girado e inclinado');
        await page.getByTestId('window-checkers').getByTestId('window-maximize').click();
        await animationsDone(page);
        await check('ventana ampliada');
      }
    });

    test('los botones de vista giran de 45 en 45, inclinan y «Restablecer» vuelve a la vista inicial', async ({ page }, testInfo) => {
      test.skip(isMobile(testInfo.project.name), 'En el móvil el tablero no se gira.');
      await openCheckers(page, testInfo.project.name);
      const board = page.getByTestId('checkers-board');
      await page.getByTestId('checkers-rot-right').click();
      await expect(board).toHaveAttribute('data-view', '45,52');
      await page.getByTestId('checkers-rot-left').click();
      await page.getByTestId('checkers-rot-left').click();
      await expect(board).toHaveAttribute('data-view', '315,52');
      await page.getByTestId('checkers-tilt-up').click();
      await expect(board).toHaveAttribute('data-view', '315,62');
      for (let i = 0; i < 6; i++) await page.getByTestId('checkers-tilt-down').click();
      await expect(board).toHaveAttribute('data-view', '315,28');
      await page.getByTestId('checkers-reset-view').click();
      await expect(board).toHaveAttribute('data-view', '0,52');
    });

    test('con el teclado: las flechas recorren las casillas oscuras y Enter elige ficha y destino', async ({ page }, testInfo) => {
      test.skip(isMobile(testInfo.project.name), 'En móvil no hay teclado.');
      await openCheckers(page, testInfo.project.name);
      await cell(page, 'a1').focus();
      await page.keyboard.press('ArrowUp');
      await expect(cell(page, 'b2')).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(cell(page, 'a3')).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(cell(page, 'c3')).toBeFocused();
      await expect(cell(page, 'c3')).toHaveAccessibleName('c3, ficha blanca');
      await page.keyboard.press('Enter');
      await expect(cell(page, 'c3')).toHaveAccessibleName('c3, ficha blanca, elegida');
      await page.keyboard.press('ArrowUp');
      await expect(cell(page, 'b4')).toBeFocused();
      await expect(cell(page, 'b4')).toHaveAccessibleName('b4, vacía, destino posible');
      await page.keyboard.press('Enter');
      await expect(pieceAt(page, 'b4')).toHaveAttribute('data-color', 'w');
    });

    test('en el móvil, el tablero se ve desde arriba, cabe sin desbordar y cada casilla mide al menos 44 px', async ({ page }, testInfo) => {
      test.skip(!isMobile(testInfo.project.name), 'Solo en el móvil.');
      await openCheckers(page, testInfo.project.name);
      await expect(page.getByTestId('checkers')).toHaveAttribute('data-mode', 'top');
      for (const name of ['a1', 'c3', 'h8', 'b8', 'g1']) {
        const box = (await cell(page, name).boundingBox())!;
        expect(box.width, name).toBeGreaterThanOrEqual(44);
        expect(box.height, name).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await cell(page, 'c3').tap();
      await cell(page, 'd4').tap();
      await expect(pieceAt(page, 'd4')).toHaveAttribute('data-color', 'w');
      await expect(page.getByTestId('checkers-reset-view')).toHaveCount(0);
    });

    for (const scheme of ['light', 'dark'] as const) {
      test(`no tiene problemas de accesibilidad, con una ficha elegida (${scheme})`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: scheme });
        await openCheckers(page, testInfo.project.name);
        await cell(page, 'c3').click();
        await animationsDone(page);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      });
    }
  });

  test('con rojas: empieza la máquina con blancas y el tablero se da la vuelta', async ({ page }, testInfo) => {
    await fixRandom(page, 0.9);
    await enter(page);
    await openCheckers(page, testInfo.project.name);
    await expect(page.getByTestId('checkers')).toHaveAttribute('data-human', 'r');
    await expect(page.getByTestId('checkers-status')).toContainText('Blancas:');
    await expect(page.getByTestId('checkers-turn')).toContainText('Tu turno · rojas');
    // Las rojas se ven en el lado de quien juega: su fila más cercana (la 8) queda abajo.
    const red = (await cell(page, 'b8').boundingBox())!;
    const white = (await cell(page, 'a1').boundingBox())!;
    expect(red.y).toBeGreaterThan(white.y);
  });
});
