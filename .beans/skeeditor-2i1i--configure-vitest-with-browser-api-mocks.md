---
# skeeditor-2i1i
title: Configure Vitest with browser API mocks
status: in-progress
type: task
priority: critical
created_at: 2026-03-18T14:26:10Z
updated_at: 2026-03-18T16:03:01Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Install and configure Vitest; add MSW and stubs for browser APIs (chrome/browser) for unit and integration tests.

## Todo

- [ ] Review the current scaffold and identify the unit/integration test entry points to replace
- [ ] Add `vitest` and related deps (`@vitest/ui`, `jsdom`, `@testing-library/dom`, `msw`)
- [ ] Create `vitest.config.ts` integrated with the Vite build and separate unit/integration projects
- [ ] Implement browser API stubs and shared test setup files for unit tests
- [ ] Add example unit and integration tests, including an MSW-backed fetch flow
- [ ] Replace placeholder package scripts with real Vitest commands and document how to run them
