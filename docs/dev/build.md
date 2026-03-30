# Build System

## Overview

skeeditor uses [WXT](https://wxt.dev/) — a browser-extension framework built on top of Vite — to build, manifest, and package the extension for every target browser. WXT replaces the previous bespoke `vite.config.ts` + `scripts/build.ts` + `manifests/` pipeline.

The primary configuration file is `wxt.config.ts` at the project root. `pnpm workspaces` handles multi-package dependency management (the main extension and the `packages/labeler` Cloudflare Worker).

---

## WXT configuration (`wxt.config.ts`)

The WXT config file replaces the old `vite.config.ts`, `scripts/build.ts`, and per-browser `manifests/` directories. It drives manifest generation as a JavaScript function so browser-specific differences are expressed in code rather than JSON overlay files.

```ts
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',   // WXT discovers entrypoints here
  outDir: 'dist',
  outDirTemplate: '{{browser}}',   // e.g. dist/chrome, dist/firefox
  imports: false,                  // auto-imports disabled; explicit imports required
  modules: ['@wxt-dev/auto-icons'],
  autoIcons: { baseIconPath: 'assets/icon.svg' },
  manifest: ctx => ({              // manifest built as a function of the target browser
    name: 'skeeditor',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'tabs', 'alarms'],
    host_permissions: [
      'https://bsky.app/*',
      'https://*.bsky.network/*',
      'https://docs.skeeditor.link/*',
      'https://slingshot.microcosm.blue/*',
    ],
    ...(ctx.browser === 'chrome' && { minimum_chrome_version: '120' }),
    ...(ctx.browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'skeeditor@selfagency.dev', strict_min_version: '125.0' },
      },
    }),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: { alias: { '@src': resolve('./src') } },
  }),
});
```

### Entrypoints

WXT discovers entrypoints by convention in `src/entrypoints/`:

| File / Directory                | Extension context | Output file                  |
| ------------------------------- | ----------------- | ---------------------------- |
| `src/entrypoints/background.ts` | Service worker    | `background.js`              |
| `src/entrypoints/content.ts`    | Content script    | `content-scripts/content.js` |
| `src/entrypoints/popup/`        | Action popup      | `popup.html`                 |
| `src/entrypoints/options/`      | Options page      | `options.html`               |

### Output layout

```text
dist/chrome/
├── background.js
├── popup.html
├── options.html
├── content-scripts/
│   ├── content.js
│   └── content.css
├── icons/
│   ├── 16.png
│   ├── 32.png
│   ├── 48.png
│   └── 128.png
├── chunks/
│   └── *.js          (shared code chunks)
└── manifest.json
```

---

## Build commands

| Command                    | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `task build`               | Build for Chrome (production, one-shot)              |
| `task build:chrome`        | Same as above                                        |
| `task build:firefox`       | Build for Firefox                                    |
| `task build:safari`        | Build for Safari                                     |
| `task build:all`           | Build all three browser targets in sequence          |
| `task dev`                 | Start WXT dev server for Chrome (watch + hot-reload) |
| `task build:watch`         | Watch mode for Chrome                                |
| `task build:watch:chrome`  | Watch mode for Chrome                                |
| `task build:watch:firefox` | Watch mode for Firefox                               |
| `task clean`               | Remove `dist/` and `.wxt/`                           |

Each build command first runs `task lex:build` to keep generated Lexicon types up to date before invoking WXT.

---

## Lexicon pipeline

AT Protocol Lexicons define the XRPC schema for every API call. The pipeline keeps TypeScript types in `src/lexicons/` in sync with the upstream Lexicon JSON files in `lexicons/`.

```sh
task lex:install    # Download/update Lexicon JSON from the AT Protocol registry
task lex:build      # Compile lexicon JSON → TypeScript types in src/lexicons/
task lex:sync       # Both steps in order (install then build)
```

Generated types are committed. `lex:build` runs automatically before `build:*`, `typecheck`, and `test:unit` Task targets.

---

## Icon pipeline

Extension icons are generated automatically from a single SVG source file via the [`@wxt-dev/auto-icons`](https://wxt.dev/guide/auto-icons) WXT module. The source image is `src/assets/icon.svg`. WXT renders it to the required PNG sizes at build time and references them from the generated manifest.

| Output file     | Size    |
| --------------- | ------- |
| `icons/16.png`  | 16×16   |
| `icons/32.png`  | 32×32   |
| `icons/48.png`  | 48×48   |
| `icons/128.png` | 128×128 |

---

## Safari build

```sh
task build:safari
xcrun safari-web-extension-converter dist/safari \
  --project-location ./safari-xcode \
  --app-name skeeditor \
  --bundle-identifier dev.selfagency.skeeditor \
  --swift
```

Run the first command to produce `dist/safari/`, then use the Apple converter to wrap it in an Xcode project. Open the generated Xcode project and build it to register the extension with Safari. CI verifies that the converter exits successfully but does not run the Xcode app.

---

## Generated files (`.wxt/`)

Running `pnpm install` (which triggers `postinstall`) generates TypeScript type stubs for WXT APIs in `.wxt/`. These stubs are needed for type-checking but are not committed to source control. If you see type errors after a fresh checkout, run:

```sh
pnpm install   # triggers postinstall → wxt prepare automatically
```

---

## Path alias

The `@src` alias resolves to the `src/` directory. It is configured in `wxt.config.ts`, `tsconfig.json`, and `vitest.config.ts` so that import resolution is consistent across WXT builds, type-checking, and tests.
