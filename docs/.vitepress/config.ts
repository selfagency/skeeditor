import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'skeeditor',
  description: 'Edit your Bluesky posts directly on bsky.app — cross-browser extension docs',
  base: '/',

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]],

  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo.svg', alt: 'skeeditor' },

    nav: [
      { text: 'User Guide', link: '/guide/introduction' },
      { text: 'Developer Docs', link: '/dev/architecture' },
      { text: 'GitHub', link: 'https://github.com/selfagency/skeeditor' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'User Guide',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Using skeeditor', link: '/guide/usage' },
            { text: 'Privacy & Security', link: '/guide/privacy' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
      ],
      '/dev/': [
        {
          text: 'Developer Docs',
          items: [
            { text: 'Architecture', link: '/dev/architecture' },
            { text: 'Getting Started', link: '/dev/getting-started' },
            { text: 'Project Structure', link: '/dev/project-structure' },
            { text: 'Build System', link: '/dev/build' },
            { text: 'Testing', link: '/dev/testing' },
            { text: 'Contributing', link: '/dev/contributing' },
          ],
        },
        {
          text: 'Internals',
          items: [
            { text: 'Authentication', link: '/dev/auth' },
            { text: 'Message Protocol', link: '/dev/messages' },
            { text: 'XRPC Client', link: '/dev/xrpc' },
            { text: 'Facets & Rich Text', link: '/dev/facets' },
            { text: 'Conflict Handling', link: '/dev/conflicts' },
            { text: 'Cross-Browser Platform', link: '/dev/platform' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/selfagency/skeeditor' }],

    editLink: {
      pattern: 'https://github.com/selfagency/skeeditor/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © selfagency',
    },

    search: { provider: 'local' },
  },
});
