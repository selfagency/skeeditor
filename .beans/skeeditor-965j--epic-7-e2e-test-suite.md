---
# skeeditor-965j
title: 'Epic 7: E2E Test Suite'
status: in-progress
type: epic
priority: high
created_at: 2026-03-18T14:25:47Z
updated_at: 2026-03-25T14:16:15Z
parent: skeeditor-bmr4
---

\nE2E tests (Playwright) for extension load, edit button visibility, edit modal flow, auth gating, and conflict handling.\n\nNote: Vitest is for unit/integration; Playwright is dedicated to E2E and will verify Web Components render, message passing, and background interactions.\n\n## Todo\n\n- [x] Add Playwright fixtures to load the built extension in Chrome/Firefox and provide a `mock-bsky-page.html` fixture\n- [x] Create MSW-enabled test server or intercept network requests in Playwright to simulate XRPC endpoints and swapRecord behavior\n- [x] Implement E2E test verifying Web Components render (custom elements present and Shadow DOM content visible)\n- [x] Implement E2E tests for message flows (content→background→XRPC) by asserting background stubs receive expected messages\n- [x] Simulate swapRecord conflict in Playwright and verify modal shows retry/fetch-latest prompt\n- [ ] Add CI job to run Playwright E2E on merge to main with artifacts and failure screenshots\n- [ ] Document how to run Playwright locally and in CI (env vars, extension path) in `docs/tests.md`
