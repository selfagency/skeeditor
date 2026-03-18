import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcAlias = { '@src': resolve(__dirname, 'src') };

export default defineConfig({
  resolve: { alias: srcAlias },
  test: {
    globals: false,
    passWithNoTests: false,
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['test/unit/**/*.test.ts'],
          setupFiles: ['test/setup/unit.ts'],
          clearMocks: true,
        },
      },
      {
        resolve: { alias: srcAlias },
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
