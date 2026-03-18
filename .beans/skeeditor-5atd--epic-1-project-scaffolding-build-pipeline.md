---
# skeeditor-5atd
title: 'Epic 1: Project Scaffolding & Build Pipeline'
status: completed
type: epic
priority: critical
created_at: 2026-03-18T14:25:17Z
updated_at: 2026-03-18T17:30:46Z
parent: skeeditor-bmr4
---

Scaffold the monorepo, configure Vite multi-entry build, manifests, testing and CI (Vitest for unit & integration, Playwright for E2E, GitHub Actions), and standardize on `oxlint` / `oxfmt` for linting and formatting.

## Todo

- [x] Initialize repository structure and docs with `pnpm workspaces` and `turbo`
- [x] Configure Vite multi-entry build (content, background, popup, options)
- [x] Create `manifests/` base and browser overrides
- [x] Configure Vitest with browser API mocks (unit + integration)
- [x] Configure Playwright for E2E (Chrome + Firefox)
- [x] Add CI workflow to run `oxlint`, `oxfmt --check`, type-check, Vitest, build, and E2E
- [x] Install Lexicons and add lex build step
