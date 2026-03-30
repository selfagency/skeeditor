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
pr: 76
---

`AUTH_GET_STATUS` currently expects a refreshed `refresh_token` even though many providers legally omit it. Preserve the existing refresh token when the response only returns a new access token.

## Todo
- [x] Add a failing test for access-token-only refresh responses
- [x] Update background refresh logic to retain the existing refresh token
- [x] Add coverage for malformed or partial refresh payloads
- [x] Verify existing refresh behavior still works when a new refresh token is returned

## Summary of Changes
- Updated `src/background/message-router.ts` AUTH_GET_STATUS handler to accept OAuth refresh responses with only access_token
- Added fallback logic to preserve stored refresh_token when provider response omits it (per OAuth 2.0 spec §6)
- Added two regression tests in `test/unit/background/message-router.test.ts`:
  - "retains the existing refresh token when silent refresh returns only a new access token"
  - "returns unauthenticated when silent refresh response omits a usable access token"
- All 65+ tests pass in message-router suite; existing refresh behavior continues to work correctly
