import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import '@wxt-dev/auto-icons';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const rootDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as { version: string };
const extensionVersion = packageJson.version;

const getExtensionCommitSha = (): string => {
  try {
    return execSync('git rev-parse --short=12 HEAD', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

const extensionCommitSha = getExtensionCommitSha();

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  outDirTemplate: '{{browser}}',
  imports: false,
  dev: {
    server: {
      // Keep WXT watch/dev off port 3000 because the local ATProto devnet PDS uses it.
      port: 3001,
      origin: 'http://localhost:3001',
    },
  },
  modules: ['@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: ctx => ({
    name: 'Skeeditor',
    version: extensionVersion,
    description: 'Edit your own Bluesky posts directly on bsky.app.',
    incognito: 'not_allowed' as const,
    permissions: ['storage', 'tabs', 'alarms'] as const,
    host_permissions: [
      'https://bsky.app/*',
      'https://*.bsky.network/*',
      'https://docs.skeeditor.link/*',
      'https://labeler.skeeditor.link/*',
      'https://slingshot.microcosm.blue/*',
      // Allow direct XRPC calls to the local devnet PDS during E2E tests.
      // Omitted from production builds to avoid requesting unnecessary localhost access.
      ...(ctx.mode !== 'production' ? ['http://localhost/*'] : []),
    ],
    action: {
      default_title: 'Skeeditor',
      default_popup: 'popup/index.html',
      default_icon: {
        '16': 'icons/16.png',
        '32': 'icons/32.png',
      },
    },
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
    ...(ctx.browser === 'chrome' && { minimum_chrome_version: '120' }),
    ...(ctx.browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'skeeditor@selfagency.dev',
          strict_min_version: '125.0',
        },
      },
    }),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      __SKEEDITOR_VERSION__: JSON.stringify(extensionVersion),
      __SKEEDITOR_COMMIT_SHA__: JSON.stringify(extensionCommitSha),
    },
    resolve: {
      alias: {
        '@src': resolve(rootDir, 'src'),
      },
    },
  }),
});
