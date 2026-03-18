---
# skeeditor-ra8t
title: Integrate webextension-polyfill for browser.* normalization
status: todo
type: task
priority: high
created_at: 2026-03-18T14:30:09Z
updated_at: 2026-03-18T14:51:33Z
parent: skeeditor-7d7e
---

Add `webextension-polyfill` to the project, update build/shims to expose a normalized `browser` API to shared code.

## Todo

- [ ] Add `webextension-polyfill` to `package.json` and pin a tested version
- [ ] Expose a build shim that injects `browser` as a global for content scripts and service worker
- [ ] Provide TypeScript types and tests that mock `browser` in Vitest
- [ ] Update `README.md` with instructions to use `browser` vs `chrome` in shared code
- [ ] Verify polyfill size and tree-shakeability in final build
