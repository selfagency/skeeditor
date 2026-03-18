---
# skeeditor-2i1i
title: Configure Vitest with browser API mocks
status: completed
type: task
priority: critical
created_at: 2026-03-18T14:26:10Z
updated_at: 2026-03-18T16:06:26Z
parent: skeeditor-5atd
---

Install and configure Vitest; add MSW and stubs for browser APIs (chrome/browser) for unit and integration tests.

## Todo

- [x] Review the current scaffold and identify the unit/integration test entry points to replace
- [x] Add `vitest` and related deps (`@vitest/ui`, `jsdom`, `@testing-library/dom`, `msw`)
- [x] Create `vitest.config.ts` integrated with the Vite build and separate unit/integration projects
- [x] Implement browser API stubs and shared test setup files for unit tests
- [x] Add example unit and integration tests, including an MSW-backed fetch flow
- [x] Replace placeholder package scripts with real Vitest commands and document how to run them

## Summary of Changes

- added `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/dom`, and `msw` to the workspace dev dependencies
- added `vitest.config.ts` with separate `unit` (`jsdom`) and `integration` (`node`) projects
- added shared test setup files, browser API mocks, MSW handlers, and starter unit/integration tests
- replaced placeholder test scripts with `vitest` commands and documented local/CI usage in `README.md`
- verified the setup with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test`
