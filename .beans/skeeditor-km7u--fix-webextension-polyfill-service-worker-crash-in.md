---
# skeeditor-km7u
title: Fix webextension-polyfill service worker crash in Chrome
status: completed
type: fix
priority: critical
created_at: 2026-03-26T02:50:43Z
updated_at: 2026-03-26T16:14:51Z
---

Chrome extension service worker crashes with "Uncaught ReferenceError: browser is not defined" (status code 15) because source files reference `browser` as a global, but webextension-polyfill only sets `module.exports` — it does NOT create `globalThis.browser` in Chrome.

Fix: change all source files from side-effect `import 'webextension-polyfill'` to explicit `import browser from 'webextension-polyfill'`, so the bundler includes the polyfill's default export as a local variable instead of relying on a nonexistent global.

## Todo
- [x] Diagnose root cause: polyfill bundled as CommonJS export, not global
- [x] Add `import browser from 'webextension-polyfill'` to all files using browser APIs
- [x] Remove side-effect-only imports from entry points
- [x] Update test mock to proxy through globalThis.browser
- [x] Verify tsc, lint, and all 292 tests pass
- [x] Build succeeds; service worker no longer references global `browser`
- [x] Create branch, commit, and push (committed in 91d4df4 on main)
