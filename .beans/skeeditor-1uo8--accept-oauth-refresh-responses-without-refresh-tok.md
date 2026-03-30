---
# skeeditor-1uo8
title: Accept OAuth refresh responses without refresh_token
status: completed
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T15:13:51Z
parent: skeeditor-d3m1
branch: fix/1uo8-refresh-token-retention
---

`AUTH_GET_STATUS` currently expects a refreshed `refresh_token` even though many providers legally omit it. Preserve the existing refresh token when the response only returns a new access token.

## Todo
- [x] Add a failing test for access-token-only refresh responses
- [x] Update background refresh logic to retain the existing refresh token
- [x] Add coverage for malformed or partial refresh payloads
- [x] Verify existing refresh behavior still works when a new refresh token is returned

## Summary of Changes
- Updated the silent-refresh path in `src/background/message-router.ts` so `AUTH_GET_STATUS` accepts access-token-only refresh responses and preserves the stored refresh token when no new one is returned.
- Added regression coverage in `test/unit/background/message-router.test.ts` for access-token-only refresh responses and malformed partial refresh payloads.
- Re-ran the focused background message-router unit tests to confirm the new behavior and preserve the existing refresh flow.
