---
# skeeditor-t5lb
title: Harden timestamp setting and labeler protocol/runtime gaps
status: in-progress
type: task
priority: high
created_at: 2026-03-31T03:32:03Z
updated_at: 2026-03-31T03:32:03Z
parent: skeeditor-d3m1
branch: fix/t5lb-timestamp-labeler-hardening
---

Implement the reviewed March 2026 follow-up work for timestamp behavior hardening, client-side post validation, labeler service declaration, labeler DID/public-key consistency, reconnect cursor handling, and the remaining docs drift cleanup.

## Todo
- [ ] Harden timestamp setting behavior and coverage
- [ ] Add client-side post record validation
- [ ] Implement labeler service declaration and DID/public-key configuration fixes
- [ ] Add reconnect cursor tracking for labeler WebSocket
- [ ] Update the remaining stale docs and drift-guard coverage
- [ ] Run targeted lint/type/test verification
