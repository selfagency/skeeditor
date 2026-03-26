---
# skeeditor-edhe
title: perf mutationobserver debounce observer narrowing
status: completed
type: task
priority: normal
created_at: 2026-03-25T17:56:35Z
updated_at: 2026-03-25T23:32:57Z
parent: skeeditor-pjwz
---

Fix performance issues found in the codebase audit:

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

All 3 performance items implemented:

1. **Observer narrowing**: Added `FEED_CONTAINER_SELECTORS` and `findObserverTarget()` to scope MutationObserver to the feed container instead of `document.body`
2. **Debounce**: Changed `scheduleScanForPosts` from `setTimeout(0)` to `setTimeout(100)` with proper coalescing and cleanup
3. **Memoization**: Added `WeakMap<Element, Element[]>` cache to `getElementCandidates` in `at-uri.ts`

branch: perf/edhe-observer-narrowing-memoize
