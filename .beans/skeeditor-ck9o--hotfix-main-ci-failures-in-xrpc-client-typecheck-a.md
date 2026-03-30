---
# skeeditor-ck9o
title: Hotfix main CI failures in xrpc-client typecheck and debounce test
status: completed
type: fix
priority: critical
created_at: 2026-03-30T19:24:49Z
updated_at: 2026-03-30T19:24:49Z
branch: fix/ck9o-main-ci-hotfix
pr: 85
---

Main branch CI is failing after merge with:
- TS2554 in src/shared/api/xrpc-client.ts listRecords call signature
- TS2375 exactOptionalPropertyTypes cursor assignment in ListRecordsResult
- unit test regression: test/unit/content/content-script-debounce.test.ts expecting one synchronous findPosts call

## Todo
- [x] Reproduce failures on current main locally
- [x] Fix listRecords call to match @atproto/lex client API
- [x] Fix cursor optional typing return shape for exactOptionalPropertyTypes
- [x] Fix/align debounce synchronous findPosts behavior or test setup
- [x] Run task typecheck and task test:coverage:ci
- [x] Commit and open hotfix PR

## Summary of Changes
- Replaced invalid `Client.call('com.atproto.repo.listRecords', ...)` usage with typed `Client.listRecords(...)` in `src/shared/api/xrpc-client.ts`.
- Ensured `ListRecordsResult.cursor` is only included when defined, fixing `exactOptionalPropertyTypes` assignment errors.
- Removed redundant synchronous `findPosts` scan by threading precomputed `posts` into `interceptArchivedPostButtons(...)` from `scanForPosts(...)`.
- Verified fixes with `task typecheck`, focused debounce unit test, and `task test:coverage:ci` (all green).
