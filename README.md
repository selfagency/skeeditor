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

## Current status

Epic 1 establishes the monorepo scaffold first. Follow-up beans wire in Vite, manifests, Vitest, Playwright, CI, and lexicon generation.
