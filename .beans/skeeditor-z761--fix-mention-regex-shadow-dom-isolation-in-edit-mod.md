---
# skeeditor-z761
title: 'fix: mention regex + Shadow DOM isolation in edit modal'
status: completed
type: bug
priority: critical
created_at: 2026-03-25T17:56:11Z
updated_at: 2026-03-25T18:04:46Z
parent: skeeditor-pjwz
---

Fix two critical bugs found in the codebase audit:

1. **Mention regex** — `src/shared/utils/facets.ts` line 25: the pattern used `+` for domain segments, requiring at least one dot in every handle. Single-word handles like `@alice` were never matched. Changed `(?:\.[...])+` to `(?:\.[...])*`.

2. **Shadow DOM not implemented** — `src/content/edit-modal.ts`: the `EditModal` class was using `innerHTML` on a plain `HTMLElement`, but the template CSS uses `:host` selectors that only work in Shadow DOM. All modal styles leaked into the page and `:host` rules never fired. Fixed with `attachShadow({ mode: 'open' })` — template now renders into the shadow root, all internal `querySelector` calls updated to `shadowRoot!.querySelector`, and `handleBackgroundClick` updated to use `event.composedPath()[0]` to avoid shadow event retargeting.

## Todo

- [x] Read `src/shared/utils/facets.ts` and understand the full mention regex
- [x] Fix mention regex: change `+` to `*` for optional domain segments
- [x] Write failing test for single-word handle detection (RED)
- [x] Run `pnpm test` to confirm mention tests pass (GREEN)
- [x] Read `src/content/edit-modal.ts` fully to understand current structure
- [x] Refactor EditModal to use `attachShadow({ mode: 'open' })` for style isolation
- [x] Move template CSS into shadow root via shadow root innerHTML
- [x] Verify existing event handlers and textarea refs still work after Shadow DOM refactor
- [x] Fix `handleBackgroundClick` to use `composedPath()[0]` (shadow event retargeting)
- [x] Update test file to query via `shadowRoot!.querySelector`
- [x] Run `pnpm test` — 230 unit tests pass
- [x] `tsc --noEmit` clean compile

## Summary of Changes

- `src/shared/utils/facets.ts`: changed `+` → `*` in `mentionPattern` (line 25) — single-word handles like `@alice` now match
- `src/content/edit-modal.ts`: added `attachShadow({ mode: 'open' })` in constructor; all internal DOM queries use `shadowRoot!.querySelector`; `handleBackgroundClick` uses `composedPath()[0]`
- `test/unit/utils/facets.test.ts`: added test for single-word handle detection
- `test/unit/content/edit-modal.test.ts`: updated all `element.querySelector` calls to `element.shadowRoot!.querySelector`
