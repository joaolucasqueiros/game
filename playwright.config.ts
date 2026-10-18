import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromiumPath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/playwright',
  testMatch: 'browser.spec.ts',
  timeout: 240_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 960 },
    headless: true,
    actionTimeout: 12_000,
    launchOptions: { executablePath: chromiumPath, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
