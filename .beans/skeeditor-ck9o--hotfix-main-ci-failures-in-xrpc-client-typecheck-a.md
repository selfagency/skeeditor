---
# skeeditor-ck9o
title: Hotfix main CI failures in xrpc-client typecheck and debounce test
status: in-progress
type: fix
priority: critical
created_at: 2026-03-30T19:24:49Z
updated_at: 2026-03-30T19:24:49Z
branch: fix/ck9o-main-ci-hotfix
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
- [ ] Commit and open hotfix PR
