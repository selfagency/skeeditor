---
# skeeditor-b1jr
title: phase 3 dataflowperformance hardening content scri
status: completed
type: task
priority: high
created_at: 2026-03-29T16:49:11Z
updated_at: 2026-03-29T17:04:33Z
---

## Context
Phase 3 of the Unified Implementation Plan. Eliminates redundant DOM scans, adds scan-generation stale-result discarding, and fixes a listener lifecycle leak.

## Todo
- [x] Write failing unit tests (RED): stale-fetch discard, editedLabel listener cleanup
- [x] Build one-pass post index in `fetchEditedPostsInView` and `fetchOwnPostsInView` apply phases
- [x] Accept optional pre-computed posts array in `applyEditedPostsFromCache`, `fetchOwnPostsInView`, `fetchPermalinkPost`
- [x] Share a single `findPosts(document)` result across sync stages in `scanForPosts`
- [x] Add scan generation counter; discard stale async fetch results
- [x] Store `editedLabelClickHandler` reference; remove it and reset flag in `cleanupContentScript`
- [x] Clear `pendingOriginalText` in `cleanupContentScript`
- [x] Run full test suite — all green (415/415)
- [x] Commit and open PR

## Summary of Changes

- **One-pass post index**: `scanForPosts()` calls `findPosts(document)` exactly once and shares the `PostInfo[]` with all sub-functions, eliminating O(N×results) DOM rescans per cycle.
- **Scan generation counter** (`scanGeneration`): incremented each scan, passed into async sub-functions; stale results are discarded after every `await`.
- **Listener lifecycle**: `editedLabelClickHandler` stored in module scope; `cleanupContentScript()` removes the listener by reference and resets `editedLabelListenerAttached` + `pendingOriginalText`.
- **3 new tests**: findPosts-once assertion, listener-removed-on-cleanup, listener-reattached-after-restart.
- All 415 tests pass. TypeScript strict-mode clean.

Branch: refactor/b1jr-phase-3-scan-dedup-listener-lifecycle
PR: #65
