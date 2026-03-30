# Getting Started

This guide walks you through setting up a local development environment so you can build, test, and iterate on skeeditor.

## Prerequisites

| Tool    | Minimum version | Notes                                                             |
| ------- | --------------- | ----------------------------------------------------------------- |
| Node.js | 20.x            | LTS recommended                                                   |
| pnpm    | 9.x             | `npm install -g pnpm`                                             |
| task    | 3.x             | [go-task](https://taskfile.dev/) — `brew install go-task`         |
| Chrome  | 120+            | For extension development and Playwright E2E                      |
| Firefox | 125+            | Nightly / Developer Edition required for manual extension loading |
| Git     | 2.x             | —                                                                 |

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
task build:watch:chrome

# Firefox
task build:watch:firefox
```

Both commands start Vite in watch mode. Changes to `src/` files trigger an incremental rebuild immediately.

### Production build

```sh
task build:chrome   # outputs to dist/chrome/
task build:firefox  # outputs to dist/firefox/
task build:safari   # outputs to dist/safari/ (macOS only, requires Xcode)
```

To build all targets at once:

```sh
task build:all
```

> **Note:** Prefer direct Task commands (`task <name>`) for day-to-day development.

---

## Load the extension in your browser

### Chrome

1. Run `task build:watch:chrome` (or `task build:chrome`).
1. Open `chrome://extensions`.
1. Enable **Developer mode**.
1. Click **Load unpacked** → select `dist/chrome/`.

The extension reloads automatically when files in `dist/chrome/` change (i.e. when the watch build rebuilds).

### Firefox

1. Run `task build:watch:firefox` (or `task build:firefox`).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** → select `dist/firefox/manifest.json`.

If you have `web-ext` installed globally you can also run:

```sh
task webext:run:firefox
```

### Safari (macOS)

Safari extensions require an Xcode app wrapper. Build the converter output first:

```sh
task build:safari
```

Then open the generated Xcode project under `dist/safari/` and run it. See [Cross-Browser Platform](./platform) for full instructions.

---

## Run tests

```sh
task test          # unit + integration (Vitest)
task test:e2e      # E2E (Playwright, requires Chrome and Firefox)
task test:coverage # unit + integration with coverage report
```

See [Testing](./testing) for full details on the test suite.

---

## Lint and type-check

```sh
task lint
task typecheck
```

Both must pass before opening a pull request. CI enforces them on every push.
