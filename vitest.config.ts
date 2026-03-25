import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcAlias = { '@src': resolve(__dirname, 'src') };
const polyfillStub = resolve(__dirname, 'test/mocks/webextension-polyfill.ts');

// In test environments, redirect webextension-polyfill to a no-op stub.
// The real polyfill throws when loaded outside a browser extension context.
// Tests provide globalThis.browser via test/mocks/browser-apis.ts instead.
const testAlias = {
  ...srcAlias,
  'webextension-polyfill': polyfillStub,
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
