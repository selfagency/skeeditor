import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: false,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['test/unit/**/*.test.ts'],
          setupFiles: ['test/setup/unit.ts'],
          clearMocks: true,
        },
      },
      {
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
