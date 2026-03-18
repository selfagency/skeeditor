---
# skeeditor-f7oz
title: Initialize monorepo structure
status: in-progress
type: task
priority: critical
created_at: 2026-03-18T14:25:54Z
updated_at: 2026-03-18T15:30:39Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Create base directories, workspace packages, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, Ox tooling config (`.oxlintrc.json`, `.oxfmtrc.json`), `.gitignore`, and the initial README for the browser extension monorepo managed with `pnpm workspaces` and `turbo`.

## Todo

- [ ] Inspect the current repository scaffold and identify missing monorepo pieces
- [ ] Add workspace directories and placeholder source/test layout
- [ ] Replace the root `package.json` with monorepo-oriented scripts and metadata
- [ ] Add `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, and `tsconfig.build.json`
- [ ] Add/update root docs and ignore files for the new workspace layout
- [ ] Validate the scaffold with install/lint/type-check-friendly commands
