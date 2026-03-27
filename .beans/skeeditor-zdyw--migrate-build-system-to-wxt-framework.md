---
# skeeditor-zdyw
title: Migrate build system to WXT framework
status: in-progress
type: chore
priority: high
created_at: 2026-03-27T14:57:07Z
updated_at: 2026-03-27T14:57:32Z
---

Replace custom Vite + scripts/build.ts build stack (including the IIFE polyfill workarounds) with WXT framework.

branch: chore/zdyw-migrate-wxt

## Todo

- [ ] Phase 1: Install & configure WXT
  - [ ] Update package.json (deps + scripts)
  - [ ] Create wxt.config.ts
  - [ ] Update tsconfig.json to extend .wxt/tsconfig.json
  - [ ] Run pnpm install + wxt prepare
- [ ] Phase 2: Replace webextension-polyfill with wxt/browser
  - [ ] Update all src/ imports
  - [ ] Delete src/browser.d.ts
- [ ] Phase 3: Create WXT entrypoints
  - [ ] Create src/entrypoints/background.ts
  - [ ] Export initContentScript() from content-script.ts
  - [ ] Create src/entrypoints/content.ts
  - [ ] Create src/entrypoints/popup/index.html + main.ts
  - [ ] Create src/entrypoints/options/index.html + main.ts
- [ ] Phase 4: Assets & icons
  - [ ] Move CSS to src/assets/
  - [ ] Set up public/icon.svg for auto-icons
  - [ ] Handle action icons
- [ ] Phase 5: Delete old build system
  - [ ] Delete vite.config.ts, scripts/build.ts, scripts/merge-manifest.ts, scripts/clean.ts
  - [ ] Delete manifests/ directory
  - [ ] Delete src/background/service-worker.ts, src/browser.d.ts
- [ ] Phase 6: Update tests
  - [ ] Update vitest.config.ts (WxtVitest plugin)
  - [ ] Replace browser-apis.ts mock with fakeBrowser from wxt/testing
  - [ ] Update test setup files
  - [ ] Delete test/mocks/webextension-polyfill.ts
- [ ] Phase 7: E2E tests verification
  - [ ] Verify playwright paths still work
  - [ ] Run full test suite
- [ ] Verification: build + load in Chrome, run all tests
