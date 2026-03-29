import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-extension',
      testMatch: /chrome\.spec\.ts/,
    },
    {
      name: 'firefox-extension',
      testMatch: /firefox\.spec\.ts/,
    },
    {
      // Real-network devnet tests for Chrome. Requires devnet stack running.
      // Run: pnpm test:e2e:chromium:devnet
      name: 'chromium-devnet',
      testMatch: /chrome-devnet\.spec\.ts/,
      globalSetup: './test/e2e/setup/devnet-global-setup.ts',
    },
    {
      // Real-network devnet tests for Firefox. Requires FIREFOX_EXTENSION_E2E=1
      // and the devnet stack running.
      // Run: FIREFOX_EXTENSION_E2E=1 pnpm test:e2e:firefox:devnet
      name: 'firefox-devnet',
      testMatch: /firefox-devnet\.spec\.ts/,
      globalSetup: './test/e2e/setup/devnet-global-setup.ts',
    },
  ],
});
