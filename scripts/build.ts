import { resolve } from 'node:path';
import { build } from 'vite';

import { writeMergedManifest } from './merge-manifest';

const isWatchEnabled = process.argv.includes('--watch');
const projectRoot = process.cwd();

const browserArg = process.argv.find(a => a.startsWith('--browser='))?.split('=')[1] ?? process.env.BROWSER ?? 'chrome';

const validBrowsers = ['chrome', 'firefox', 'safari'] as const;
type Browser = (typeof validBrowsers)[number];

if (!(validBrowsers as readonly string[]).includes(browserArg)) {
  console.error(`Unknown browser target "${browserArg}". Valid values: ${validBrowsers.join(', ')}`);
  process.exitCode = 1;
  process.exit();
}

const browser = browserArg as Browser;

const main = async (): Promise<void> => {
  await build({
    configFile: resolve(projectRoot, 'vite.config.ts'),
    build: {
      watch: isWatchEnabled ? {} : null,
    },
  });

  await writeMergedManifest(browser, 'dist/manifest.json', projectRoot);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
