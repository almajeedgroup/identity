import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same alias as apps/web/tsconfig.json
    alias: { '@/': fileURLToPath(new URL('./apps/web/', import.meta.url)) },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tools/**/*.test.ts', 'apps/web/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/acceptance/**', 'apps/web/.next/**'],
  },
});
