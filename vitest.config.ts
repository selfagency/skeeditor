import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcAlias = { '@src': resolve(__dirname, 'src') };

// In test environments, redirect wxt/browser to the fakeBrowser stub.
// The fakeBrowser (from wxt/testing) provides a controllable browser API.
// Tests configure globalThis.browser via test/mocks/browser-apis.ts instead.
const testAlias = {
  ...srcAlias,
  'wxt/browser': resolve(__dirname, 'test/mocks/wxt-browser.ts'),
};

export default defineConfig({
  resolve: { alias: srcAlias },
  test: {
    globals: false,
    passWithNoTests: false,
    projects: [
      {
        resolve: { alias: testAlias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['test/unit/**/*.test.ts'],
          setupFiles: ['test/setup/unit.ts'],
          clearMocks: true,
        },
      },
      {
        resolve: { alias: testAlias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*.test.ts'],
          setupFiles: ['test/setup/integration.ts'],
          clearMocks: true,
        },
      },
    ],
  },
});
