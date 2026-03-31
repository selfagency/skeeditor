---
# skeeditor-t5lb
title: Harden timestamp setting and labeler protocol/runtime gaps
status: completed
type: task
priority: high
created_at: 2026-03-31T03:32:03Z
updated_at: 2026-03-31T04:10:00Z
parent: skeeditor-d3m1
branch: fix/t5lb-timestamp-labeler-hardening
pr: 94
---

Implement the reviewed March 2026 follow-up work for timestamp behavior hardening, client-side post validation, labeler service declaration, labeler DID/public-key consistency, reconnect cursor handling, and the remaining docs drift cleanup.

## Todo
- [x] Harden timestamp setting behavior and coverage
- [x] Add client-side post record validation
- [x] Address PR feedback on did-document Worker compatibility and fallback behavior
- [x] Add reconnect cursor tracking for labeler WebSocket
- [x] Update the remaining stale docs and drift-guard coverage
- [x] Re-run targeted verification and update PR metadata if needed

## Summary of Changes
- Added client-side `app.bsky.feed.post` validation before save, plus preserve/update timestamp coverage in content, options, and post-editor tests.
- Clarified timestamp tradeoff copy in the settings UI and developer docs so update-vs-preserve behavior matches product intent.
- Implemented `/xrpc/app.bsky.labeler.getServices`, moved DID document public-key publication off the hard-coded constant, and added explicit labeler service URL/public-key configuration.
- Added labeler WebSocket cursor persistence in the background service worker and a focused unit test for reconnect behavior.
- Updated labeler/privacy/platform docs and added docs drift-guard tests for the corrected guidance.
- Followed up on PR review by replacing CommonJS crypto loading in `did-document.ts` with an ESM import and adding fallback-to-`LABELER_PUBLIC_KEY_MULTIBASE` behavior when key derivation fails.
