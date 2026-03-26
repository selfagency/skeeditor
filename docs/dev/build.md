# Build System

## Overview

skeeditor uses [Vite](https://vite.dev/) as its bundler with a custom build script (`scripts/build.ts`) that orchestrates manifest merging, lexicon generation, and per-browser output.

Using `pnpm workspaces` directly for dependency management and task orchestration.

---

## Vite configuration (`vite.config.ts`)

The Vite config sets up multiple entry points for each extension context:

```ts
rollupOptions: {
  input: {
    background: 'src/background/service-worker.ts',
    content:    'src/content/content-script.ts',
    popup:      'src/popup/popup.html',
    options:    'src/options/options.html',
  }
}
```

Output layout in `dist/<browser>/`:

```text
dist/chrome/
├── background/
│   └── service-worker.js
├── content/
│   ├── browser-polyfill.js
│   └── content-script.js
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   ├── action-16.png
│   └── action-32.png
├── assets/
│   ├── popup-<hash>.js
│   └── options-<hash>.js
├── manifest.json
└── _locales/
```

### Key config choices

- **`base: './'`** — relative asset paths so the extension works when loaded unpacked.
- **`publicDir: false`** — static assets are managed per-browser in the manifest build step, not via Vite's public dir.
- **`target: 'es2022'`** — both Chrome 120+ and Firefox 125+ fully support ES2022.
- **`modulePreload: false`** — extensions cannot use `<link rel="modulepreload">`.
- **Source maps enabled** — always generated (`sourcemap: true`) for debuggability, even in production builds.

---

## Build script (`scripts/build.ts`)

Run via:

```sh
pnpm build:chrome    # or :firefox / :safari
```

The script:

1. Runs the Vite build with the appropriate browser target (via `--browser=chrome|firefox|safari`).
2. The `iifeContentPlugin` Vite plugin (running in the `closeBundle` hook) rebuilds the content script as a self-contained IIFE, copies the `webextension-polyfill` to `dist/<browser>/content/`, and calls `scripts/merge-manifest.ts` to write `dist/<browser>/manifest.json`.

> **Note:** `pnpm lex:build` is called by the npm script (e.g. `pnpm build:chrome`) before invoking the build script, not by `scripts/build.ts` itself.

### Watch mode

```sh
pnpm build:watch:chrome
pnpm build:watch:firefox
```

Starts Vite in `--watch` mode and re-runs the manifest merge step after each rebuild.

---

## Manifest system (`scripts/merge-manifest.ts`)

Each browser target has:

- `manifests/base.json` — shared fields: `name`, `version`, `description`, `permissions`, `host_permissions`, `content_scripts`, `default_locale`.
- `manifests/<browser>/manifest.json` — browser-specific overrides merged on top.

The merge uses a recursive `mergeJson()` function: nested objects are deep-merged, while arrays are fully replaced by the overlay.

### Chrome overlay

```json
{
  "background": { "service_worker": "background/service-worker.js" }
}
```

### Firefox overlay

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "skeeditor@selfagency.dev",
      "strict_min_version": "125.0"
    }
  },
  "background": { "scripts": ["background/service-worker.js"] }
}
```

### Safari overlay

Minimal overlay — the main Safari-specific adjustments are applied by `xcrun safari-web-extension-converter` after the build.

---

## Lexicon pipeline

AT Protocol Lexicons define the schema for every XRPC call. The pipeline keeps in-repo TypeScript types in sync with upstream lexicons.

```sh
pnpm lex:install    # Download lexicon JSON from the AT Protocol registry
pnpm lex:build      # Compile lexicon JSON → TypeScript types in src/lexicons/
pnpm lex:sync       # Both steps in order
```

Generated types land in `src/lexicons/` and are committed. `lex:build` is run automatically before `pnpm build` and `pnpm test:unit`.

---

## Safari build

```sh
pnpm build:safari
```

This runs the standard Vite build with `--browser=safari`, merges the Safari manifest overlay, and outputs to `dist/safari/`. To create a native Safari extension from the build output, run:

```sh
xcrun safari-web-extension-converter dist/safari \
  --project-location ./safari-xcode \
  --app-name skeeditor \
  --bundle-identifier dev.selfagency.skeeditor \
  --swift
```

Open the generated Xcode project and build it to register the extension with Safari. CI verifies that the converter exits successfully but does not run the Xcode app.

---

## Icon pipeline

Extension icons are generated at build time from two SVG source files at the project root:

| Source file               | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `skeeditor.svg`           | Transparent background — used for the `icons` manifest key |
| `skeeditor_button.svg`    | Solid background — used for `action.default_icon`          |

[`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) renders the SVGs to PNG at the required pixel sizes. The generated PNGs are written to `dist/<browser>/icons/` by the `buildIcons()` function in `scripts/build.ts`, called from the `iifeContentPlugin` `closeBundle` hook alongside the content-script IIFE build and manifest merge.

### Output files

| File                      | Size   | Referenced by                    |
| ------------------------- | ------ | -------------------------------- |
| `icons/icon-16.png`       | 16×16  | `manifest.icons.16`              |
| `icons/icon-32.png`       | 32×32  | `manifest.icons.32`              |
| `icons/icon-48.png`       | 48×48  | `manifest.icons.48`              |
| `icons/icon-128.png`      | 128×128| `manifest.icons.128`             |
| `icons/action-16.png`     | 16×16  | `manifest.action.default_icon.16`|
| `icons/action-32.png`     | 32×32  | `manifest.action.default_icon.32`|

### Image optimisation

[`vite-plugin-image-optimizer`](https://github.com/FatehAK/vite-plugin-image-optimizer) is registered in `vite.config.ts` and compresses any SVG and raster images processed through Vite's main bundle (popup assets, options-page assets, etc.).

---

## Environment variables

| Variable       | Set by             | Purpose                                                |
| -------------- | ------------------ | ------------------------------------------------------ |
| `VITE_BROWSER` | `scripts/build.ts` | Selects the platform shim in `src/platform/<browser>/` |

---

## Path alias

The `@src` alias resolves to `src/`. It is configured in `vite.config.ts`, `tsconfig.json`, and `vitest.config.ts` so that import resolution is consistent across builds, type-checking, and tests.
