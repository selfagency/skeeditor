---
# skeeditor-5atd
title: 'Epic 1: Project Scaffolding & Build Pipeline'
status: in-progress
type: epic
priority: critical
created_at: 2026-03-18T14:25:17Z
updated_at: 2026-03-18T15:37:12Z
parent: skeeditor-bmr4
---

Scaffold the monorepo, configure Vite multi-entry build, manifests, testing and CI (Vitest for unit & integration, Playwright for E2E, GitHub Actions), and standardize on `oxlint` / `oxfmt` for linting and formatting.

## Todo

- [x] Initialize repository structure and docs with `pnpm workspaces` and `turbo`
- [ ] Configure Vite multi-entry build (content, background, popup, options)
- [ ] Create `manifests/` base and browser overrides
- [ ] Configure Vitest with browser API mocks (unit + integration)
- [ ] Configure Playwright for E2E (Chrome + Firefox)
- [ ] Add CI workflow to run `oxlint`, `oxfmt --check`, type-check, Vitest, build, and E2E
- [ ] Install Lexicons and add lex build step
