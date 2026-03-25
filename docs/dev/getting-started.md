# Getting Started

This guide walks you through setting up a local development environment so you can build, test, and iterate on skeeditor.

## Prerequisites

| Tool | Minimum version | Notes |
| --- | --- | --- |
| Node.js | 20.x | LTS recommended |
| pnpm | 9.x | `npm install -g pnpm` |
| Chrome | 120+ | For extension development and Playwright E2E |
| Firefox | 121+ | Nightly / Developer Edition required for manual extension loading |
| Git | 2.x | — |

::: info macOS users
Install Node.js via [nvm](https://github.com/nvm-sh/nvm) or [mise](https://mise.jdx.dev/) to avoid system-Python conflicts. pnpm can be installed with `npm install -g pnpm` or via `brew install pnpm`.
:::

---

## Clone and install

```sh
git clone https://github.com/selfagency/skeeditor.git
cd skeeditor
pnpm install
```

This installs all workspace dependencies, including the build toolchain, test runners, and Playwright browsers.

---

## Build

### Development build (watch mode)

```sh
# Chrome
pnpm build:watch:chrome

# Firefox
pnpm build:watch:firefox
```

Both commands start Vite in watch mode. Changes to `src/` files trigger an incremental rebuild immediately.

### Production build

```sh
pnpm build:chrome    # outputs to dist/chrome/
pnpm build:firefox   # outputs to dist/firefox/
pnpm build:safari    # outputs to dist/safari/ (macOS only, requires Xcode)
```

To build all targets at once:

```sh
pnpm build
```

---

## Load the extension in your browser

### Chrome

1. Run `pnpm dev:chrome` (or `pnpm build:chrome`).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** → select `dist/chrome/`.

The extension reloads automatically when files in `dist/chrome/` change (i.e. when the watch build rebuilds).

### Firefox

1. Run `pnpm dev:firefox` (or `pnpm build:firefox`).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** → select `dist/firefox/manifest.json`.

If you have `web-ext` installed globally you can also run:

```sh
web-ext run --source-dir dist/firefox/ --firefox=nightly
```

### Safari (macOS)

Safari extensions require an Xcode app wrapper. Build the converter output first:

```sh
pnpm build:safari
```

Then open the generated Xcode project under `dist/safari/` and run it. See [Cross-Browser Platform](./platform) for full instructions.

---

## Run tests

```sh
pnpm test          # unit + integration (Vitest)
pnpm test:e2e      # E2E (Playwright, requires Chrome and Firefox)
pnpm test:coverage # unit + integration with coverage report
```

See [Testing](./testing) for full details on the test suite.

---

## Lint and type-check

```sh
pnpm lint          # ESLint + oxfmt
pnpm typecheck     # tsc --noEmit
```

Both must pass before opening a pull request. CI enforces them on every push.
