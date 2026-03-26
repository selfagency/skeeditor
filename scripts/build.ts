import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, type Plugin } from 'vite';

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
const sourceRoot = resolve(projectRoot, 'src');
const outDir = resolve(projectRoot, 'dist', browser);

// Rebuild the content script as a self-contained IIFE so Chrome can load it
// as a classic script.  Playwright's bundled Chromium does not honour
// "type": "module" for content_scripts, so the ESM bundle from the main
// build throws "Cannot use import statement outside a module" at runtime.
// An IIFE has no top-level import statements and is valid in both
// classic-script and module contexts, so this build works everywhere.
const buildContentScript = async (): Promise<void> => {
  await build({
    configFile: false,
    resolve: {
      alias: {
        '@src': sourceRoot,
      },
    },
    base: './',
    publicDir: false,
    root: sourceRoot,
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: true,
      target: 'es2022',
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: resolve(sourceRoot, 'content/content-script.ts'),
        external: ['webextension-polyfill'],
        output: {
          format: 'iife',
          name: '_skeeditorContent',
          entryFileNames: 'content/content-script.js',
          assetFileNames: 'assets/[name][extname]',
          globals: {
            'webextension-polyfill': 'browser',
          },
        },
      },
    },
  });

  // Copy the webextension-polyfill to the content script directory so the
  // manifest can load it as a separate script before the IIFE content script.
  // The polyfill sets globalThis.browser, which the IIFE references via the
  // `globals` mapping above.
  const polyfillSrc = resolve(projectRoot, 'node_modules/webextension-polyfill/dist/browser-polyfill.min.js');
  const polyfillDest = resolve(outDir, 'content/browser-polyfill.js');
  await mkdir(resolve(outDir, 'content'), { recursive: true });
  await copyFile(polyfillSrc, polyfillDest);
};

// Vite plugin that rebuilds the content script as an IIFE and copies the
// polyfill after every build cycle — including incremental watch rebuilds.
// This ensures the dev workflow (build:watch) produces a valid unpacked
// extension on every change, not just on the initial production build.
const iifeContentPlugin = (): Plugin => ({
  name: 'iife-content-rebuild',
  apply: 'build',
  async closeBundle() {
    await buildContentScript();
    await writeMergedManifest(browser, `dist/${browser}/manifest.json`, projectRoot);
  },
});

const main = async (): Promise<void> => {
  await build({
    configFile: resolve(projectRoot, 'vite.config.ts'),
    build: {
      outDir,
      emptyOutDir: true,
      watch: isWatchEnabled ? {} : null,
    },
    plugins: [iifeContentPlugin()],
  });
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
