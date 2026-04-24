// Perf-only Playwright config. Separate from the e2e config so the
// benchmark runs against the live Cloudflare deploy without spinning up a
// local preview server (which the e2e config does via its webServer hook).

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 180_000,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
