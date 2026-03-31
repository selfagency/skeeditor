import tailwindcss from '@tailwindcss/vite';
import '@wxt-dev/auto-icons';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

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
    version: '0.1.0',
    description: 'Edit your own Bluesky posts directly on bsky.app.',
    incognito: 'not_allowed' as const,
    permissions: ['storage', 'tabs', 'alarms'] as const,
    host_permissions: [
      'https://bsky.app/*',
      'https://*.bsky.network/*',
      'https://docs.skeeditor.link/*',
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
    resolve: {
      alias: {
        '@src': resolve('./src'),
      },
    },
  }),
});
