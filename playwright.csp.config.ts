import { defineConfig } from '@playwright/test';

const PORT = 4322;

// Pruebas de la CSP (M-11) contra la COMPILACIÓN, no contra `astro dev`: Astro no genera la política
// en desarrollo. `pnpm build` + `pnpm preview` sirven el sitio con el mismo servidor local de
// Cloudflare. Siempre en localhost (límite 1 de CLAUDE.md).
export default defineConfig({
  testDir: 'tests/csp',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'produccion' }],
  webServer: {
    // --ignore-lock: Astro 7 pasa a segundo plano si detecta un agente; Playwright necesita el proceso delante.
    // Sin clave pública propia, la de prueba de Cloudflare: así el formulario se compila con Turnstile (simulado en las pruebas).
    command: `PUBLIC_TURNSTILE_SITE_KEY=${process.env.PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'} pnpm build && pnpm preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
