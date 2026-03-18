import { resolve } from 'node:path';
import { build } from 'vite';

const isWatchEnabled = process.argv.includes('--watch');
const projectRoot = process.cwd();

const main = async (): Promise<void> => {
  await build({
    configFile: resolve(projectRoot, 'vite.config.ts'),
    build: {
      watch: isWatchEnabled ? {} : null,
    },
  });
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
