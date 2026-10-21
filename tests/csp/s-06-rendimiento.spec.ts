import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Presupuesto de rendimiento de la home (S-06), contra la COMPILACIÓN y con Chrome real. Es un suelo
 * contra regresiones, no el rendimiento de un visitante con una red real: en local no hay red.
 *
 * Medido el 2026-10-10 (escritorio): LCP 104 ms, CLS 0, 7 peticiones, JS 99 KB sin comprimir,
 * CSS 26 KB, ninguna petición externa. Los topes llevan un margen de en torno al 30 %.
 *
 * CSS: subió de 40 a 50 KB el 2026-10-11. La home carga hoy 43 KB porque Astro enlaza también el CSS de las apps que se cargan bajo
 * demanda (Stack, Proyectos, Libro de visitas: unos 15 KB que solo hacen falta al abrirlas). Es crecimiento real y conocido, no una
 * regresión por descuido; evitarlo (que ese CSS llegue al abrir cada app) está en mejoras/backlog.md (MEJORA-08).
 */
const PRESUPUESTO = {
  lcpMs: 2500, // el del PRD
  cls: 0.1, // el del PRD
  jsKb: 130,
  cssKb: 50,
  peticiones: 12,
};

interface Medida {
  lcp: number;
  cls: number;
  peticiones: number;
  jsKb: number;
  cssKb: number;
  externos: string[];
}

async function medir(page: Page): Promise<Medida> {
  await page.addInitScript(() => {
    const w = window as unknown as { __m: { lcp: number; cls: number } };
    w.__m = { lcp: 0, cls: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__m.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__m.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000); // deja que se asienten el reloj, la foto y la hidratación
  return page.evaluate(() => {
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const m = (window as unknown as { __m: { lcp: number; cls: number } }).__m;
    const kb = (f: (r: PerformanceResourceTiming) => boolean) => res.filter(f).reduce((a, r) => a + r.encodedBodySize, 0) / 1024;
    return {
      lcp: m.lcp,
      cls: m.cls,
      peticiones: res.length + 1, // + el documento
      jsKb: kb((r) => /\.js(\?|$)/.test(r.name)),
      cssKb: kb((r) => /\.css(\?|$)/.test(r.name)),
      externos: res.filter((r) => new URL(r.name).origin !== location.origin).map((r) => r.name),
    };
  });
}

async function conCpuLenta(browser: Browser, viewport: { width: number; height: number }, rate: number) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return { page, cerrar: () => context.close() };
}

function comprobar(m: Medida) {
  expect(m.lcp, 'LCP').toBeGreaterThan(0);
  expect(m.lcp, 'LCP').toBeLessThan(PRESUPUESTO.lcpMs);
  expect(m.cls, 'CLS').toBeLessThan(PRESUPUESTO.cls);
  expect(m.jsKb, 'JavaScript (KB sin comprimir)').toBeLessThan(PRESUPUESTO.jsKb);
  expect(m.cssKb, 'CSS (KB)').toBeLessThan(PRESUPUESTO.cssKb);
  expect(m.peticiones, 'peticiones').toBeLessThanOrEqual(PRESUPUESTO.peticiones);
  expect(m.externos, 'cargar la home no debe pedir nada a otros dominios').toEqual([]);
}

test.describe('S-06 Rendimiento de la home', () => {
  test('escritorio: cumple el presupuesto', async ({ browser }) => {
    const { page, cerrar } = await conCpuLenta(browser, { width: 1280, height: 800 }, 1);
    comprobar(await medir(page));
    await cerrar();
  });

  test('móvil con la CPU 4 veces más lenta: cumple el mismo presupuesto', async ({ browser }) => {
    const { page, cerrar } = await conCpuLenta(browser, { width: 390, height: 844 }, 4);
    comprobar(await medir(page));
    await cerrar();
  });

  test('los archivos compilados llevan caché inmutable y la home se revalida', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const asset = html.match(/\/_astro\/[^"']+\.(?:js|css)/)?.[0];
    expect(asset, 'ningún archivo en /_astro/').toBeTruthy();
    const res = await request.get(asset!);
    expect(res.headers()['cache-control']).toMatch(/immutable/);
    expect(res.headers()['cache-control']).toMatch(/max-age=31536000/);
    expect((await request.get('/')).headers()['cache-control']).toMatch(/must-revalidate|no-cache|max-age=0/);
  });

  test('la foto de la pantalla de acceso lleva sus dimensiones y prioridad: no mueve la página', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const foto = page.getByTestId('lock-photo');
    await expect(foto).toHaveAttribute('width', '276');
    await expect(foto).toHaveAttribute('height', '276');
    await expect(foto).toHaveAttribute('fetchpriority', 'high');
    await expect(foto).not.toHaveAttribute('loading', 'lazy');
  });
});
