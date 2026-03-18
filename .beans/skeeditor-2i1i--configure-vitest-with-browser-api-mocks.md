---
# skeeditor-2i1i
title: Configure Vitest with browser API mocks
status: todo
type: task
priority: critical
created_at: 2026-03-18T14:26:10Z
updated_at: 2026-03-18T14:41:18Z
parent: skeeditor-5atd
---

Install and configure Vitest; add MSW and stubs for browser APIs (chrome/browser) for unit and integration tests.

## Todo

- [ ] Add `vitest` and related deps (`@vitest/ui`, `jsdom`, `@testing-library/dom`, `msw`)
- [ ] Create `vitest.config.ts` integrated with Vite build
- [ ] Implement browser API stubs (webextension-polyfill types/mocks) for unit tests
- [ ] Add example unit test and integration test using MSW
- [ ] Add package.json scripts: `test:unit`, `test:integration`, `test:watch`
- [ ] Document how to run Vitest locally and in CI
