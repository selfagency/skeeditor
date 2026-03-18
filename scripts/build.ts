import { resolve } from 'node:path';
import { build } from 'vite';

import { writeMergedManifest } from './merge-manifest';

const isWatchEnabled = process.argv.includes('--watch');
const projectRoot = process.cwd();

const main = async (): Promise<void> => {
  await build({
    configFile: resolve(projectRoot, 'vite.config.ts'),
    build: {
      watch: isWatchEnabled ? {} : null,
    },
  });

  await writeMergedManifest('chrome', 'dist/manifest.json', projectRoot);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
