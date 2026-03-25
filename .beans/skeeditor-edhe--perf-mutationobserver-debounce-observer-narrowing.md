---
# skeeditor-edhe
title: perf mutationobserver debounce observer narrowing
status: in-progress
type: task
priority: normal
created_at: 2026-03-25T17:56:35Z
updated_at: 2026-03-25T22:39:37Z
parent: skeeditor-pjwz
---

Fix performance issues found in the codebase audit:

1. **MutationObserver not debounced** — `content-script.ts:142-150`: `scheduleScanForPosts()` is called on every mutation, enqueueing N timeouts for rapidly firing mutations. Replace with a coalescing 100ms debounce so burst mutations result in a single scan.

2. **Observer watches all of `document.body`** — `content-script.ts:147`: narrow the observer target to the feed container element when available; fall back to `document.body` if not.

3. **Subtree `querySelectorAll` in `parseAtUriFromElement`** — `at-uri.ts:131-174`: `getElementCandidates` runs a full descendant-tree `querySelectorAll` inside every call. Memoize the result per element, or move the lookup to happen only once per post rather than per-element.

## Todo

- [ ] Read `src/content/content-script.ts` observer setup
- [ ] Implement coalescing debounce (100ms) for `scheduleScanForPosts`
- [ ] Identify the feed container selector used by bsky.app and narrow the observer to it with body fallback
- [ ] Read `src/shared/api/at-uri.ts` `getElementCandidates` function
- [ ] Memoize or restructure the subtree search to avoid O(n) per call
- [ ] Add/update unit tests for debounce behavior
- [ ] `pnpm test` + `tsc --noEmit` clean
- [ ] Commit with `perf(content)` prefix
