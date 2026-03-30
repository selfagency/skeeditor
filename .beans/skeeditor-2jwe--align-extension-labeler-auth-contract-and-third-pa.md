---
# skeeditor-2jwe
title: Align extension-labeler auth contract and third-party token handling
status: completed
type: bug
priority: critical
branch: fix/2jwe-auth-contract-labeler
pr: 83
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
---

The extension forwards a bearer token to the labeler, while product docs claim tokens are never sent to third parties. Align implementation and trust boundaries so credential handling is explicit, justified, and secure.

## Todo
- [x] Write failing tests or assertions for the current emit contract
- [x] Decide and implement the supported auth contract between extension and labeler
- [x] Remove unnecessary token forwarding or document it accurately if retained
- [x] Verify successful edits still trigger labels correctly
- [x] Update user-facing auth/privacy docs

## Summary of Changes
- Added tests for the emit auth contract and token-forwarding behavior in background message-router flows.
- Implemented cryptographic bearer-token verification in labeler `/emit` auth by validating via the subject DID's PDS session endpoint.
- Aligned user-facing privacy/auth documentation with implementation details (including explicit disclosure of access-token forwarding to the labeler emit endpoint).
- Verified the edit flow still triggers label emission after successful record updates.
