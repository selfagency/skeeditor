---
# skeeditor-p40f
title: 'Address PR #55 Copilot review comments'
status: in-progress
type: fix
priority: high
created_at: 2026-03-26T21:29:02Z
updated_at: 2026-03-26T21:29:06Z
---

Fix four issues flagged in Copilot review on PR #55.

## Todo

- [ ] Add PDS URL input to authenticated state for "Add another account" (fix hardcoded bsky.social)
- [ ] Validate DID format in AUTH_SWITCH_ACCOUNT + verify session exists before switching
- [ ] Validate DID format in AUTH_SIGN_OUT_ACCOUNT
- [ ] Optimize AUTH_LIST_ACCOUNTS: add listAll() to session-store for single-read account listing
- [ ] Update tests for all changes
- [ ] All tests green, typecheck clean
