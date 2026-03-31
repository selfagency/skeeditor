---
# skeeditor-az0s
title: Cryptographically verify labeler emit authentication
status: in-progress
type: bug
priority: critical
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-31T13:27:51Z
parent: skeeditor-d3m1
---

The labeler currently accepts emit requests based on decoded bearer-token claims without cryptographic verification. Harden the labeler trust boundary so forged or tampered tokens cannot authorize label emission.

## Todo
- [x] Add failing tests for forged or invalid emit auth
- [x] Implement cryptographic verification for the emit auth path
- [x] Ensure repo DID and authenticated subject checks still hold
- [x] Update labeler service docs to match the final contract
- [x] Run unit/integration tests for labeler auth paths

## Summary of Changes
- Added a red/green unit test path for emit-auth subject consistency: reject when `com.atproto.server.getSession` returns HTTP 200 but `did` does not match JWT `sub`.
- Hardened `packages/labeler/src/auth.ts` to require session `did` equality with JWT `sub` after issuer-side signature verification.
- Updated `docs/plans/labeler.md` emit-auth contract to document the additional `getSession` subject check.
- Verified with:
  - `pnpm --filter @skeeditor/labeler test`
  - `pnpm --filter @skeeditor/labeler typecheck`
  - `task typecheck`
