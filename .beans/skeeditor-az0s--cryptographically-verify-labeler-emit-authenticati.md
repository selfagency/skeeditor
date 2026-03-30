---
# skeeditor-az0s
title: Cryptographically verify labeler emit authentication
status: in-progress
type: bug
priority: critical
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T19:45:39Z
parent: skeeditor-d3m1
branch: fix/az0s-verify-labeler-emit-auth
---

The labeler currently accepts emit requests based on decoded bearer-token claims without cryptographic verification. Harden the labeler trust boundary so forged or tampered tokens cannot authorize label emission.

## Todo
- [ ] Add failing tests for forged or invalid emit auth
- [ ] Implement cryptographic verification for the emit auth path
- [ ] Ensure repo DID and authenticated subject checks still hold
- [ ] Update labeler service docs to match the final contract
- [ ] Run unit/integration tests for labeler auth paths
