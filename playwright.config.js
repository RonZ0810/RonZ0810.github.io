import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  fullyParallel: true,
  // Hosted runners render WebGL in software. Concurrent office scenes compete
  // for CPU time and can starve browser input, history events, and screenshots.
  workers: process.env.CI ? 1 : 2,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  reporter: [['list']],
  use: {
    // Windows' full Chromium uses its graphics backend reliably; retain the
    // established bundled headless shell on Linux's software-rendered runner.
    channel: process.platform === 'win32' ? 'chromium' : undefined,
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: !process.env.CI,
  },
});
