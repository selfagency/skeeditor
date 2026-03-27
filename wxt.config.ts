import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import '@wxt-dev/auto-icons';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  imports: false,
  modules: ['@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: ctx => ({
    name: 'skeeditor',
    version: '0.1.0',
    description: 'Edit your own Bluesky posts directly on bsky.app.',
    incognito: 'not_allowed' as const,
    permissions: ['storage', 'activeTab', 'tabs'] as const,
    host_permissions: ['https://bsky.app/*', 'https://*.bsky.network/*', 'https://skeeditor.self.agency/*'],
    action: {
      default_title: 'skeeditor',
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
