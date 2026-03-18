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
  ],
});
