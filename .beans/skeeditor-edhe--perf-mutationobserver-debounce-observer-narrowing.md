---
# skeeditor-edhe
title: perf mutationobserver debounce observer narrowing
status: completed
type: task
priority: normal
created_at: 2026-03-25T17:56:35Z
updated_at: 2026-03-25T22:42:05Z
parent: skeeditor-pjwz
---

Fix performance issues found in the codebase audit:

1. **MutationObserver not debounced** — `content-script.ts:142-150`: `scheduleScanForPosts()` is called on every mutation, enqueueing N timeouts for rapidly firing mutations. Replace with a coalescing 100ms debounce so burst mutations result in a single scan.

2. **Observer watches all of `document.body`** — `content-script.ts:147`: narrow the observer target to the feed container element when available; fall back to `document.body` if not.

3. **Subtree `querySelectorAll` in `parseAtUriFromElement`** — `at-uri.ts:131-174`: `getElementCandidates` runs a full descendant-tree `querySelectorAll` inside every call. Memoize the result per element, or move the lookup to happen only once per post rather than per-element.

## Todo

- [x] Read `src/content/content-script.ts` observer setup
- [x] Implement coalescing debounce (100ms) for `scheduleScanForPosts`
- [x] Identify the feed container selector used by bsky.app and narrow the observer to it with body fallback
- [x] Read `src/shared/api/at-uri.ts` `getElementCandidates` function
- [x] Memoize or restructure the subtree search to avoid O(n) per call
- [x] Add/update unit tests for debounce behavior
- [x] `pnpm test` + `tsc --noEmit` clean
- [x] Commit with `perf(content)` prefix

## Summary of Changes

- `src/content/content-script.ts`: observer now targets feed container (`[data-testid=\"feed\"]`, `[data-testid=\"feedPage-feed\"]`, `main`, `[role=\"main\"]`) with `document.body` fallback
- `src/content/content-script.ts`: debounce increased from `setTimeout(0)` to `setTimeout(100)` for mutation coalescing
- `src/content/content-script.ts`: `cleanupContentScript` now clears pending timer
- `src/shared/api/at-uri.ts`: `getElementCandidates` uses `WeakMap<Element, Element[]>` cache to skip redundant `querySelectorAll` per element

branch: perf/edhe-observer-narrowing-memoize

267 unit/integration tests pass, tsc clean.
