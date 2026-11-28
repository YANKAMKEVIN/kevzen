// Tests de bout en bout (Playwright) sur le jeu construit (dist/), servi par tools/serve.mjs.
// Lancer : npm run build && npm run e2e
import { defineConfig } from '@playwright/test';

// Port choisi une fois (le processus principal le transmet aux workers par l'environnement).
const port = Number(process.env.KZ_PORT) || 5200 + Math.floor(Math.random() * 800);
process.env.KZ_PORT = String(port);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  outputDir: 'test-results/playwright',
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    trace: 'off',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'node tools/serve.mjs',
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
