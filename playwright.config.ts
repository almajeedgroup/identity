import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);

/** Acceptance tests (tests/acceptance) — titles carry spec AC IDs for traceability. */
export default defineConfig({
  testDir: 'tests/acceptance',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    // Reference budget-phone viewport (F09 / Q-17): 360 px wide, touch.
    ...devices['Galaxy S9+'],
    viewport: { width: 360, height: 740 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'budget-phone' }],
  webServer: {
    command: 'npm run start -w @identity/web',
    // The Full Check runs against an in-memory database and file store, with codes in the dev outbox (F05-AC-4.1).
    env: { PORT: String(port), NEXT_TELEMETRY_DISABLED: '1', APP_ENV: 'test', PGLITE_DIR: 'memory://', STORAGE_DIR: 'memory://', OTP_SENDER: 'dev-outbox' },
    url: `http://127.0.0.1:${port}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
