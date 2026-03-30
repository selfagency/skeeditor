---
# skeeditor-wuj5
title: Fix pendingAuth TTL metadata mismatch in storage fallback
status: completed
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T21:59:03Z
parent: skeeditor-d3m1
---

Startup cleanup expects `pendingAuth.createdAt`, but the stored auth state currently omits that field. Make TTL cleanup real or simplify the flow so comments, code, and docs agree.

## Todo
- [x] Add a failing test for stale `pendingAuth` cleanup in local-storage fallback
- [x] Store the metadata needed for TTL cleanup or remove dead cleanup logic
- [x] Update auth docs/comments to reflect the real behavior
- [x] Re-run auth flow tests for storage.session and storage.local paths

## Summary of Changes
- Added startup cleanup tests for local-storage fallback in `test/unit/background/service-worker.test.ts`, including stale and missing-`createdAt` cases.
- Hardened fallback detection in `src/entrypoints/background.ts` with a `hasUsableSessionStorage()` guard.
- Updated startup cleanup to remove legacy local `pendingAuth` records that lack a numeric `createdAt`, and to remove records older than 5 minutes.
- Updated auth documentation in `docs/auth.md` and `docs/dev/auth.md` to match the actual `pendingAuth` lifecycle and fallback behavior.
- Verified with targeted auth/background unit tests:
  - `test/unit/background/message-router.test.ts`
  - `test/unit/background/service-worker.test.ts`
