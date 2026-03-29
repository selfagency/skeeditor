---
# skeeditor-b1jr
title: phase 3 dataflowperformance hardening content scri
status: in-progress
type: task
priority: high
created_at: 2026-03-29T16:49:11Z
updated_at: 2026-03-29T16:49:32Z
---

## Context
Phase 3 of the Unified Implementation Plan. Eliminates redundant DOM scans, adds scan-generation stale-result discarding, and fixes a listener lifecycle leak.

## Todo
- [ ] Write failing unit tests (RED): stale-fetch discard, editedLabel listener cleanup
- [ ] Build one-pass post index in `fetchEditedPostsInView` and `fetchOwnPostsInView` apply phases
- [ ] Accept optional pre-computed posts array in `applyEditedPostsFromCache`, `fetchOwnPostsInView`, `fetchPermalinkPost`
- [ ] Share a single `findPosts(document)` result across sync stages in `scanForPosts`
- [ ] Add scan generation counter; discard stale async fetch results
- [ ] Store `editedLabelClickHandler` reference; remove it and reset flag in `cleanupContentScript`
- [ ] Clear `pendingOriginalText` in `cleanupContentScript`
- [ ] Run full test suite — all green
- [ ] Commit and open PR
