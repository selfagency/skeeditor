---
# skeeditor-f7oz
title: Initialize monorepo structure
status: completed
type: task
priority: critical
created_at: 2026-03-18T14:25:54Z
updated_at: 2026-03-18T15:37:12Z
parent: skeeditor-5atd
---

Create base directories, workspace packages, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, Ox tooling config (`.oxlintrc.json`, `.oxfmtrc.json`), `.gitignore`, and the initial README for the browser extension monorepo managed with `pnpm workspaces` and `turbo`.

## Todo

- [x] Inspect the current repository scaffold and identify missing monorepo pieces
- [x] Add workspace directories and placeholder source/test layout
- [x] Replace the root `package.json` with monorepo-oriented scripts and metadata
- [x] Add `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, and `tsconfig.build.json`
- [x] Add/update root docs and ignore files for the new workspace layout
- [x] Validate the scaffold with install/lint/type-check-friendly commands

## Summary of Changes

- scaffolded the root workspace layout for source, manifests, tests, scripts, packages, and lexicons
- replaced the starter `package.json` with `pnpm` + `turbo` scripts and added `typescript`, `turbo`, and `@types/node`
- added baseline `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `tsconfig.build.json`, README, and updated ignore rules
- verified `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` on the scaffold
