import { defineConfig } from 'vitest/config';

// Tests unitarios de lógica pura. Los e2e van con Playwright (tests/e2e).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/os/windows/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
