# skeeditor

A cross-browser browser extension that lets Bluesky users edit their own posts directly on `bsky.app`.

## Workspace overview

This repository is scaffolded as a strict TypeScript workspace managed with `pnpm` and `turbo`.

- `src/` — extension source code grouped by runtime area
- `test/` — unit, integration, and E2E coverage
- `manifests/` — browser-specific manifest inputs
- `scripts/` — build and tooling scripts
- `docs/plans/` — planning artifacts and implementation notes
- `lexicons/` — generated or vendored AT Protocol lexicon artifacts

## Root commands

- `pnpm lint` — run `oxlint`
- `pnpm format:check` — verify formatting with `oxfmt`
- `pnpm typecheck` — run strict TypeScript checks
- `pnpm build` — build extension assets with Vite
- `pnpm build:repo` — orchestrate workspace builds with `turbo`
- `pnpm dev` — run the Vite build in watch mode
- `pnpm test` — run unit and integration test entry points
- `pnpm test:unit` — run the Vitest jsdom project
- `pnpm test:integration` — run the Vitest + MSW node project
- `pnpm test:watch` — run both Vitest projects in watch mode
- `pnpm test:e2e:list` — print the configured Playwright extension E2E tests
- `pnpm test:e2e:chromium` — run Chromium extension smoke tests
- `pnpm test:e2e:firefox` — run the Firefox extension scaffold project
- `pnpm lex:install` — download / refresh AT Protocol lexicon JSON files
- `pnpm lex:build` — generate TypeScript helpers from the installed lexicons
- `pnpm lex:sync` — install lexicons then build (shorthand for both steps)

## Testing

- Unit tests run in the `unit` Vitest project with a `jsdom` environment and browser API mocks.
- Integration tests run in the `integration` Vitest project with `msw` intercepting network requests in Node.
- CI can run `pnpm test:unit` and `pnpm test:integration` independently, or `pnpm test` to execute both.

## E2E testing

- Playwright E2E lives under `test/e2e/` and uses extension-specific fixtures.
- Chromium extension tests launch a persistent Chromium context with the built `dist/` extension loaded.
- Firefox extension tests are scaffolded behind `FIREFOX_EXTENSION_E2E=1`; the project stays listed for future `web-ext`-driven integration without failing by default.

## Current status

Epic 1 establishes the monorepo scaffold first. Follow-up beans wire in Vite, manifests, Vitest, Playwright, CI, and lexicon generation.
