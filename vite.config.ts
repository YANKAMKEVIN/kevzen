import { defineConfig } from 'vitest/config';

// base relative : le même build marche sur GitHub Pages (/kevzen/) et en local.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 200 },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
