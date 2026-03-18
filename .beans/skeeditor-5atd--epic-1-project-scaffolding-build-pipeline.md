---
# skeeditor-5atd
title: 'Epic 1: Project Scaffolding & Build Pipeline'
status: in-progress
type: epic
priority: critical
created_at: 2026-03-18T14:25:17Z
updated_at: 2026-03-18T16:06:26Z
parent: skeeditor-bmr4
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Scaffold the monorepo, configure Vite multi-entry build, manifests, testing and CI (Vitest for unit & integration, Playwright for E2E, GitHub Actions), and standardize on `oxlint` / `oxfmt` for linting and formatting.

## Todo

- [x] Initialize repository structure and docs with `pnpm workspaces` and `turbo`
- [x] Configure Vite multi-entry build (content, background, popup, options)
- [x] Create `manifests/` base and browser overrides
- [x] Configure Vitest with browser API mocks (unit + integration)
- [x] Configure Playwright for E2E (Chrome + Firefox)
- [ ] Add CI workflow to run `oxlint`, `oxfmt --check`, type-check, Vitest, build, and E2E
- [ ] Install Lexicons and add lex build step
