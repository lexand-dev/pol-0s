import { defineConfig } from '@playwright/test';

// Otro puerto si el 4321 lo usa otro proyecto: `E2E_PORT=4323 pnpm test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 4321);
/** Lo que se prueba en el móvil: los requisitos que tienen versión móvil. */
const MOBILE_SPECS = /(m-(0[1345689]|10)|s-(0[13489]|10)|c-0[156])-/;

// Siempre contra localhost (límite 1 de CLAUDE.md). Los proyectos `escritorio` y `movil` usan el Google Chrome instalado
// en la máquina (channel 'chrome'); `pnpm test:e2e` corre solo esos. Los de otros motores (`safari`, `safari-movil` y
// `firefox`) usan los navegadores de Playwright (`pnpm exec playwright install webkit firefox`) y se corren con
// `pnpm test:e2e:navegadores`: así se ven los fallos que solo pasan en Safari o en Firefox (como el de las fichas de las damas).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      use: { channel: 'chrome', viewport: { width: 1280, height: 800 } },
      testIgnore: /m-03-/,
    },
    {
      name: 'movil',
      use: { channel: 'chrome', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      testMatch: MOBILE_SPECS,
    },
    {
      name: 'safari',
      use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } },
      testIgnore: /m-03-/,
    },
    {
      // WebKit con pantalla y toque de iPhone: lo más parecido a Safari en un móvil.
      name: 'safari-movil',
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      testMatch: MOBILE_SPECS,
    },
    {
      // Firefox no admite `isMobile`: solo escritorio.
      name: 'firefox',
      use: { browserName: 'firefox', viewport: { width: 1280, height: 800 } },
      testIgnore: /m-03-/,
    },
  ],
  webServer: {
    // --ignore-lock: Astro 7 pasa a segundo plano si detecta un agente; Playwright necesita el proceso delante.
    command: `pnpm dev --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
