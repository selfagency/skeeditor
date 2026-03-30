---
# skeeditor-wuj5
title: Fix pendingAuth TTL metadata mismatch in storage fallback
status: in-progress
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T21:17:48Z
parent: skeeditor-d3m1
branch: fix/wuj5-pendingauth-ttl-metadata-mismatch
pr: 88
---

Startup cleanup expects `pendingAuth.createdAt`, but the stored auth state currently omits that field. Make TTL cleanup real or simplify the flow so comments, code, and docs agree.

## Todo
- [ ] Add a failing test for stale `pendingAuth` cleanup in local-storage fallback
- [ ] Store the metadata needed for TTL cleanup or remove dead cleanup logic
- [ ] Update auth docs/comments to reflect the real behavior
- [ ] Re-run auth flow tests for storage.session and storage.local paths
