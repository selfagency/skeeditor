import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = process.cwd();
const sourceRoot = resolve(projectRoot, 'src');

export default defineConfig({
  resolve: {
    alias: {
      '@src': sourceRoot,
    },
  },
  base: './',
  publicDir: false,
  root: sourceRoot,
  build: {
    emptyOutDir: true,
    outDir: resolve(projectRoot, 'dist'),
    sourcemap: true,
    target: 'es2022',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        background: resolve(sourceRoot, 'background/service-worker.ts'),
        content: resolve(sourceRoot, 'content/content-script.ts'),
        popup: resolve(sourceRoot, 'popup/popup.html'),
        options: resolve(sourceRoot, 'options/options.html'),
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: chunkInfo => {
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }

          if (chunkInfo.name === 'content') {
            return 'content/content-script.js';
          }

          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
