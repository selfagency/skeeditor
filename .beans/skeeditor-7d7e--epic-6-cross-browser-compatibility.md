---
# skeeditor-7d7e
title: 'Epic 6: Cross-Browser Compatibility'
status: completed
type: epic
priority: high
created_at: 2026-03-18T14:25:41Z
updated_at: 2026-03-25T02:24:52Z
parent: skeeditor-bmr4
---

Integrate webextension-polyfill, add platform shims, and test/fix behaviors across Chrome, Firefox, and Safari.

UI note: Verify Web Components render and behave correctly under each browser (Shadow DOM quirks, CSS vars).

## Todo

- [ ] Add `webextension-polyfill` dependency and types
- [ ] Provide build-time shim to expose `browser` global in content and background scripts
- [ ] Create `src/platform/` shims and document differences per browser
- [ ] Add Vitest unit tests for platform shims and browser API fallbacks
- [ ] Add Playwright cross-browser smoke tests to verify extension loads and Web Components render
- [ ] Document per-browser dev workflow (Chrome load-unpacked, web-ext for Firefox, Xcode for Safari)
- [ ] Maintain a checklist of known browser-specific issues and workarounds in `docs/platform.md`
