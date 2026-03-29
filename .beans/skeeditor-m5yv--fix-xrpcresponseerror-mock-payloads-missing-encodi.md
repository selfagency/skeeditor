---
# skeeditor-m5yv
title: 'fix: XrpcResponseError mock payloads missing encoding field'
status: completed
type: bug
priority: high
created_at: 2026-03-29T18:13:26Z
updated_at: 2026-03-29T18:14:41Z
---

## Todo\n\n- [x] Add `encoding: 'application/json'` to all 6 XrpcResponseError mock payloads\n- [x] Run tests to confirm 3 failures are resolved (27/27 pass)\n- [x] Commit and push\n- [x] Open PR\n\n## Summary of Changes\n\nAdded `encoding: 'application/json'` to all 6 `XrpcResponseError` mock payloads in `test/unit/api/xrpc-client.test.ts`. The `@atproto/lex-client` library's `isXrpcErrorPayload()` requires this field to recognize a payload as a valid XRPC error body; without it the constructor falls back to a generic status-code message, causing 3 tests to fail.\n\nBranch: fix/m5yv-xrpc-mock-encoding\nPR: #68
